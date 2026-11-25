# 2026-11-25 — Money, live-DB and parked-residue sweep (stages G, H, I)

## Context
First run of the recurring audit kit, adapted to Capozy. Covered: money RPCs and races (G),
live grants / RLS / SECURITY DEFINER functions on project `opcdtgzpzxxjzfdafday` (H), and
parked-feature residue plus brand leaks (I). Read-only: SELECTs against the live DB, no writes.
Not covered this round: the uncommitted working tree (support/announcement API routes),
storefront checkout end to end, developer API, performance advisors.

## Status (same day)
- Suspension self-lift, `shop_pricing` owner writes, `shop_profiles` column pins:
  `supabase/migrations/20261125b_audit_lockdowns.sql`. **Written and committed; not yet applied
  to the live project.**
- Top-up amount check now fails closed in `lib/payments.ts` (wallet + agent upgrade) and
  `lib/dealer-payments.ts`. `lib/payment-reconciliation.ts` only takes the `/charge` fast path
  when it carries an amount.
- MoMo Send & Claim parked (owner decision): routes, webhook, admin page and wallet tab moved
  to `_parked/`; the wallet page reads Paystack fee/limits from the new
  `/api/wallet/topup-settings`. `claim_momo_transaction` is service-role only and has no caller.
- Sub-agent retail ceiling re-enabled (owner decision) in `computeSubAgentCost`, plus a
  save-time check in `buildValidatedWrites` so recruiters see an error instead of items
  silently disappearing. Results-checker ceiling is the single-unit customer price (a bulk
  tier is the same price for every role, so a bulk ceiling would reject any markup).
  Live had 0 saved markups, so nothing existing became unavailable.
- Reviewed by `payments-security-reviewer`: no critical/high findings.
- Crons: 16 routes scheduled via `vercel.json` `schedules` (path targets, GET, every 15 min at
  most). Held back for an owner decision: `delete-old-orders` (hard-deletes all orders > 90
  days), `delete-old-complaints` (deletes complaints > 30 days regardless of status),
  `auto-complete-data` (toggle unset = ON; marks data orders stuck 30 min as completed with no
  delivery proof), `daily-greeting` (daily push to every subscriber).
- **New, High: every Vercel env var is type `plain`, not Sensitive.** The service-role key,
  Paystack secret, CRON_SECRET, Resend, Rexamart, Upstash and VAPID keys are readable by anyone
  with project access and through the API (the env listing returned their values). CLAUDE.md
  requires Sensitive variables and rotating anything ever stored as plain.
- **New, Low: `BREVO_API_KEY` is set but unused** (no code references it). A second email
  provider is out of scope; delete the variable and revoke the key at Brevo.
- Still open: leaked-password protection (dashboard toggle);
  `scripts/test-subagent-create.ts` duplicate-phone cases fail since the 2026-10-08
  non-unique-phone auth change (pre-existing, unrelated).

## Findings

### [High] Suspended user can lift their own permanent suspension — CONFIRMED
- Where: live trigger `guard_users_privilege_change()` + RLS policy `users_update_combined`;
  `app/api/cron/auto-unsuspend/route.ts:25-36`; `app/dashboard/dashboard-layout-client.tsx:130-131`.
- Who: any signed-in user whose account is suspended.
- How: `authenticated` has table-level UPDATE on `users`, and the RLS policy lets a user update
  their own row. The guard blocks `role`, `status`, expiry, PIN and email, but **not**
  `suspended_until`, `suspension_reason`, `suspended_at` or `suspended_by`. A permanently
  suspended user (`suspended_until IS NULL`) PATCHes `/rest/v1/users?id=eq.<self>` with
  `suspended_until=2000-01-01`. The dashboard gate immediately treats the suspension as lapsed,
  and the auto-unsuspend cron (once crons are scheduled) flips `status` back to `active` because
  it matches `status='suspended' AND suspended_until <= now()`. The user can also rewrite
  `suspension_reason` / `suspended_by`, which falsifies the record admins rely on.
