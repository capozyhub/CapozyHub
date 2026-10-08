// scripts/test-fulfillment-supplier-tag.ts
import { resolveSupplier } from '../lib/order-supplier'

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

// ── explicit supplier tag wins ──────────────────────────────────────────
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'ghdata' } }], null),
    'ghdata',
    'tracking row with explicit supplier → that supplier'
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'agentportal' } }], 'batch-1'),
    'agentportal',
    'explicit supplier wins even when download_batch_id is also set'
)

// ── multiple tracking rows — the LATEST one carrying a supplier tag wins ─
assertEqual(
    resolveSupplier([{ api_response: { note: 'no supplier here' } }, { api_response: { supplier: 'xpress' } }], null),
    'xpress',
    'finds the supplier tag on a later tracking row'
)
assertEqual(
    resolveSupplier(
        [
            { api_response: { supplier: 'ghdata' }, created_at: '2026-07-29T10:00:00Z' },
            { api_response: { supplier: 'agentportal' }, created_at: '2026-07-29T08:00:00Z' },
        ],
        null
    ),
    'ghdata',
    'two tagged rows, ARRAY order does not match chronological order → picks the later created_at (ghdata), not the first element (agentportal)'
)
assertEqual(
    resolveSupplier(
        [
            { api_response: { supplier: 'agentportal' } }, // no created_at — treated as oldest
            { api_response: { supplier: 'ghdata' }, created_at: '2026-07-29T08:00:00Z' },
        ],
        null
    ),
    'ghdata',
    'a row missing created_at sorts as oldest and never shadows a dated row'
)
assertEqual(
    resolveSupplier(
        [
            { api_response: { supplier: 'ghdata' }, created_at: 'not-a-valid-date' },
            { api_response: { supplier: 'xpress' }, created_at: '2026-07-29T08:00:00Z' },
        ],
        null
    ),
    'xpress',
    'an unparseable created_at (Date.parse → NaN) sorts as oldest, same as missing'
)
assertEqual(
    resolveSupplier(
        [
            { api_response: { supplier: 'xpress' }, created_at: '2026-07-29T08:00:00Z' },
            { api_response: { supplier: 'ghdata' }, created_at: '2026-07-29T08:00:00Z' },
        ],
        null
    ),
    'xpress',
    'tied created_at → deterministic, first element in array order wins'
)

// ── no default supplier ever ─────────────────────────────────────────────
assertEqual(
    resolveSupplier([{ api_response: { note: 'legacy bulk-purchase row, no supplier field' } }], null),
    null,
    'tracking row exists but no supplier field, no batch → N/A (never defaults to a supplier)'
)
assertEqual(
    resolveSupplier([], null),
    null,
    'no tracking rows, no batch → N/A'
)
assertEqual(
    resolveSupplier(null, null),
    null,
    'null tracking rows, no batch → N/A'
)

// ── exported (manual download batch, never touched by a supplier) ───────
assertEqual(
    resolveSupplier([], 'batch-42'),
    'exported',
    'no tracking rows but download_batch_id set → exported'
)
assertEqual(
    resolveSupplier(null, 'batch-42'),
    'exported',
    'null tracking rows but download_batch_id set → exported'
)
assertEqual(
    resolveSupplier([{ api_response: { note: 'legacy, no supplier field' } }], 'batch-42'),
    'exported',
    'tracking row without supplier + download_batch_id set → exported (batch wins over an untagged row)'
)

// ── DataGod (recognized late, normalized failed-variant, unknown fallback) ──
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'datagod' } }], null),
    'datagod',
    'tracking row with datagod supplier → datagod'
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'datagod_failed' } }], null),
    'datagod',
    'datagod_failed variant normalizes to datagod'
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'some_future_unknown_supplier' } }], null),
    null,
    'unrecognized supplier string → N/A (defensive fallback, does not crash or invent a tag)'
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'some_future_unknown_supplier' } }], 'batch-1'),
    'exported',
    'unrecognized supplier string + download_batch_id → exported (unidentified tag does not block the batch fallback)'
)

