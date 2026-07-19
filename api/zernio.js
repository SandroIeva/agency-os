// Bundled Zernio endpoint — ONE serverless function for the whole social-media
// integration (Vercel Hobby caps Node functions at 12; this is the only one the
// integration adds). Full docs: docs/zernio-integration.md · https://docs.zernio.com
//
// Zernio is a unified social API (LinkedIn/Instagram/Threads/X/Pinterest/…).
// Model: one Zernio "profile" per i7OS workspace (mapping in workspace_social),
// social accounts hang off that profile, posts/analytics are scoped by it.
//
// POST /api/zernio with { mode, orgId, … } + Supabase Bearer token. Modes:
//   "status"     → workspace's connected accounts (creates the Zernio profile lazily)
//   "connect"    → { platform } → OAuth authUrl to redirect the user to (admin only)
//   "disconnect" → { accountId } → remove a connected account (admin only)
//   "analytics"  → { platform? } → overview + top posts + follower stats + daily series
//   "presign"    → { filename, contentType, size } → direct-upload URL for post media
//   "post"       → { content, platforms, mediaItems?, scheduledFor?, timezone?, isDraft? }
//
// The ZERNIO_API_KEY is server-only. The client NEVER talks to Zernio directly.
import {
  HttpError,
  getAdminSupabase,
  getAppUrl,
  readJsonBody,
  requireOrgMember,
  requireUser,
} from "../server/billing.js";

const ZERNIO_BASE = "https://zernio.com/api/v1";

function zernioKey() {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new HttpError(503, "ZERNIO_API_KEY is not configured", "zernio_not_configured");
  return key;
}

