// Which model each AI provider runs when a person has not chosen one, and how a
// chosen one is checked.
//
// Imported by the app (Settings shows the default next to the choice) AND by
// api/chat-multi.js (which sends it), so keep it dependency-free, the same way
// src/entitlements.js is. The two used to disagree by construction: the server
// had three model names written into its request code, and the app had none,
// so nobody could read what they were paying for.
//
// Checked against each provider's own model list on 2026-09-19. The old
// defaults were claude-sonnet-4-20250514 (no longer on Anthropic's list of
// available models), gpt-4o and gemini-2.5-flash.
export const AI_DEFAULT_MODEL = {
  claude: "claude-sonnet-5",
  openai: "gpt-5.6-terra",
  gemini: "gemini-3.5-flash-lite",
};

// What a model id may look like before it goes into a url or a request body.
export const AI_MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

// The model to use for `provider`: the person's choice when it is a plausible
// id, otherwise the default.
export function aiModelFor(provider, models) {
  const m = models && models[provider];
  return typeof m === "string" && AI_MODEL_ID_RE.test(m) ? m : (AI_DEFAULT_MODEL[provider] || null);
}
