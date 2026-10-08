// scripts/test-shop-afa-checkout.ts
import { computeAfaShopPricing, computeShopAfaCheckout } from '../lib/shop-afa-checkout'
import { resolveAfaPrice } from '../lib/afa-pricing'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
        console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// Base case: cost 13, selling 15 -> profit 2 (caller accepts, profit > 0)
{
    const r = computeAfaShopPricing(13, 15)
    assertEqual(r.sellingPrice, 15, 'sellingPrice at cost 13 / selling 15')
    assertEqual(r.profit, 2, 'profit at cost 13 / selling 15')
}

// Selling == cost -> profit 0 (caller must reject: profit <= 0 is not a valid live value)
{
    const r = computeAfaShopPricing(13, 13)
    assertEqual(r.sellingPrice, 13, 'sellingPrice at cost 13 / selling 13')
    assertEqual(r.profit, 0, 'profit at cost 13 / selling 13 (caller rejects, profit <= 0)')
}

// Selling below cost -> negative profit (caller must reject — the underwater guard)
{
    const r = computeAfaShopPricing(13, 12)
    assertEqual(r.sellingPrice, 12, 'sellingPrice at cost 13 / selling 12')
    assertEqual(r.profit, -1, 'profit at cost 13 / selling 12 (caller rejects, underwater)')
}

// 2dp rounding on the selling price itself
{
    const r = computeAfaShopPricing(13, 15.999)
    assertEqual(r.sellingPrice, 16, 'sellingPrice rounds to 2dp')
    assertEqual(r.profit, 3, 'profit computed from rounded sellingPrice')
}

// 2dp rounding on the resulting profit (repeating decimal)
{
    const r = computeAfaShopPricing(10.01, 13.34)
    assertEqual(r.sellingPrice, 13.34, 'sellingPrice stays as provided (already 2dp)')
    assertEqual(r.profit, 3.33, 'profit rounds a repeating decimal to 2dp')
}

// Paystack-fee calc: total = selling + round(selling * 1.95%, 2), mirroring the DATA
// branch in lib/shop-checkout.ts exactly (paystackFeePercent default 1.95).
{
    const sellingPrice = 15
    const paystackFeePercent = 1.95
    const paystackFee = Math.round(sellingPrice * (paystackFeePercent / 100) * 100) / 100
    const totalAmountPesewas = Math.round((sellingPrice + paystackFee) * 100)
    assertEqual(paystackFee, 0.29, 'paystackFee at 1.95% of GHS 15 selling price')
    assertEqual(totalAmountPesewas, 1529, 'totalAmountPesewas = (selling + paystackFee) in pesewas')
}

// =============================================================================
// computeShopAfaCheckout — sub-agent storefront wiring (Plan 2c, Task 1)
// A minimal mock Supabase client: each `.from(table)` returns a thenable
// builder that records `.eq()`/`.in()` filters and resolves via a per-table
// handler function once awaited (mirrors how the real postgrest client is
// awaited directly without a trailing `.then()`).
// =============================================================================

type TableHandler = (state: { filters: [string, any][]; inFilter?: [string, any[]] }) => { data: any; error: any }

function makeMockDb(handlers: Record<string, TableHandler>) {
    return {
        from(table: string) {
            const state: { filters: [string, any][]; inFilter?: [string, any[]] } = { filters: [] }
            const builder: any = {
                select() { return builder },
                eq(col: string, val: any) { state.filters.push([col, val]); return builder },
                in(col: string, vals: any[]) { state.inFilter = [col, vals]; return builder },
                single() { return builder },
                maybeSingle() { return builder },
                then(resolve: any, reject: any) {
                    const handler = handlers[table]
                    if (!handler) return Promise.resolve({ data: null, error: null }).then(resolve, reject)
                    return Promise.resolve(handler(state)).then(resolve, reject)
                },
            }
            return builder
        },
    }
}

const VALID_FORM_DATA = {
    full_name: 'Kofi Mensah',
    phone: '0241234567',
    id_type: 'Ghana Card',
    id_number: 'GHA-123456789-0',
    location: 'Adenta',
    region: 'Greater Accra',
    date_of_birth: '1990-01-01',
}

const AFA_SETTINGS_ROWS = [
    { key: 'storefront_afa_enabled', value: 'true' },
    { key: 'afa_price_customer', value: '15' },
    { key: 'afa_price_agent', value: '13' },
    { key: 'afa_price_dealer', value: '12' },
]

function makeShopRow(overrides: Partial<{ owner_id: string; ownerRole: string; afa_selling_price: number }> = {}) {
    return {
        id: 'shop-1',
        shop_name: 'Test Shop',
        shop_slug: 'test-shop',
        owner_id: overrides.owner_id ?? 'owner-1',
        approval_status: 'approved',
        is_active: true,
        owner_phone: '0200000000',
        whatsapp_number: '0200000000',
        afa_selling_price: overrides.afa_selling_price ?? 20,
        paystack_fee_percent: null,
        owner: { role: overrides.ownerRole ?? 'agent', email: 'owner@example.com' },
    }
}

