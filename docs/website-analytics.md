# Website analytics

The marketing website sends one event per visible page load to the app's Edge endpoint `/api/website-track`. All published English and German HTML pages load `/website-analytics.js`. Local and preview hosts do not count.

The existing `/?admin` overview displays today's estimated visitors, sums of daily visitors over 7/30 days, page views, a daily chart, countries, first referring domains and page rankings. Multi-day totals are visitor-days, not distinct people. Shared IPs count together. Fast repeat views within two seconds and more than 1,000 views per IP/day are suppressed. Known bot user agents, DNT and GPC are excluded; this is an estimate, not a fraud-proof counter.

## Database and release

`supabase/website-analytics.sql` was applied to the existing agency-os project via Supabase migration `website_analytics`. It is a one-time schema definition; do not apply it again to that database. The tables and functions are accessible only to `service_role`. The existing admin endpoint verifies the session and `ADMIN_USER_IDS` before requesting aggregates. Analytics failure does not break the rest of the admin overview.

Deploy the app first, then the marketing website through their existing Vercel projects. No new environment variables are required: the endpoint uses existing server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). The HMAC is domain-separated and changes with the Berlin calendar date. The endpoint uses Vercel's trusted IP and country headers; requests without the trusted IP header do not count. Never expose the server key in website code.

The endpoint accepts only https://i7os.com and https://www.i7os.com. The site sends only a fixed public page path and referrer origin. Query strings, fragments and raw IPs are not stored. Countries and referrer domains belong to the first counted visit of the day. Old entries outside 90 calendar days are removed on the next event; without further traffic they remain until cleanup is run. Both privacy pages describe the collection.

## Verification

Run `node scripts/test-website-analytics.mjs` and `npm run check && npm run build` in the app. The endpoint tests mock database transport and use synthetic IP addresses. Database aggregation, repeat suppression and permissions were also checked transactionally with rollback so no synthetic traffic is retained.

After deployment, open a production marketing page with DNT/GPC disabled, then refresh `/?admin` and verify the count. Historical traffic before deployment cannot be reconstructed. Source may be unknown when the browser or linking site omits a referrer.
