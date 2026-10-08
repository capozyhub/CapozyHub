import {
    resolveHendyLinksNetwork,
    isValidAtSizeForNetwork,
    normalizeHendyLinksPhone,
    isBusinessRejection,
    matchesRecentOrder,
    parseHendyLinksTimestamp,
    shouldFetchNextPage,
    selectReconciliationMatch,
    classifyPlacementResponse,
    RECONCILE_WINDOW_MS,
    type HendyLinksOrder,
} from '../lib/hendylinks-service'

let passCount = 0

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        passCount++
        console.log(`PASS: ${label}`)
    }
}

/**
 * selectReconciliationMatch deliberately logs LOUDLY (console.error) on the ambiguous case —
 * that noise is the point in production, but it makes the test output look like failures.
 * Silence it only for the duration of the call, and assert that it actually fired.
 */
function withSilencedErrors<T>(fn: () => T): { value: T; errorLogCount: number } {
    const original = console.error
    let errorLogCount = 0
    console.error = () => { errorLogCount++ }
    try {
        return { value: fn(), errorLogCount }
    } finally {
        console.error = original
    }
}

// ── resolveHendyLinksNetwork ────────────────────────────────────────────────
assertEqual(resolveHendyLinksNetwork('MTN'), 'MTN', "MTN → 'MTN'")
assertEqual(resolveHendyLinksNetwork('Telecel'), 'Telecel', "Telecel → 'Telecel'")
assertEqual(resolveHendyLinksNetwork('AT-iShare'), 'AirtelTigo', "AT-iShare → 'AirtelTigo'")
assertEqual(resolveHendyLinksNetwork('AT-BigTime'), 'AirtelTigo', "AT-BigTime → 'AirtelTigo'")
assertEqual(resolveHendyLinksNetwork('Vodafone'), null, 'unknown network → null')

// ── isValidAtSizeForNetwork ──────────────────────────────────────────────────
assertEqual(isValidAtSizeForNetwork('AT-iShare', 1), true, 'AT-iShare 1GB (lower bound) → valid')
assertEqual(isValidAtSizeForNetwork('AT-iShare', 15), true, 'AT-iShare 15GB (upper bound) → valid')
assertEqual(isValidAtSizeForNetwork('AT-iShare', 0.5), false, 'AT-iShare 0.5GB (below range) → invalid')
assertEqual(isValidAtSizeForNetwork('AT-iShare', 16), false, 'AT-iShare 16GB (above range, in the gap) → invalid')
assertEqual(isValidAtSizeForNetwork('AT-BigTime', 25), true, 'AT-BigTime 25GB (lower bound) → valid')
assertEqual(isValidAtSizeForNetwork('AT-BigTime', 50), true, 'AT-BigTime 50GB (upper bound) → valid')
assertEqual(isValidAtSizeForNetwork('AT-BigTime', 24), false, 'AT-BigTime 24GB (below range, in the gap) → invalid')
assertEqual(isValidAtSizeForNetwork('AT-BigTime', 51), false, 'AT-BigTime 51GB (above range) → invalid')
assertEqual(isValidAtSizeForNetwork('MTN', 500), true, 'non-AT network → no range restriction')

// ── normalizeHendyLinksPhone ─────────────────────────────────────────────────
assertEqual(normalizeHendyLinksPhone('0241234567'), '0241234567', 'already-0-prefixed 10 digits → unchanged')
assertEqual(normalizeHendyLinksPhone('241234567'), '0241234567', '9 digits, no prefix → 0 added')
assertEqual(normalizeHendyLinksPhone('233241234567'), '0241234567', "233 country code → '0' prefix")
assertEqual(normalizeHendyLinksPhone('+233241234567'), '0241234567', 'leading + stripped, then 233 → 0')

// ── isBusinessRejection ──────────────────────────────────────────────────────
assertEqual(isBusinessRejection(400), true, '400 → business rejection')
assertEqual(isBusinessRejection(401), true, '401 → business rejection')
assertEqual(isBusinessRejection(402), true, '402 → business rejection')
// 403 = "Recipient phone number is not a verified beneficiary" — a routine per-order
// outcome, NOT instability. Omitting it made 5 unverified numbers open the circuit
// breaker and fast-fail every other HendyLinks order (fixed 2026-08-20 from a live 403).
assertEqual(isBusinessRejection(403), true, '403 (unverified beneficiary) → business rejection, must NOT trip breaker')
assertEqual(isBusinessRejection(404), true, '404 → business rejection')
assertEqual(isBusinessRejection(500), false, '500 → NOT a business rejection (trips breaker)')
assertEqual(isBusinessRejection(429), false, '429 → NOT a business rejection (handled separately as rate limit)')
assertEqual(isBusinessRejection(200), false, '200 → not applicable, false')

