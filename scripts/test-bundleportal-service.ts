// Bundle Portal service tests
import { resolveBundlePortalNetwork, fulfillOrder, fetchBundlePortalBundles, isBusinessRejection } from '../lib/bundleportal-service'
// ── fulfillOrdersConcurrent (empty input, no network call) ─────────────────────
import { fulfillOrdersConcurrent } from '../lib/bundleportal-service'
import type { OrderToFulfill } from '../lib/fulfillment-service'

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

async function testFulfillOrderGates() {
    // Ruling P-1: network/size validation gates run BEFORE the API-key config guard, so
    // these assertions must hold even with BUNDLEPORTAL_API_KEY unset in this environment.
    const bigtime = await fulfillOrder('AT-BigTime', '0241000001', '5GB', 'order-1')
    assertEqual(bigtime.success, false, 'fulfillOrder: AT-BigTime → success:false')
    assertEqual(bigtime.error, 'Bundle Portal does not support network: AT-BigTime', 'fulfillOrder: AT-BigTime → correct error')

    const decimalSize = await fulfillOrder('MTN', '0241000001', '1.5GB', 'order-2')
    assertEqual(decimalSize.success, false, 'fulfillOrder: decimal size → success:false (package_size must be whole GB)')

    const noKey = await fulfillOrder('MTN', '0241000001', '5GB', 'order-3')
    // BUNDLEPORTAL_API_KEY is unset in this test environment — confirms the config guard
    // fires (after validation gates pass) for a request that would otherwise be valid.
    assertEqual(noKey.success, false, 'fulfillOrder: missing API key → success:false')
}

// ── fetchBundlePortalBundles (empty cache, no key configured → empty array, never throws) ──
async function testFetchBundlePortalBundlesNoKey() {
    const bundles = await fetchBundlePortalBundles('mtn')
    assertEqual(Array.isArray(bundles), true, 'fetchBundlePortalBundles: always returns an array, even with no API key/cache')
}

// ── isBusinessRejection (Finding 2 fix: 402 must classify as a business rejection even
// though Bundle Portal never puts a `code` field on that response) ─────────────────────
function testIsBusinessRejection() {
    assertEqual(isBusinessRejection(402, undefined), true, 'isBusinessRejection: HTTP 402 with no code → true (business rejection, no recordFailure)')
    assertEqual(isBusinessRejection(402), true, 'isBusinessRejection: HTTP 402 called with no code arg at all → true')
    assertEqual(isBusinessRejection(403, 'not_allowlisted'), true, 'isBusinessRejection: known code → true regardless of status')
    assertEqual(isBusinessRejection(409, 'pending_order'), true, 'isBusinessRejection: known code (409) → true')
    assertEqual(isBusinessRejection(500, undefined), false, 'isBusinessRejection: no code, non-402 status → false (counts as failure)')
    assertEqual(isBusinessRejection(500, 'totally_unrecognized_code'), false, 'isBusinessRejection: unknown code, non-402 status → false')
    assertEqual(isBusinessRejection(400, 'validation'), true, 'isBusinessRejection: known code (validation) → true')
    assertEqual(isBusinessRejection(403, 'suspended'), true, 'isBusinessRejection: v2 suspended code (403) → true (account-state condition, mirrors role_locked)')
    assertEqual(isBusinessRejection(400, 'invalid_recipient'), true, 'isBusinessRejection: v2 invalid_recipient code (400) → true (bad customer input, not our integration failing) — sandbox-confirmed 2026-09-28')
}

async function testFulfillOrdersConcurrentEmpty() {
    const result = await fulfillOrdersConcurrent([])
    assertEqual(result, [], 'fulfillOrdersConcurrent: empty input → empty array, no network call')
}

// ── fulfillOrdersConcurrent (multi-chunk + input-order preservation) ───────────
// BUNDLEPORTAL_API_KEY is unset in this environment, so every fulfillOrder call returns
// { success: false, error: 'Bundle Portal is not configured' } quickly with no network call.
// 12 orders at the default concurrency of 5 spans 3 chunks (5 + 5 + 2), which is what actually
// exercises the i + j index math across chunk boundaries.
async function testFulfillOrdersConcurrentOrderPreservation() {
    const orders: OrderToFulfill[] = Array.from({ length: 12 }, (_, i) => ({
        id: `o${i + 1}`,
        phone_number: '0241000001',
        network: 'MTN',
        size: '5GB',
        shop_order_id: null,
        reference_code: `ref-${i + 1}`,
        price: 10,
    }))

    const results = await fulfillOrdersConcurrent(orders)
    assertEqual(results.length, 12, 'fulfillOrdersConcurrent: 12 orders (3 chunks) → 12 results')
    assertEqual(
        results.map(r => r.orderId),
        orders.map(o => o.id),
        'fulfillOrdersConcurrent: result order matches input order across all chunk boundaries'
    )
}

