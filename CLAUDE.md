# Capozy Hub

Ghana digital-services platform: mobile data bundles, airtime, WAEC/BECE results-checker vouchers, MTN AFA registration, a reseller system (customer, agent, dealer, sub-agent), member storefronts, and a public developer API. Built from the KiNG FLEXY GH codebase and being turned into its own product. **Nothing here may read, look or behave like KiNG FLEXY.**

Stack: Next.js 15 (App Router) + React 18, TypeScript, Tailwind 3 + shadcn/ui, Supabase (Postgres, Auth, Realtime), Paystack, Resend, Upstash Redis (rate limits), deployed on Vercel. Path alias `@/*` is the repo root. Product name, domain and URLs come from `lib/brand.ts` (`BRAND`); never hard-code them.

## Commands

```powershell
npm run dev                  # next dev
npx tsc --noEmit             # typecheck (ignore stale errors under .next/types; delete .next to clear)
npx next build               # production build
npx tsx scripts/test-<name>.ts   # one guard test
npm run lint
```

- `npm run test:guards` chains the guard tests with `&&`, so one failure hides the rest. Run them individually; they need `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` set to dummy values.
- `next build` needs the same placeholders plus `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` and `RESEND_API_KEY=re_placeholder`.
- `next build` exiting 0 does **not** prove the UI is styled. `postcss.config.mjs` must be tracked (the `*.mjs` ignore rule once dropped it and Tailwind silently never ran). Check that the built CSS contains utilities (`.flex{`) and no literal `@tailwind`.
- Windows: PowerShell 5.1. Write files with `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding($false)))`, because `Set-Content -Encoding utf8` writes a BOM. Pass commit messages with `git commit -F <file>`, not `-m`. PowerShell variables are case-insensitive (`$s` and `$S` are one variable).

## Scope and the `_parked/` rule

The product was scoped down on purpose. Removed features live in the gitignored `_parked/` folder (original paths preserved), outside the build and never pushed. **Tracked code must never import a parked file; the pushed repo must build from a fresh clone.** Parked: utility bills, Hubtel (all of it), Moolre, MoMo "Send & Claim" (SMS-forward wallet top-up; parked 2026-11-25 as a second payment rail), the commission wallet, the SMS product (shop/business SMS, sender IDs, credits), USSD, Google/passkey/PIN/biometric/phone-OTP auth, the signup promo. Full plan and order: `docs/stage-1-5-scope-down.md`.

What is in scope now:
- **Payments and payouts: Paystack only** (collections, MoMo transfers, bank list). Ghana bank account names cannot be auto-resolved; the withdraw flow falls back to a typed name that an admin confirms.
- **Auth: email + password only.** Signup creates `customer` only; roles change only through service-role updates. The dashboard gate is just "signed in".
- **Email: Resend only** (`lib/email-service.ts`: `sendEmail` from support@, `sendReceiptEmail` from receipts@).
- **SMS:** `lib/sms-service.ts` is a provider-neutral seam with no transport wired, so `sendSMS` returns "SMS is not configured". Callers treat a failed send as non-fatal. Only admin broadcast SMS is kept (`app/admin/sms-broadcast`).
- **Fulfillment:** data bundles go through supplier adapters the owner brings (Rexamart is wired: `lib/rexamart-service.ts`, webhook `app/api/webhooks/rexamart`). The admin Fulfillment page has a "No suppliers yet" state. **Airtime is fulfilled manually** from `/admin/airtime`.

## Architecture

- `app/dashboard/*` member app; `app/admin/*` admin console; `app/shop/[shopSlug]` and `app/shop-domain/[shopSlug]` storefronts (middleware rewrites the shop subdomain to `/shop-domain/...`); `app/agent-domain`; `app/developers` public API docs; `app/api/*` routes.
- Nav: `components/dashboard/nav-config.ts` (member groups, shop menu, admin groups; secondary pages sit under a per-group `more` list) rendered by `components/dashboard/sidebar.tsx`.
- Roles (`lib/roles.ts`): `admin`, `sub-admin`, `dealer`, `agent`, `subagent`, `customer`. Use `effectiveRole` (expiry applied) for pricing and `userRole` for permissions.
- `middleware.ts` is security-critical: CORS allowlist, rate limits, API-key shape check, fail-closed money endpoints, host rewrites. Edit it carefully and rerun the guard tests.