// ── parseHendyLinksTimestamp ─────────────────────────────────────────────────
// Their history rows carry created_at with NO timezone ("2026-08-20 20:23:45"). A bare
// new Date() reads that against the PROCESS timezone, so on a non-UTC host it lands hours
// away from the true instant and defeats the RECONCILE_WINDOW_MS freshness check — which is
// what stops an unrelated older order being adopted. These assertions are timezone-independent
// precisely because the parser must not depend on ambient TZ.
const UTC_INSTANT = Date.parse('2026-08-20T20:23:45.000Z')
assertEqual(parseHendyLinksTimestamp('2026-08-20 20:23:45'), UTC_INSTANT, 'timestamp: zone-less "YYYY-MM-DD HH:MM:SS" → parsed as UTC, not local')
assertEqual(parseHendyLinksTimestamp('2026-08-20T20:23:45'), UTC_INSTANT, 'timestamp: zone-less ISO (T, no Z) → parsed as UTC')
assertEqual(parseHendyLinksTimestamp('2026-08-20T20:23:45Z'), UTC_INSTANT, 'timestamp: explicit Z → parsed verbatim')
assertEqual(parseHendyLinksTimestamp('2026-08-20T20:23:45.000Z'), UTC_INSTANT, 'timestamp: ISO with millis + Z → parsed verbatim')
assertEqual(parseHendyLinksTimestamp('2026-08-20T23:23:45+03:00'), UTC_INSTANT, 'timestamp: explicit +03:00 offset → honoured, not overridden')
assertEqual(Number.isNaN(parseHendyLinksTimestamp(undefined)), true, 'timestamp: undefined → NaN')
assertEqual(Number.isNaN(parseHendyLinksTimestamp('')), true, 'timestamp: empty string → NaN')
assertEqual(Number.isNaN(parseHendyLinksTimestamp('not-a-date')), true, 'timestamp: garbage → NaN, no throw')
assertEqual(Number.isNaN(parseHendyLinksTimestamp(12345 as any)), true, 'timestamp: non-string → NaN, no throw')

// ── shouldFetchNextPage (history pagination stop conditions) ────────────────
// An off-by-one here is either an unbounded request loop or a silently truncated history —
// and a truncated history means a stuck order is never reconciled.
assertEqual(shouldFetchNextPage(100, 100, 100, 250), true, 'paginate: full page, total not reached → continue')
assertEqual(shouldFetchNextPage(23, 100, 23, 23), false, 'paginate: short page → stop (end of data)')
assertEqual(shouldFetchNextPage(100, 100, 100, 100), false, 'paginate: full page but total reached → stop')
assertEqual(shouldFetchNextPage(100, 100, 120, 100), false, 'paginate: collected MORE than total → stop (never loop on drifting total)')
assertEqual(shouldFetchNextPage(100, 100, 100, undefined), true, 'paginate: full page, total absent → continue (short page is the authority)')
assertEqual(shouldFetchNextPage(0, 100, 50, undefined), false, 'paginate: empty page → stop')
assertEqual(shouldFetchNextPage(100, 100, 100, NaN), true, 'paginate: NaN total is ignored, not treated as reached')

// ── matchesRecentOrder (reconciliation match predicate) ──────────────────────
// This predicate + selectReconciliationMatch below are the rule whose absence caused a
// Critical: the old code took the FIRST history row matching phone+size, so a second local
// order could adopt a FIRST order's HendyLinks id — customer charged, nothing delivered,
// logged as a success, and two local rows sharing one hendylinks_order_id.
const NOW = Date.parse('2026-08-19T12:00:00.000Z')

// The fixture uses recipient_msisdn — the field GET /api/orders ACTUALLY returns, verified
// against the live endpoint 2026-08-20. It previously used recipient_phone, a name taken from
// the design spec that does not exist on the wire; because the fixture and the implementation
// shared that same wrong assumption, every one of these assertions passed while the real
// predicate compared against `undefined` and could never match a genuine history row.
function hlOrder(overrides: Partial<HendyLinksOrder> = {}): HendyLinksOrder {
    return {
        id: 1,
        status: 'pending',
        recipient_msisdn: '0241234567',
        size_mb: 5120,
        network: 'MTN',
        created_at: new Date(NOW - 60_000).toISOString(),
        ...overrides,
    }
}

