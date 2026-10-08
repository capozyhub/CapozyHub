process.env.AGENTPORTAL_API_KEY = process.env.AGENTPORTAL_API_KEY || 'test-key-for-mocked-fetch'

import { matchItemsToOutcomes, resolvePhoneLookup, computeConfirmedAbsent, resolveAgentPortalOrdersByPhone, AgentPortalItemRow } from '../lib/agentportal-status'

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

// Sort resolved Map into a stable array of tuples so JSON.stringify comparisons don't
// depend on insertion order or Map's non-JSON-serializable shape.
function resolvedToSortedArray(resolved: Map<string, { outcome: string; failedReason: string | null }>) {
    return Array.from(resolved.entries())
        .map(([id, v]) => [id, v.outcome, v.failedReason] as const)
        .sort((a, b) => a[0].localeCompare(b[0]))
}

function ambiguousSorted(ambiguous: string[]) {
    return [...ambiguous].sort()
}

// ── Case 1: reference row already terminal ───────────────────────────────────────────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000001', data_mb: 1024, status: 'success', batch_id: 'b1', reference: 'order-1', failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-1', 'completed', null]], 'reference row already terminal (success) resolves directly')
    assertEqual(ambiguousSorted(result.ambiguous), [], 'reference row already terminal -> no ambiguity')
}

// ── The retriable-vs-terminal failure distinction ────────────────────────────────────
// AgentPortal retries a retriable failure up to 3 times; only a NON-retriable failure is
// terminal, and they mark that by auto-refunding the item (refunded_at). Treating an
// un-refunded `failed` as final is what refunded customers who then received their data.
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000001', data_mb: 1024, status: 'failed', batch_id: 'b1', reference: 'order-1', failed_reason: 'no airtime', refunded_at: '2026-07-26T11:00:00Z' },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-1', 'failed', 'no airtime']], 'failed + refunded_at (non-retriable) resolves as failed')
}

{
    // The exact live shape that caused the incident: "System Error: Unable to get balance",
    // refunded_at null -> AgentPortal still has retries to run. Must NOT resolve.
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000001', data_mb: 1024, status: 'failed', batch_id: 'b1', reference: 'order-1b', failed_reason: 'System Error: Unable to get balance', refunded_at: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'failed WITHOUT refunded_at is mid-retry -> not resolved, order stays processing')
    assertEqual(ambiguousSorted(result.ambiguous), [], 'a mid-retry failure is not flagged for review either')
}

{
    // A retriable failure sitting next to the reference row must likewise leave it in flight.
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000013', data_mb: 1024, status: 'uploaded', batch_id: 'bR', reference: 'order-1c', failed_reason: null },
        { id: 'i2', msisdn: '0551000013', data_mb: 1024, status: 'failed', batch_id: 'bR', reference: null, failed_reason: 'transient', refunded_at: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'un-refunded failed SIBLING does not resolve the order either')
}

// ── Case 2: reference row non-terminal ("uploaded") with exactly one terminal sibling ─
{
    // Mirrors the confirmed live shape: reference-carrying row is 'uploaded', sibling
    // shares batch_id + msisdn + data_mb and carries the terminal 'success' status.
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551617309', data_mb: 1024, status: 'uploaded', batch_id: 'batch-A', reference: 'order-2', failed_reason: null },
        { id: 'i2', msisdn: '0551617309', data_mb: 1024, status: 'success', batch_id: 'batch-A', reference: null, failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-2', 'completed', null]], "uploaded reference row + exactly one terminal sibling resolves via the sibling")
    assertEqual(ambiguousSorted(result.ambiguous), [], 'single terminal sibling -> no ambiguity')
}

// ── Case 3: zero terminal siblings — must skip, not fail ──────────────────────────────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000003', data_mb: 1024, status: 'uploaded', batch_id: 'batch-B', reference: 'order-3', failed_reason: null },
        { id: 'i2', msisdn: '0551000003', data_mb: 1024, status: 'queued', batch_id: 'batch-B', reference: null, failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'zero terminal siblings -> not resolved (still in flight)')
    assertEqual(ambiguousSorted(result.ambiguous), [], 'zero terminal siblings -> not ambiguous either, just skipped')
}