// Zernio API call with auth, timeout and normalized errors. Returns parsed JSON.
async function zfetch(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(ZERNIO_BASE + path, {
    method,
    headers: {
      "Authorization": `Bearer ${zernioKey()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || `Zernio ${res.status}`;
    const err = new HttpError(res.status, msg, "zernio_error");
    err.upstream = data;
    throw err;
  }
  return data;
}

// Same call, but a tolerated failure returns a marker instead of throwing —
// used for analytics parts that depend on Zernio's analytics add-on (402/403).
async function zfetchSoft(path, opts) {
  try { return await zfetch(path, opts); }
  catch (e) { return { __unavailable: true, status: e.status, error: e.message }; }
}

// The workspace's Zernio profile id — created lazily on first use and persisted
// in workspace_social (server-only table, service key).
async function ensureProfile(orgId) {
  const admin = getAdminSupabase();
  const { data: row, error } = await admin
    .from("workspace_social").select("zernio_profile_id").eq("org_id", orgId).maybeSingle();
  if (error) throw error;
  if (row?.zernio_profile_id) return row.zernio_profile_id;

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const created = await zfetch("/profiles", {
    method: "POST",
    body: { name: `${org?.name || "Workspace"} · i7OS`, description: `i7OS workspace ${orgId}` },
  });
  const profileId = created?.profile?._id || created?._id;
  if (!profileId) throw new HttpError(502, "Zernio profile creation returned no id", "zernio_error");
  const { error: upErr } = await admin.from("workspace_social").upsert(
    { org_id: orgId, zernio_profile_id: profileId, updated_at: new Date().toISOString() },
    { onConflict: "org_id" },
  );
  if (upErr) throw upErr;
  return profileId;
}

// Slim account shape for the client (never leak raw Zernio internals wholesale).
const slimAccount = (a) => ({
  id: a._id,
  platform: a.platform,
  username: a.username || a.displayName || "",
  displayName: a.displayName || a.username || "",
  profileUrl: a.profileUrl || null,
  isActive: a.isActive !== false,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const body = await readJsonBody(req);
    const { mode, orgId } = body;
    if (!orgId) throw new HttpError(400, "Workspace is required", "missing_workspace");

    // ── status — connected accounts for this workspace ──
    if (mode === "status") {
      await requireOrgMember(user.id, orgId);
      const profileId = await ensureProfile(orgId);
      const data = await zfetch(`/accounts?profileId=${encodeURIComponent(profileId)}`);
      return res.status(200).json({
        accounts: (data.accounts || []).map(slimAccount),
        hasAnalyticsAccess: data.hasAnalyticsAccess !== false,
      });
    }

    // ── connect — OAuth URL for a platform (admin only) ──
    if (mode === "connect") {
      await requireOrgMember(user.id, orgId, { adminOnly: true });
      const platform = String(body.platform || "");
      if (!/^[a-z]+$/.test(platform)) throw new HttpError(400, "Invalid platform", "invalid_platform");
      const profileId = await ensureProfile(orgId);
      // Zernio appends connected={platform}&accountId=… to this URL after OAuth;
      // the app detects ?zernio=connected on load and jumps back to Analytics.
      const redirect = `${getAppUrl(req)}/?zernio=connected`;
      const data = await zfetch(
        `/connect/${platform}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(redirect)}`,
      );
      if (!data.authUrl) throw new HttpError(502, "Zernio returned no authUrl", "zernio_error");
      return res.status(200).json({ authUrl: data.authUrl });
    }

    // ── disconnect — remove a connected account (admin only) ──
    if (mode === "disconnect") {
      await requireOrgMember(user.id, orgId, { adminOnly: true });
      const accountId = String(body.accountId || "");
      if (!/^[a-f0-9]{24}$/i.test(accountId)) throw new HttpError(400, "Invalid accountId", "invalid_account");
      await zfetch(`/accounts/${accountId}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    // ── analytics — dashboard payload (tolerates missing analytics add-on) ──
    if (mode === "analytics") {
      await requireOrgMember(user.id, orgId);
      const profileId = await ensureProfile(orgId);
      const platform = body.platform && /^[a-z]+$/.test(body.platform) ? body.platform : null;
      const pf = platform ? `&platform=${platform}` : "";
      const since = new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString().slice(0, 10); // 8 weeks
      const [top, followers, daily] = await Promise.all([
        zfetchSoft(`/analytics?profileId=${profileId}${pf}&sortBy=engagement&order=desc&limit=5`),
        zfetchSoft(`/accounts/follower-stats?profileId=${profileId}&granularity=weekly`),
        zfetchSoft(`/analytics/daily-metrics?profileId=${profileId}${pf}&fromDate=${since}`),
      ]);
      return res.status(200).json({ top, followers, daily, platform: platform || "all" });
    }

    // ── presign — direct-upload URL for post media (client PUTs the file itself,
    //    so media bytes never pass through this function) ──
    if (mode === "presign") {
      await requireOrgMember(user.id, orgId);
      const { filename, contentType, size } = body;
      if (!filename || !contentType) throw new HttpError(400, "filename and contentType required", "invalid_media");
      const data = await zfetch("/media/presign", { method: "POST", body: { filename, contentType, size } });
      return res.status(200).json({ uploadUrl: data.uploadUrl, publicUrl: data.publicUrl });
    }

    // ── post — create/schedule/publish a post ──
    if (mode === "post") {
      await requireOrgMember(user.id, orgId);
      const { content, platforms, mediaItems, scheduledFor, timezone, isDraft } = body;
      if (!Array.isArray(platforms) || (!isDraft && platforms.length === 0)) {
        throw new HttpError(400, "At least one platform/account is required", "invalid_platforms");
      }
      if (!content && !(mediaItems || []).length) {
        throw new HttpError(400, "Content or media is required", "invalid_content");
      }
      // Guard: every account must belong to THIS workspace's Zernio profile.
      const profileId = await ensureProfile(orgId);
      const mine = await zfetch(`/accounts?profileId=${encodeURIComponent(profileId)}`);
      const myIds = new Set((mine.accounts || []).map(a => a._id));
      for (const p of platforms) {
        if (!myIds.has(p.accountId)) throw new HttpError(403, "Account does not belong to this workspace", "forbidden_account");
      }
      const payload = {
        content: content || undefined,
        platforms: platforms.map(p => ({ platform: p.platform, accountId: p.accountId })),
        mediaItems: (mediaItems || []).length ? mediaItems : undefined,
        isDraft: Boolean(isDraft) || undefined,
        ...(scheduledFor
          ? { scheduledFor, timezone: timezone || "UTC" }
          : (isDraft ? {} : { publishNow: true })),
      };
      const data = await zfetch("/posts", {
        method: "POST",
        body: payload,
        headers: { "x-request-id": crypto.randomUUID() }, // Zernio idempotency — safe retries
      });
      const post = data.post || data;
      return res.status(200).json({
        id: post?._id || null,
        status: post?.status || (isDraft ? "draft" : (scheduledFor ? "scheduled" : "published")),
        platforms: (post?.platforms || []).map(p => ({
          platform: p.platform,
          status: p.status,
          url: p.platformPostUrl || null,
          error: p.errorMessage || null,
        })),
      });
    }

    return res.status(400).json({ error: "Unknown mode" });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : "internal_error";
    if (status >= 500) console.error("[zernio]", error);
    return res.status(status).json({ error: error.message || "Zernio request failed", code });
  }
}
