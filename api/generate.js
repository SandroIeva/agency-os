// AI image generation through Pixazo.
//
// Edge runtime → does NOT count against the Hobby plan's 12 Node functions,
// which are full. Two modes in one file for the same reason.
//
//   { mode: "submit", orgId, model, prompt }  → { jobId, status, ... }
//   { mode: "status", orgId, jobId }          → { status, url?, error? }
//
// WHY A JOB AND NOT A PLAIN PROXY
// Pixazo answers nearly every model asynchronously: submit returns a request id
// and the picture arrives seconds to minutes later. A function cannot wait that
// long, so the work outlives the request — and the browser, since people close
// tabs. The row in generation_jobs is both the progress record and the record of
// what we owe.
//
// Some models may answer synchronously with the image in the submit response.
// Rather than guess which, both shapes are handled: an image in the answer is
// taken immediately, an id is polled. That is also insurance against the
// provider changing which models are which.
import { createClient } from "@supabase/supabase-js";
import { PLAN_ENTITLEMENTS, limitsFor, resolveEntitlements } from "../src/entitlements.js";

export const config = { runtime: "edge" };

const GATEWAY = "https://gateway.pixazo.ai";
const ASSET_BUCKET = "user-files";

// One credit is a tenth of a cent of provider cost. Everything the customer sees
// is credits; micro-USD stays internal, as the record of what we actually paid.
//
// Every generation costs at least one credit, including the models that cost us
// nothing. Otherwise "your credits are used up" would be untrue — a free model
// would still generate — and the provider throttles those anyway, so unlimited
// was never on offer.
const CREDIT_MICRO_USD = 1000;
const creditsFor = (microUsd) => Math.max(1, Math.ceil(microUsd / CREDIT_MICRO_USD));

// Per-model: where it lives and what it costs, in micro-USD per image.
// One table, because a price that appears twice eventually disagrees with
// itself. Prices from Pixazo's published rates — when they change, they change
// HERE and nowhere else.
// `body` builds the request: the models do not share a request shape any more
// than they share an endpoint. GPT Image 2 in particular is priced by size AND
// quality, so those are pinned here — asking for the cheap variant is what makes
// the price below true. Every model whose price depends on a dimension pins that
// dimension for the same reason: a price that rests on somebody else's default
// is a price that can change while this file stays untouched.
//
// WHERE THE NUMBERS COME FROM, and how to check them again. Each price is the
// published rate for THIS endpoint at THIS setting. They move: Nano Banana 2
// went from $0.070 to $0.084 per image between two readings, and for a while we
// billed 71 credits for something that cost 84. Read the tables, do not assume.
//
//   flux-1-schnell, flux-2-klein, flux-pro   pixazo.ai/models/flux
//   gpt-image-2                              pixazo.ai/models/gpt-image
//   nano-banana-2, nano-banana-pro           pixazo.ai/models/nano-banana
//
// On each page the price table sits at the END of an endpoint's section, just
// before the next heading — read the one AFTER the endpoint you care about, not
// the one above it. All six last verified 2026-09-06.
//
// Listed cheapest first; the dialog renders them in this order.
const MODELS = {
  "flux-1-schnell": {
    path: "/flux-1-schnell/v1/getData", microUsd: 0, label: "Flux Schnell",
    body: (prompt) => ({ prompt }),
  },
  "flux-2-klein": {
    // Priced per pixel count: $0.0003 at 512², $0.0007 at 1024², $0.0014 at
    // 1448², $0.0028 at 2048². The size used to be left to the provider's
    // default, which made the number below a guess about somebody else's
    // config; 1024² is pinned so it is a fact. Still one credit either way,
    // but a price nobody can state is a price that drifts unnoticed.
    path: "/flux-2-klein-4b/v1/generateImage", microUsd: 700, label: "Flux 2 Klein",
    body: (prompt) => ({ prompt, width: 1024, height: 1024 }),
  },
  "gpt-image-2": {
    path: "/gpt-image-2/v1/text-to-image", microUsd: 5000, label: "GPT Image 2",
    // 1536x1024 at low quality is the $0.005 tier. Medium at the same size is
    // eight times that, so the two fields are not cosmetic.
    body: (prompt) => ({ prompt, image_size: "1536x1024", quality: "low", num_images: 1, output_format: "png" }),
  },
  "flux-pro": {
    path: "/flux-pro/v1/pro/textToImage", microUsd: 40000, label: "FLUX Pro",
    body: (prompt) => ({ prompt }),
  },
  "nano-banana-2": {
    // Priced per resolution — $0.063 at 0.5K, $0.084 at 1K, $0.126 at 2K,
    // $0.168 at 4K. The documented default is 1K, but it is pinned anyway: a
    // price that depends on someone else's default is a price that can change
    // without us touching anything. num_images is pinned for the same reason —
    // it bills per image, and defaults are not promises.
    // Was 70350 here, from the earlier published rate of $0.070. Pixazo raised
    // it and this file did not follow, so every picture cost us a fifth more
    // than it billed. That is the whole reason the source pages are named above.
    path: "/nano-banana-2/v1/text-to-image", microUsd: 84000, label: "Nano Banana 2",
    body: (prompt) => ({ prompt, resolution: "1K", num_images: 1, output_format: "png" }),
  },
  "nano-banana-pro": {
    // Gemini 3 Pro Image, the dearest thing on the list. Pixazo prices it
    // 1K $0.1407, 2K $0.1407, 4K $0.252 — one and two K cost THE SAME, so
    // asking for 1K would mean paying for two and receiving one. Hence 2K.
    // Four K is nearly double and is not what a file manager needs.
    //
    // output_format is deliberately absent: the documentation marks it
    // "accepted but ignored", the model returns JPEG whatever is asked. Sending
    // "png" would be a request that reads like a promise and is not one — and
    // persistImage sniffs the real bytes anyway, so the file is filed by what
    // it IS rather than by what was ordered.
    path: "/nano-banana-pro/v1/text-to-image", microUsd: 140700, label: "Nano Banana Pro",
    body: (prompt) => ({ prompt, resolution: "2K", num_images: 1 }),
  },
};
// GPT Image 2, not the free model. Flux Schnell's getData is undocumented and,
// measured against the live service, does not answer within twenty seconds nor
// hand back a request id — it appears to generate synchronously, which no Edge
// function can wait out. The documented asynchronous models answer at once with
// an id, which is what this design is built around. Schnell stays in the list
// but must not be what a first-time user meets.
const DEFAULT_MODEL = "gpt-image-2";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const admin = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);