// ── Case 4: a failed AND a success sibling — SUCCESS WINS ─────────────────────────────
// This is the shape a retried delivery produces, and resolving it any other way is what
// caused real refunds on data customers had already received (2026-07-26). Delivered data
// cannot be un-delivered, so a success is final regardless of an earlier failure.
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000004', data_mb: 1024, status: 'uploaded', batch_id: 'batch-C', reference: 'order-4', failed_reason: null },
        { id: 'i2', msisdn: '0551000004', data_mb: 1024, status: 'success', batch_id: 'batch-C', reference: null, failed_reason: null },
        { id: 'i3', msisdn: '0551000004', data_mb: 1024, status: 'failed', batch_id: 'batch-C', reference: null, failed_reason: 'dup', refunded_at: '2026-07-26T11:00:00Z' },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-4', 'completed', null]], 'success sibling beats even a refunded failed sibling -> completed')
    assertEqual(ambiguousSorted(result.ambiguous), [], 'a success resolution is never flagged for review')
}

// Row order must not matter — the failed row arriving first must not win.
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000004', data_mb: 1024, status: 'failed', batch_id: 'batch-C2', reference: null, failed_reason: 'System Error: Unable to get balance', refunded_at: '2026-07-26T11:00:00Z' },
        { id: 'i2', msisdn: '0551000004', data_mb: 1024, status: 'uploaded', batch_id: 'batch-C2', reference: 'order-4b', failed_reason: null },
        { id: 'i3', msisdn: '0551000004', data_mb: 1024, status: 'success', batch_id: 'batch-C2', reference: null, failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-4b', 'completed', null]], 'success wins regardless of row order')
}

// ── Case 4b: the REAL cross-order retry shape, pooled from two AgentPortal orders ─────
// Transcribed from the live incident: the original order holds the row carrying OUR uuid
// plus its failed row; the -R1- retry order holds a fresh row with AgentPortal's own numeric
// reference plus the success row. Only `batch_id` links them. Pooling both orders' rows must
// resolve our order to completed — resolving each order in isolation cannot see this at all.
{
    const rows: AgentPortalItemRow[] = [
        // original order 694530a1
        { id: 'o1', msisdn: '0547712657', data_mb: 1024, status: 'uploaded', batch_id: 'af7826de', reference: '3a995042-7cdc-43ea-ae3a-55a0e1fbe63a', failed_reason: null },
        // refunded_at is null here, exactly as it was live — so under the current rule this
        // failure is not even terminal. Two independent guards now stop the incident: the
        // failure never resolves at all, and the retry's success below wins regardless.
        { id: 'o2', msisdn: '0547712657', data_mb: 1024, status: 'failed', batch_id: 'af7826de', reference: null, failed_reason: 'System Error: Unable to get balance', refunded_at: null },
        // retry order d5359819 (group AG1072626-881-1GB-R1-0726-883-1GB)
        { id: 'r1', msisdn: '0547712657', data_mb: 1024, status: 'uploaded', batch_id: 'af7826de', reference: '417388707996', failed_reason: null },
        { id: 'r2', msisdn: '0547712657', data_mb: 1024, status: 'success', batch_id: 'af7826de', reference: null, failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    // REGRESSION GUARD (2026-08-21 production incident): this used to require filtering the
    // resolved array down to dash-containing ids before asserting, because the retry row's own
    // AgentPortal-numeric reference ('417388707996') was ALSO landing in `resolved` as a bogus
    // top-level entry — not just serving as a sibling. The webhook handler (unlike the reconcile
    // cron, which cross-checks against a known set of our own order ids) fed every entry in
    // `resolved` straight into applyAgentPortalOutcome's uuid-typed `.eq('id', orderId)`, so that
    // bogus numeric-keyed entry crashed Postgres with "invalid input syntax for type uuid" on
    // every redelivery, forever. Asserting the exact array (not a filtered view of it) is the
    // point of this test now — a numeric-reference entry reappearing here must fail loudly.
    assertEqual(resolvedToSortedArray(result.resolved), [['3a995042-7cdc-43ea-ae3a-55a0e1fbe63a', 'completed', null]], 'pooled original + -R1- retry rows resolve OUR order to completed, with no spurious entry for the retry row\'s own AgentPortal numeric reference')
    assertEqual(ambiguousSorted(result.ambiguous), [], 'a retry that delivered is not flagged for review')
}

// ── Case 4c: repeated failures with no success — failed, and flagged for review ───────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000014', data_mb: 2048, status: 'uploaded', batch_id: 'batch-C3', reference: 'order-4c', failed_reason: null },
        { id: 'i2', msisdn: '0551000014', data_mb: 2048, status: 'failed', batch_id: 'batch-C3', reference: null, failed_reason: 'attempt 1', refunded_at: '2026-07-26T11:00:00Z' },
        { id: 'i3', msisdn: '0551000014', data_mb: 2048, status: 'failed', batch_id: 'batch-C3', reference: null, failed_reason: 'attempt 2', refunded_at: '2026-07-26T11:05:00Z' },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-4c', 'failed', 'attempt 1']], 'all-failed siblings resolve to failed')
    assertEqual(ambiguousSorted(result.ambiguous), ['order-4c'], 'repeated failures are flagged for review')
}

// ── Case 5: two different msisdns in one batch resolve independently ─────────────────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000005', data_mb: 1024, status: 'uploaded', batch_id: 'batch-D', reference: 'order-5a', failed_reason: null },
        { id: 'i2', msisdn: '0551000005', data_mb: 1024, status: 'success', batch_id: 'batch-D', reference: null, failed_reason: null },
        { id: 'i3', msisdn: '0551000006', data_mb: 1024, status: 'uploaded', batch_id: 'batch-D', reference: 'order-5b', failed_reason: null },
        { id: 'i4', msisdn: '0551000006', data_mb: 1024, status: 'failed', batch_id: 'batch-D', reference: null, failed_reason: 'network error', refunded_at: '2026-07-26T11:00:00Z' },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(
        resolvedToSortedArray(result.resolved),
        [
            ['order-5a', 'completed', null],
            ['order-5b', 'failed', 'network error'],
        ],
        'two different msisdns sharing a batch resolve independently to their own sibling outcome'
    )
    assertEqual(ambiguousSorted(result.ambiguous), [], 'independent per-msisdn resolution -> no cross-contamination/ambiguity')
}

