import { resolveService, parseWholeGb, validateWindow } from '../lib/agentportal-service'

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

// ── resolveService ───────────────────────────────────────────────────────────
assertEqual(resolveService('MTN'), 'mtn', "MTN → 'mtn'")
assertEqual(resolveService('Telecel'), 'telecel', "Telecel → 'telecel'")
assertEqual(resolveService('AT-iShare'), 'airteltigo', "AT-iShare → 'airteltigo'")
assertEqual(resolveService('AT-BigTime'), 'airteltigo', "AT-BigTime → 'airteltigo' (same service as iShare)")
assertEqual(resolveService('Unknown'), null, 'unrecognized network → null')

// ── parseWholeGb ──────────────────────────────────────────────────────────────
assertEqual(parseWholeGb('5GB'), 5, "'5GB' → 5")
assertEqual(parseWholeGb('1GB'), 1, "'1GB' → 1")
assertEqual(parseWholeGb('1.5GB'), null, "'1.5GB' → null (never rounds a decimal)")
assertEqual(parseWholeGb('no digits here'), null, 'no numeric part → null')

// ── validateWindow ────────────────────────────────────────────────────────────
assertEqual(validateWindow('mtn', 1), null, 'MTN 1GB → within window (1-200)')
assertEqual(validateWindow('mtn', 200), null, 'MTN 200GB → within window')
assertEqual(validateWindow('mtn', 0), 'MTN only accepts bundles of 1-200 GB via AgentPortal — got 0 GB', 'MTN 0GB → below window')
assertEqual(validateWindow('telecel', 5), 'TELECEL only accepts bundles of 10-200 GB via AgentPortal — got 5 GB', 'Telecel 5GB → below its higher 10GB floor')
assertEqual(validateWindow('telecel', 10), null, 'Telecel 10GB → within window')
assertEqual(validateWindow('airteltigo', 201), 'AIRTELTIGO only accepts bundles of 1-200 GB via AgentPortal — got 201 GB', 'AirtelTigo 201GB → above window')

// ── fulfillOrder validation-gate paths (no network call reached) ────────────
import { fulfillOrder } from '../lib/agentportal-service'

// ── partitionOrdersForSubmission ─────────────────────────────────────────────
import { partitionOrdersForSubmission } from '../lib/agentportal-service'

function testPartitionOrdersForSubmission() {
    const orders = [
        { id: 'o1', phone_number: '0241000001', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r1', price: 20 },
        { id: 'o2', phone_number: '0241000002', network: 'Telecel', size: '15GB', shop_order_id: null, reference_code: 'r2', price: 40 },
        { id: 'o3', phone_number: '0241000003', network: 'MTN', size: '1.5GB', shop_order_id: null, reference_code: 'r3', price: 10 },
        { id: 'o4', phone_number: '0241000004', network: 'Telecel', size: '5GB', shop_order_id: null, reference_code: 'r4', price: 15 },
    ]

    const { valid, invalid } = partitionOrdersForSubmission(orders)

    assertEqual(valid.mtn?.length, 1, 'partition: one valid MTN order')
    assertEqual(valid.mtn?.[0].order.id, 'o1', 'partition: valid MTN order is o1')
    assertEqual(valid.telecel?.length, 1, 'partition: one valid Telecel order (o2, 15GB ≥ 10GB floor)')
    assertEqual(invalid.length, 2, 'partition: two invalid orders (decimal size, below-floor Telecel)')
    assertEqual(invalid.map(r => r.orderId).sort(), ['o3', 'o4'], 'partition: o3 (decimal) and o4 (5GB Telecel, below floor) are invalid')
}

testPartitionOrdersForSubmission()

async function testFulfillOrderGates() {
    const unknownNetwork = await fulfillOrder('Unknown', '0241000001', '5GB', 'order-1')
    assertEqual(unknownNetwork.success, false, 'fulfillOrder: unknown network → success:false')
    assertEqual(unknownNetwork.error, 'AgentPortal does not support network: Unknown', 'fulfillOrder: unknown network → correct error')

    const decimalSize = await fulfillOrder('MTN', '0241000001', '1.5GB', 'order-2')
    assertEqual(decimalSize.success, false, 'fulfillOrder: decimal size → success:false')

    const outOfWindow = await fulfillOrder('Telecel', '0241000001', '5GB', 'order-3')
    assertEqual(outOfWindow.success, false, 'fulfillOrder: Telecel 5GB (below 10GB floor) → success:false')
}

// ── fulfillOrdersBulk (stubbed fetch — no real network calls) ───────────────
// NOTE: `AGENTPORTAL_API_KEY` inside lib/agentportal-service.ts is a top-level `const`
// read from process.env once, at module-load time (import hoisting means that already
// happened before this file's function bodies run). Setting process.env here would be
// too late for the already-cached module instance's config guard — so we force a FRESH
// module instance (via require.cache invalidation) after setting the env var, giving
// this test its own correctly-configured `fulfillOrdersBulk` and fresh circuit-breaker
// state, independent of the module instance the static imports above are bound to.
function makeJsonResponse(status: number, body: any) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (_name: string) => 'application/json' },
        json: async () => body,
        text: async () => JSON.stringify(body),
    }
}

