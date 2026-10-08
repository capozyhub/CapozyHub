# Stage 1.5 — scope-down plan

Decided with the owner on 2026-10-08. This is the working plan; update it as areas complete.

## Principles
- Removed features are **parked** in a gitignored `_parked/` folder: kept on disk, outside the Next build, never pushed.
- The pushed repo must build from a fresh clone. No tracked file may import a parked file.
- DB work is code + migration files only. Nothing is applied to the live Capozy Supabase project before Stage 4.
- One area per pass. Each pass ends with a verified local commit. Push only after owner approval.

## Verification gate (every area)
Fresh clone of `HEAD` in a scratch directory (committed files only), then `npm ci`, `npx tsc --noEmit`, `npx next build`. All must pass before anything is pushed. Commits stay local until the owner approves.

Build-time placeholders (dummy values, not credentials) are needed because some modules read env at import time:
`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY=re_placeholder` (`lib/email-service.ts` constructs `new Resend()` at import and throws without it).

Baseline results: upstream snapshot typechecks clean. Pushed `53a49af` failed with 4x TS2307 (fixed in `42f015a`). `42f015a` passes `tsc` and `next build` (351/351 pages).

## Scope

| Remove / park | Keep |
|---|---|
| Shop SMS, business SMS, SMS fallbacks, mNotify / Moolre / Hubtel SMS providers | Admin broadcast SMS |
| Google sign-in, passkeys, PIN app-lock | Email + password login |
| OTP verification, phone-based recovery | Email-based password recovery |
| Utility bills | — |
| Hubtel (checkout, receive-money, commission, airtime rail, SMS DLR) | Paystack (payments and transfers) |
| Moolre (payouts, SMS) | — |
| All 10 hardcoded suppliers, webhooks, fallback chains | Admin fulfillment page with a "No suppliers yet" empty state |
| Brevo, MailerSend | Resend |
| USSD (already untracked) | — |

Public developer API is kept. Renaming it (no v1/v2 in paths, Capozy key prefix, docs on capozygh.com) happens in Stage 2.

## Order
0. Repair and baseline: fix tracked imports of parked USSD code, create `_parked/`, measure the upstream build.
1. Utility bills
2. SMS
3. Hubtel and Moolre
4. Auth (Google, passkeys, PIN, OTP, phone recovery) and email recovery
5. Email consolidation to Resend
6. Suppliers (empty state, generic `supplier_id` / `supplier_reference` columns in place of supplier-specific ones)
7. Baseline SQL trim (full copy kept local)

Each area also removes its cron routes and any `vercel.json` / workflow entries.

## Known consequences
- Data, airtime, AFA and results-checker orders cannot fulfill until a supplier is configured.
- The trimmed baseline is validated in Stage 4 against the empty Capozy project, together with the Stage 5 money-table checks.