// ── Case 6: case-insensitive status matching ──────────────────────────────────────────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000007', data_mb: 1024, status: 'SUCCESS', batch_id: 'b6', reference: 'order-6', failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-6', 'completed', null]], "status 'SUCCESS' (uppercase) resolves the same as 'success'")
}

{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000008', data_mb: 1024, status: 'Uploaded', batch_id: 'batch-E', reference: 'order-7', failed_reason: null },
        { id: 'i2', msisdn: '0551000008', data_mb: 1024, status: 'Failed', batch_id: 'batch-E', reference: null, failed_reason: 'x', refunded_at: '2026-07-26T11:00:00Z' },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-7', 'failed', 'x']], "mixed-case sibling status 'Failed' resolves the same as 'failed'")
}

// ── Extra: no reference at all — row is irrelevant to us ──────────────────────────────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000009', data_mb: 1024, status: 'success', batch_id: 'b7', reference: null, failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'a row with no reference at all resolves nothing')
    assertEqual(ambiguousSorted(result.ambiguous), [], 'a row with no reference at all is not ambiguous either')
}

// ── Extra: data_mb mismatch excludes an otherwise-matching sibling ────────────────────
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000010', data_mb: 1024, status: 'uploaded', batch_id: 'batch-F', reference: 'order-8', failed_reason: null },
        { id: 'i2', msisdn: '0551000010', data_mb: 2048, status: 'success', batch_id: 'batch-F', reference: null, failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'a same-batch/same-msisdn sibling with a DIFFERENT data_mb does not match -> stays unresolved')
}

// ── Extra: a stale `failed` row must never undo an already-resolved success ───────────
// Two rows can legitimately carry the same reference (one per attempt AgentPortal echoes).
// If the success is seen first, a later failed row must not overwrite it.
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000011', data_mb: 1024, status: 'success', batch_id: 'g1', reference: 'order-9', failed_reason: null },
        { id: 'i2', msisdn: '0551000011', data_mb: 1024, status: 'failed', batch_id: 'g2', reference: 'order-9', failed_reason: 'stale', refunded_at: '2026-07-26T11:00:00Z' },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-9', 'completed', null]], 'a later failed row with the same reference cannot undo a resolved completed')
}

// And the reverse order: failed seen first, success later, must end completed.
{
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551000012', data_mb: 1024, status: 'failed', batch_id: 'g3', reference: 'order-10', failed_reason: 'first attempt', refunded_at: '2026-07-26T11:00:00Z' },
        { id: 'i2', msisdn: '0551000012', data_mb: 1024, status: 'success', batch_id: 'g4', reference: 'order-10', failed_reason: null },
    ]
    const result = matchItemsToOutcomes(rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-10', 'completed', null]], 'a success row upgrades a previously resolved failed for the same reference')
}