// The caller, from their bearer token. Everything else hangs off this: an
// unauthenticated request must never reach the provider, because every call
// costs money even when it fails to produce anything useful.
async function requireUser(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data?.user || null;
}

async function isMember(db, userId, orgId) {
  const { data } = await db.from("org_members").select("user_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

// The allowance, and what is left of it this calendar month.
//
// Calendar month, not billing period: "full again on the first" needs no
// explanation, and the alternative reads differently for every customer.
//
// Only COMPLETED jobs count. A generation that failed produced nothing, and
// charging for it would be charging for our own bad day.
async function remainingCredits(db, orgId) {
  const { data: org } = await db.from("organizations").select("created_by").eq("id", orgId).maybeSingle();
  const owner = org?.created_by;
  if (!owner) return { limit: 0, used: 0, left: 0 };

  const { data: account } = await db.from("billing_accounts").select("*").eq("owner_user_id", owner).maybeSingle();
  const limit = resolveEntitlements(account).limits.imageCredits ?? 0;

  // Asked of the database, not counted here, because reserve_image_credits has
  // to answer the same question a millisecond later and the number the dialog
  // shows must be the number the gate uses. Two sums drift.
  //
  // What it counts: this account's jobs, not just this workspace's. The plan
  // belongs to whoever created the workspace and pools storage and seats
  // across everything they own; the image allowance was the one that did not,
  // so three workspaces quietly meant three times the credits. And a job
  // counts from the moment it STARTS rather than when it finishes, which is
  // what stops five quick clicks spending the same remainder five times.
  const { data: usedRaw, error: usedErr } = await db.rpc("image_credits_used", { p_org: orgId });
  if (usedErr) throw new Error(`could not read the credit balance: ${usedErr.message}`);
  const used = Number(usedRaw || 0);
  return { limit, used, left: Math.max(0, limit - used) };
}

// Every outbound call is time-boxed well inside the platform's own limit.
//
// An Edge function is killed at ~25s and the caller gets a bare 504 — no JSON,
// no job id, nothing to act on. Cutting the call off ourselves turns that into
// an answer we control, and leaves room to record the failure before the
// function ends.
// Close to the platform ceiling, with room left to record the failure. A model
// that answers synchronously needs every second it can get.
const PIXAZO_SUBMIT_MS = 20000;
const PIXAZO_STATUS_MS = 8000;
const DOWNLOAD_MS = 10000;

const pixazo = (path, body, ms = PIXAZO_SUBMIT_MS, extraHeaders = {}) => fetch(GATEWAY + path, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": process.env.PIXAZO_API_KEY || "",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(ms),
});

// Pull an image URL out of whatever shape came back.
//
// The first version looked in a fixed list of field names and missed: the
// provider reported COMPLETED and the picture was somewhere this did not think
// to look, so the job spun until the client gave up. Guessing field names was
// the mistake — this walks the entire payload instead and judges the VALUES.
//
// Anything that is not the polling URL and looks like an image wins; failing
// that, any remaining http(s) string, since a completed job's payload has very
// little else in it.
function findImage(payload) {
  const urls = [];
  const seen = new Set();
  const walk = (node, depth = 0) => {
    if (node == null || depth > 8) return;
    if (typeof node === "string") {
      if (/^data:image\//.test(node)) urls.push({ url: node, image: true });
      else if (/^https?:\/\//.test(node) && !node.includes("/requests/status/")) {
        urls.push({ url: node, image: /\.(png|jpe?g|webp|gif|avif|bmp)(\?|$)/i.test(node) });
      }
      return;
    }
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (seen.has(v) ) continue;
        if (v && typeof v === "object") seen.add(v);
        // Never mistake the provider's own plumbing for the result.
        if (/^(polling_url|pollingUrl|webhook|callback)/i.test(k)) continue;
        walk(v, depth + 1);
      }
    }
  };
  walk(payload);
  if (!urls.length) return null;
  return (urls.find(u => u.image) || urls[0]).url;
}