assertEqual(matchesRecentOrder(hlOrder(), '0241234567', 5120, NOW, 'MTN'), true, 'match: same phone + size + network, inside window → true')
assertEqual(matchesRecentOrder(hlOrder({ recipient_msisdn: '0201234567' }), '0241234567', 5120, NOW, 'MTN'), false, 'match: different phone → false')

// Regression guard: a verbatim row from the live GET /api/orders response must match. This is
// the assertion that would have caught the recipient_phone/recipient_msisdn mismatch.
const LIVE_ROW: HendyLinksOrder = {
    id: 1633614, user_id: 117, provider_id: 4, data_plan_id: 96,
    recipient_msisdn: '0549565371', amount: '15.80', status: 'processing',
    external_reference: 'KT-8764487499', external_order_id: null, source: 'web',
    response_code: 'PROCESSING', message: 'Order is processing',
    created_at: '2026-08-20 20:23:45', updated_at: '2026-08-20 20:24:31', completed_at: null,
    user_name: 'Felix Boahen', user_phone: '0551617309', plan_name: 'MTNUP2U',
    network: 'MTN', size_mb: 4096, provider_name: 'Kuntanii',
} as HendyLinksOrder
assertEqual(
    matchesRecentOrder(LIVE_ROW, '0549565371', 4096, Date.parse('2026-08-20T20:24:00.000Z'), 'MTN'),
    true,
    'match: VERBATIM live API row (recipient_msisdn, size_mb 4096) → true'
)
// And the legacy name still works, so a rename on their side cannot silently re-break it.
assertEqual(
    matchesRecentOrder(hlOrder({ recipient_msisdn: undefined, recipient_phone: '0241234567' }), '0241234567', 5120, NOW, 'MTN'),
    true,
    'match: legacy recipient_phone-only row → true (fallback still honoured)'
)
assertEqual(matchesRecentOrder(hlOrder({ size_mb: 10240 }), '0241234567', 5120, NOW, 'MTN'), false, 'match: different size_mb → false')
assertEqual(matchesRecentOrder(hlOrder({ network: 'Telecel' }), '0241234567', 5120, NOW, 'MTN'), false, 'match: different network → false (network is an extra discriminator)')
assertEqual(matchesRecentOrder(hlOrder({ network: 'mtn' }), '0241234567', 5120, NOW, 'MTN'), true, 'match: network compare is case-insensitive')
assertEqual(matchesRecentOrder(hlOrder({ network: undefined }), '0241234567', 5120, NOW, 'MTN'), true, 'match: history row without a network → still matches (absent field must not be a mismatch)')
assertEqual(matchesRecentOrder(hlOrder({ network: '' }), '0241234567', 5120, NOW, 'MTN'), true, 'match: history row with a blank network → still matches')
assertEqual(matchesRecentOrder(hlOrder({ network: 'Telecel' }), '0241234567', 5120, NOW), true, 'match: no expected network supplied → network is not checked')
assertEqual(matchesRecentOrder(hlOrder({ created_at: new Date(NOW - RECONCILE_WINDOW_MS).toISOString() }), '0241234567', 5120, NOW, 'MTN'), true, 'match: created exactly at the window boundary → true')
assertEqual(matchesRecentOrder(hlOrder({ created_at: new Date(NOW - RECONCILE_WINDOW_MS - 1000).toISOString() }), '0241234567', 5120, NOW, 'MTN'), false, 'match: created just outside the window → false')
assertEqual(matchesRecentOrder(hlOrder({ created_at: undefined }), '0241234567', 5120, NOW, 'MTN'), false, 'match: no created_at → false')
assertEqual(matchesRecentOrder(hlOrder({ created_at: 'not-a-date' }), '0241234567', 5120, NOW, 'MTN'), false, 'match: unparseable created_at → false')

// ── selectReconciliationMatch (F2: the ambiguity rule — fail closed) ─────────
const zeroCandidates = selectReconciliationMatch([hlOrder({ id: 7, recipient_msisdn: '0209999999' })], '0241234567', 5120, NOW, 'MTN')
assertEqual(zeroCandidates, null, 'reconcile: 0 candidates → null (unreconciled, caller reports ambiguous)')

const oneCandidate = selectReconciliationMatch(
    [hlOrder({ id: 7, recipient_msisdn: '0209999999' }), hlOrder({ id: 8 }), hlOrder({ id: 9, size_mb: 1024 })],
    '0241234567', 5120, NOW, 'MTN'
)
assertEqual(oneCandidate?.id, 8, 'reconcile: exactly 1 candidate → adopt it')

