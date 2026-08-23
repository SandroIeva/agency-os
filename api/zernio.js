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
//   "comments"   → { platform? } → posts that have comments; with { postId, accountId } the thread
//   "reactors"   → { url } → who reacted to a LinkedIn post (SocialCrawl)
//   "lookup"     → { platform, handle } → a PUBLIC profile via SocialCrawl (any
//                  account, not just connected ones) — for benchmarking against
//                  competitors. Second vendor in this file on purpose: Vercel
//                  Hobby caps Node functions at 12 and we sit at 11, so a file
//                  of its own would spend the last slot on a proxy.
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
  getEntitlementsForOrg,
} from "../server/billing.js";

const ZERNIO_BASE = "https://zernio.com/api/v1";

// Connecting a social account bills us at Zernio the moment it happens, so the
// allowance is checked HERE and not in the browser: this endpoint is the only
// writer of workspace_social and the only caller of Zernio's connect route, so
// it is the actual boundary. A trial gets none — resolveEntitlements zeroes the
// allowance until there is a real subscription behind the account.
async function requirePaidSocial(orgId) {
  const ent = await getEntitlementsForOrg(orgId);
  if ((ent?.limits?.socialAccounts ?? 0) === 0) {
    throw new HttpError(402, "Social publishing needs a paid plan.", "social_needs_plan");
  }
  return ent;
}
async function requireSocialSlot(orgId, connectedCount) {
  const ent = await getEntitlementsForOrg(orgId);
  const limit = ent?.limits?.socialAccounts ?? 0;
  if (limit === 0) {
    throw new HttpError(402, "Connecting social accounts needs a paid plan.", "social_needs_plan");
  }
  if (connectedCount >= limit) {
    throw new HttpError(402, `Your plan connects up to ${limit} social account${limit === 1 ? "" : "s"}.`, "social_limit_reached");
  }
  return ent;
}

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