// ── fulfillment_method is checked FIRST (when dispatch succeeded), because it is the
// one column every dispatch path overwrites on every attempt — so it is always the
// LATEST attempted supplier, unlike mtn_fulfillment_tracking which only accumulates
// rows and can go stale. Gated on order status: a pre-dispatch claim stamps
// fulfillment_method BEFORE calling the supplier, and a failed dispatch reverts only
// `status`, leaving fulfillment_method pointing at the supplier that FAILED — so the
// fallback must not fire for pending/failed/queued orders. ──
assertEqual(
    resolveSupplier([], null, 'agentportal', 'processing'),
    'agentportal',
    'no tracking rows, no batch, fulfillment_method=agentportal, status=processing → agentportal (the shop-order gap this fixes)'
)
assertEqual(
    resolveSupplier(null, null, 'codecraft', 'completed'),
    'codecraft',
    'null tracking rows, fulfillment_method=codecraft, status=completed → codecraft'
)
assertEqual(
    resolveSupplier([], null, 'codecraft', 'refunded'),
    'codecraft',
    'status=refunded (fulfilled then refunded) still trusts fulfillment_method'
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'xpress' } }], null, 'agentportal', 'processing'),
    'agentportal',
    'fulfillment_method wins over a tracking-row supplier tag when dispatch succeeded — fulfillment_method is guaranteed the latest attempt, the tracking row could be from an earlier one'
)
assertEqual(
    resolveSupplier(
        [{ api_response: { supplier: 'xpress' }, created_at: '2026-07-20T00:00:00Z' }],
        null,
        'codecraft',
        'processing'
    ),
    'codecraft',
    'THE BUG THIS FIXES: order was fulfilled by xpress (tracking row exists), later failed and was re-dispatched via codecraft (no new tracking row, only fulfillment_method updated) and succeeded — must show codecraft (the latest), not the stale xpress tracking row'
)
assertEqual(
    resolveSupplier([], 'batch-1', 'agentportal', 'processing'),
    'agentportal',
    'fulfillment_method wins over download_batch_id (a real supplier beats a stale export tag)'
)
assertEqual(
    resolveSupplier([], null, 'datagod', 'completed'),
    'datagod',
    'fulfillment_method=datagod, status=completed → datagod (admin/datagod/fulfill now stamps this column too)'
)
assertEqual(
    resolveSupplier([], null, 'auto', 'processing'),
    null,
    'fulfillment_method=auto is a dispatch-mode marker, not a supplier → N/A'
)
assertEqual(
    resolveSupplier([], null, 'manual', 'processing'),
    null,
    'fulfillment_method=manual is a dispatch-mode marker, not a supplier → N/A'
)
assertEqual(
    resolveSupplier([], null, null, 'processing'),
    null,
    'fulfillment_method=null, no tracking, no batch → N/A'
)
assertEqual(
    resolveSupplier([], null, 'codecraft', 'pending'),
    null,
    'status=pending → fulfillment_method reflects the LAST ATTEMPTED supplier, not a confirmed fulfillment — must not surface it (would show a failed/unretried attempt as if it succeeded)'
)
assertEqual(
    resolveSupplier([], null, 'agentportal', 'failed'),
    null,
    'status=failed → same stale-attempt guard applies'
)
assertEqual(
    resolveSupplier([], null, 'datakazina', 'queued'),
    null,
    'status=queued (held for MTN number registration, never dispatched) → fulfillment_method not trusted'
)
assertEqual(
    resolveSupplier([], null, 'codecraft', undefined),
    null,
    'orderStatus omitted → fallback does not fire (fail closed, not open)'
)

if (process.exitCode === 1) {
    console.error('\nOne or more assertions failed.')
} else {
    console.log('\nAll assertions passed.')
}
