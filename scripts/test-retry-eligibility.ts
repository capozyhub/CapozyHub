// scripts/test-retry-eligibility.ts
import { isRetryEligible, checkRetryCooldown, resolveRetryFundingWallet } from '../lib/retry-eligibility'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// ── isRetryEligible ──────────────────────────────────────────────────────
assertEqual(isRetryEligible({ status: 'failed' }, 'admin', true), { ok: true }, 'admin retrying failed → ok')
assertEqual(isRetryEligible({ status: 'failed' }, 'user', true), { ok: false, reason: 'admin_only' }, 'user retrying failed → admin_only')
assertEqual(isRetryEligible({ status: 'refunded' }, 'user', true), { ok: true }, 'owner user retrying refunded → ok')
assertEqual(isRetryEligible({ status: 'refunded' }, 'user', false), { ok: false, reason: 'not_owner' }, 'non-owner user retrying refunded → not_owner')
assertEqual(isRetryEligible({ status: 'refunded' }, 'admin', false), { ok: true }, 'admin retrying any refunded → ok')
assertEqual(isRetryEligible({ status: 'pending' }, 'admin', true), { ok: false, reason: 'not_retryable' }, 'pending → not_retryable')
assertEqual(isRetryEligible({ status: 'processing' }, 'admin', true), { ok: false, reason: 'not_retryable' }, 'processing → not_retryable')
assertEqual(isRetryEligible({ status: 'completed' }, 'admin', true), { ok: false, reason: 'not_retryable' }, 'completed → not_retryable')

// ── refunded_at gating (C2 fix) ──────────────────────────────────────────
// A failed row that was already refunded (refunded_at set, status drifted
// away from 'refunded') must NOT be treated as the free admin-only path —
// it must take the paid/ownership path, same as a row still at
// status='refunded'.
assertEqual(
    isRetryEligible({ status: 'failed', refunded_at: '2026-07-20T00:00:00Z' }, 'user', true),
    { ok: true },
    'owner user retrying failed+refunded_at set → ok (paid/ownership path, not free)'
)
assertEqual(
    isRetryEligible({ status: 'failed', refunded_at: '2026-07-20T00:00:00Z' }, 'user', false),
    { ok: false, reason: 'not_owner' },
    'non-owner user retrying failed+refunded_at set → not_owner (paid path ownership enforced)'
)
assertEqual(
    isRetryEligible({ status: 'failed', refunded_at: '2026-07-20T00:00:00Z' }, 'admin', false),
    { ok: true },
    'admin retrying failed+refunded_at set → ok'
)
// A genuinely never-refunded failed row (refunded_at null) still takes the
// free in-place path, admin-only.
assertEqual(
    isRetryEligible({ status: 'failed', refunded_at: null }, 'user', true),
    { ok: false, reason: 'admin_only' },
    'user retrying failed with refunded_at null → admin_only (free path)'
)
assertEqual(
    isRetryEligible({ status: 'failed', refunded_at: null }, 'admin', true),
    { ok: true },
    'admin retrying failed with refunded_at null → ok (free path)'
)
// A row still at status='refunded' (refunded_at set) behaves as before —
// paid path, ownership enforced.
assertEqual(
    isRetryEligible({ status: 'refunded', refunded_at: '2026-07-20T00:00:00Z' }, 'user', true),
    { ok: true },
    'owner user retrying refunded with refunded_at set → ok'
)

// ── checkRetryCooldown ───────────────────────────────────────────────────
const now = new Date('2026-07-26T12:00:00Z')
assertEqual(checkRetryCooldown({ retry_count: 0, last_retry_at: null }, now), { ok: true }, 'never retried → ok')
assertEqual(
    checkRetryCooldown({ retry_count: 1, last_retry_at: '2026-07-26T11:59:30Z' }, now),
    { ok: false, reason: 'retry_too_soon', retryAfter: new Date('2026-07-26T12:00:30Z') },
    '30s since last retry → too soon'
)
assertEqual(
    checkRetryCooldown({ retry_count: 1, last_retry_at: '2026-07-26T11:58:00Z' }, now),
    { ok: true },
    '2 min since last retry, count=1 → ok'
)
assertEqual(
    checkRetryCooldown({ retry_count: 3, last_retry_at: '2026-07-26T11:00:00Z' }, now),
    { ok: false, reason: 'retry_locked', retryAfter: new Date('2026-07-27T11:00:00Z') },
    'at cap, 1h since last retry → locked until +24h'
)
assertEqual(
    checkRetryCooldown({ retry_count: 3, last_retry_at: '2026-07-25T11:00:00Z' }, now),
    { ok: true },
    'at cap, 25h since last retry → lockout elapsed, ok'
)
assertEqual(
    checkRetryCooldown({ retry_count: 1, last_retry_at: new Date(now.getTime() - 60_000).toISOString() }, now),
    { ok: true },
    'exactly 60s since last retry → ok (boundary)'
)
assertEqual(
    checkRetryCooldown({ retry_count: 3, last_retry_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() }, now),
    { ok: true },
    'exactly 24h since last retry at cap → lockout just elapsed, ok (boundary)'
)

// ── resolveRetryFundingWallet ────────────────────────────────────────────
assertEqual(
    resolveRetryFundingWallet({ shop_order_id: null, user_id: 'buyer-1' }),
    { ok: true, userId: 'buyer-1' },
    'retail order → buyer wallet'
)
assertEqual(
    resolveRetryFundingWallet({ shop_order_id: null, user_id: null }),
    { ok: false, error: 'no_wallet_user' },
    'retail order with no user_id → no_wallet_user'
)
assertEqual(
    resolveRetryFundingWallet({ shop_order_id: 'so-1', user_id: null }, { refund_method: 'owner_wallet', owner_id: 'owner-1' }),
    { ok: true, userId: 'owner-1' },
    'shop order refunded to owner wallet → owner wallet'
)
assertEqual(
    resolveRetryFundingWallet({ shop_order_id: 'so-1', user_id: null }, { refund_method: 'paystack', owner_id: 'owner-1' }),
    { ok: false, error: 'paystack_refund_no_wallet' },
    'shop order refunded via paystack → blocked'
)
assertEqual(
    resolveRetryFundingWallet({ shop_order_id: 'so-1', user_id: null }, { refund_method: 'owner_wallet', owner_id: null }),
    { ok: false, error: 'owner_not_found' },
    'shop order with no resolvable owner → owner_not_found'
)
