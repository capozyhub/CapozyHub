// scripts/test-airtime-pricing.ts
//
// quoteAirtime is now the single source of airtime fee arithmetic for BOTH the
// dashboard (app/api/airtime/create) and the developer API
// (app/api/v2/airtime/purchase). It decides what a customer is charged, so the
// two fee modes and the fallback constants are pinned here.
import { quoteAirtime, quoteAirtimeCommission } from '@/lib/airtime-pricing'

function assertClose(actual: number, expected: number, label: string) {
    if (Math.abs(actual - expected) > 0.005) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`)
    }
}
function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

// Explicit settings so these assertions test the arithmetic, not the fallbacks.
const settings: Record<string, string> = {
    airtime_min_amount_customer: '1',
    airtime_max_amount_customer: '500',
    airtime_fee_mtn_customer: '5',
}

// ── Standard mode: customer pays `amount`, beneficiary receives amount - fee ──
{
    const r = quoteAirtime({ settings, network: 'MTN', role: 'customer', amount: 100, useExactAmount: false })
    assert(r.ok, 'standard mode quotes successfully')
    if (r.ok) {
        assertClose(r.quote.totalPaid, 100, 'standard: customer pays exactly the amount')
        assertClose(r.quote.feeAmount, 5, 'standard: 5% fee on 100')
        assertClose(r.quote.airtimeAmount, 95, 'standard: beneficiary receives amount - fee')
        // The three must always reconcile, or the wallet debit and the airtime
        // sent to the network disagree.
        assertClose(r.quote.airtimeAmount + r.quote.feeAmount, r.quote.totalPaid, 'standard: airtime + fee == totalPaid')
    }
}

// ── Exact mode: beneficiary receives `amount`, customer pays amount + fee ─────
{
    const r = quoteAirtime({ settings, network: 'MTN', role: 'customer', amount: 100, useExactAmount: true })
    assert(r.ok, 'exact mode quotes successfully')
    if (r.ok) {
        assertClose(r.quote.airtimeAmount, 100, 'exact: beneficiary receives exactly the amount')
        assertClose(r.quote.feeAmount, 5, 'exact: 5% fee on 100')
        assertClose(r.quote.totalPaid, 105, 'exact: customer pays amount + fee')
        assertClose(r.quote.airtimeAmount + r.quote.feeAmount, r.quote.totalPaid, 'exact: airtime + fee == totalPaid')
    }
}

// ── Limits ───────────────────────────────────────────────────────────────────
{
    const below = quoteAirtime({ settings, network: 'MTN', role: 'customer', amount: 0.5, useExactAmount: false })
    assert(!below.ok && below.reason === 'below_min', 'rejects below the minimum')

    const above = quoteAirtime({ settings, network: 'MTN', role: 'customer', amount: 501, useExactAmount: false })
    assert(!above.ok && above.reason === 'above_max', 'rejects above the maximum')
}

// ── Role tiers read their OWN settings keys ─────────────────────────────────
// A dealer must not silently inherit the customer fee.
{
    const roleSettings: Record<string, string> = {
        ...settings,
        airtime_max_amount_dealer: '2000',
        airtime_fee_mtn_dealer: '2',
    }
    const r = quoteAirtime({ settings: roleSettings, network: 'MTN', role: 'dealer', amount: 1000, useExactAmount: false })
    assert(r.ok, 'dealer quote succeeds within the dealer maximum')
    if (r.ok) {
        assertClose(r.quote.feeRate, 2, 'dealer uses the dealer fee rate, not the customer one')
        assertClose(r.quote.feeAmount, 20, 'dealer: 2% fee on 1000')
    }
}

// ── Fallbacks when admin_settings rows are missing ───────────────────────────
// A missing key must NOT parse to NaN — NaN would make every comparison false
// and silently disable the limit entirely.
{
    const r = quoteAirtime({ settings: {}, network: 'MTN', role: 'customer', amount: 100, useExactAmount: false })
    assert(r.ok, 'quotes from fallbacks when settings are empty')
    if (r.ok) {
        assertClose(r.quote.feeRate, 5, 'falls back to the customer fee default')
        assertClose(r.quote.maxAmount, 500, 'falls back to the customer max default')
        assert(Number.isFinite(r.quote.feeAmount), 'fee is a real number, never NaN')
    }
    const over = quoteAirtime({ settings: {}, network: 'MTN', role: 'customer', amount: 10_000, useExactAmount: false })
    assert(!over.ok && over.reason === 'above_max', 'fallback maximum is actually ENFORCED, not bypassed by NaN')
}

// ── An unknown role must not crash or bypass limits ─────────────────────────
{
    const r = quoteAirtime({ settings: {}, network: 'MTN', role: 'nonsense', amount: 10_000, useExactAmount: false })
    assert(!r.ok && r.reason === 'above_max', 'unknown role falls back to customer limits rather than unlimited')
}

// ── mashup uses its own keys and its own GHS 5 floor (dashboard-only path) ───
{
    const r = quoteAirtime({ settings: {}, network: 'MTN', role: 'customer', amount: 3, useExactAmount: false, orderType: 'mashup' })
    assert(!r.ok && r.reason === 'below_min', 'mashup enforces its higher GHS 5 minimum')
}

// ── Fee cannot swallow the whole amount ─────────────────────────────────────
{
    const r = quoteAirtime({
        settings: { airtime_min_amount_customer: '0.01', airtime_fee_mtn_customer: '100' },
        network: 'MTN', role: 'customer', amount: 10, useExactAmount: false,
    })
    assert(!r.ok && r.reason === 'too_low_after_fees', 'rejects when the fee leaves nothing for the beneficiary')
}

// quoteAirtimeCommission — zero-fee API path
{
    const r = quoteAirtimeCommission({ settings: {}, network: 'MTN', role: 'agent', amount: 50 })
    assert(r.ok === true, 'quoteAirtimeCommission: GHS 50 for agent should be ok')
    if (r.ok) {
        assert(r.quote.feeAmount === 0, 'quoteAirtimeCommission: feeAmount must be 0')
        assert(r.quote.feeRate === 0, 'quoteAirtimeCommission: feeRate must be 0')
        assert(r.quote.airtimeAmount === 50, 'quoteAirtimeCommission: airtimeAmount must equal amount')
        assert(r.quote.totalPaid === 50, 'quoteAirtimeCommission: totalPaid must equal amount')
    }
}
{
    // min/max still enforced -- default customer max is 500
    const r = quoteAirtimeCommission({ settings: {}, network: 'MTN', role: 'customer', amount: 501 })
    assert(r.ok === false && r.reason === 'above_max', 'quoteAirtimeCommission: must still enforce max limit')
}
{
    const r = quoteAirtimeCommission({ settings: {}, network: 'MTN', role: 'customer', amount: 0.5 })
    assert(r.ok === false && r.reason === 'below_min', 'quoteAirtimeCommission: must still enforce min limit')
}

console.log('All airtime-pricing tests passed.')
