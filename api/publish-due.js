// Was für später geplant war, und jetzt dran ist.
//
// Threads und Instagram kennen in ihrer API keinen geplanten Beitrag. Sie
// veröffentlichen sofort oder gar nicht. "Später" bei diesen Kanälen heißt
// deshalb: wir heben den Beitrag in `scheduled_posts` auf, und diese Funktion
// schickt ihn zur Zeit raus. Angestoßen von pg_cron alle fünf Minuten über
// pg_net, mit dem Geheimnis aus dem Vault, genau wie der Telegram-Anstoß.
//
// ── Warum sie nicht selbst mit Meta spricht ─────────────────────────────────
//
// Der ganze Weg zu einem Beitrag steht bereits in api/threads.js und
// api/instagram.js, geschrieben und geprüft. Ein zweiter Satz derselben Aufrufe
// hier wäre ein zweiter Ort, der beim nächsten Umbau zurückbleibt. Also ruft
// diese Funktion dieselben Endpunkte auf wie der Browser, nur mit
// `x-i7-hook-secret` statt einer Anmeldung: den Kopf kennt nur die Datenbank.
//
// ── Warum sie in Takten arbeitet ────────────────────────────────────────────
//
// Ein Video rechnet Meta erst um, und das dauert länger, als eine Edge-Funktion
// leben darf. Der Browser fragt deshalb so lange nach, wie es dauert; hier gibt
// es keinen Browser. Also merkt sich die Zeile, welche Container schon gebaut
// sind, und der nächste Takt fragt sie nur noch ab, statt sie neu zu bauen. Ein
// zweiter Container wäre ein zweiter Beitrag.
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// Wieviel Zeit sich ein Durchgang nimmt, bevor er den Rest dem nächsten Takt
// überlässt. Die Grenze der Funktion liegt bei 25 Sekunden.
const BUDGET_MS = 18000;
const MAX_ATTEMPTS = 12;