// ── fulfillOrdersConcurrent (rejected-promise branch) ───────────────────────────
// fulfillOrder does `dataSize.match(/[\d.]+/)` before the API-key guard — passing size: null
// makes that call throw a TypeError synchronously inside the async function, so the promise
// returned to Promise.allSettled REJECTS. This exercises the outcome.status === 'rejected'
// branch without any stubbing.
async function testFulfillOrdersConcurrentRejectedPromise() {
    const orders: OrderToFulfill[] = [
        { id: 'sib-1', phone_number: '0241000001', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'ref-sib-1', price: 10 },
        { id: 'malformed-1', phone_number: '0241000001', network: 'MTN', size: null as any, shop_order_id: null, reference_code: 'ref-malformed-1', price: 10 },
        { id: 'sib-2', phone_number: '0241000001', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'ref-sib-2', price: 10 },
    ]

    const results = await fulfillOrdersConcurrent(orders)
    assertEqual(results.length, 3, 'fulfillOrdersConcurrent: rejected-promise branch → sibling orders not lost, 3 results')

    const byId = new Map(results.map(r => [r.orderId, r]))
    assertEqual(
        [...byId.keys()].sort(),
        ['malformed-1', 'sib-1', 'sib-2'],
        'fulfillOrdersConcurrent: every input id appears exactly once in output'
    )

    const malformed = byId.get('malformed-1')
    assertEqual(malformed?.success, false, 'fulfillOrdersConcurrent: malformed order (null size, rejected promise) → success:false')
    assertEqual(
        typeof malformed?.error === 'string' && malformed.error.length > 0,
        true,
        'fulfillOrdersConcurrent: malformed order → non-empty error message (from rejected-promise branch)'
    )

    assertEqual(byId.get('sib-1')?.success, false, 'fulfillOrdersConcurrent: sibling order sib-1 still present with its own result')
    assertEqual(byId.get('sib-2')?.success, false, 'fulfillOrdersConcurrent: sibling order sib-2 still present with its own result')
}

// ── Mocked-transport tests (Findings C2 + I1) ───────────────────────────────────
// Both tests below need fulfillOrder to actually reach its place_order call instead of
// short-circuiting at the "Bundle Portal is not configured" guard — which means
// BUNDLEPORTAL_API_KEY has to be truthy. That constant is captured ONCE, at module-evaluation
// time, from `process.env.BUNDLEPORTAL_API_KEY || ''` — and the static import at the top of
// this file already froze it at '' for every test above (deliberately: testFulfillOrderGates'
// "missing API key" assertion depends on that). Setting the env var after that point has no
// effect on the already-loaded module instance.
//
// To get a second, independently-configured module instance without disturbing the one the
// rest of this file relies on, we set the env var and then import the SAME file again under a
// cache-busting query-string specifier — Node's module cache is keyed by the full specifier
// (including the query string), so this forces a fresh evaluation that picks up the new env
// var, while every earlier `import ... from '../lib/bundleportal-service'` keeps using the
// original (unconfigured) instance. global.fetch is stubbed for the duration so no real
// network call ever leaves this process either way.
async function withMockedBundlePortalTransport<T>(
    responder: (body: any) => { httpStatus: number; json: any },
    run: (fresh: typeof import('../lib/bundleportal-service')) => Promise<T>
): Promise<T> {
    process.env.BUNDLEPORTAL_API_KEY = 'test-key-for-mocked-transport-tests'
    const originalFetch = global.fetch
    global.fetch = (async (_url: any, init: any) => {
        const body = JSON.parse(String(init?.body ?? '{}'))
        const { httpStatus, json } = responder(body)
        return {
            status: httpStatus,
            headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
            json: async () => json,
            text: async () => JSON.stringify(json),
        } as unknown as Response
    }) as any

    try {
        const fresh = await import(`../lib/bundleportal-service?bust=${Date.now()}-${Math.random()}`)
        return await run(fresh)
    } finally {
        global.fetch = originalFetch
    }
}