// ── resolvePhoneLookup: targeted phone-search resolution ──────────────────────────────
// Confirmed live 2026-08-25: the reconcile poller's blind global sweep cannot reach an
// order whose original AgentPortal submission is outside its bounded lookback window —
// resolvePhoneLookup is the pure decision layer for the `?search=<msisdn>` fallback that
// fixes that (see the network I/O wrapper, resolveAgentPortalOrdersByPhone).

{
    // Order resolves normally via its own item rows, same algorithm as matchItemsToOutcomes.
    const orders = [{ id: 'order-p1', phone_number: '0551700001' }]
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551700001', data_mb: 1024, status: 'success', batch_id: 'bp1', reference: 'order-p1', failed_reason: null },
    ]
    const result = resolvePhoneLookup(orders, rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-p1', 'completed', null]], 'resolvePhoneLookup resolves a terminal row the same as matchItemsToOutcomes')
    assertEqual(Array.from(result.stillInFlight), [], 'a resolved order is never also reported stillInFlight')
}

{
    // Not resolved (still in flight on AgentPortal's side, e.g. processing_status UPLOADED),
    // but ITS OWN item row IS present among the pooled rows -> stillInFlight, not "lost".
    const orders = [{ id: 'order-p2', phone_number: '0551700002' }]
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551700002', data_mb: 1024, status: 'uploaded', batch_id: 'bp2', reference: 'order-p2', failed_reason: null },
    ]
    const result = resolvePhoneLookup(orders, rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'an unresolved order stays unresolved')
    assertEqual(Array.from(result.stillInFlight), ['order-p2'], "the order's own row present (non-terminal) marks it stillInFlight, not lost")
}

{
    // Not resolved AND no row anywhere in the pooled set references this order at all
    // (e.g. search found nothing for its phone) -> genuinely unaccounted for.
    const orders = [{ id: 'order-p3', phone_number: '0551700003' }]
    const result = resolvePhoneLookup(orders, [])
    assertEqual(resolvedToSortedArray(result.resolved), [], 'no matching rows -> unresolved')
    assertEqual(Array.from(result.stillInFlight), [], 'no row references this order at all -> NOT marked stillInFlight, stays genuinely unaccounted for')
}

// REGRESSION GUARD (security review finding, 2026-08-25): stillInFlight must be PER-ORDER, not
// per-phone. A shared phone number with one genuinely-lost order and one unrelated, currently
// live order must NOT let the live order's presence mask the lost one from being alerted on —
// that would silently hide a paid-for, undelivered order from ever surfacing for investigation.
{
    const orders = [
        { id: 'order-lost', phone_number: '0551700010' },   // no row anywhere references this one
        { id: 'order-live', phone_number: '0551700010' },   // its own row IS present, non-terminal
    ]
    const rows: AgentPortalItemRow[] = [
        { id: 'i1', msisdn: '0551700010', data_mb: 1024, status: 'uploaded', batch_id: 'bp10', reference: 'order-live', failed_reason: null },
    ]
    const result = resolvePhoneLookup(orders, rows)
    assertEqual(resolvedToSortedArray(result.resolved), [], 'neither order resolves yet')
    assertEqual(Array.from(result.stillInFlight), ['order-live'], "a same-phone sibling's liveness must NOT mask a genuinely lost order — only order-live (whose own row exists) is stillInFlight, order-lost is NOT")
}

{
    // A retry's terminal row, pooled from a DIFFERENT AgentPortal order for the same phone
    // number, must still resolve our order — same batch_id-linking guarantee as the sweep.
    const orders = [{ id: 'order-p5', phone_number: '0551700005' }]
    const rows: AgentPortalItemRow[] = [
        { id: 'o1', msisdn: '0551700005', data_mb: 1024, status: 'uploaded', batch_id: 'bp5', reference: 'order-p5', failed_reason: null },
        { id: 'o2', msisdn: '0551700005', data_mb: 1024, status: 'failed', batch_id: 'bp5', reference: null, failed_reason: 'transient', refunded_at: null },
        { id: 'r1', msisdn: '0551700005', data_mb: 1024, status: 'success', batch_id: 'bp5', reference: null, failed_reason: null },
    ]
    const result = resolvePhoneLookup(orders, rows)
    assertEqual(resolvedToSortedArray(result.resolved), [['order-p5', 'completed', null]], 'a retry order\'s pooled success row resolves the original order via shared batch_id')
}

