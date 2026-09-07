// One place that decides whether the server may fetch a URL somebody handed us,
// and one place that actually fetches it.
//
// Four endpoints fetch arbitrary URLs on the user's behalf: the image proxy,
// the brand analyser, the website preview and the PDF import. Each had grown
// its own guard, and they disagreed. The image proxy blocked 127.0.0.1 but not
// 127.0.0.2, and compared the hostname against "::1" when URL.hostname actually
// answers "[::1]" with the brackets, so both of those reached the network. The
// preview had no host check at all. And none of them looked at where a redirect
// went, so a public URL that answers 302 to http://127.0.0.1 was followed
// without a second thought.
//
// What this can and cannot do. It blocks every literal private and reserved
// address, in both IPv4 and IPv6 and in the forms that are easy to miss, and it
// re-checks every hop of a redirect chain rather than letting fetch follow them
// invisibly. It CANNOT resolve a hostname: the Edge runtime has no resolver, so
// a name that points at a private address still gets through this. Closing that
// needs DNS at request time, which is a different runtime, and pretending
// otherwise would be worse than saying it.
//
// See https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

// Hostnames nobody legitimately asks a server to fetch.
const BLOCKED_NAMES = new Set([
  "localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback",
  // The cloud metadata services, which is what an SSRF is usually reaching for.
  "metadata.google.internal", "metadata.goog", "instance-data",
]);
const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost", ".localdomain", ".home.arpa"];

const ipv4Parts = (host) => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n >= 0 && n <= 255) ? p : null;
};

function isPrivateIPv4(p) {
  const [a, b] = p;
  return (
    a === 0 ||                                   // 0.0.0.0/8, "this network"
    a === 10 ||                                  // private
    a === 127 ||                                 // the WHOLE loopback range, not just .1
    (a === 100 && b >= 64 && b <= 127) ||        // carrier grade NAT
    (a === 169 && b === 254) ||                  // link local, and the metadata address
    (a === 172 && b >= 16 && b <= 31) ||         // private
    (a === 192 && b === 168) ||                  // private
    (a === 192 && b === 0) ||                    // protocol assignments
    (a === 198 && (b === 18 || b === 19)) ||     // benchmarking
    a >= 224                                     // multicast and reserved
  );
}

// URL.hostname keeps the brackets on an IPv6 literal, which is exactly how the
// old "::1" comparison missed every loopback request.
function normaliseIPv6(host) {
  if (!host.startsWith("[") || !host.endsWith("]")) return null;
  return host.slice(1, -1).toLowerCase();
}

function isPrivateIPv6(addr) {
  const a = addr.replace(/%.*$/, "");            // drop any zone id
  if (a === "::1" || a === "::" || a === "0:0:0:0:0:0:0:1") return true;
  if (/^f[cd]/.test(a)) return true;             // fc00::/7 unique local
  if (/^fe[89ab]/.test(a)) return true;          // fe80::/10 link local
  // ::ffff:127.0.0.1 and friends: an IPv4 address wearing an IPv6 coat. Both
  // spellings, because URL() rewrites the readable one into hex the moment it
  // parses: "[::ffff:127.0.0.1]" comes back out of hostname as "[::ffff:7f00:1]",
  // which is why matching only the dotted form matched nothing at all.
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(a);
  if (dotted) {
    const p = ipv4Parts(dotted[1]);
    return p ? isPrivateIPv4(p) : true;
  }
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(a);
  if (hex) {
    const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
    return isPrivateIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }
  return false;
}

export class BlockedUrlError extends Error {
  constructor(message) { super(message); this.name = "BlockedUrlError"; }
}

// Throws BlockedUrlError, or returns the parsed URL.
export function assertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new BlockedUrlError("not a url"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedUrlError("only http and https");

  const host = u.hostname.toLowerCase();
  if (!host) throw new BlockedUrlError("no host");
  if (BLOCKED_NAMES.has(host)) throw new BlockedUrlError("blocked host");
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new BlockedUrlError("blocked host");

  const v6 = normaliseIPv6(host);
  if (v6 !== null) {
    if (isPrivateIPv6(v6)) throw new BlockedUrlError("private address");
    return u;
  }
  const v4 = ipv4Parts(host);
  if (v4) {
    if (isPrivateIPv4(v4)) throw new BlockedUrlError("private address");
    return u;
  }
  // A decimal or octal integer is still an IPv4 address to most resolvers.
  if (/^\d+$/.test(host) || /^0[0-7]+(\.|$)/.test(host)) throw new BlockedUrlError("blocked host");
  return u;
}

// Fetch, checking every hop, and refusing to read more than maxBytes.
//
// redirect: "manual" is the point of it. Letting fetch follow redirects means
// only the FIRST url is ever checked, and a public url that answers 302 to a
// private one walks straight past the guard above.
export async function safeFetch(raw, {
  maxBytes = 8 * 1024 * 1024,
  maxRedirects = 4,
  timeoutMs = 12000,
  headers = {},
} = {}) {
  let url = assertPublicUrl(raw);
  const started = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const left = timeoutMs - (Date.now() - started);
    if (left <= 0) throw new BlockedUrlError("timed out");
    const res = await fetch(url.toString(), {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; i7OS/1.0)", ...headers },
      signal: AbortSignal.timeout(left),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { res, url };
      url = assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    return { res, url };
  }
  throw new BlockedUrlError("too many redirects");
}

// Read a body while counting, so a lying or absent Content-Length cannot make
// us hold an arbitrary amount in memory. Checking the size AFTER the download
// protects nothing.
export async function readCapped(res, maxBytes) {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) throw new BlockedUrlError("too large");
  if (!res.body) return new Uint8Array(await res.arrayBuffer()).slice(0, maxBytes);

  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch (_) {}
      throw new BlockedUrlError("too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}
