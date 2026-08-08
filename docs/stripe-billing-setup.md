# Stripe Billing setup

The implementation uses Stripe-hosted Checkout and the Stripe Customer Portal.

**A subscription belongs to a PERSON, not a workspace.** The paying account is
the user who created a workspace (`organizations.created_by`), and their plan
covers every workspace they own, with one pooled storage and seat allowance.
Only that owner can subscribe or open the portal; everyone else sees the plan
read-only. The older per-workspace table `workspace_subscriptions` is still
written to during the transition but nothing reads it.

## Plan limits

| | Free | Basic | Pro | Max |
|---|---|---|---|---|
| Storage (per account) | 1 GB | 5 GB | 25 GB | 100 GB |
| Seats (per account) | 1 | 1 | 5 | 12 |
| Projects | — | 3 | unlimited | unlimited |
| Workspaces | 1 | 1 | 5 | unlimited |

Every number lives in **`src/entitlements.js`** (imported by both the browser
bundle and the serverless functions) and in the **`plan_limits`** table, which
the enforcement triggers read. Enforcement genuinely runs in two runtimes that
cannot call each other, so a limit change has to be made in **both** places.

New signups get a **7-day trial without a credit card**, started by a trigger on
`organizations` insert and granting Basic entitlements. An expired trial is
still stored as `status = 'trialing'`; the expiry is resolved in
`resolveEntitlements()` and `account_plan()`, not by a scheduled job.

`billing_accounts.plan_override` grants a plan outside Stripe (internal and
comped accounts). The webhook never writes that column — a plan written straight
into `plan` would be reverted on the next subscription event.

## 1. Create the Stripe products and recurring prices

Create three products in Stripe and add the following recurring prices. The
annual price is charged once per year; the UI displays its monthly equivalent.

| Product | Monthly price | Annual price |
| --- | ---: | ---: |
| Basic (key `starter`) | EUR 15 / month | EUR 144 / year |
| Pro (key `pro`) | EUR 24 / month | EUR 240 / year |
| Max (key `agency`) | EUR 85 / month | EUR 864 / year |

Connectable social accounts per plan — 1 / 2 / 5, and none at all on a cardless
trial. These are a direct cost: the upstream provider bills per connected
account, so the allowance is what keeps a plan profitable. The numbers live in
`src/entitlements.js`; changing them here alone changes nothing.

Copy the generated `price_...` IDs into the matching Vercel environment
variables listed in `.env.example`.

## 2. Add server secrets to Vercel

Configure these values for Preview and Production in the **i7os-app** Vercel
project:

- `PUBLIC_APP_URL=https://app.i7os.com`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or the legacy `SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`)
- `STRIPE_SECRET_KEY`
- all six `STRIPE_PRICE_...` IDs
- `CRON_SECRET` — required by the lifecycle sweep; without it the endpoint
  refuses every request, so it is not publicly callable
- `LIFECYCLE_PURGE_ENABLED` — leave **unset** at first. The sweep then runs,
  records what it would have deleted, and touches nothing. Set it to `true`
  only after reviewing `account_lifecycle_log` (see below).

Never add server secrets to a `VITE_...` variable.

## 3. Apply the Supabase migration

Review and apply:

`supabase/migrations/20260717134517_create_workspace_subscriptions.sql`

The table has Row Level Security enabled and is not directly exposed to browser
clients. Billing endpoints verify the Supabase access token and workspace role,
then use the server-side secret key.

## 4. Configure the Stripe webhook

Create a Stripe webhook endpoint for:

`https://app.i7os.com/api/stripe-webhook`

Subscribe it to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy its `whsec_...` signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel.

## 5. Configure the Customer Portal

In Stripe, enable the Customer Portal for the platform account. At minimum,
allow customers to update payment methods, view invoices, and cancel their
subscription. If plan switching is enabled, add all six recurring prices to the
portal product catalogue.

Plan switching matters more than it used to: an upgrade from Basic to Pro runs
through the portal, so all six prices must be in its product catalogue. Without
that, the only way to change plan is to cancel and buy again.

## 6. Test before going live

Use Stripe test mode first. Run the app through `vercel dev` so the local API
functions are available, complete Checkout with a Stripe test card, and verify:

1. The webhook returns HTTP 200.
2. `billing_accounts` contains the correct owner, plan, and status.
3. The Billing settings show the active plan.
4. Checkout and the Customer Portal open only for the workspace **owner** —
   an invited admin gets `owner_required`.
5. Cancelling or changing a subscription updates the app after the webhook.

Only after the complete test-mode flow succeeds should the Vercel variables be
switched to Stripe live-mode keys and live price IDs.

## 7. Account lifecycle (automatic deletion)

`api/lifecycle-sweep.js` runs daily via Vercel Cron (`vercel.json`) and reclaims
space from accounts that have had no plan for a long time. Storage objects are
~99% of what an abandoned workspace costs, so they go first and the structure
survives long enough that a returning user can still convert.

| Day | Action | Ever paid |
|---|---|---|
| 0 | Workspace becomes read-only | — |
| 16 | Warning email (`mode: "lifecycle-warning"`) | day 46 |
| 30 | Storage objects deleted | day 60 |
| 90 | Workspace rows deleted | day 180 |

Accounts that ever paid get double the window, because a failed card payment
moves a Stripe subscription to `canceled` and is indistinguishable from a real
cancellation.

Safeguards, all deliberate:

- Nothing happens without `LIFECYCLE_PURGE_ENABLED=true`; until then every
  candidate is recorded as `dry_run`.
- At most 25 accounts per run.
- Every action is written to `account_lifecycle_log`, including the reason —
  the record outlives the data it describes.
- `billing_accounts.purge_exempt = true` removes an account permanently.
- The `auth.users` row is never deleted, so the person can still sign in and
  see what happened.
- `refresh_access_ended()` clears the clock the moment access returns, so a
  returning customer cannot be caught by a purge already in progress.

**Is the job alive?** Every run writes a `heartbeat` row, even when nothing was
due — so an empty log means the job is NOT running, never "all quiet". Check the
most recent runs:

```sql
select * from public.account_lifecycle_runs limit 14;
```

**Before arming it**, inspect who it would have deleted. `dry_run` rows name the
accounts and the reason:

```sql
select action, owner_user_id, detail, created_at
from public.account_lifecycle_log
where action <> 'heartbeat'
order by created_at desc limit 50;
```

Nothing appears until an account has been without a plan for ~16 days, so plan
the review around the first warning date rather than the day after deploying.
