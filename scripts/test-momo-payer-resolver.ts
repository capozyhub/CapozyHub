// scripts/test-momo-payer-resolver.ts
import { isMomoLookupEligible, resolveMomoPayerDetails, requiresExternalLookup, buildPersistedCachePayload, type ShopOrderMomoRow, type MomoResolverDeps } from '../lib/momo-payer-resolver'

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

// ── isMomoLookupEligible ─────────────────────────────────────────────────
assertEqual(isMomoLookupEligible({ status: 'failed' }), true, 'failed → eligible')
assertEqual(isMomoLookupEligible({ status: 'refunded' }), true, 'refunded → eligible')
assertEqual(isMomoLookupEligible({ status: 'completed' }), false, 'completed → not eligible')
assertEqual(isMomoLookupEligible({ status: 'pending' }), false, 'pending → not eligible')
assertEqual(isMomoLookupEligible({ status: null }), false, 'null status → not eligible')

// ── buildPersistedCachePayload (FIX 5: a null-name resolution must never
//    permanently freeze "Unavailable" on an order) ───────────────────────
{
    const namedPayload = buildPersistedCachePayload({ number: '0241234567', name: 'Kwame Mensah', network: 'MTN' })
    assertEqual(
        Object.prototype.hasOwnProperty.call(namedPayload, 'payer_momo_resolved_at'),
        true,
        'resolved name → payload stamps payer_momo_resolved_at'
    )
    assertEqual(typeof namedPayload.payer_momo_resolved_at, 'string', 'payer_momo_resolved_at is a timestamp string when stamped')
}
{
    const nullNamePayload = buildPersistedCachePayload({ number: '0241234567', name: null, network: 'MTN' })
    assertEqual(
        Object.prototype.hasOwnProperty.call(nullNamePayload, 'payer_momo_resolved_at'),
        false,
        'null name (provider outage) → payload must NOT stamp payer_momo_resolved_at, so the next lookup can retry'
    )
    assertEqual(
        { number: nullNamePayload.payer_momo_number, network: nullNamePayload.payer_momo_network },
        { number: '0241234567', network: 'MTN' },
        'null name → number/network are still persisted unconditionally (cheap and needed for the refund)'
    )
}

// ── requiresExternalLookup (FIX 8: only spend rate-limit quota when a
//    provider call will actually happen) ─────────────────────────────────
assertEqual(requiresExternalLookup({ status: 'completed' } as ShopOrderMomoRow), false, 'ineligible order → no external lookup')
assertEqual(
    requiresExternalLookup({ status: 'failed', payer_momo_resolved_at: '2026-08-01T00:00:00Z', payer_momo_number: '0241234567' } as ShopOrderMomoRow),
    false,
    'fully cached row → no external lookup'
)
assertEqual(
    requiresExternalLookup({ status: 'failed', source: 'ussd', payer_momo_number: null, paystack_reference: null } as ShopOrderMomoRow),
    false,
    'USSD order with no captured payer → short-circuits to unavailable, no external lookup (must not burn quota)'
)
assertEqual(
    requiresExternalLookup({ status: 'failed', source: 'website', payer_momo_number: null, paystack_reference: null } as ShopOrderMomoRow),
    false,
    'website order with no paystack_reference → short-circuits to unavailable, no external lookup (must not burn quota)'
)
assertEqual(
    requiresExternalLookup({ status: 'failed', source: 'website', payer_momo_number: null, paystack_reference: 'ref-abc' } as ShopOrderMomoRow),
    true,
    'website order with a paystack_reference → will call Paystack verify'
)
assertEqual(
    requiresExternalLookup({ status: 'failed', source: 'ussd', payer_momo_number: '0241234567', payer_momo_resolved_at: null } as ShopOrderMomoRow),
    true,
    'payer number known but not yet name-resolved → still needs a name-resolution call'
)

function baseRow(overrides: Partial<ShopOrderMomoRow> = {}): ShopOrderMomoRow {
    return {
        id: 'order-1',
        source: 'ussd',
        guest_phone: '0241234567',
        network: 'MTN',
        selling_price: 25.5,
        paystack_reference: null,
        status: 'failed',
        payer_momo_number: null,
        payer_momo_name: null,
        payer_momo_network: null,
        payer_momo_resolved_at: null,
        ...overrides,
    }
}

const noopDeps: MomoResolverDeps = {
    verifyPaystackTransaction: async () => { throw new Error('should not be called for USSD') },
    resolveName: async () => 'Kwame Mensah',
    persistCache: async () => {},
}

