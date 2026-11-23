---
name: capozy-fulfillment-adapter
description: Use when wiring a new data-bundle, AFA or results-checker supplier into Capozy Hub, changing how orders are fulfilled, or touching the admin Fulfillment page or a supplier webhook.
---

# Fulfillment suppliers for Capozy Hub

Capozy has **no hard-coded suppliers**. The owner brings suppliers; each one is an adapter. Rexamart is the reference implementation (`lib/rexamart-service.ts`, `lib/rexamart-webhook-signature.ts`, `app/api/webhooks/rexamart/route.ts`). Airtime is fulfilled **manually** from `/admin/airtime`. Read `CLAUDE.md` first; run `payments-security-reviewer` on the result.

## What an adapter must do
1. **Config from env**, never from code: base URL, API key, webhook secret (see `.env.example` for the Rexamart set). A missing secret must make the webhook **fail closed** (reject with 503).
2. **Per-network switches** live in admin settings and on `/admin/fulfillment`; the page keeps its "No suppliers yet" empty state until an adapter is configured.
3. **Idempotent dispatch.** Write the order and its `reference_code` first, send a stable supplier reference, and make retries safe (a second dispatch must never double-send). Store the supplier reference and a sanitised status.
4. **Webhook route:** verify the HMAC signature over the **raw** body (constant-time compare) before reading any field; only act on orders in the expected state (for example `processing`); be idempotent on replays; always return 200 once handled so the supplier stops retrying, and 4xx/503 only for bad signature or missing secret.
5. **Failures:** classify with `categorizeFailure` and refund through the existing refund RPCs (`autoRefundApiOrderOnFailure` for developer-API orders). Never show raw supplier text to a customer; store it for admins only.
6. **No supplier name in customer-facing copy, public docs, `openapi.yaml` or `llms.txt`.** `scripts/check-ai-discoverability.ts` bans supplier and infrastructure names.
7. **Cron backstop:** pending orders that miss a webhook are retried by `app/api/cron/refulfill-pending-orders` (first line `validateCronAuth`). Note that crons are not scheduled yet (see `CLAUDE.md`).

## Checklist before declaring it done
- Typecheck and build pass; guard tests pass (`test-data-order-webhook`, `test-api-webhook-signing`, `test-data-order-guards`).
- A replayed webhook, a duplicate dispatch and a missing secret each behave safely (add tests under `scripts/test-*.ts`).
- Admin Fulfillment page shows the supplier's balance/status without exposing keys.
- Nothing from `_parked/` is imported; the repo builds from a fresh clone.
