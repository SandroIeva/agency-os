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

// Per-model: where it lives and what it costs, in micro-USD per image.
// One table, because a price that appears twice eventually disagrees with
// itself. Prices from Pixazo's published rates — when they change, they change
// HERE and nowhere else.
const MODELS = {
  "flux-1-schnell": { path: "/flux-1-schnell/v1/getData", microUsd: 0, label: "Flux Schnell" },
  "flux-2-klein":   { path: "/flux-2-klein-4b/v1/generateImage", microUsd: 692, label: "Flux 2 Klein" },
  "flux-2-dev":     { path: "/flux-2-dev/v1/generateT2I", microUsd: 12000, label: "Flux 2 Dev" },
  "flux-dev":       { path: "/flux-dev/v1/dev/textToImage", microUsd: 25000, label: "Flux Dev" },
  "flux-pro":       { path: "/flux-pro/v1/pro/textToImage", microUsd: 40000, label: "FLUX Pro" },
};
const DEFAULT_MODEL = "flux-1-schnell";

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
  const limit = resolveEntitlements(account).limits.imageCreditsMicroUsd ?? 0;

  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { data: rows } = await db
    .from("generation_jobs")
    .select("cost_micro_usd")
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("completed_at", since.toISOString());
  const used = (rows || []).reduce((n, r) => n + Number(r.cost_micro_usd || 0), 0);
  return { limit, used, left: Math.max(0, limit - used) };
}

const pixazo = (path, body, extraHeaders = {}) => fetch(GATEWAY + path, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": process.env.PIXAZO_API_KEY || "",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

// Pull an image URL (or a data URI) out of whatever shape came back. Providers
// disagree about this even between their own models, so look in the places it
// is plausibly hiding rather than insisting on one.
function findImage(payload) {
  if (!payload || typeof payload !== "object") return null;
  const direct = payload.image_url || payload.imageUrl || payload.url || payload.output_url;
  if (typeof direct === "string" && /^(https?:|data:image)/.test(direct)) return direct;
  for (const key of ["images", "output", "outputs", "data", "result"]) {
    const v = payload[key];
    if (typeof v === "string" && /^(https?:|data:image)/.test(v)) return v;
    if (Array.isArray(v) && v.length) {
      const first = v[0];
      if (typeof first === "string" && /^(https?:|data:image)/.test(first)) return first;
      const nested = findImage(first);
      if (nested) return nested;
    }
    if (v && typeof v === "object") {
      const nested = findImage(v);
      if (nested) return nested;
    }
  }
  return null;
}

const findRequestId = (p) => p?.request_id || p?.requestId || p?.id || null;
const findPollingUrl = (p) => p?.polling_url || p?.pollingUrl || null;

// Store the picture ourselves. The provider's link expires and points at their
// infrastructure; an asset in a moodboard has to still be there next year.
async function persistImage(db, { url, orgId }) {
  const res = await fetch(url);
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

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
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
      models: Object.entries(MODELS).map(([key, m]) => ({ key, label: m.label, microUsd: m.microUsd })),
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
    if (model.microUsd > credits.left) {
      return json({
        error: "This month's AI generation allowance is used up.",
        code: "generation_no_credits",
        limit: credits.limit, used: credits.used,
      }, 402);
    }

    const { data: job, error: jobErr } = await db.from("generation_jobs").insert({
      org_id: orgId, user_id: user.id, kind: "image", model: modelKey, prompt, status: "queued",
    }).select().single();
    if (jobErr) return json({ error: jobErr.message }, 500);

    let payload;
    try {
      const res = await pixazo(model.path, { prompt });
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
      const msg = e?.message || "Image service unreachable";
      await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
      return json({ error: msg, code: "generation_failed", jobId: job.id }, 502);
    }

    // Synchronous answer: the image is already here.
    const immediate = findImage(payload);
    if (immediate) {
      try {
        const stored = await persistImage(db, { url: immediate, orgId });
        await db.from("generation_jobs").update({
          status: "completed", result_url: stored.publicUrl, cost_micro_usd: model.microUsd,
          completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        return json({
          jobId: job.id, status: "completed", url: stored.publicUrl,
          // Handed back so the client can file it as an asset and record the
          // bytes in the storage ledger — the same bookkeeping an upload does.
          storagePath: stored.path, bytes: stored.bytes, bucket: "brand-assets",
          model: modelKey, costMicroUsd: model.microUsd,
        });
      } catch (e) {
        await db.from("generation_jobs").update({ status: "failed", error: e.message, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ error: e.message, code: "generation_failed", jobId: job.id }, 502);
      }
    }

    // Asynchronous answer: remember where to ask.
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
    return json({ jobId: job.id, status: "running" });
  }

  // ── status ────────────────────────────────────────────────────────────────
  if (mode === "status") {
    const { data: job } = await db.from("generation_jobs").select("*").eq("id", body.jobId).eq("org_id", orgId).maybeSingle();
    if (!job) return json({ error: "Unknown job", code: "unknown_job" }, 404);
    // Terminal states are answered from our own row — asking the provider again
    // would be a request we pay for and already know the answer to.
    if (job.status === "completed") return json({ status: "completed", url: job.result_url });
    if (job.status === "failed") return json({ status: "failed", error: job.error });
    if (!job.polling_url) return json({ status: job.status });

    let payload;
    try {
      const res = await fetch(job.polling_url, {
        headers: { "Ocp-Apim-Subscription-Key": process.env.PIXAZO_API_KEY || "" },
      });
      payload = await res.json().catch(() => ({}));
    } catch (e) {
      return json({ status: job.status, note: e?.message || "status check failed" });
    }

    const state = String(payload?.status || "").toUpperCase();
    const image = findImage(payload);
    if (image) {
      try {
        const stored = await persistImage(db, { url: image, orgId });
        const model = MODELS[job.model] || { microUsd: 0 };
        await db.from("generation_jobs").update({
          status: "completed", result_url: stored.publicUrl, cost_micro_usd: model.microUsd,
          completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        return json({
          status: "completed", url: stored.publicUrl,
          storagePath: stored.path, bytes: stored.bytes, bucket: "brand-assets",
          model: job.model, costMicroUsd: model.microUsd,
        });
      } catch (e) {
        await db.from("generation_jobs").update({ status: "failed", error: e.message, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ status: "failed", error: e.message });
      }
    }
    if (["ERROR", "FAILED", "CANCELLED"].includes(state)) {
      const msg = payload?.error || payload?.message || "Generation failed";
      await db.from("generation_jobs").update({ status: "failed", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
      return json({ status: "failed", error: msg });
    }
    return json({ status: "running" });
  }

  return json({ error: "Unknown mode" }, 400);
}