const findRequestId = (p) => p?.request_id || p?.requestId || p?.id || null;
const findPollingUrl = (p) => p?.polling_url || p?.pollingUrl || null;

// Store the picture ourselves. The provider's link expires and points at their
// infrastructure; an asset in a moodboard has to still be there next year.
// A picture is only a picture if it looks like one. A provider can answer with
// an error page, an expired link or a JSON body, and every one of those
// downloads perfectly happily — the status code says nothing about the
// content. The bytes decide, and they also decide the extension, so a PNG
// never gets filed as a .jpg because a header said so.
const IMAGE_MAGIC = [
  { ext: "png",  type: "image/png",  head: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "jpg",  type: "image/jpeg", head: [0xff, 0xd8, 0xff] },
  { ext: "gif",  type: "image/gif",  head: [0x47, 0x49, 0x46, 0x38] },
  { ext: "webp", type: "image/webp", head: [0x52, 0x49, 0x46, 0x46], at8: [0x57, 0x45, 0x42, 0x50] },
];
function sniffImage(buf) {
  const b = new Uint8Array(buf || new ArrayBuffer(0));
  for (const m of IMAGE_MAGIC) {
    if (m.head.every((v, i) => b[i] === v) && (!m.at8 || m.at8.every((v, i) => b[8 + i] === v))) return m;
  }
  return null;
}

