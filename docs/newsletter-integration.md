# Loops product updates

Contact sync runs only on explicit answers in the onboarding tour, newsletter dialog or Settings. It does not import existing users or send campaigns/events.

## Configuration

- Set `LOOPS_API_KEY` in the Vercel **agency-os** project. Never use a `VITE_` prefix.
- Create the mailing list **i7OS Product Updates**. The server resolves this exact name; missing/duplicate names produce a visible sync error.
- Optional: `LOOPS_PRODUCT_UPDATES_LIST_ID` pins the list ID and avoids the list lookup.
- Deploy the code before testing in production. Plain Vite at port 5173 does not serve `/api/send`; use `vercel dev` with server environment variables for local end-to-end testing.

## Behavior

`POST /api/send` with `{ mode: "newsletter", subscribed: true|false, source: "tour"|"dialog"|"settings" }` requires a verified signed-in account. The server derives email and user ID from Supabase Auth, never from the request body. It stores consent, server timestamp and source on the existing profile, then updates Loops.

YES upserts email, user ID, optional first/last name and membership in the product updates list. Explicit YES also sets global subscribed=true, allowing a user to deliberately opt in again. There is no login/background resubscription.

NO first finds the contact. A person who is not in Loops is not created. Existing contacts leave only the product updates list; unrelated list preferences and global unsubscribe status remain untouched. Send product update campaigns to this mailing list, not the entire audience.

The Settings switch is available to every signed-in user. The separate dashboard prompt still has its existing operator preview gate; this change does not launch that prompt for all users.

## Failures and current scope

A database failure stops before any Loops request. Provider/configuration/time-out failures preserve the recorded decision and show a bilingual retry message. The tour stays open on failure. Requests are serialized within the browser to prevent rapid double clicks. No durable background retry queue is included: retry the same choice after a sync error.

Loops email-unsubscribe links still suppress delivery inside Loops, but a webhook back to the i7OS preference display is not yet included. Welcome/trial sequences, historical consent backfill, contact-language custom properties, and account-deletion synchronization are separate follow-up work.

## Verification

`node scripts/test-newsletter.mjs` covers consent, account identity, list selection, refusal without contact creation, withdrawal, validation, database/provider errors and timeout. `npm run check` and `npm run build` cover the app.

After deployment, use an account you own to accept product updates, confirm the contact is on **i7OS Product Updates**, then switch the setting off and confirm list membership becomes false. Existing Loops workflows could react to contact/list changes; do not run this test with someone else's address.