- Impact: ban evasion; tampered audit fields.
- Fix: add the four `suspended_*` columns to the `auth.uid() IS NOT NULL` block in
  `guard_users_privilege_change()`. Admin suspend/unsuspend and the cron use the service role
  (auth.uid() NULL), so they are unaffected.

### [High, scope question] MoMo "Send & Claim" is a live second top-up rail
- Where: `app/api/webhooks/sms-forward/route.ts`, `claim_momo_transaction`,
  `app/dashboard/wallet` (ClaimPanel / ClaimWaitingModal), `app/admin/momo-claims`.
- CLAUDE.md says payments are Paystack only; this rail credits wallets from forwarded MoMo SMS
  and is not mentioned in `docs/stage-1-5-scope-down.md`. Live: 0 `momo_transactions` rows.
- Risk while it stays live (SUSPECTED, depends on the forwarder phone's config):
  - The webhook trusts only the SMS **text**. It never checks the SMS sender ID, so if the
    forwarder app forwards every inbound SMS, anyone who texts the merchant number a message
    shaped like "Payment received for GHS 5000.00 from X ... Reference: BOOK45 ... Transaction ID:
    12345678901" gets auto-credited to whoever owns `BOOK45`.
  - `momo_max_claimable` is 50,000 GHS, so the auto-claim ceiling is effectively unlimited.
  - Reference codes are low-entropy (39 words x 900 numbers x 2 orders ≈ 70k, `Math.random`),
    so a target's code is guessable.
- Decision needed: park it (it fits the "Paystack only" rule), or keep it and (a) allowlist the
  carrier sender IDs from the forwarder payload, (b) drop the auto-claim cap to a small amount
  with admin review above it, and (c) use `crypto.randomInt` for codes.

### [Launch blocker] Payment reconciliation never runs — CONFIRMED
- `vercel.json` has no `crons`/`schedules`. All 20 cron routes call `validateCronAuth` first
  (constant-time compare, verified), but none are triggered. This includes
  `verify-pending-payments`, `sync-paystack-withdrawals`, `refulfill-pending-orders` and
  `auto-unsuspend`. Already noted in CLAUDE.md; restated because it is still unfixed.

### [Medium] Shop owners can write `shop_pricing` directly, bypassing route validation — CONFIRMED (latent)
- Where: RLS policies `shop_pricing_insert/update_owner_or_admin` + table UPDATE grant;
  route rules in `app/api/shop/pricing/route.ts:161-238`.
- The route enforces `data_profit_max_<role>` and the `sub_price` bounds (>= cost + margin,
  <= customer price). A direct PostgREST write skips both. Checkout re-checks only
  `profit > 0` (`lib/shop-checkout.ts:319`), so a negative price is still blocked.
- Today no `data_profit_max_*` setting exists live, so there is no cap to bypass yet. It becomes
  a real gap the day one is set.
- Fix: drop the owner INSERT/UPDATE policies on `shop_pricing` (the route already writes with
  the service role) and keep owner SELECT/DELETE as needed.

### [Medium] Sub-agent price ceiling disabled "temporarily" since 2026-09-14 — CONFIRMED
- `lib/pricing/sub-agent-cost.ts:51-63`: the `subCost > customerPrice` reject is commented out
  "until testing is done". A recruiter's markup can push a sub's cost above the public retail
  price. Re-enable before launch, or record it as an owner decision.

### [Low] Owner-writable `shop_profiles` columns not pinned by `protect_shop_admin_columns`
- `pricing_status`, `pricing_approved_at/by`, `pricing_note`, `approval_note`, `ussd_code`,
  `ussd_active`, `sms_sender_status` are writable by the owner. Today `auto_approve_pricing_*`
  is unset (defaults to auto-approve), and USSD and shop SMS are parked, so there is no live
  impact. Pin them anyway so turning on manual pricing review later can't be bypassed with a
  direct PATCH.

### [Low] Top-up amount check skips when provider amount is missing
- `lib/payments.ts:44-49` skips the mismatch check unless `providerMetadata.amount` is a number.
  All 5 callers pass Paystack's own transaction object, so this can't be triggered today. Make it
  fail closed: refuse to credit when the amount is absent.

### [Info] Leaked-password protection is off (Supabase Auth advisor). Enable it in the dashboard.

## Verified clean
- Only 3 SECURITY DEFINER functions are executable by `anon`/`authenticated`: `is_admin`
  (harmless), `delete_shop_data` (scoped to `auth.uid()`; NO ACTION FKs on orders make it fail
  and roll back for any shop with history), and `get_user_transactions_with_balance` (rejects
  `auth.uid() <> p_user_id`).
- Broad table grants to `anon`/`authenticated` exist on ~45 tables (mostly parked ones), but every
  table has RLS on, and those without write policies deny by default. The 22 "RLS enabled, no
  policy" advisor items are all intentional server-only tables.
- Wallet RPCs: `complete_wallet_topup` locks the payment row before the status check. The
  check-before-debit RPCs (`place_data_orders`, `place_airtime_order`,
  `place_results_checker_order`) are backed by UNIQUE indexes on `reference_code`, so a
  concurrent duplicate rolls back its own debit instead of double-charging. Refunds are backed by
  `uq_wallet_tx_refund_reference`.
- Shop withdrawals: `process_shop_withdrawal` is service-role only, and the server sets
  `p_name_verified`. The Paystack transfer-approval webhook is default-deny and amount-matched.
- No tracked file imports `_parked/`. No KiNG FLEXY / KFT strings in app code (only the deliberate
  guards in `scripts/apply-sql.js` and `scripts/check-ai-discoverability.ts`). `app/api/commission`,
  `utilities` and `sms` are empty folders.

---

# Stage E: developer API and webhooks (same day)

Migration `20261125b` verified live after the owner applied it: definitions match, owner
INSERT/UPDATE policies on `shop_pricing` are gone, and two rolled-back tests as a signed-in user
confirmed a suspended user cannot change `suspended_until` and an owner cannot insert
`shop_pricing` or set `ussd_code`. Advisors unchanged.

## Findings
- **[High, config] `REXAMART_WEBHOOK_SECRET` is not set in Vercel.** `app/api/webhooks/rexamart`
  fails closed with 503 for every delivery, so asynchronous supplier updates (failed, refunded,
  late completion) never land; orders stay `processing`. Add the secret (Sensitive) from the
  Rexamart dashboard.
- **[Medium, fixed] Developers never got order webhooks for Rexamart-fulfilled orders.**
  `notifyDataOrderWebhook` was only called from the admin status route and the unscheduled
  auto-complete cron. The Rexamart webhook now calls it after its guarded update.
- **[Low, fixed] Bare promises dropped on Vercel:** Rexamart push notifications (now
  `waitUntil`); `last_used_at` and `api_logs` writes in `lib/api-auth.ts` (now `waitUntil`; that
  file is also being changed by another session, so these hunks ship with its commit).
- **[Low, fixed] Paystack amount-mismatch update** could flip a concurrently completed payment to
  failed; now guarded by `status = 'pending'`.
- **[Low, open] API references share one global namespace** (`API-<ref>`): another developer
  using `order-1` first makes yours a 409. Scoping per key changes the idempotency contract;
  owner decision.
- **[Low, open] Per-key `rate_limits` are resolved but never enforced**; middleware uses fixed
  limits.
- **[Info] `ENABLE_AUTO_FULFILLMENT` env var is unused.**

## Verified clean
- Paystack webhook: HMAC-SHA512 over the raw body, constant-time compare, before any read;
  duplicate and amount checks on wallet top-ups. Browser-initiated payments with forged
  `SHOP-`/`RC-` metadata cannot profit: every storefront processor re-derives the price from the
  DB and rejects a mismatch before creating an order.
- Rexamart webhook: HMAC-SHA256 over `timestamp.body`, 5-minute replay window, fails closed
  without a secret, guarded status transitions.
- API keys: strict shape, prefix lookup, bcrypt with equalised timing, status before bcrypt,
  standard-only, suspended users refused, role allowlist. Rate limits in middleware are keyed on a
  salted hash of the full key and fail closed on money endpoints.
- Purchases: idempotency scoped to the key owner, UNIQUE index catches races without a double
  charge.
- Outbound webhooks: HMAC-signed, https only, IP-literal/localhost/bare-host blocked, redirects
  refused, 5 s timeout. DNS rebinding is out of scope by design. `api_keys` has no client write
  grant (the "writable from the browser" comment in `lib/api-webhook.ts` is stale).

---

# Storefront: API, injection, database protection (same day)

## Findings
- **[High, fixed] Voucher PINs were brute-forceable.** Storefront results-checker references were
  `RC-<shop id prefix>-<ms timestamp>` with no random part
  (`app/api/shop/results-checker/initialize`), and `/api/results-checker/retrieve` (returns PINs
  for reference + phone) was limited only per IP, keyed on the leftmost `X-Forwarded-For`, which
  the caller controls. Knowing a buyer's phone and rough purchase time was enough to enumerate
  references. Fixed: 4 random bytes added to the reference (as every other storefront reference
  already had); retrieve now uses a trusted IP and adds global caps per phone and per reference
  (10/hour each); `order-status` moved to a global, trusted-IP limit.
- **[Medium, fixed] 13 public storefront routes keyed rate limits on the spoofable leftmost
  `X-Forwarded-For`.** All now use `lib/request-ip.ts` (x-real-ip, then the rightmost hop).
- **[Medium, open] Any signed-in user can read every approved shop's full `shop_profiles` row**
  (admin approval/pricing notes, per-shop fee and withdrawal overrides, `approved_by`, sender-ID
  state). `authenticated` has table-level SELECT and the policy allows approved+active shops.
  Anon is correctly limited to display columns. Fix needs a public view for non-owners, because
  owners read their own full row from the browser; design change, not rushed.
- **[Medium, open] Shop mirror reference collisions.** Orders mirrored from storefront sales use
  `SHOP-${reference.slice(-10)}` (`lib/shop-order-processor.ts`), about 1 timestamp digit + 32
  random bits. `orders.reference_code` is UNIQUE, so a collision makes the mirror insert fail for a
  paid order. ~0.1% chance across 10k orders, ~11% across 100k. Use the full reference.
- **[Low, fixed] Four admin searches interpolated raw input into PostgREST `.or()`** (batches,
  finance/users, lifetime-agents, search-users). Admin-only, but a comma or bracket broke the
  query; now sanitised.

## Verified clean
- No SQL injection surface in the database: the only dynamic SQL is the `rls_auto_enable` event
  trigger (catalog identifiers, not callable by clients). App code only reaches Postgres through
  PostgREST.
- `shop/withdraw` `.or()` uses a regex-validated value and is ANDed with the caller's owner id.
- Authenticated shop routes on the service role all scope by `owner_id` / `shop_owner_id` or a
  verified `shop_id`.
- Guest order lookup: shop-scoped, 48 h window, global per-IP and per-phone limits, and the RPC
  returns no names, emails or payment details.
- Status polling endpoints return status only, never PINs.
- Uploads: MIME allowlist, magic-byte check and re-encode, paths prefixed with the user id.
- Anonymous reads: every money/order table is scoped to the signed-in user or admin;
  `results_checker_inventory` is service-role only; anon gets storefront display columns of
  `shop_profiles` only.