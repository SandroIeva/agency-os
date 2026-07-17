# Stripe Billing setup

The implementation uses Stripe-hosted Checkout and the Stripe Customer Portal.
Subscriptions belong to an i7OS workspace. A workspace admin can subscribe or
open the portal; all workspace members can see the current plan in the app.

## 1. Create the Stripe products and recurring prices

Create three products in Stripe and add the following recurring prices. The
annual price is charged once per year; the UI displays its monthly equivalent.

| Product | Monthly price | Annual price |
| --- | ---: | ---: |
| Starter | EUR 15 / month | EUR 144 / year |
| Pro | EUR 24 / month | EUR 240 / year |
| Agency | EUR 85 / month | EUR 864 / year |

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

## 6. Test before going live

Use Stripe test mode first. Run the app through `vercel dev` so the local API
functions are available, complete Checkout with a Stripe test card, and verify:

1. The webhook returns HTTP 200.
2. `workspace_subscriptions` contains the correct workspace, plan, and status.
3. The Billing settings show the active plan.
4. The Customer Portal opens only for workspace admins.
5. Cancelling or changing a subscription updates the app after the webhook.

Only after the complete test-mode flow succeeds should the Vercel variables be
switched to Stripe live-mode keys and live price IDs.
