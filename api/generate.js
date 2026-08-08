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
// the price below true.
//
// Listed cheapest first; the dialog renders them in this order.
const MODELS = {
  "flux-1-schnell": {
    path: "/flux-1-schnell/v1/getData", microUsd: 0, label: "Flux Schnell",
    body: (prompt) => ({ prompt }),
  },
  "flux-2-klein": {
    path: "/flux-2-klein-4b/v1/generateImage", microUsd: 692, label: "Flux 2 Klein",
    body: (prompt) => ({ prompt }),
  },
  "gpt-image-2": {
    path: "/gpt-image-2/v1/text-to-image", microUsd: 5000, label: "GPT Image 2",
    // 1536x1024 at low quality is the $0.005 tier. Medium at the same size is
    // eight times that, so the two fields are not cosmetic.
    body: (prompt) => ({ prompt, image_size: "1536x1024", quality: "low", num_images: 1, output_format: "png" }),
  },
  "flux-2-dev": {
    path: "/flux-2-dev/v1/generateT2I", microUsd: 12000, label: "Flux 2 Dev",
    body: (prompt) => ({ prompt }),
  },
  "flux-dev": {
    path: "/flux-dev/v1/dev/textToImage", microUsd: 25000, label: "Flux Dev",
    body: (prompt) => ({ prompt }),
  },
  "flux-pro": {
    path: "/flux-pro/v1/pro/textToImage", microUsd: 40000, label: "FLUX Pro",
    body: (prompt) => ({ prompt }),
  },
  "nano-banana-2": {
    // Priced per resolution — $0.047 at 0.5K, $0.070 at 1K, more above. The
    // documented default is 1K, but it is pinned anyway: a price that depends on
    // someone else's default is a price that can change without us touching
    // anything. num_images is pinned for the same reason — it bills per image,
    // and defaults are not promises.
    path: "/nano-banana-2/v1/text-to-image", microUsd: 70350, label: "Nano Banana 2",
    body: (prompt) => ({ prompt, resolution: "1K", num_images: 1, output_format: "png" }),
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

  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { data: rows } = await db
    .from("generation_jobs")
    .select("cost_credits")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("completed_at", since.toISOString());
  const used = (rows || []).reduce((n, r) => n + Number(r.cost_credits || 0), 0);
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
async function persistImage(db, { url, orgId }) {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_MS) });
  if (!res.ok) throw new Error(`could not fetch generated image (${res.status})`);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  const ext = (type.split("/")[1] || "png").split("+")[0].replace("jpeg", "jpg");
  const path = `generated/${orgId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("brand-assets").upload(path, blob, { contentType: type });
  if (error) throw new Error(error.message);
  const { data } = db.storage.from("brand-assets").getPublicUrl(path);
  return { publicUrl: data.publicUrl, path, bytes: blob.size };
}

// Everything that has to happen when a picture is ready, in one place and
// entirely server-side: bill it, file it as an asset, record the bytes, tell the
// user. The client used to do the last three, which meant closing the dialog
// lost the result — the image existed in storage and nothing pointed at it.
async function completeJob(db, job, imageUrl) {
  const model = MODELS[job.model] || { microUsd: 0 };
  const credits = creditsFor(model.microUsd);
  const stored = await persistImage(db, { url: imageUrl, orgId: job.org_id });

  // The asset row. Named from the prompt so a generated picture is findable by
  // what was asked for.
  const name = ((job.prompt || "").slice(0, 60).replace(/[\n\r]+/g, " ").trim() || "KI-Bild") + ".png";
  await db.from("user_files").insert({
    user_id: job.user_id, org_id: job.org_id, name,
    mime_type: "image/png", size_bytes: stored.bytes, storage_path: stored.path,
    storage_provider: "supabase", public_url: stored.publicUrl,
    metadata: { generated: true, model: job.model, prompt: job.prompt },
  });

  // The storage ledger. Skipping this is how the ledger drifts from reality —
  // an upload does it, so a generation must too.
  await db.from("workspace_files").upsert(
    { org_id: job.org_id, bucket: "brand-assets", path: stored.path, size_bytes: stored.bytes, created_by: job.user_id },
    { onConflict: "bucket,path" },
  );

  await db.from("generation_jobs").update({
    status: "completed", result_url: stored.publicUrl,
    cost_micro_usd: model.microUsd, cost_credits: credits,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", job.id);

  // The whole point of doing this here: the person may be somewhere else
  // entirely by now, three minutes later.
  await db.from("notifications").insert({
    user_id: job.user_id, org_id: job.org_id, type: "image_ready",
    title: "Dein KI-Bild ist fertig",
    body: (job.prompt || "").slice(0, 120),
    metadata: { url: stored.publicUrl, model: job.model },
  });

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
      try { await completeJob(db0, job, image); return json({ ok: true }); }
      catch (e) {
        await db0.from("generation_jobs").update({ status: "failed", error: e.message, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ ok: false, error: e.message });
      }
    }
    if (["ERROR", "FAILED", "CANCELLED"].includes(state)) {
      await db0.from("generation_jobs").update({
        status: "failed", error: payload?.error || payload?.message || "Generation failed",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
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
    const c = await remainingCredits(db, orgId);
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

    const credits = await remainingCredits(db, orgId);
    // A free model still needs a plan — the provider throttles it, and it is
    // ours to hand out, not a trial's to consume.
    if (credits.limit === 0) {
      return json({ error: "AI generation needs a paid plan.", code: "generation_needs_plan" }, 402);
    }
    if (creditsFor(model.microUsd) > credits.left) {
      return json({
        error: "This month's AI credits are used up.",
        code: "generation_no_credits",
        limit: credits.limit, used: credits.used, needed: creditsFor(model.microUsd),
      }, 402);
    }

    const { data: job, error: jobErr } = await db.from("generation_jobs").insert({
      org_id: orgId, user_id: user.id, kind: "image", model: modelKey, prompt, status: "queued",
    }).select().single();
    if (jobErr) return json({ error: jobErr.message }, 500);

    let payload;
    const startedAt = Date.now();
    try {
      const origin = new URL(req.url).origin;
      const res = await pixazo(model.path, model.body(prompt), PIXAZO_SUBMIT_MS, {
        // Terminal mode: one callback when it is done or has failed. Polling
        // still works and stays as the fallback — a webhook that never arrives
        // must not strand the job.
        "X-Webhook-URL": `${origin}/api/generate?hook=${job.id}.${await hookToken(job.id)}`,
        "X-Webhook-Mode": "terminal",
      });
      payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 429 is the provider throttling us, most likely on a free model. Say
        // so plainly instead of relaying "error 429".
        const msg = res.status === 429
          ? "The image service is busy right now — please try again in a moment."
          : (payload?.error || payload?.message || `Image service error ${res.status}`);
        await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ error: msg, code: res.status === 429 ? "generation_busy" : "generation_failed", jobId: job.id }, 502);
      }
    } catch (e) {
      const timedOut = e?.name === "TimeoutError" || /abort|timeout/i.test(e?.message || "");
      const msg = timedOut
        ? "The image service did not answer in time. It may still be working — try again in a moment."
        : (e?.message || "Image service unreachable");
      await db.from("generation_jobs").update({
        status: "failed", error: msg, updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      return json({
        error: msg,
        code: timedOut ? "generation_timeout" : "generation_failed",
        jobId: job.id,
      }, 504);
    }

    // Synchronous answer: the image is already here.
    const immediate = findImage(payload);
    if (immediate) {
      try {
        const done = await completeJob(db, job, immediate);
        return json({ jobId: job.id, status: "completed", url: done.url });
      } catch (e) {
        await db.from("generation_jobs").update({ status: "failed", error: e.message, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ error: e.message, code: "generation_failed", jobId: job.id }, 502);
      }
    }

    // Asynchronous answer: remember where to ask.
    const upstreamMs = Date.now() - startedAt;
    const requestId = findRequestId(payload);
    if (!requestId) {
      const msg = "The image service returned nothing we could use.";
      await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
      return json({ error: msg, code: "generation_failed", jobId: job.id }, 502);
    }
    await db.from("generation_jobs").update({
      status: "running",
      provider_request_id: String(requestId),
      polling_url: findPollingUrl(payload) || `${GATEWAY}/v2/requests/status/${requestId}`,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    return json({ jobId: job.id, status: "running", upstreamMs });
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
        await db.from("generation_jobs").update({
          status: "failed", error: msg, provider_status: `HTTP ${res.status}`,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
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
        return json({ jobId: job.id, status: "completed", url: done.url });
      } catch (e) {
        await db.from("generation_jobs").update({ status: "failed", error: e.message, updated_at: new Date().toISOString() }).eq("id", job.id);
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
      await db.from("generation_jobs").update({
        status: "failed", error: msg, provider_status: state,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      return json({ jobId: job.id, status: "failed", error: "The image service finished but returned no image." });
    }
    if (["ERROR", "FAILED", "CANCELLED"].includes(state)) {
      const msg = payload?.error || payload?.message || "Generation failed";
      await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
      return json({ jobId: job.id, status: "failed", error: msg });
    }
    return json({ jobId: job.id, status: "running", providerStatus: state || null });
  }

  return json({ error: "Unknown mode" }, 400);
}
