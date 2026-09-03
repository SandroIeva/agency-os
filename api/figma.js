// Figma → Artboards. Designs come IN; nothing goes back out.
//
// A Figma connection belongs to the WORKSPACE, like Pinterest and unlike the
// messenger links: the files a team imports from are the team's, and a second
// person on the same board should not have to connect again to see where a
// design came from.
//
// Edge runtime → does NOT count against the Hobby 12-function Node limit, which
// is already at 11 of 12. Nothing here needs Node.
//
// Verbs. The first needs no secret and answers for itself:
//   GET  ?check=1                     → is it configured, and which commit is live
//   GET  ?mode=install&state=<token>  → send somebody to Figma's consent screen
//   GET  ?mode=callback&code=…        → Figma sends them back here (/figma/callback)
export const config = { runtime: "edge" };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// What the importer actually needs, and nothing else: a scope list is read by
// the person clicking Allow.
//
// file_content:read is the current scope for reading nodes; `files:read` is the
// deprecated blanket one and is deliberately not used. file_metadata:read is
// here so the import can name the file it is about to pull, which is worth
// asking for NOW rather than later: a token keeps the scopes it was issued
// with, so widening the list strands every connection made before the change.
// That is not a guess, it is what happened to Pinterest in this codebase.
//
// file_variables:read is Enterprise-only and therefore not requested at all:
// asking for it would put a permission most accounts cannot grant on the
// consent screen.
const SCOPES = ["file_content:read", "file_metadata:read"];

export default async function handler(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const check = url.searchParams.get("check");
  if (req.method !== "POST" && !mode && !check) return json({ error: "Method not allowed" }, 405);

  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;
  const appUrl = (process.env.PUBLIC_APP_URL || "https://app.i7os.com").replace(/\/$/, "");
  const redirectUri = `${appUrl}/figma/callback`;

  // Names of what is missing, never values.
  const missing = [
    !clientId && "FIGMA_CLIENT_ID",
    !clientSecret && "FIGMA_CLIENT_SECRET",
  ].filter(Boolean);

  // ── Health. Answers even when nothing is set up: that is the question it
  //    exists to answer, and it is how a deploy can be checked without a
  //    secret and without anybody being asked to run something.
  if (check) {
    return json({
      configured: missing.length === 0,
      missing: missing.length ? missing : undefined,
      scopes: SCOPES.join(","),
      redirect_uri: redirectUri,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    });
  }

  if (missing.length) {
    return json({ error: "Figma is not configured", code: "not_configured", missing }, 503);
  }

  return json({ error: "Not implemented yet", code: "todo", mode }, 501);
}