async function run() {
    // --- Scenario A: non-sub owner — behavior must be byte-identical to today.
    {
        const shop = makeShopRow({ owner_id: 'owner-non-sub', ownerRole: 'agent', afa_selling_price: 20 })
        const db = makeMockDb({
            shop_profiles: () => ({ data: shop, error: null }),
            admin_settings: () => ({ data: AFA_SETTINGS_ROWS, error: null }),
            sub_agents: () => ({ data: null, error: null }), // no membership row -> not a sub
            shop_global_settings: () => ({ data: [], error: null }),
        })
        const result = await computeShopAfaCheckout(db as any, {
            shopSlug: 'test-shop', guestPhone: '0241234567', formData: VALID_FORM_DATA,
        })
        const expectedCost = resolveAfaPrice({ afa_price_customer: '15', afa_price_agent: '13', afa_price_dealer: '12' }, 'agent')
        if (result.ok) {
            assertEqual(result.costPrice, expectedCost, 'non-sub owner: costPrice unchanged (flat role price)')
            assertEqual(result.costPrice, 13, 'non-sub owner: costPrice equals afa_price_agent')
        } else {
            console.error('FAIL: non-sub owner scenario returned an error:', result)
            process.exitCode = 1
        }
    }

    // --- Scenario B: healthy sub-agent owner — cost comes from resolveSubAgentAfaCost.
    {
        const shop = makeShopRow({ owner_id: 'owner-sub-healthy', ownerRole: 'agent', afa_selling_price: 20 })
        const db = makeMockDb({
            shop_profiles: () => ({ data: shop, error: null }),
            admin_settings: () => ({ data: AFA_SETTINGS_ROWS, error: null }),
            sub_agents: () => ({
                data: { user_id: 'owner-sub-healthy', status: 'active', upline_user_id: 'recruiter-1' },
                error: null,
            }),
            users: () => ({
                data: { id: 'recruiter-1', role: 'agent', agent_expires_at: null, dealer_expires_at: null },
                error: null,
            }),
            sub_agent_pricing: () => ({ data: { markup: 1 }, error: null }), // per-sub override: markup 1
            sub_agent_default_pricing: () => ({ data: null, error: null }),
            shop_global_settings: () => ({ data: [], error: null }),
        })
        const result = await computeShopAfaCheckout(db as any, {
            shopSlug: 'test-shop', guestPhone: '0241234567', formData: VALID_FORM_DATA,
        })
        // recruiterCost = afa_price_agent (13), markup = 1 -> subCost = 14, customerPrice (15) ceiling not exceeded
        if (result.ok) {
            assertEqual(result.costPrice, 14, 'healthy sub: costPrice = recruiterCost(13) + markup(1) = subCost(14)')
        } else {
            console.error('FAIL: healthy sub scenario returned an error:', result)
            process.exitCode = 1
        }
    }

    // --- Scenario C: sub-agent pricing rejection (subCost would exceed the customer-price
    // ceiling) — must block with the SAME 500 shape as the existing "pricing not configured"
    // path, with no partial state (no sellingPrice/profit computed, no paystack lookup used).
    {
        const shop = makeShopRow({ owner_id: 'owner-sub-rejected', ownerRole: 'agent', afa_selling_price: 20 })
        const db = makeMockDb({
            shop_profiles: () => ({ data: shop, error: null }),
            admin_settings: () => ({ data: AFA_SETTINGS_ROWS, error: null }),
            sub_agents: () => ({
                data: { user_id: 'owner-sub-rejected', status: 'active', upline_user_id: 'recruiter-2' },
                error: null,
            }),
            users: () => ({
                data: { id: 'recruiter-2', role: 'agent', agent_expires_at: null, dealer_expires_at: null },
                error: null,
            }),
            // recruiterCost (13) + markup (10) = 23 > customerPrice (15) -> rejected by computeSubAgentCost
            sub_agent_pricing: () => ({ data: { markup: 10 }, error: null }),
            sub_agent_default_pricing: () => ({ data: null, error: null }),
            shop_global_settings: () => ({ data: [], error: null }),
        })
        const result = await computeShopAfaCheckout(db as any, {
            shopSlug: 'test-shop', guestPhone: '0241234567', formData: VALID_FORM_DATA,
        })
        if (!result.ok) {
            assertEqual(result.status, 500, 'sub-agent pricing rejection: status 500')
            assertEqual(result.error, 'Registration pricing is not configured. Please contact support.', 'sub-agent pricing rejection: reuses existing error message')
        } else {
            console.error('FAIL: sub-agent pricing rejection scenario unexpectedly succeeded:', result)
            process.exitCode = 1
        }
    }

    // --- Scenario D: suspended / ineligible sub — blocked the same way, no partial state.
    {
        const shop = makeShopRow({ owner_id: 'owner-sub-suspended', ownerRole: 'agent', afa_selling_price: 20 })
        const db = makeMockDb({
            shop_profiles: () => ({ data: shop, error: null }),
            admin_settings: () => ({ data: AFA_SETTINGS_ROWS, error: null }),
            sub_agents: () => ({
                data: { user_id: 'owner-sub-suspended', status: 'suspended', upline_user_id: 'recruiter-3' },
                error: null,
            }),
            users: () => ({
                data: { id: 'recruiter-3', role: 'agent', agent_expires_at: null, dealer_expires_at: null },
                error: null,
            }),
            sub_agent_pricing: () => ({ data: null, error: null }),
            sub_agent_default_pricing: () => ({ data: null, error: null }),
            shop_global_settings: () => ({ data: [], error: null }),
        })
        const result = await computeShopAfaCheckout(db as any, {
            shopSlug: 'test-shop', guestPhone: '0241234567', formData: VALID_FORM_DATA,
        })
        if (!result.ok) {
            assertEqual(result.status, 500, 'suspended sub: status 500')
            assertEqual(result.error, 'Registration pricing is not configured. Please contact support.', 'suspended sub: reuses existing error message')
        } else {
            console.error('FAIL: suspended sub scenario unexpectedly succeeded:', result)
            process.exitCode = 1
        }
    }

    console.log(process.exitCode ? '\nSome tests FAILED' : '\nAll tests PASSED')
}

run()