// Finding C2 regression pin: Bundle Portal's `order_id` is ITS idempotency key (retrying with
// the same value returns the original order, `duplicate: true`, no double charge; a DIFFERENT
// value places a genuinely new, separately-charged order). fulfillOrder's `dispatchKey`
// parameter defaults to `orderId`, and fulfillOrdersConcurrent calls
// `fulfillOrder(order.network, order.phone_number, order.size, order.id)` with no explicit
// 5th argument — so whatever ends up on the wire as `order_id` must equal `order.id` unchanged.
// This test observes the actual outbound request body to pin that, rather than only checking
// the returned BulkOrderResult.orderId (which testFulfillOrdersConcurrentOrderPreservation
// above already covers but which is populated independently of the network call).
async function testFulfillOrdersConcurrentPinsOrderIdAsIdempotencyKey() {
    const capturedOrderIds: string[] = []
    await withMockedBundlePortalTransport(
        (body) => {
            if (body.action === 'place_order') capturedOrderIds.push(body.order_id)
            // The outcome doesn't matter for this test — only what we SENT as order_id.
            return { httpStatus: 200, json: { success: false, message: 'declined for test', code: 'validation' } }
        },
        async (fresh) => {
            const orders: OrderToFulfill[] = [
                { id: 'orders-row-id-111', phone_number: '0241000001', network: 'MTN', size: '5GB', shop_order_id: null, reference_code: 'ref-1', price: 10 },
                { id: 'orders-row-id-222', phone_number: '0241000001', network: 'Telecel', size: '10GB', shop_order_id: null, reference_code: 'ref-2', price: 20 },
            ]
            await fresh.fulfillOrdersConcurrent(orders)
        }
    )
    // Chunk members dispatch concurrently, so sort before comparing — this pins SET
    // membership + exact string equality per id, not network-completion ordering.
    assertEqual(
        [...capturedOrderIds].sort(),
        ['orders-row-id-111', 'orders-row-id-222'].sort(),
        'fulfillOrdersConcurrent: order_id sent to Bundle Portal equals each order.id unchanged (Finding C2 idempotency-key pin)'
    )
}

// Finding I1: a success:true response with no usable reference must be classified as a
// failure (not a silent stranded-order success) — see lib/bundleportal-service.ts's fulfillOrder.
async function testFulfillOrderMissingReferenceClassifiedAsFailure() {
    const result = await withMockedBundlePortalTransport(
        () => ({ httpStatus: 200, json: { success: true, data: {} } }), // success:true, no reference
        async (fresh) => fresh.fulfillOrder('MTN', '0241000001', '5GB', 'order-missing-ref')
    )
    assertEqual(result.success, false, 'fulfillOrder: success:true with no reference → classified as failure (Finding I1)')
    assertEqual(
        result.error,
        'Bundle Portal accepted the order but returned no reference',
        'fulfillOrder: missing-reference failure carries the documented error message'
    )
}

async function main() {
    // ── resolveBundlePortalNetwork ──────────────────────────────────────────
    assertEqual(resolveBundlePortalNetwork('MTN'), 'mtn', "MTN → 'mtn'")
    assertEqual(resolveBundlePortalNetwork('Telecel'), 'telecel', "Telecel → 'telecel'")
    assertEqual(resolveBundlePortalNetwork('AT-iShare'), 'airteltigo', "AT-iShare → 'airteltigo'")
    assertEqual(resolveBundlePortalNetwork('AT-BigTime'), null, 'AT-BigTime → null (explicitly unsupported)')
    assertEqual(resolveBundlePortalNetwork('Unknown'), null, 'unrecognized network → null')

    // ── fulfillOrder validation-gate paths (no network call reached) ─────────
    await testFulfillOrderGates()

    // ── fetchBundlePortalBundles ──────────────────────────────────────────
    await testFetchBundlePortalBundlesNoKey()

    // ── isBusinessRejection (402 classification) ─────────────────────────
    testIsBusinessRejection()

    // ── fulfillOrdersConcurrent ───────────────────────────────────────────
    await testFulfillOrdersConcurrentEmpty()
    await testFulfillOrdersConcurrentOrderPreservation()
    await testFulfillOrdersConcurrentRejectedPromise()

    // ── Mocked-transport tests (Findings C2 + I1) ────────────────────────
    await testFulfillOrdersConcurrentPinsOrderIdAsIdempotencyKey()
    await testFulfillOrderMissingReferenceClassifiedAsFailure()

    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll tests passed.')
    }
}

main()