function loadFreshAgentPortalService(): typeof import('../lib/agentportal-service') {
    const modulePath = require.resolve('../lib/agentportal-service')
    delete require.cache[modulePath]
    return require('../lib/agentportal-service')
}

async function testFulfillOrdersBulk() {
    const originalFetch = global.fetch
    const originalApiKey = process.env.AGENTPORTAL_API_KEY
    process.env.AGENTPORTAL_API_KEY = 'test-key-for-bulk-tests'

    try {
        const { fulfillOrdersBulk } = loadFreshAgentPortalService()

        // ── Exactly-once: valid MTN + valid Telecel + one invalid (decimal) row ──
        global.fetch = (async () => makeJsonResponse(200, { added: 1, rejected: [] })) as any

        const mixedOrders = [
            { id: 'b1', phone_number: '0241000001', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r1', price: 20 },
            { id: 'b2', phone_number: '0241000002', network: 'Telecel', size: '15GB', shop_order_id: null, reference_code: 'r2', price: 40 },
            { id: 'b3', phone_number: '0241000003', network: 'MTN', size: '1.5GB', shop_order_id: null, reference_code: 'r3', price: 10 },
        ]

        const mixedResults = await fulfillOrdersBulk(mixedOrders)
        assertEqual(
            mixedResults.map(r => r.orderId).sort(),
            ['b1', 'b2', 'b3'],
            'fulfillOrdersBulk: exactly-once — every input order id appears exactly once (mixed valid/invalid)'
        )

        // ── Rejection mapping: one msisdn rejected, sibling order still accepted ──
        global.fetch = (async () => makeJsonResponse(200, {
            added: 1,
            rejected: [{ msisdn: '0241000005', reason: 'Not whitelisted' }],
        })) as any

        const rejectionOrders = [
            { id: 'b4', phone_number: '0241000005', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r4', price: 20 },
            { id: 'b5', phone_number: '0241000006', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r5', price: 20 },
        ]

        const rejectionResults = await fulfillOrdersBulk(rejectionOrders)
        const b4Result = rejectionResults.find(r => r.orderId === 'b4')
        const b5Result = rejectionResults.find(r => r.orderId === 'b5')
        assertEqual(b4Result?.success, false, 'fulfillOrdersBulk: order whose msisdn is in `rejected` → success:false')
        assertEqual(b5Result?.success, true, 'fulfillOrdersBulk: sibling order in same chunk, not rejected → success:true')

        // ── Two orders sharing one msisdn both receive the rejection outcome ──────
        global.fetch = (async () => makeJsonResponse(200, {
            added: 0,
            rejected: [{ msisdn: '0241000007', reason: 'Not whitelisted' }],
        })) as any

        const sharedMsisdnOrders = [
            { id: 'b6', phone_number: '0241000007', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r6', price: 20 },
            { id: 'b7', phone_number: '0241000007', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r7', price: 20 },
        ]

        const sharedResults = await fulfillOrdersBulk(sharedMsisdnOrders)
        assertEqual(
            sharedResults.every(r => r.success === false),
            true,
            'fulfillOrdersBulk: two orders sharing one rejected msisdn → both success:false'
        )

        // ── Thrown fetch exception → still exactly one result per input order ────
        global.fetch = (async () => { throw new Error('network down') }) as any

        const exceptionOrders = [
            { id: 'b8', phone_number: '0241000008', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r8', price: 20 },
            { id: 'b9', phone_number: '0241000009', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r9', price: 20 },
        ]

        const exceptionResults = await fulfillOrdersBulk(exceptionOrders)
        assertEqual(
            exceptionResults.map(r => r.orderId).sort(),
            ['b8', 'b9'],
            'fulfillOrdersBulk: thrown fetch exception → exactly one result per input order'
        )
        assertEqual(
            exceptionResults.every(r => r.success === false),
            true,
            'fulfillOrdersBulk: thrown fetch exception → all affected orders marked failed'
        )
        assertEqual(
            exceptionResults.every(r => r.ambiguous === true),
            true,
            'fulfillOrdersBulk: thrown fetch exception → all affected orders flagged ambiguous:true (transport failure, not a definite rejection)'
        )

        // ── Non-exception failures must NOT be flagged ambiguous ──────────────────
        // A definite HTTP-error response (not a thrown exception) is a confirmed rejection —
        // AgentPortal told us clearly it didn't accept the chunk — so it must be safe to
        // revert to pending and retry, unlike the ambiguous transport-failure case above.
        global.fetch = (async () => makeJsonResponse(500, { error: 'Internal Server Error' })) as any

        const httpErrorOrders = [
            { id: 'b10', phone_number: '0241000010', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'r10', price: 20 },
        ]
        const httpErrorResults = await fulfillOrdersBulk(httpErrorOrders)
        assertEqual(httpErrorResults[0]?.success, false, 'fulfillOrdersBulk: definite HTTP 500 error → success:false')
        assertEqual(httpErrorResults[0]?.ambiguous, undefined, 'fulfillOrdersBulk: definite HTTP 500 error → ambiguous is NOT set (a confirmed rejection, safe to retry)')
    } finally {
        global.fetch = originalFetch
        if (originalApiKey === undefined) {
            delete process.env.AGENTPORTAL_API_KEY
        } else {
            process.env.AGENTPORTAL_API_KEY = originalApiKey
        }
        // Drop the fresh instance too, so nothing lingers with the test key baked into
        // its module-level const if anything else in this process ever re-requires it.
        delete require.cache[require.resolve('../lib/agentportal-service')]
    }
}

// ── fetchSupplierBalance (stubbed fetch — no real network calls) ────────────
// Covers the review finding: AgentPortal's balance field must be parsed as
// defensively as CodeCraft's (lib/codecraft-service.ts) — accept a JSON number
// or a numeric string, but a missing/null/unparseable balance must return
// success:false and must NEVER fall through to balance:0 (a spurious zero on
// the admin dashboard reads as "wallet empty, stop sending orders").
async function testFetchSupplierBalance() {
    const originalFetch = global.fetch
    const originalApiKey = process.env.AGENTPORTAL_API_KEY
    process.env.AGENTPORTAL_API_KEY = 'test-key-for-balance-tests'

    try {
        const { fetchSupplierBalance } = loadFreshAgentPortalService()

        // ── Numeric balance ────────────────────────────────────────────────────
        global.fetch = (async () => makeJsonResponse(200, { balance: 142.5 })) as any
        const numericResult = await fetchSupplierBalance()
        assertEqual(numericResult.success, true, 'fetchSupplierBalance: numeric balance → success:true')
        assertEqual(numericResult.balance, 142.5, 'fetchSupplierBalance: numeric balance → parsed correctly')

        // ── Numeric-string balance (common shape for money fields) ────────────
        global.fetch = (async () => makeJsonResponse(200, { balance: '142.50' })) as any
        const stringResult = await fetchSupplierBalance()
        assertEqual(stringResult.success, true, 'fetchSupplierBalance: numeric-string balance → success:true')
        assertEqual(stringResult.balance, 142.5, 'fetchSupplierBalance: numeric-string balance → parsed correctly')

        // ── Missing/null balance → failure, never coerced to 0 ────────────────
        global.fetch = (async () => makeJsonResponse(200, { balance: null })) as any
        const nullResult = await fetchSupplierBalance()
        assertEqual(nullResult.success, false, 'fetchSupplierBalance: null balance → success:false')
        assertEqual(nullResult.balance, undefined, 'fetchSupplierBalance: null balance → does NOT fall back to 0')

        // ── Non-numeric garbage balance → failure, never coerced to 0 ─────────
        global.fetch = (async () => makeJsonResponse(200, { balance: 'not-a-number' })) as any
        const garbageResult = await fetchSupplierBalance()
        assertEqual(garbageResult.success, false, 'fetchSupplierBalance: non-numeric garbage balance → success:false')
        assertEqual(garbageResult.balance, undefined, 'fetchSupplierBalance: non-numeric garbage balance → does NOT fall back to 0')

        // ── Literal JSON null body (passes content-type check) → clean failure,
        // not a thrown/generic error from accessing `.balance`/`.error` on null ──
        global.fetch = (async () => makeJsonResponse(200, null)) as any
        const nullBodyResult = await fetchSupplierBalance()
        assertEqual(nullBodyResult.success, false, 'fetchSupplierBalance: literal null response body → success:false')
        assertEqual(nullBodyResult.balance, undefined, 'fetchSupplierBalance: literal null response body → does NOT fall back to 0')
    } finally {
        global.fetch = originalFetch
        if (originalApiKey === undefined) {
            delete process.env.AGENTPORTAL_API_KEY
        } else {
            process.env.AGENTPORTAL_API_KEY = originalApiKey
        }
        delete require.cache[require.resolve('../lib/agentportal-service')]
    }
}

testFulfillOrderGates()
    .then(() => testFulfillOrdersBulk())
    .then(() => testFetchSupplierBalance())
    .then(() => {
        if (process.exitCode === 1) {
            console.error('\nSome tests failed.')
        } else {
            console.log('\nAll tests passed.')
        }
    }).catch((e) => { console.error(e); process.exit(1) })