async function run() {
    // Ineligible order → blocked with no payer fields, regardless of deps.
    const blocked = await resolveMomoPayerDetails(baseRow({ status: 'completed' }), noopDeps)
    assertEqual(blocked, { ok: false, error: 'Not eligible' }, 'completed order → blocked, no payer data')

    // USSD with a captured payer number → returns the PAYER, never guest_phone.
    const ussdCaptured = await resolveMomoPayerDetails(
        baseRow({ source: 'ussd', guest_phone: '0209998888', payer_momo_number: '0241234567', status: 'failed' }),
        noopDeps
    )
    assertEqual(
        ussdCaptured,
        { ok: true, data: { name: 'Kwame Mensah', number: '0241234567', network: 'MTN', amountPaid: 25.5, source: 'ussd' } },
        'USSD with captured payer → returns payer number, NOT guest_phone'
    )

    // USSD with NO captured payer number → unavailable. Must NOT fall back to guest_phone.
    const ussdMissing = await resolveMomoPayerDetails(
        baseRow({ source: 'ussd', guest_phone: '0209998888', payer_momo_number: null, status: 'refunded' }),
        noopDeps
    )
    assertEqual(
        ussdMissing,
        { ok: false, error: 'MoMo details unavailable for this order' },
        'USSD with no captured payer → unavailable, never falls back to guest_phone'
    )

    // Network is derived from the PAYER's own prefix, not the beneficiary's network column.
    const ussdNetwork = await resolveMomoPayerDetails(
        baseRow({ source: 'ussd', network: 'MTN', payer_momo_number: '0201112222', status: 'failed' }),
        noopDeps
    )
    assertEqual(
        ussdNetwork,
        { ok: true, data: { name: 'Kwame Mensah', number: '0201112222', network: 'TELECEL', amountPaid: 25.5, source: 'ussd' } },
        'USSD network derived from payer prefix (020 => TELECEL), not the order network column'
    )

    // A captured payer number also short-circuits the website path (no Paystack call).
    const websiteCaptured = await resolveMomoPayerDetails(
        baseRow({ source: 'website', paystack_reference: 'ref-abc', payer_momo_number: '0551112222', status: 'refunded' }),
        { ...noopDeps, verifyPaystackTransaction: async () => { throw new Error('should not be called when payer already captured') } }
    )
    assertEqual(
        websiteCaptured.ok && websiteCaptured.data.number,
        '0551112222',
        'captured payer number short-circuits the Paystack verify call'
    )

    // Storefront: resolves via injected Paystack verify.
    const websiteDeps: MomoResolverDeps = {
        verifyPaystackTransaction: async (ref) => {
            assertEqual(ref, 'ref-abc', 'website path passes paystack_reference through')
            return { mobileMoneyNumber: '0551112222', network: 'MTN' }
        },
        resolveName: async () => 'Ama Owusu',
        persistCache: async () => {},
    }
    const websiteResult = await resolveMomoPayerDetails(
        baseRow({ source: 'website', guest_phone: '0209998888', paystack_reference: 'ref-abc', status: 'refunded' }),
        websiteDeps
    )
    assertEqual(
        websiteResult,
        { ok: true, data: { name: 'Ama Owusu', number: '0551112222', network: 'MTN', amountPaid: 25.5, source: 'website' } },
        'Website eligible order → resolves via Paystack verify, NOT guest_phone'
    )

    // FIX 8: Paystack commonly returns the payer number as `233…`/`+233…` — must
    // be normalised to the local `0XXXXXXXXX` form before it's returned/cached,
    // matching the format the USSD capture path and backfill migration write.
    const rawInternationalDeps: MomoResolverDeps = {
        verifyPaystackTransaction: async () => ({ mobileMoneyNumber: '233551112222', network: 'MTN' }),
        resolveName: async () => 'Ama Owusu',
        persistCache: async () => {},
    }
    const normalizedResult = await resolveMomoPayerDetails(
        baseRow({ source: 'website', paystack_reference: 'ref-intl', status: 'failed' }),
        rawInternationalDeps
    )
    assertEqual(
        normalizedResult.ok && normalizedResult.data.number,
        '0551112222',
        'Paystack 233-form number is normalised to local 0XXXXXXXXX before being returned'
    )

    // Storefront: Paystack verify returns nothing → graceful unavailable, not a crash.
    const failedVerifyDeps: MomoResolverDeps = {
        verifyPaystackTransaction: async () => null,
        resolveName: async () => { throw new Error('should not be called') },
        persistCache: async () => {},
    }
    const unresolvable = await resolveMomoPayerDetails(
        baseRow({ source: 'website', paystack_reference: 'ref-missing', status: 'failed' }),
        failedVerifyDeps
    )
    assertEqual(unresolvable, { ok: false, error: 'MoMo details unavailable for this order' }, 'unresolvable Paystack verify → graceful error')

    // Cached row → returns cache, never calls deps at all.
    const cachedResult = await resolveMomoPayerDetails(
        baseRow({
            status: 'refunded',
            payer_momo_number: '0241234567',
            payer_momo_name: 'Cached Name',
            payer_momo_network: 'MTN',
            payer_momo_resolved_at: '2026-08-01T00:00:00Z',
        }),
        noopDeps
    )
    assertEqual(
        cachedResult,
        { ok: true, data: { name: 'Cached Name', number: '0241234567', network: 'MTN', amountPaid: 25.5, source: 'ussd' } },
        'cached row → returns cache without calling any provider'
    )

    if (process.exitCode === 1) {
        console.error('Some momo-payer-resolver tests FAILED')
    } else {
        console.log('All momo-payer-resolver tests passed.')
    }
}

run()
