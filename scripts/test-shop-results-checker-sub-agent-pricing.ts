// scripts/test-shop-results-checker-sub-agent-pricing.ts
// Plan 2c, Task 3 — pure-logic coverage for the storefront RC CHECKOUT pricing composition
// wired into app/api/shop/results-checker/initialize/route.ts and
// app/api/shop/results-checker/charge/route.ts (both routes share the identical block, so one
// test file covers both). Exercises calculateRCPrice + applySubAgentRcOverride exactly as the
// routes compose them, plus resolveSubAgentRcCost's fail-closed contract that the routes map
// to a 409 before any order row is created.
import { calculateRCPrice, applySubAgentRcOverride } from '../lib/results-checker-service'
import { resolveSubAgentRcCost } from '../lib/sub-agent-rc-pricing'

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

type Row = Record<string, any>

function fakeDb(tables: Record<string, Row[]>) {
    return {
        from(table: string) {
            let rows = [...(tables[table] ?? [])]
            const builder: any = {
                select() { return builder },
                eq(col: string, val: any) { rows = rows.filter(r => r[col] === val); return builder },
                async maybeSingle() { return { data: rows[0] ?? null, error: null } },
            }
            return builder
        },
    } as any
}

// Settings passed directly to calculateRCPrice (bypasses the live admin_settings fetch —
// the param exists precisely for this kind of pure-logic test, per its own doc comment).
const SETTINGS = {
    results_checker_paystack_fee_percent: '1.95',
    results_checker_max_markup_customer: '0',
    results_checker_max_markup_agent: '0',
    results_checker_max_markup_dealer: '0',
}

const LIFETIME_AGENT_ROW = { id: 'lead', role: 'agent', agent_expires_at: null, dealer_expires_at: null }
const TYPE = { id: 'type-1', customer_price: 14, agent_price: 13, dealer_price: 12.5, cost_price: 10, name: 'WASSCE' }

async function main() {
    // ── Non-sub shop: byte-identical to today (no override applied) ──────────
    {
        const breakdown = await calculateRCPrice({
            type: TYPE, quantity: 2, userRole: 'customer', shopMarkup: 1, includePaystackFee: true, settings: SETTINGS,
        })
        const unitPrice = breakdown.unitPrice + breakdown.shopMarkup
        assertEqual(breakdown.unitPrice, 14, 'non-sub: unitPrice untouched (role price)')
        assertEqual(unitPrice, 15, 'non-sub: guest unit price = role price + shop markup')
        assertEqual(breakdown.subtotal, 30, 'non-sub: subtotal = unitPrice * quantity')
    }

    // ── Healthy sub composition matches the dashboard pattern exactly:
    //    guest unit price = subAgentUnitPrice + shopMarkup, recruiterEarns stacks under it ──
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 0.5 }],
            sub_agent_default_pricing: [],
        })
        const subResult = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(subResult.ok, true, 'healthy sub: resolver ok')
        assertEqual(subResult.subCost, 13.5, 'healthy sub: subCost = recruiterCost(13) + markup(0.5)')
        assertEqual(subResult.recruiterEarns, 0.5, 'healthy sub: recruiterEarns = 0.5')

        const baseBreakdown = await calculateRCPrice({
            type: TYPE, quantity: 1, userRole: 'customer', shopMarkup: 2, includePaystackFee: true, settings: SETTINGS,
        })
        const overridden = applySubAgentRcOverride(baseBreakdown, subResult.subCost, 1)
        const guestUnitPrice = overridden.unitPrice + overridden.shopMarkup
        // subAgentUnitPrice(13.5) + shopMarkup(2) — the shop's own storefront markup stacks
        // UNCHANGED on top of the sub-agent cost basis, exactly mirroring purchaseWithWallet.
        assertEqual(guestUnitPrice, 15.5, 'healthy sub: guest unit price = subCost + shopMarkup (shop markup untouched)')
        assertEqual(overridden.subtotal, 15.5, 'healthy sub: subtotal re-derived from overridden unit price at quantity 1')
        // Fee is rescaled proportionally to the new subtotal rather than the pre-override one —
        // storefront routes (unlike the dashboard wallet path) always charge a Paystack fee.
        const expectedFee = parseFloat((15.5 * 0.0195).toFixed(2))
        assertEqual(overridden.paystackFee, expectedFee, 'healthy sub: paystack fee rescaled to overridden subtotal')
        assertEqual(overridden.total, parseFloat((15.5 + expectedFee).toFixed(2)), 'healthy sub: total = overridden subtotal + rescaled fee')
    }

    // ── Bulk-tier sub-agent quantity correctly threaded (reuses Plan 2b's bulk-tier fixture) ──
    {
        const TYPE_BULK = { ...TYPE, bulk_pricing: [{ min_qty: 10, max_qty: 100, unit_price: 11 }] }
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 0 }],
            sub_agent_default_pricing: [],
        })
        const subResult = await resolveSubAgentRcCost(db, 'kofi', TYPE_BULK, 20)
        assertEqual(subResult.subCost, 11, 'bulk tier: subCost uses the bulk unit price (11) at qty 20')

        const baseBreakdown = await calculateRCPrice({
            type: TYPE_BULK, quantity: 20, userRole: 'customer', shopMarkup: 1, includePaystackFee: true, settings: SETTINGS,
        })
        const overridden = applySubAgentRcOverride(baseBreakdown, subResult.subCost, 20)
        const guestUnitPrice = overridden.unitPrice + overridden.shopMarkup
        assertEqual(guestUnitPrice, 12, 'bulk tier: guest unit price = bulk subCost(11) + shopMarkup(1)')
        assertEqual(overridden.subtotal, 240, 'bulk tier: subtotal = (11+1) * 20')
    }

    // ── Rejection: ceiling breach fails closed — routes must 409 before any order row ──────
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 5 }],
            sub_agent_default_pricing: [],
        })
        const subResult = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(subResult.ok, false, 'ceiling breach: resolver rejects (subCost 18 > customer ceiling 14)')
        // The routes check `if (!subCostResult.ok)` and return 409 immediately — no
        // calculateRCPrice call, no order insert, no Paystack call happens past this point.
    }

    // ── Suspended sub-agent: resolver fails closed (route must 409, not fall through to
    //    the flat role price) ──────────────────────────────────────────────────────────────
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'suspended' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [],
            sub_agent_default_pricing: [],
        })
        const subResult = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(subResult.ok, false, 'suspended sub: resolver rejects')
    }
}

main()