export default async function handler(req) {
  const url = new URL(req.url);
  const secret = process.env.PUBLISH_SECRET || "";
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");

  if (url.searchParams.get("check")) {
    return new Response(JSON.stringify({
      configured: !!secret,
      missing: secret ? [] : ["PUBLISH_SECRET"],
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=30" } });
  }

  if (!secret) return json({ error: "PUBLISH_SECRET is not set", code: "not_configured" }, 503);
  if ((req.headers.get("x-i7-hook-secret") || "") !== secret) return json({ error: "forbidden" }, 403);

  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supaUrl || !serviceKey) return json({ error: "Server not configured", code: "not_configured" }, 503);
  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const started = Date.now();
  const left = () => BUDGET_MS - (Date.now() - started);

  const { data: rows, error } = await db.from("scheduled_posts")
    .select("*")
    .in("status", ["queued", "processing"])
    .lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: true })
    .limit(3);
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ due: 0 });

  // Einer der Endpunkte, mit dem internen Kopf statt einer Anmeldung.
  const call = (what, payload) => fetch(`${appUrl}/api/${what}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-i7-hook-secret": secret },
    body: JSON.stringify(payload),
  }).then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => null) }))
    .catch((e) => ({ ok: false, status: 0, j: { error: String(e?.message || e) } }));

  const save = (id, patch) => db.from("scheduled_posts")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);

  // Welche Kanaele nicht bei Meta liegen, sondern bei Zernio. Eine Menge und
  // keine Abfrage auf "linkedin", damit der naechste Kanal von dort nur hier
  // eingetragen werden muss.
  const ZERNIO_PROVIDERS = new Set(["linkedin", "facebook", "x", "tiktok", "youtube", "pinterest"]);

  // Ein Medium aus unserem Speicher in Zernios Speicher. Signierte Adresse,
  // Bytes holen, Platz bei Zernio erfragen, hochladen, deren Adresse behalten.
  const toZernio = async (orgId, m) => {
    try {
      const { data: sign } = await db.storage.from(m.bucket || "brand-assets")
        .createSignedUrl(m.path, 600);
      if (!sign?.signedUrl) return { ok: false, error: "Media is gone" };
      const file = await fetch(sign.signedUrl);
      if (!file.ok) return { ok: false, error: `Media read ${file.status}` };
      const bytes = await file.arrayBuffer();
      const contentType = file.headers.get("content-type") || "application/octet-stream";
      const filename = String(m.path).split("/").pop() || "media";
      const pre = await call("zernio", { mode: "presign", orgId, filename, contentType, size: bytes.byteLength });
      if (!pre.ok || !pre.j?.uploadUrl) return { ok: false, error: pre.j?.error || `Zernio presign ${pre.status}` };
      const put = await fetch(pre.j.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes });
      if (!put.ok) return { ok: false, error: `Zernio upload ${put.status}` };
      return { ok: true, item: {
        type: String(m.kind || "").toUpperCase() === "VIDEO" ? "video" : "image",
        url: pre.j.publicUrl, filename,
      } };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  };

  const done = [];

  for (const row of rows) {
    if (left() < 3000) break;
    const media = Array.isArray(row.media) ? row.media : [];
    const targets = Array.isArray(row.targets) ? row.targets : [];
    const state = (row.containers && typeof row.containers === "object") ? { ...row.containers } : {};
    const results = Array.isArray(row.result?.platforms) ? [...row.result.platforms] : [];
    const attempts = (row.attempts || 0) + 1;

    // Aufgegeben wird nur, wenn es wirklich nicht mehr weitergeht: ein Video
    // darf eine Stunde brauchen, ein kaputter Beitrag nicht ewig wiederkommen.
    if (attempts > MAX_ATTEMPTS) {
      await save(row.id, { status: "failed", attempts,
        last_error: row.last_error || "Gave up after too many attempts" });
      done.push({ id: row.id, status: "failed" });
      continue;
    }
    await save(row.id, { status: "processing", attempts });

    let pending = false;
    for (const t of targets) {
      const key = `${t.provider}:${t.threadsUserId || t.igUserId || t.accountId || ""}`;
      if (results.some(r => r.key === key)) continue;      // schon erledigt
      if (left() < 3000) { pending = true; break; }

      // ── Was ueber Zernio geht (LinkedIn und die anderen dort) ──────────
      //
      // Ein Weg, nicht zwei: derselbe Endpunkt, den der Composer benutzt, nur
      // mit dem internen Kopf statt einer Anmeldung. Zernio nimmt keine Bytes
      // und auch keine fremde Adresse, sondern eine aus dem eigenen Speicher,
      // also wird jedes Medium erst dorthin gelegt. Ein geplanter Beitrag ist
      // bei Zernio ein Aufruf und kein Takt: es gibt nichts abzufragen.
      if (ZERNIO_PROVIDERS.has(t.provider)) {
        const zfail = (error) => results.push({ key, platform: t.provider, status: "failed", url: null, error });
        if (!t.accountId) { zfail("No account id"); continue; }
        let items = [];
        let broke = null;
        for (const m of media) {
          const up = await toZernio(row.org_id, m);
          if (!up.ok) { broke = up.error; break; }
          items.push(up.item);
        }
        if (broke) { zfail(broke); continue; }
        const r = await call("zernio", {
          mode: "post", orgId: row.org_id,
          content: row.body || undefined,
          platforms: [{ platform: t.provider, accountId: t.accountId }],
          mediaItems: items.length ? items : undefined,
        });
        const one = (r.j?.platforms || [])[0];
        results.push({ key, platform: t.provider,
          status: r.ok && one?.status !== "failed" ? "published" : "failed",
          url: one?.url || null,
          error: r.ok ? (one?.error || null) : (r.j?.error || `Zernio ${r.status}`) });
        continue;
      }

      const isThreads = t.provider === "threads";
      const what = isThreads ? "threads" : "instagram";
      const who = isThreads ? "Threads" : "Instagram";
      const base = { orgId: row.org_id, ...(isThreads ? { threadsUserId: t.threadsUserId } : { igUserId: t.igUserId }) };
      const st = state[key] || {};
      const fail = (error) => results.push({ key, platform: what, status: "failed", url: null, error });

      // Ist ein Container schon fertig, wird er nur noch veröffentlicht.
      const finish = async (containerId) => {
        const r = await call(what, { ...base, mode: "publish-finish", containerId });
        if (r.status === 202) return false;                 // rechnet noch
        results.push({ key, platform: what, status: r.ok ? "published" : "failed",
          url: r.j?.url || null, error: r.ok ? null : (r.j?.error || `${who} ${r.status}`) });
        return true;
      };

      if (st.parent) { if (!await finish(st.parent)) { pending = true; } continue; }

      // Eine Story ist genau ein Medium, also nie ein Karussell.
      const story = isThreads ? false : !!t.story;

      // ── Karussell: Folie für Folie, und jede überlebt den Takt ──
      if (media.length > 1 && !story) {
        const children = Array.isArray(st.children) ? [...st.children] : [];
        let broke = null;
        for (let i = 0; i < media.length; i++) {
          if (left() < 4000) { pending = true; break; }
          if (!children[i]) {
            const r = await call(what, isThreads
              ? { ...base, mode: "child", media: media[i] }
              : { ...base, mode: "container", media: media[i], isCarouselItem: true });
            if (!r.ok || !r.j?.containerId) { broke = r.j?.error || `${who} ${r.status}`; break; }
            children[i] = r.j.containerId;
            state[key] = { ...st, children };
            await save(row.id, { containers: state });
          }
          const s = await call(what, { ...base, mode: "container-status", containerId: children[i] });
          if (s.j?.status === "error") { broke = s.j.error || `${who}: slide ${i + 1}`; break; }
          if (s.j?.status !== "ready") { pending = true; break; }
        }
        if (broke) { fail(broke); continue; }
        if (pending) break;
        const par = await call(what, isThreads
          ? { ...base, mode: "carousel", children, text: row.body || undefined }
          : { ...base, mode: "container", kind: "CAROUSEL", children, caption: row.body || undefined });
        if (!par.ok || !par.j?.containerId) { fail(par.j?.error || `${who} ${par.status}`); continue; }
        state[key] = { ...(state[key] || {}), children, parent: par.j.containerId };
        await save(row.id, { containers: state });
        if (!await finish(par.j.containerId)) pending = true;
        continue;
      }

      // ── Ein Bild, ein Video, oder bei Threads auch nur Text ──
      if (isThreads) {
        const r = await call("threads", { ...base, mode: "publish", text: row.body || undefined, media });
        if (r.status === 202 && r.j?.containerId) {
          state[key] = { parent: r.j.containerId };
          await save(row.id, { containers: state });
          pending = true;
          continue;
        }
        results.push({ key, platform: "threads", status: r.ok ? "published" : "failed",
          url: r.j?.url || null, error: r.ok ? null : (r.j?.error || `Threads ${r.status}`) });
        continue;
      }

      if (!media.length) { fail("Instagram needs an image or a video"); continue; }
      const isVideo = String(media[0]?.kind || "").toUpperCase() === "VIDEO";
      const r = await call("instagram", { ...base, mode: "container", media: media[0],
        // In der Story gibt es keine Bildunterschrift, und ein Video ist dort
        // kein Reel, sondern eine Story mit Bewegtbild.
        kind: story ? "STORIES" : isVideo ? "REELS" : "IMAGE",
        caption: story ? undefined : (row.body || undefined) });
      if (!r.ok || !r.j?.containerId) { fail(r.j?.error || `Instagram ${r.status}`); continue; }
      state[key] = { parent: r.j.containerId };
      await save(row.id, { containers: state });
      if (!await finish(r.j.containerId)) pending = true;
    }

    const allDone = targets.every(t => results.some(r => r.key === `${t.provider}:${t.threadsUserId || t.igUserId || t.accountId || ""}`));
    if (allDone && !pending) {
      const anyOk = results.some(r => r.status === "published");
      await save(row.id, {
        status: anyOk ? "done" : "failed",
        result: { platforms: results },
        last_error: anyOk ? null : (results.find(r => r.error)?.error || null),
        containers: {},
      });
      done.push({ id: row.id, status: anyOk ? "done" : "failed" });
    } else {
      await save(row.id, { status: "processing", result: { platforms: results }, containers: state });
      done.push({ id: row.id, status: "processing" });
    }
  }

  return json({ due: rows.length, handled: done });
}