async function persistImage(db, { url, userId }) {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_MS) });
  if (!res.ok) throw new Error(`could not fetch generated image (${res.status})`);
  const buf = await res.arrayBuffer();

  const kind = sniffImage(buf);
  if (!kind) {
    const head = new TextDecoder().decode(buf.slice(0, 200)).replace(/\s+/g, " ").trim();
    throw new Error(`the image service returned no image${head ? `: ${head.slice(0, 140)}` : ""}`);
  }

  // Same bucket as every other asset. They are assets — putting them somewhere
  // else meant the app's own delete looked in the wrong place, removed the row
  // and left the file behind.
  // <user_id>/ai-generated/… is the layout the policies already describe: the
  // storage rules key on the first folder being the owner, and user_files lets
  // org members see a row whose path contains /creations/ or /ai-generated/.
  // Written under generated/<org_id>/ instead, a picture was readable by nobody
  // and visible to no colleague — while the workspace paid for it.
  const path = `${userId}/ai-generated/${crypto.randomUUID()}.${kind.ext}`;
  const { error } = await db.storage.from(ASSET_BUCKET).upload(path, buf, { contentType: kind.type });
  if (error) throw new Error(error.message);

  // user-files is a PRIVATE bucket, so only a signed link works — the same
  // year-long signature the Assets upload path uses. getPublicUrl builds a URL
  // that looks perfectly valid and answers "Bucket not found", which is exactly
  // how a job reported success while pointing at nothing.
  const { data: signed, error: signErr } =
    await db.storage.from(ASSET_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  const link = signed?.signedUrl;
  if (signErr || !link) {
    await db.storage.from(ASSET_BUCKET).remove([path]).catch(() => {});
    throw new Error(signErr?.message || "could not create a link to the stored image");
  }

  // One request to prove the link serves the picture, before anybody is told it
  // is ready. Every way this can break — wrong bucket, private bucket, wrong
  // path, bad signature — produces a URL that looks fine until it is opened,
  // and by then it is an asset row and a notification, not a failed job.
  const check = await fetch(link, { headers: { Range: "bytes=0-15" }, signal: AbortSignal.timeout(DOWNLOAD_MS) })
    .catch(() => null);
  const checkBytes = check?.ok ? await check.arrayBuffer().catch(() => null) : null;
  if (!sniffImage(checkBytes)) {
    await db.storage.from(ASSET_BUCKET).remove([path]).catch(() => {});
    throw new Error(`the stored image is not readable (HTTP ${check?.status ?? "no response"})`);
  }

  // The sniffed kind travels with the result. The storage object was already
  // named from the bytes; the user_files row used to say ".png" and
  // "image/png" no matter what arrived, so a JPEG was filed under a name it
  // could not be opened by. Nano Banana returns JPEG whatever output_format
  // asks for, which is how this surfaced.
  return { publicUrl: link, path, bytes: buf.byteLength, ext: kind.ext, mime: kind.type };
}

// The other ending. A generation can fail minutes after the request, long after
// whoever asked has moved on — so a failure has to travel the same way success
// does, or the only person who ever learns about it is the one who happened to
// still be watching.
//
// The status change is the guard: `in ('queued','running')` returns a row to
// exactly one caller, so the poll and the webhook cannot both report the same
// failure.
async function failJob(db, job, message, extra = {}) {
  const { data: marked } = await db
    .from("generation_jobs")
    .update({ status: "failed", error: message, updated_at: new Date().toISOString(), ...extra })
    .eq("id", job.id)
    .in("status", ["queued", "running"])
    .select("id")
    .maybeSingle();
  if (!marked) return false;   // already resolved by the other trigger

  const de = job.lang === "de";
  const { error } = await db.from("notifications").insert({
    user_id: job.user_id, org_id: job.org_id, type: "image_failed",
    title: de ? "Bilderzeugung fehlgeschlagen" : "Image generation failed",
    body: (job.prompt || "").slice(0, 120),
    metadata: { model: job.model, reason: String(message).slice(0, 300) },
  });
  if (error) console.error("[generate] failure notification insert failed:", error.message);
  return true;
}