// ── computeConfirmedAbsent: the "wipe to N/A" decision layer ──────────────────────────
// Drives app/api/admin/orders/sync-selection releasing a `processing` order back to
// pending/no-supplier — money-safety critical, so the ALL-OR-NOTHING completeness rule gets
// its own explicit tests, not just the ordinary resolved/stillInFlight cases.

{
    // Not resolved, not stillInFlight, lookup complete -> confirmed absent.
    const orders = [{ id: 'order-c1', phone_number: '0551700020' }]
    const result = computeConfirmedAbsent(orders, new Map(), new Set(), true)
    assertEqual(Array.from(result), ['order-c1'], 'unresolved + not in flight + complete lookup -> confirmed absent')
}

{
    // Identical inputs, but the lookup was INCOMPLETE (an error or a cap was hit somewhere in
    // the call) -> must NOT be confirmed absent, regardless of how it looks otherwise. This is
    // the single most important guard in this file: a false "confirmed absent" here means an
    // order that might still be live at AgentPortal gets released for re-dispatch, risking a
    // real double-charge/double-deliver.
    const orders = [{ id: 'order-c2', phone_number: '0551700021' }]
    const result = computeConfirmedAbsent(orders, new Map(), new Set(), false)
    assertEqual(Array.from(result), [], 'an incomplete lookup NEVER produces a confirmed-absent order, even if it looks unresolved')
}

{
    // Resolved orders are never confirmed absent, complete lookup or not.
    const resolved = new Map([['order-c3', { outcome: 'completed' as const, failedReason: null }]])
    const result = computeConfirmedAbsent([{ id: 'order-c3', phone_number: '0551700022' }], resolved, new Set(), true)
    assertEqual(Array.from(result), [], 'a resolved order is never confirmed absent')
}

{
    // stillInFlight orders are never confirmed absent either.
    const result = computeConfirmedAbsent([{ id: 'order-c4', phone_number: '0551700023' }], new Map(), new Set(['order-c4']), true)
    assertEqual(Array.from(result), [], 'a stillInFlight order is never confirmed absent')
}

{
    // Mixed batch: only the genuinely unresolved+not-in-flight order is confirmed absent, even
    // though the lookup as a whole was complete.
    const orders = [
        { id: 'order-c5', phone_number: '0551700024' },
        { id: 'order-c6', phone_number: '0551700025' },
        { id: 'order-c7', phone_number: '0551700026' },
    ]
    const resolved = new Map([['order-c5', { outcome: 'completed' as const, failedReason: null }]])
    const stillInFlight = new Set(['order-c6'])
    const result = computeConfirmedAbsent(orders, resolved, stillInFlight, true)
    assertEqual(Array.from(result), ['order-c7'], 'a mixed batch only flags the genuinely unresolved, not-in-flight order')
}

// ── resolveAgentPortalOrdersByPhone: the completeness gate under a REAL network error ──
// Security review finding (2026-08-25): the pure computeConfirmedAbsent tests above only prove
// the decision layer is safe GIVEN a correct `complete` flag — this proves the flag itself gets
// set correctly on a genuine fetch failure, by mocking `fetch` to fail and asserting the whole
// call still refuses to mark anything confirmedAbsent, even though the target order would
// otherwise look exactly like an unresolved, not-in-flight, ripe-for-wiping order.
async function runNetworkErrorTest() {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        throw new Error('simulated network failure')
    }) as typeof fetch

    try {
        const orders = [{ id: 'order-net1', phone_number: '0551700030' }]
        const result = await resolveAgentPortalOrdersByPhone(orders)
        assertEqual(Array.from(result.confirmedAbsent), [], 'a phone-search fetch exception must NEVER produce a confirmedAbsent order')
        assertEqual(result.errors.length > 0, true, 'the fetch exception is still surfaced in errors, just never trusted for the wipe decision')
    } finally {
        globalThis.fetch = realFetch
    }
}

runNetworkErrorTest().then(() => {
    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll tests passed.')
    }
}).catch(err => {
    console.error('FATAL in runNetworkErrorTest:', err)
    process.exitCode = 1
})