// ── SocialCrawl — public profiles of accounts nobody connected ──────────────
// A different vendor with a different job: Zernio reads the accounts this
// workspace OWNS, SocialCrawl reads anyone's public page. That is what makes a
// benchmark possible. https://www.socialcrawl.dev · one unified schema across
// platforms, auth by x-api-key, billed per call in credits.
const SC_BASE = "https://www.socialcrawl.dev/v1";
// Where each platform's profile lives, and what it wants to be told. LinkedIn
// is the odd one: it takes a full URL rather than a handle, and a company page
// is a different endpoint from a person.
const SC_PROFILE = {
  linkedin: { path: "/linkedin/company", by: "url",
    url: (h) => (/^https?:/i.test(h) ? h : `https://www.linkedin.com/company/${encodeURIComponent(h)}`) },
  linkedinperson: { path: "/linkedin/profile", by: "url",
    url: (h) => (/^https?:/i.test(h) ? h : `https://www.linkedin.com/in/${encodeURIComponent(h)}`) },
  instagram: { path: "/instagram/profile", by: "handle" },
  tiktok: { path: "/tiktok/profile", by: "handle" },
  youtube: { path: "/youtube/channel", by: "handle" },
  threads: { path: "/threads/profile", by: "handle" },
  twitter: { path: "/twitter/profile", by: "handle" },
  // Facebook wants a URL like LinkedIn does. Pinterest is absent on purpose:
  // SocialCrawl has boards, pins and search there, but no profile endpoint, and
  // a mapping that 404s is worse than an honestly missing option.
  facebook: { path: "/facebook/profile", by: "url",
    url: (h) => (/^https?:/i.test(h) ? h : `https://www.facebook.com/${encodeURIComponent(h)}`) },
};
async function scfetch(path, query, fresh) {
  const key = process.env.SOCIALCRAWL_API_KEY;
  if (!key) throw new HttpError(503, "SOCIALCRAWL_API_KEY is not configured", "socialcrawl_not_configured");
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${SC_BASE}${path}?${qs}`, {
    // Cached by default — a page's employee count does not change between two
    // looks at a dashboard, and every live fetch is billed. `no-cache` is what
    // the Refresh button sends.
    headers: { "x-api-key": key, accept: "application/json",
      ...(fresh ? { "Cache-Control": "no-cache" } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const msg = data?.error || data?.message || `SocialCrawl ${res.status}`;
    throw new HttpError(res.status === 200 ? 502 : res.status, msg, "socialcrawl_error");
  }
  return data;
}

// The enrichment parts may be absent on a page or on a plan; one of them
// failing must not take the card with it.
async function scSoft(path, query, fresh) {
  try { return await scfetch(path, query, fresh); }
  catch (e) { return { __unavailable: true, status: e.status, error: e.message }; }
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
      // Counted from Zernio rather than from our own table: Zernio is where the
      // accounts actually live, and one removed on their side must free a slot.
      const current = await zfetch(`/accounts?profileId=${encodeURIComponent(profileId)}`);
      await requireSocialSlot(orgId, (current.accounts || []).length);
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

    // ── comments — who said what under a post. Two shapes, because that is how
    //    Zernio splits it: without a postId the list of posts that HAVE comments,
    //    with one the thread under that post.
    //
    //    Soft-fetched like analytics: reading comments needs the same add-on on
    //    some plans, and a workspace without it should see a notice rather than
    //    a failed tab.
    if (mode === "comments") {
      await requireOrgMember(user.id, orgId);
      const profileId = await ensureProfile(orgId);
      const platform = body.platform && /^[a-z]+$/.test(body.platform) ? body.platform : null;

      if (body.postId) {
        const accountId = String(body.accountId || "");
        if (!/^[a-f0-9]{24}$/i.test(accountId)) throw new HttpError(400, "Invalid accountId", "invalid_account");
        const thread = await zfetchSoft(
          `/inbox/comments/${encodeURIComponent(String(body.postId))}?accountId=${encodeURIComponent(accountId)}`);
        return res.status(200).json({ thread });
      }

      const pf = platform ? `&platform=${platform}` : "";
      // Only posts that actually have something under them, newest first —
      // the default sort is the only one whose cursor paging is coherent.
      const list = await zfetchSoft(
        `/inbox/comments?profileId=${profileId}${pf}&minComments=1&limit=25`);
      if (!body.recent || list?.__unavailable) return res.status(200).json({ list });

      // "The latest comments" is not something Zernio answers: it lists POSTS
      // that have comments, and a thread is a second call per post. Doing that
      // walk here rather than in the browser keeps it one request instead of
      // seven, and the fan-out is capped — the newest handful of posts is where
      // the newest comments are.
      const posts = Array.isArray(list?.data) ? list.data.slice(0, 6) : [];
      // Said out loud rather than left to look like missing data: without the
      // key a LinkedIn thread falls back to Zernio, which returns comments
      // with no author — and the UI then shows a list of "Unknown" that looks
      // like a bug instead of an unset variable.
      const scReady = !!process.env.SOCIALCRAWL_API_KEY;
      // On LinkedIn the thread comes from SocialCrawl instead. Zernio returns
      // the comments but not who wrote them — the author object arrives without
      // a name, which is why every row read "Unknown". The public post page has
      // the display name, the picture and the verified flag, so for a LinkedIn
      // post with a permalink that is the better source; everywhere else Zernio
      // stays, because it needs no second vendor and costs no credit.
      const threads = await Promise.all(posts.map(async (p) => {
        if (p.platform === "linkedin" && p.permalink && process.env.SOCIALCRAWL_API_KEY) {
          const sc = await scSoft("/linkedin/post/comments", { url: p.permalink });
          const items = sc?.data?.items;
          if (Array.isArray(items) && items.length) {
            // Folded into the shape the rest of this already speaks, so the UI
            // does not need to know which vendor a comment came from.
            const conv = (n) => {
              const c = n?.comment || n || {};
              const a = c.author || {};
              return {
                id: c.id || c.url || Math.random().toString(36).slice(2),
                message: c.text || c.message || "",
                createdTime: c.published_at || c.createdTime || null,
                url: c.url || null,
                platform: "linkedin",
                likeCount: c.engagement?.likes ?? 0,
                replyCount: c.engagement?.replies ?? 0,
                from: {
                  name: a.display_name || a.username || null,
                  username: a.username || null,
                  picture: a.avatar_url || null,
                  verified: a.verified ?? null,
                },
                replies: Array.isArray(c.replies) ? c.replies.map(conv) : [],
              };
            };
            return { comments: items.map(conv) };
          }
        }
        return zfetchSoft(`/inbox/comments/${encodeURIComponent(p.id)}?accountId=${encodeURIComponent(p.accountId || "")}`);
      }));
      const flat = [];
      posts.forEach((p, i) => {
        const t = threads[i];
        if (!t || t.__unavailable || !Array.isArray(t.comments)) return;
        // Replies count as comments — they are the part of a conversation that
        // usually needs answering, and hiding them behind their parent would
        // make "the latest" quietly untrue.
        const walk = (c, parent) => {
          flat.push({ ...c, replies: undefined, postId: p.id, postContent: p.content,
            postPermalink: p.permalink, platform: c.platform || p.platform,
            accountUsername: p.accountUsername, parentAuthor: parent });
          (Array.isArray(c.replies) ? c.replies : [])
            .forEach(r => walk(r, c.from?.name || c.from?.username || null));
        };
        t.comments.forEach(c => walk(c, null));
      });
      flat.sort((a, b) => String(b.createdTime || "").localeCompare(String(a.createdTime || "")));
      return res.status(200).json({ list, recent: flat.slice(0, 40), socialcrawl: scReady });
    }

    // ── lookup — a public profile, for holding your numbers against someone
    //    else's. Behind a plan, and that is the rule rather than a judgement:
    //    every call costs a credit upstream, and what costs us per use is what
    //    gets gated (docs/pricing — free stays for what is free to run).
    if (mode === "lookup") {
      await requireOrgMember(user.id, orgId);
      await requirePaidSocial(orgId);
      const platform = String(body.platform || "").toLowerCase();
      const spec = SC_PROFILE[platform];
      if (!spec) throw new HttpError(400, "Unsupported platform", "invalid_platform");
      const handle = String(body.handle || "").trim().replace(/^@/, "");
      if (!handle || handle.length > 200) throw new HttpError(400, "handle required", "invalid_handle");

      const fresh = !!body.fresh;
      const q = spec.by === "url" ? { url: spec.url(handle) } : { handle };
      const data = await scfetch(spec.path, q, fresh);
      const out = {
        profile: data?.data || null,
        credits: { used: data?.credits_used ?? null, remaining: data?.credits_remaining ?? null },
        cached: !!data?.cached,
      };

      // Everything a LinkedIn company page carries that our own analytics
      // cannot see. Zernio reads what a connected account DID — posts, reach,
      // comments. None of it says how many people work there, what the page
      // calls its industry, or whether it is hiring; that lives on the public
      // page and comes from here.
      //
      // The follow-ups take the numeric company id the profile call returns, so
      // they can only run after it, and they run in parallel with each other.
      if (body.enrich && platform === "linkedin" && data?.data?.id) {
        const company_id = String(data.data.id);
        const [insights, jobs] = await Promise.all([
          scSoft("/linkedin/company/insights", { company_id }, fresh),
          scSoft("/linkedin/company/job-count", { company_id }, fresh),
        ]);
        out.insights = insights?.__unavailable ? null : (insights?.data || null);
        out.jobs = jobs?.__unavailable ? null : (jobs?.data || null);
      }
      return res.status(200).json(out);
    }

    // ── reactors — the people who reacted to a post. Zernio reports HOW MANY
    //    reactions a post got; it cannot say who, because a reaction is not
    //    something the connected account holds. The public post page can, and
    //    that is what SocialCrawl reads.
    //
    //    The item shape is not pinned down in SocialCrawl's spec, so this
    //    passes the list through as it comes and the UI reads defensively —
    //    inventing a shape here would only move the guessing one layer down.
    if (mode === "reactors") {
      await requireOrgMember(user.id, orgId);
      await requirePaidSocial(orgId);
      const url = String(body.url || "");
      if (!/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(url)) {
        throw new HttpError(400, "A LinkedIn post URL is required", "invalid_url");
      }
      const data = await scfetch("/linkedin/post/reactions", { url }, !!body.fresh);
      const items = data?.data?.items;
      return res.status(200).json({
        reactors: Array.isArray(items) ? items.slice(0, 50) : [],
        total: data?.data?.total ?? null,
        credits: { used: data?.credits_used ?? null, remaining: data?.credits_remaining ?? null },
      });
    }

    // ── presign — direct-upload URL for post media (client PUTs the file itself,
    //    so media bytes never pass through this function) ──
    if (mode === "presign") {
      await requireOrgMember(user.id, orgId);
      // Publishing bills upstream as well, and a lapsed account keeps whatever
      // it had connected — so this cannot lean on "they have no accounts".
      await requirePaidSocial(orgId);
      const { filename, contentType, size } = body;
      if (!filename || !contentType) throw new HttpError(400, "filename and contentType required", "invalid_media");
      const data = await zfetch("/media/presign", { method: "POST", body: { filename, contentType, size } });
      return res.status(200).json({ uploadUrl: data.uploadUrl, publicUrl: data.publicUrl });
    }

    // ── post — create/schedule/publish a post ──
    if (mode === "post") {
      await requireOrgMember(user.id, orgId);
      await requirePaidSocial(orgId);
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