// Everything that has to happen when a picture is ready, in one place and
// entirely server-side: bill it, file it as an asset, record the bytes, tell the
// user. The client used to do the last three, which meant closing the dialog
// lost the result — the image existed in storage and nothing pointed at it.
async function completeJob(db, job, imageUrl) {
  // Claim it first. Completion has two triggers — the status poll and the
  // provider's webhook — and they can arrive together. Checking the status and
  // then acting is not enough: both readers see "running", both proceed, and the
  // picture gets downloaded, stored and filed twice under different ids. That
  // happened, two seconds apart.
  //
  // `update … where claimed_at is null` is atomic, so exactly one caller gets a
  // row back and the other steps aside.
  const { data: claimed } = await db
    .from("generation_jobs")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", job.id)
    .is("claimed_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return null;   // someone else is finishing it

  const model = MODELS[job.model] || { microUsd: 0 };
  const credits = creditsFor(model.microUsd);
  const stored = await persistImage(db, { url: imageUrl, userId: job.user_id });

  // The asset row. Named from the prompt so a generated picture is findable by
  // what was asked for.
  const name = ((job.prompt || "").slice(0, 60).replace(/[\n\r]+/g, " ").trim() || "KI-Bild") + "." + (stored.ext || "png");

  // ⚠ Every one of these three errors is CHECKED. supabase-js does not throw on
  // a database error, it hands it back in `error`, and all three of these used
  // to be awaited and then ignored. A failed user_files insert therefore left
  // the picture in storage with no row pointing at it, while the job was still
  // marked completed and the credits still charged: paid for, reported as
  // finished, and findable nowhere.
  //
  // The asset row is the one that decides. Without it there is no picture as
  // far as the product is concerned, so its failure fails the job and the
  // stored object is removed rather than left to be paid for by the storage
  // quota forever.
  const { error: fileErr } = await db.from("user_files").insert({
    user_id: job.user_id, org_id: job.org_id, name,
    mime_type: stored.mime || "image/png", size_bytes: stored.bytes, storage_path: stored.path,
    storage_provider: "supabase", public_url: stored.publicUrl,
    // The bucket travels with the row: deletion should never have to infer it.
    metadata: { generated: true, model: job.model, prompt: job.prompt, bucket: ASSET_BUCKET },
  });
  if (fileErr) {
    await db.storage.from(ASSET_BUCKET).remove([stored.path]).catch(() => {});
    throw new Error(`could not file the generated image: ${fileErr.message}`);
  }

  // The storage ledger. Skipping this is how the ledger drifts from reality —
  // an upload does it, so a generation must too. A miss here does NOT throw:
  // the picture exists and is usable, and a quota that is briefly short is a
  // smaller problem than destroying finished work. It is logged so the drift
  // has a cause somebody can find.
  const { error: ledgerErr } = await db.from("workspace_files").upsert(
    { org_id: job.org_id, bucket: ASSET_BUCKET, path: stored.path, size_bytes: stored.bytes, created_by: job.user_id },
    { onConflict: "bucket,path" },
  );
  if (ledgerErr) console.error("[generate] storage ledger not updated:", ledgerErr.message);

  // The job's own row. If this does not land the job stays "running" with a
  // finished picture already filed, and the next poll would try to complete it
  // again — which is exactly what claimed_at prevents, so it would simply stop.
  // Better to fail loudly and leave a job that can be looked at.
  const { error: jobErr } = await db.from("generation_jobs").update({
    status: "completed", result_url: stored.publicUrl,
    cost_micro_usd: model.microUsd, cost_credits: credits,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  if (jobErr) throw new Error(`could not close the generation job: ${jobErr.message}`);

  // The whole point of doing this here: the person may be somewhere else
  // entirely by now, minutes later.
  //
  // The error is checked. `notifications.type` is a closed set, and the first
  // version of this used a type that was not in it — the insert was rejected and
  // the only symptom was a notification that never arrived, with nothing
  // anywhere to say why.
  const { error: notifyErr } = await db.from("notifications").insert({
    user_id: job.user_id, org_id: job.org_id, type: "image_ready",
    title: job.lang === "de" ? "Dein KI-Bild ist fertig" : "Your AI image is ready",
    body: (job.prompt || "").slice(0, 120),
    metadata: { url: stored.publicUrl, model: job.model },
  });
  // Logged, not thrown: the picture is finished and filed. Losing the note is a
  // nuisance; failing the job over it would throw away the work.
  if (notifyErr) console.error("[generate] notification insert failed:", notifyErr.message);

  return { url: stored.publicUrl, path: stored.path, bytes: stored.bytes, credits };
}

// The webhook URL handed to the provider, signed so only URLs we minted are
// accepted. Without a signature this would be an open endpoint that completes
// and BILLS arbitrary jobs on request.
async function hookToken(jobId) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(jobId));
  return [...new Uint8Array(sig)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── webhook — the provider telling us a job is done ───────────────────────
  // No session here: the caller is Pixazo, not a person. The signature is what
  // authorises it, and the work is idempotent — a job already completed is left
  // alone, so a retried callback cannot bill twice.
  const hook = new URL(req.url).searchParams.get("hook");
  if (hook) {
    const [jobId, sig] = hook.split(".");
    if (!jobId || !sig || sig !== await hookToken(jobId)) return json({ error: "bad signature" }, 403);
    const db0 = admin();
    const { data: job } = await db0.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();
    if (!job) return json({ error: "unknown job" }, 404);
    if (job.status === "completed" || job.status === "failed") return json({ ok: true, already: job.status });

    const payload = await req.json().catch(() => ({}));
    const state = String(payload?.status || "").toUpperCase();
    const image = findImage(payload);
    await db0.from("generation_jobs").update({ provider_status: state || "webhook", updated_at: new Date().toISOString() }).eq("id", job.id);
    if (image) {
      try { const done = await completeJob(db0, job, image); return json({ ok: true, claimed: Boolean(done) }); }
      catch (e) {
        await failJob(db0, job, e.message);
        return json({ ok: false, error: e.message });
      }
    }
    if (["ERROR", "FAILED", "CANCELLED"].includes(state)) {
      await failJob(db0, job, payload?.error || payload?.message || "Generation failed");
    }
    // Anything else: the poll path will finish it. A webhook that arrives
    // without a usable picture is not a reason to fail a running job.
    return json({ ok: true, noted: state || null });
  }
  if (!process.env.PIXAZO_API_KEY) {
    return json({ error: "Image generation is not configured.", code: "generation_not_configured" }, 503);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { mode, orgId } = body || {};
  if (!orgId) return json({ error: "Workspace is required", code: "missing_workspace" }, 400);

  const user = await requireUser(req);
  if (!user) return json({ error: "Not signed in", code: "unauthorized" }, 401);

  const db = admin();
  if (!(await isMember(db, user.id, orgId))) {
    return json({ error: "Not a member of this workspace", code: "forbidden" }, 403);
  }

  // ── credits — what is left this month, for the dialog to show ────────────
  if (mode === "credits") {
    // The balance now comes from the database, so it can fail. Saying so beats
    // answering "you have no plan", which is what returning zeros would look
    // like from the dialog.
    let c;
    try { c = await remainingCredits(db, orgId); }
    catch (e) { return json({ error: e.message, code: "credits_unavailable" }, 503); }
    return json({
      ...c,
      models: Object.entries(MODELS).map(([key, m]) => ({ key, label: m.label, credits: creditsFor(m.microUsd) })),
    });
  }

  // ── submit ────────────────────────────────────────────────────────────────
  if (mode === "submit") {
    const modelKey = MODELS[body.model] ? body.model : DEFAULT_MODEL;
    const model = MODELS[modelKey];
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json({ error: "A prompt is required", code: "missing_prompt" }, 400);

    let credits;
    try { credits = await remainingCredits(db, orgId); }
    catch (e) { return json({ error: e.message, code: "credits_unavailable" }, 503); }
    // A free model still needs a plan — the provider throttles it, and it is
    // ours to hand out, not a trial's to consume.
    if (credits.limit === 0) {
      return json({ error: "AI generation needs a paid plan.", code: "generation_needs_plan" }, 402);
    }
    const need = creditsFor(model.microUsd);
    // An early, friendly no. The real gate is the reservation below; this one
    // exists so the common case answers without taking a lock.
    if (need > credits.left) {
      return json({
        error: "This month's AI credits are used up.",
        code: "generation_no_credits",
        limit: credits.limit, used: credits.used, needed: need,
      }, 402);
    }

    // THE gate. Checking the remainder and then creating the job were two
    // steps, and between them another request could read the same remainder:
    // five clicks a moment apart each saw the full balance and each started,
    // and Pixazo billed us for all five. This reserves and creates in one
    // statement, under a lock held per account, so the second request sees the
    // first one's credits already taken.
    //
    // A job that fails stops counting, so nothing has to be handed back by
    // name. A job that dies mid-flight holds its credits for half an hour and
    // then stops counting too, which is why there is no sweeper here.
    const { data: job, error: jobErr } = await db.rpc("reserve_image_credits", {
      p_org: orgId, p_user: user.id, p_model: modelKey, p_prompt: prompt,
      p_lang: body.lang === "de" ? "de" : "en", p_credits: need, p_limit: credits.limit,
    });
    // PostgREST hands a composite return back as an object, but tolerate the
    // single-row-array shape too rather than depend on that.
    const jobRow = Array.isArray(job) ? job[0] : job;
    if (jobErr || !jobRow?.id) {
      if (/i7os_image_credits/.test(`${jobErr?.message || ""} ${jobErr?.details || ""}`)) {
        // Somebody else's request took the last of it in the moment between the
        // read above and the lock. The honest answer is the same one.
        const after = await remainingCredits(db, orgId).catch(() => credits);
        return json({
          error: "This month's AI credits are used up.",
          code: "generation_no_credits",
          limit: after.limit, used: after.used, needed: need,
        }, 402);
      }
      return json({ error: jobErr?.message || "could not start the generation" }, 500);
    }

    let payload;
    const startedAt = Date.now();
    try {
      const origin = new URL(req.url).origin;
      const res = await pixazo(model.path, model.body(prompt), PIXAZO_SUBMIT_MS, {
        // Terminal mode: one callback when it is done or has failed. Polling
        // still works and stays as the fallback — a webhook that never arrives
        // must not strand the job.
        "X-Webhook-URL": `${origin}/api/generate?hook=${jobRow.id}.${await hookToken(jobRow.id)}`,
        "X-Webhook-Mode": "terminal",
      });
      payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 429 is the provider throttling us, most likely on a free model. Say
        // so plainly instead of relaying "error 429".
        const msg = res.status === 429
          ? "The image service is busy right now — please try again in a moment."
          : (payload?.error || payload?.message || `Image service error ${res.status}`);
        await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() })
          .eq("id", jobRow.id).in("status", ["queued", "running"]);
        return json({ error: msg, code: res.status === 429 ? "generation_busy" : "generation_failed", jobId: jobRow.id }, 502);
      }
    } catch (e) {
      const timedOut = e?.name === "TimeoutError" || /abort|timeout/i.test(e?.message || "");
      const msg = timedOut
        ? "The image service did not answer in time. It may still be working — try again in a moment."
        : (e?.message || "Image service unreachable");
      await db.from("generation_jobs").update({
        status: "failed", error: msg, updated_at: new Date().toISOString(),
      }).eq("id", jobRow.id);
      return json({
        error: msg,
        code: timedOut ? "generation_timeout" : "generation_failed",
        jobId: jobRow.id,
      }, 504);
    }

    // Synchronous answer: the image is already here.
    const immediate = findImage(payload);
    if (immediate) {
      try {
        const done = await completeJob(db, jobRow, immediate);
        if (!done) {
          const { data: fresh } = await db.from("generation_jobs").select("result_url,status").eq("id", jobRow.id).maybeSingle();
          return json({ jobId: jobRow.id, status: fresh?.status || "running", url: fresh?.result_url || null });
        }
        return json({ jobId: jobRow.id, status: "completed", url: done.url });
      } catch (e) {
        await db.from("generation_jobs").update({ status: "failed", error: e.message, updated_at: new Date().toISOString() }).eq("id", jobRow.id);
        return json({ error: e.message, code: "generation_failed", jobId: jobRow.id }, 502);
      }
    }

    // Asynchronous answer: remember where to ask.
    const upstreamMs = Date.now() - startedAt;
    const requestId = findRequestId(payload);
    if (!requestId) {
      const msg = "The image service returned nothing we could use.";
      // Same reason as the transition below: never over a terminal state.
      await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() })
        .eq("id", jobRow.id).in("status", ["queued", "running"]);
      return json({ error: msg, code: "generation_failed", jobId: jobRow.id }, 502);
    }
    // ⚠ Only from a state that is not finished.
    //
    // The provider is handed the webhook URL during the submit call, so a fast
    // model can call it back BEFORE this line runs. completeJob then stores the
    // picture and writes "completed", and this update used to overwrite that
    // with "running" unconditionally. claimed_at is set by then, so no later
    // attempt could finish the job either: a picture that existed, paid for,
    // showing as forever in progress. Reproduced by the review, and the fix is
    // the `.in(...)` filter, which makes the transition atomic.
    const { data: moved } = await db.from("generation_jobs").update({
      status: "running",
      provider_request_id: String(requestId),
      polling_url: findPollingUrl(payload) || `${GATEWAY}/v2/requests/status/${requestId}`,
      updated_at: new Date().toISOString(),
    }).eq("id", jobRow.id).in("status", ["queued", "running"]).select("id").maybeSingle();

    if (!moved) {
      // Somebody got there first, and the only way that happens is the webhook.
      const { data: fresh } = await db.from("generation_jobs")
        .select("status,result_url,error").eq("id", jobRow.id).maybeSingle();
      return json({ jobId: jobRow.id, status: fresh?.status || "running", url: fresh?.result_url || null, error: fresh?.error || undefined, upstreamMs });
    }
    return json({ jobId: jobRow.id, status: "running", upstreamMs });
  }

  // ── status ────────────────────────────────────────────────────────────────
  if (mode === "status") {
    const { data: job } = await db.from("generation_jobs").select("*").eq("id", body.jobId).eq("org_id", orgId).maybeSingle();
    if (!job) return json({ error: "Unknown job", code: "unknown_job" }, 404);
    // Terminal states are answered from our own row — asking the provider again
    // would be a request we pay for and already know the answer to.
    if (job.status === "completed") return json({ jobId: job.id, status: "completed", url: job.result_url });
    if (job.status === "failed") return json({ jobId: job.id, status: "failed", error: job.error });
    if (!job.polling_url) return json({ jobId: job.id, status: job.status });

    let payload, httpStatus;
    try {
      const res = await fetch(job.polling_url, {
        headers: { "Ocp-Apim-Subscription-Key": process.env.PIXAZO_API_KEY || "" },
        signal: AbortSignal.timeout(PIXAZO_STATUS_MS),
      });
      httpStatus = res.status;
      payload = await res.json().catch(() => ({}));
      // A failed status check used to fall through to "running", because that is
      // this code's word for "not finished yet". The client then polled a dead
      // job until it gave up, and the reason never left this function.
      if (!res.ok) {
        const msg = payload?.message || payload?.error || `Status check failed (HTTP ${res.status})`;
        // A status endpoint that is busy, rate limited or briefly down says
        // nothing about the GENERATION. Failing the job on a 503 threw away a
        // picture that was still being made, and the webhook that arrived a
        // minute later was then refused as "already failed": paid for, produced,
        // and unreachable. Only an answer that is about the request itself is
        // terminal.
        const transient = res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500;
        if (transient) {
          await db.from("generation_jobs").update({
            provider_status: `HTTP ${res.status} (voruebergehend)`, updated_at: new Date().toISOString(),
          }).eq("id", job.id).in("status", ["queued", "running"]);
          return json({ jobId: job.id, status: job.status, note: msg });
        }
        await failJob(db, job, msg, { provider_status: `HTTP ${res.status}` });
        return json({ jobId: job.id, status: "failed", error: msg });
      }
    } catch (e) {
      return json({ jobId: job.id, status: job.status, note: e?.message || "status check failed" });
    }

    const state = String(payload?.status || "").toUpperCase();
    // Kept verbatim on the row. Otherwise a job stuck at "running" is a black
    // box — our own word for "not finished" tells us nothing about why.
    await db.from("generation_jobs").update({
      provider_status: state || `HTTP ${httpStatus} (kein status-Feld)`,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    const image = findImage(payload);
    if (image) {
      try {
        const done = await completeJob(db, job, image);
        if (!done) {
          const { data: fresh } = await db.from("generation_jobs").select("result_url,status").eq("id", job.id).maybeSingle();
          return json({ jobId: job.id, status: fresh?.status || "running", url: fresh?.result_url || null });
        }
        return json({ jobId: job.id, status: "completed", url: done.url });
      } catch (e) {
        await failJob(db, job, e.message);
        return json({ jobId: job.id, status: "failed", error: e.message });
      }
    }
    // The provider says it is done and we still found no picture. Failing here
    // beats spinning: the client would poll a finished job until it gave up, and
    // the payload — the one thing that would explain it — would be discarded on
    // every pass. Keeping a snippet turns the next occurrence into a five-second
    // diagnosis.
    if (["COMPLETED", "SUCCESS", "SUCCEEDED", "DONE"].includes(state)) {
      const snippet = JSON.stringify(payload || {}).slice(0, 600);
      const msg = `Provider reported ${state} but returned no usable image. Payload: ${snippet}`;
      await failJob(db, job, msg, { provider_status: state });
      return json({ jobId: job.id, status: "failed", error: "The image service finished but returned no image." });
    }
    if (["ERROR", "FAILED", "CANCELLED"].includes(state)) {
      const msg = payload?.error || payload?.message || "Generation failed";
      await failJob(db, job, msg);
      return json({ jobId: job.id, status: "failed", error: msg });
    }
    return json({ jobId: job.id, status: "running", providerStatus: state || null });
  }

  return json({ error: "Unknown mode" }, 400);
}
