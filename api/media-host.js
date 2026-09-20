// Wo eine große Datei wartet, während Meta sie sich abholt.
//
// Instagram und Threads nehmen keine Bytes entgegen, nur eine URL, die sie
// selbst aufrufen. Der normale Weg dafür ist unser Supabase-Speicher, und der
// steht auf dem kostenlosen Plan: 50 MB je Objekt, nicht verhandelbar. Ein
// Video ist schnell größer, Meta selbst nähme knapp ein Gigabyte.
//
// Also gibt es eine Ausweichspur: ein winziges PHP-Skript auf dem eigenen
// Webspace des Betreibers (docs/media-relay.md). Der Browser lädt die Datei
// dort in Stücken ab, Meta holt sie von dort, und nach dem Posten fliegt sie
// wieder runter. Diese Funktion ist die Türsteherin davor. Sie unterschreibt
// kurzlebige Tickets, damit nicht jeder auf fremdem Webspace ablegen kann.
//
// Die BYTES gehen hier nicht durch. Eine halbe Gigabyte durch eine Edge-
// Funktion zu schieben ist ein Timeout mit Ansage, dieselbe Lehre wie bei
// TikToks Upload: der Browser spricht direkt mit dem Ziel.
//
// Edge → zählt nicht gegen das Hobby-Limit von 12 Node-Funktionen, das bei 12
// von 12 steht. Eine Node-Funktion hier würde das Deployment sprengen.
//
// Verben:
//   GET  ?check=1        → konfiguriert? und was das Skript drüben meldet
//   POST { mode: "sign", orgId, ext } → { uploadUrl, id, exp, token, publicUrl }
//   POST { mode: "drop", orgId, id, ext } → Datei drüben löschen
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// 4 MB je Stück. Klein genug, dass jedes Shared Hosting es annimmt (PHP steht
// oft auf 8 MB je Anfrage), groß genug, dass ein 500-MB-Video nicht in
// tausend Anfragen zerfällt.
const PART_BYTES = 4 * 1024 * 1024;
const MAX_BYTES = 1024 * 1024 * 1024;
// Eine Stunde. So lange darf das Hochladen dauern, nicht länger gilt das Ticket.
const TICKET_SECONDS = 3600;
const EXT_OK = new Set(["mp4", "mov", "m4v", "jpg", "jpeg", "png", "webp", "gif"]);

const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

async function ticket(secret, id, ext, exp) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}|${ext}|${exp}`)));
}

// Das Skript legt neben sich einen Ordner "files", und genau so wird die
// öffentliche Adresse gebildet. Beide Seiten rechnen dasselbe, damit keine
// zweite Einstellung auseinanderlaufen kann.
const publicBase = (relay) => relay.replace(/\/[^/]*$/, "") + "/files";

export default async function handler(req) {
  const url = new URL(req.url);
  const relay = (process.env.MEDIA_HOST_URL || "").trim().replace(/\?.*$/, "");
  const secret = process.env.MEDIA_HOST_SECRET || "";
  const configured = !!(relay && secret.length >= 16);

  // Namen dessen, was fehlt, niemals Werte.
  if (url.searchParams.get("check")) {
    let reported = null;
    if (relay) {
      try {
        const r = await fetch(`${relay}?check=1`, { cache: "no-store" });
        reported = await r.json().catch(() => ({ error: `http_${r.status}` }));
      } catch (e) { reported = { error: String(e?.message || e) }; }
    }
    return new Response(JSON.stringify({
      configured,
      missing: [!relay && "MEDIA_HOST_URL", secret.length < 16 && "MEDIA_HOST_SECRET"].filter(Boolean),
      maxBytes: MAX_BYTES,
      partBytes: PART_BYTES,
      base: relay ? publicBase(relay) : null,
      relay: reported,
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=30" } });
  }

  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!configured) return json({ error: "Media relay is not configured", code: "not_configured" }, 503);

  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId;
  if (!orgId) return json({ error: "orgId is required" }, 400);

  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supaUrl || !serviceKey) return json({ error: "Server not configured", code: "not_configured" }, 503);
  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Ein Ticket bekommt nur, wer in diesem Workspace ist. Eine orgId im Body
  // beweist nichts, die steht in jedem Freigabelink.
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Not signed in", code: "unauthenticated" }, 401);
  const { data: who } = await db.auth.getUser(bearer);
  const userId = who?.user?.id;
  if (!userId) return json({ error: "Not signed in", code: "unauthenticated" }, 401);
  const { data: member } = await db.from("org_members")
    .select("user_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  if (!member) return json({ error: "Not a member of this workspace", code: "forbidden" }, 403);

  const ext = String(body.ext || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!EXT_OK.has(ext)) return json({ error: "Unsupported file type", code: "bad_ext" }, 400);

  if (body.mode === "sign") {
    const id = crypto.randomUUID().replace(/-/g, "");
    const exp = Math.floor(Date.now() / 1000) + TICKET_SECONDS;
    return json({
      uploadUrl: relay,
      publicUrl: `${publicBase(relay)}/${id}.${ext}`,
      id, ext, exp,
      token: await ticket(secret, id, ext, exp),
      partBytes: PART_BYTES,
      maxBytes: MAX_BYTES,
    });
  }

  // Aufgeräumt wird, sobald Meta die Datei hat. Das Skript drüben räumt nach
  // einem Tag ohnehin auf, aber ein Video soll nicht einen Tag lang öffentlich
  // herumliegen, nur weil es gepostet wurde.
  if (body.mode === "drop") {
    const id = String(body.id || "").replace(/[^a-f0-9]/g, "");
    if (id.length !== 32) return json({ error: "bad_id" }, 400);
    const exp = Math.floor(Date.now() / 1000) + 300;
    const q = new URLSearchParams({ drop: "1", id, ext, exp: String(exp), token: await ticket(secret, id, ext, exp) });
    try {
      const r = await fetch(`${relay}?${q}`, { method: "POST", body: "x" });
      return json({ ok: r.ok });
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) });
    }
  }

  return json({ error: "Unknown mode" }, 400);
}