const twoCandidates = withSilencedErrors(() =>
    selectReconciliationMatch([hlOrder({ id: 11 }), hlOrder({ id: 12 })], '0241234567', 5120, NOW, 'MTN')
)
assertEqual(twoCandidates.value, null, 'reconcile: 2 candidates → null (FAIL CLOSED, adopt neither)')
assertEqual(twoCandidates.errorLogCount, 1, 'reconcile: 2 candidates → logs the ambiguity loudly')

const threeCandidates = withSilencedErrors(() =>
    selectReconciliationMatch([hlOrder({ id: 11 }), hlOrder({ id: 12 }), hlOrder({ id: 13 })], '0241234567', 5120, NOW, 'MTN')
)
assertEqual(threeCandidates.value, null, 'reconcile: 3 candidates → null (FAIL CLOSED)')

// Network as the discriminator that turns an otherwise-ambiguous pair into a single match.
const networkDisambiguated = selectReconciliationMatch(
    [hlOrder({ id: 21, network: 'Telecel' }), hlOrder({ id: 22, network: 'MTN' })],
    '0241234567', 5120, NOW, 'MTN'
)
assertEqual(networkDisambiguated?.id, 22, 'reconcile: network discriminates two same-phone/same-size rows → single adopt')

assertEqual(selectReconciliationMatch([], '0241234567', 5120, NOW, 'MTN'), null, 'reconcile: empty history → null')

// ── classifyPlacementResponse (F5) ───────────────────────────────────────────
assertEqual(classifyPlacementResponse(200, { success: true, order_id: 12345 }), { outcome: 'success', orderId: '12345' }, 'classify: success + order_id → success')
assertEqual(classifyPlacementResponse(201, { success: true, order_id: 'HL-9' }), { outcome: 'success', orderId: 'HL-9' }, 'classify: 201 success + order_id → success')

// The accepted-but-untrackable branch: HendyLinks HAS charged us, so this must never be
// retry-eligible — a retry with no idempotency key is a guaranteed duplicate charge.
assertEqual(classifyPlacementResponse(200, { success: true }).outcome, 'ambiguous', 'classify: 2xx success WITHOUT order_id → ambiguous (never retry-eligible)')
assertEqual(classifyPlacementResponse(200, { success: true, order_id: null }).outcome, 'ambiguous', 'classify: 2xx success with null order_id → ambiguous')
assertEqual(classifyPlacementResponse(200, {}).outcome, 'ambiguous', 'classify: 2xx with no success flag → ambiguous, not a rejection')
assertEqual(classifyPlacementResponse(200, { success: false, message: 'huh' }).outcome, 'ambiguous', 'classify: 2xx with success:false → ambiguous (a 2xx is not a definite decline)')
assertEqual(classifyPlacementResponse(204, null).outcome, 'ambiguous', 'classify: 2xx with a null body → ambiguous')

assertEqual(classifyPlacementResponse(429, { message: 'slow down' }), { outcome: 'rate_limited' }, 'classify: 429 → rate_limited (retryable, no breaker)')

// Business rejections — they answered correctly, they just declined. Must NOT trip the breaker.
assertEqual(classifyPlacementResponse(400, { message: 'bad params' }), { outcome: 'rejection', tripsBreaker: false }, 'classify: 400 → business rejection, no breaker trip')
assertEqual(classifyPlacementResponse(401, { message: 'bad key' }), { outcome: 'rejection', tripsBreaker: false }, 'classify: 401 → business rejection, no breaker trip')
assertEqual(classifyPlacementResponse(402, { message: 'insufficient balance' }), { outcome: 'rejection', tripsBreaker: false }, 'classify: 402 → business rejection, no breaker trip')
assertEqual(classifyPlacementResponse(403, { message: 'Recipient phone number is not a verified beneficiary in our system and cannot receive an order.' }), { outcome: 'rejection', tripsBreaker: false }, 'classify: 403 (live unverified-beneficiary body) → business rejection, no breaker trip')
assertEqual(classifyPlacementResponse(404, { message: 'Plan not found' }), { outcome: 'rejection', tripsBreaker: false }, 'classify: 404 → business rejection, no breaker trip')

// Real instability signals — these DO trip the breaker.
assertEqual(classifyPlacementResponse(500, { message: 'boom' }), { outcome: 'rejection', tripsBreaker: true }, 'classify: 500 → rejection that trips the breaker')
assertEqual(classifyPlacementResponse(503, { message: 'unavailable' }), { outcome: 'rejection', tripsBreaker: true }, 'classify: 503 → rejection that trips the breaker')

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log(`\nAll tests passed. (${passCount} assertions)`)
}