### Supabase clients (`lib/supabase.ts`, `lib/supabase-server.ts`)
- `supabase`: browser client.
- `createRouteClient()`: cookie session, **RLS enforced**. Use in user-facing routes.
- `createServerClient()`: **service role**, bypasses RLS. Only for admin, cron and webhook code, and only where intended. Any query using it must scope by user explicitly (`.eq('user_id', user.id)`).

### Money rules
- All balance changes go through Supabase RPCs, never a direct `UPDATE`. Money endpoints take a unique `reference` as an idempotency key.
- Paystack webhooks verify the HMAC-SHA512 signature over the **raw** body before trusting anything.
- Cron routes call `validateCronAuth(request)` (`lib/cron-utils.ts`) as the first statement.
- Every `new Ratelimit(...)` needs a literal, globally unique `prefix` (middleware uses `czh:<name>`); `scripts/test-ratelimit-prefixes.ts` enforces this. Developer-API `consumeRateLimit` buckets use an `api-` prefix.

### Developer API
One key type, `standard`. New keys start `cs_live_` (cs = commission services); older `cz_live_` keys stay valid until regenerated. The format lives in `lib/api-key-format.ts` and is shared by key generation, `validateApiKey`, middleware and admin approval (`app/api/user/api-keys`). `validateApiKey` (`lib/api-auth.ts`) refuses any other `key_type`. A route is public only if it matches `lib/developer-api.ts` `DEV_API_PATTERNS`; add a route there and in `public/openapi.yaml`, and `scripts/test-developer-api.ts` plus `scripts/check-ai-discoverability.ts` will tell you if they drift. Order webhooks: `lib/api-webhook.ts`.

### Crons: Vercel Schedules
`app/api/cron/*` has 20 routes. 16 run from `vercel.json` `schedules` (path targets, `requestMethod: "GET"`; Vercel sends `Authorization: Bearer $CRON_SECRET`, which `validateCronAuth` checks). Nothing runs more often than every 15 minutes, so the config deploys on Hobby as well as Pro. Four routes are deliberately unscheduled pending an owner decision: `delete-old-orders`, `delete-old-complaints`, `auto-complete-data`, `daily-greeting`. `scripts/test-cron-schedules.ts` fails if a route is neither scheduled nor on that list, or if a schedule points at a missing route. Never add legacy `crons` alongside `schedules` (routes would run twice). `.github/workflows/cron.yml` is manual-dispatch only.

## Database
- Migrations live in `supabase/migrations`; the baseline is trimmed last (full copy kept locally). Apply SQL with `node scripts/apply-sql.js` (transactional; reads `CAPOZY_DB_URL` from env or the gitignored `.env.db`), not by pasting large SQL through MCP calls.
- The live Capozy Supabase project is the `supabase-capozy` MCP server. **Never write to project `ubvjtacdmwynqcxuposj`**: it is the old KiNG FLEXY production database, and `apply-sql.js` refuses it.
- Any new signup path must go through `handle_new_user`. Audit SECURITY DEFINER functions that write `users.role`.
- Never print or save env values. Production secrets must be Vercel **Sensitive** variables; rotate anything that was ever stored as plain.

## Design
Palette follows the logo (`brand/capozy-logo-source.jpg`): black, gold (`brand-500` `#F6C30F`) and silver/white. Surfaces use the `neu-*` classes, buttons the `clay-*` classes (`clay-gold`, `clay-silver`, `clay-black`), fonts `--font-display` (Bricolage Grotesque) and `--font-body` (Figtree). Regenerate icons with `node scripts/generate-brand-assets.js`.

**The Capozy UI preset** is defined by the landing page and the account pages and written down in `.claude/skills/capozy-page-redesign/PRESET.md`. Every page, public, member and admin, must match it; the old white-card / `slate-*` / `violet-*` / `emerald-*` look is the thing being removed. Check a finished reference page (`app/auth`, `app/dashboard/shop/*`, `app/dashboard/upgrade`) before building a new one.

When redesigning a page: change layout **and** tone (headings, empty states, button labels, toasts, helper text in plain, direct language), not just colours, and audit the page for bugs while you are in it. One reviewable commit per page.

## Working agreements
- Work in staged, build-gated steps: `npx tsc --noEmit`, `npx next build`, the guard tests, then commit locally. **Push only after the owner approves.**
- Use the `payments-security-reviewer` agent on any route that touches money, wallets, fulfillment or roles; use `/code-review` and `/security-review` before pushes. Superpowers skills (brainstorming, writing-plans, TDD, verification-before-completion) apply as usual.
- Never reintroduce a removed feature, a second payment or email provider, or a hard-coded supplier. Parked means parked.
