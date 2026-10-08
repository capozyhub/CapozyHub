// scripts/test-retry-sub-agent-pricing.ts
// Pure-logic coverage for the sub-agent pricing branch in lib/retry-service.ts
// (Task 1, docs/superpowers/plans/2026-09-16-subagent-retry-ussd-afa-wallet-fixes.md).
//
// SAFETY NOTE: retryOrder() reaches two real modules via dynamic import
// (`@/lib/fulfillment-trigger`, `@/lib/push-service`) that each construct their
// OWN live Supabase/web-push clients — NOT the fake `admin` client this harness
// passes in. Left unmocked, invoking retryOrder() to a successful claim would
// make real calls against the live project. Both are shadowed below via a
// require.cache pre-populate BEFORE retryOrder is ever called — Node's dynamic
// import() of a CommonJS module reuses require.cache by resolved file path, so
// this substitutes an inert stub and the real files are never executed at all.
// Verified empirically against this exact mechanism before writing this file.
// Every test order also uses network 'AirtelTigo' (never 'MTN') so
// checkMtnWhitelistGate's very first check (`shouldEvaluateWhitelistGate`)
// short-circuits before it would ever construct a real client either.
import * as path from 'path'
import * as Module from 'module'

const fulfillmentTriggerPath = path.resolve(__dirname, '../lib/fulfillment-trigger.ts')
;(Module as any)._cache[fulfillmentTriggerPath] = {
    id: fulfillmentTriggerPath,
    filename: fulfillmentTriggerPath,
    loaded: true,
    exports: { triggerFulfillment: async () => ({ failed: false, type: 'skipped' }) },
}
const pushServicePath = path.resolve(__dirname, '../lib/push-service.ts')
;(Module as any)._cache[pushServicePath] = {
    id: pushServicePath,
    filename: pushServicePath,
    loaded: true,
    exports: {
        sendOrderRetryPushNotification: async () => {},
        sendAdminPushNotification: async () => {},
    },
}

// lib/retry-service.ts statically imports lib/mtn-whitelist-gate.ts, which statically
// imports lib/supabase.ts — whose top-level `export const supabase = createBrowserClient(...)`
// throws synchronously if these two env vars are unset, entirely independent of whether
// this test ever exercises the MTN whitelist path (it doesn't — see the network choice
// below). Dummy placeholder values only; createBrowserClient() never makes a network call
// at construction time, only when a method on the returned client is invoked, which none
// of these tests do. Set BEFORE importing retry-service — done via a dynamic import()
// inside main() below, rather than a static top-level import, so this assignment is
// guaranteed to run first regardless of module-hoisting semantics.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-placeholder-anon-key'

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

/**
 * Mirrors the fakeDb() shape from scripts/test-sub-agent-data-pricing.ts, extended
 * with insert/update/upsert (recorded, always "succeed") and a configurable rpc()
 * so retryOrder's single admin.rpc('claim_order_retry', ...) call can be scripted
 * per test case.
 */
function fakeDb(tables: Record<string, Row[]>) {
    const inserted: Record<string, Row[]> = {}
    const rpcCalls: Array<{ name: string; params: any }> = []
    const db = {
        from(table: string) {
            let rows = [...(tables[table] ?? [])]
            const builder: any = {
                select() { return builder },
                eq(col: string, val: any) { rows = rows.filter(r => r[col] === val); return builder },
                in(col: string, vals: any[]) { rows = rows.filter(r => vals.includes(r[col])); return builder },
                order() { return builder },
                limit() { return builder },
                async maybeSingle() { return { data: rows[0] ?? null, error: null } },
                async single() { return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } } },
                async insert(payload: any) {
                    inserted[table] = inserted[table] ?? []
                    const arr = Array.isArray(payload) ? payload : [payload]
                    inserted[table].push(...arr)
                    return { data: null, error: null }
                },
                // update()/upsert() chains are awaited directly by callers in
                // retry-service.ts (e.g. .update({...}).eq(...).eq(...)) — return
                // a thenable builder so either `await` on the intermediate .eq()
                // result or on update() itself resolves cleanly.
                update(_payload: any) { return builder },
                async upsert(_payload: any) { return { data: null, error: null } },
                then(resolve: any) { resolve({ data: null, error: null }) },
            }
            return builder
        },
        async rpc(name: string, params: any) {
            // Overridden per test case below with a canned claim_order_retry response —
            // this default only guards against a test forgetting to set one.
            rpcCalls.push({ name, params })
            return { data: null, error: { message: 'rpc not stubbed for this test' } }
        },
        __inserted: inserted,
        __rpcCalls: rpcCalls,
    }
    return db as any
}

const RETAIL_ORDER: Row = {
    id: 'order-1',
    user_id: 'buyer-1',
    price: 10,
    status: 'refunded',
    category: 'data',
    network: 'AirtelTigo', // never MTN — keeps checkMtnWhitelistGate a guaranteed no-op
    size: '1GB',
    phone_number: '0201234567',
    shop_order_id: null,
    reference_code: 'OLD-REF-1',
    retry_count: 0,
    last_retry_at: null,
    refunded_at: '2026-09-01T00:00:00Z',
}

const PKG = {
    id: 'pkg-1', price: 10, agent_price: 4, dealer_price: 3.5, cost_price: 3,
    // Must match RETAIL_ORDER.network/size/is_available — the pkg lookup in
    // retry-service.ts filters data_packages on all three .eq() clauses.
    network: 'AirtelTigo', size: '1GB', is_available: true,
}
const LIFETIME_AGENT_RECRUITER = { id: 'lead-1', role: 'agent', agent_expires_at: null, dealer_expires_at: null }

function buildSuccessRpc(chargedAmount: number, referenceCode: string) {
    return { data: { ok: true, target_order_id: 'order-1', attempt_no: 1, charged_amount: chargedAmount, reference_code: referenceCode, mode: 'in_place' }, error: null }
}
const FAILURE_RPC = { data: { ok: false, error: 'insufficient_balance', required: 5, available: 1 }, error: null }

async function main() {
const { retryOrder } = await import('../lib/retry-service')

// ── 1. Sub-agent retry prices at recruiterCost + markup, not customer price ──
{
    const db = fakeDb({
        orders: [RETAIL_ORDER],
        data_packages: [PKG],
        sub_agents: [{ user_id: 'buyer-1', upline_user_id: 'lead-1', status: 'active' }],
        users: [LIFETIME_AGENT_RECRUITER],
        sub_agent_pricing: [{ sub_user_id: 'buyer-1', product_type: 'data', product_ref: 'pkg-1', markup: 1 }],
        sub_agent_default_pricing: [],
        sub_agent_order_earnings: [],
    })
    // rpc echoes back whatever reference_code/charge_amount retryOrder actually sent,
    // so the RPC call params are the authoritative check, not this canned response.
    db.rpc = async (name: string, params: any) => {
        db.__rpcCalls.push({ name, params })
        return buildSuccessRpc(params.p_charge_amount, params.p_reference_code)
    }

    const result = await retryOrder(db, { orderId: 'order-1', actorId: 'buyer-1', actorRole: 'user' })

    assertEqual(result.ok, true, 'sub-agent retry: succeeds')
    const rpcParams = db.__rpcCalls[0]?.params
    assertEqual(rpcParams?.p_charge_amount, 5, 'sub-agent retry: charged recruiterCost(4) + markup(1) = 5, not customer price 10')
    assertEqual(rpcParams?.p_cost_price, 3, 'sub-agent retry: cost_price still passed through from the package row')

    const earnings = db.__inserted['sub_agent_order_earnings'] ?? []
    assertEqual(earnings.length, 1, 'sub-agent retry: exactly one earning row recorded')
    assertEqual(earnings[0]?.order_table, 'orders', "sub-agent retry: earning recorded with orderTable 'orders'")
    assertEqual(earnings[0]?.recruiter_id, 'lead-1', 'sub-agent retry: earning credited to the resolved recruiter')
    assertEqual(earnings[0]?.sub_user_id, 'buyer-1', 'sub-agent retry: earning attributed to the sub-agent buyer')
    assertEqual(earnings[0]?.amount, 1, 'sub-agent retry: recruiter earns exactly the markup (1)')
    assertEqual(earnings[0]?.order_reference, rpcParams?.p_reference_code, 'sub-agent retry: earning order_reference matches the exact referenceCode used in the RPC call')
}

// ── 2. Non-sub-agent retry is byte-identical to before (plain dealer role) ──
{
    const db = fakeDb({
        orders: [RETAIL_ORDER],
        data_packages: [PKG],
        sub_agents: [], // not a sub at all
        users: [{ id: 'buyer-1', role: 'dealer', agent_expires_at: null, dealer_expires_at: null }],
        sub_agent_order_earnings: [],
    })
    db.rpc = async (name: string, params: any) => {
        db.__rpcCalls.push({ name, params })
        return buildSuccessRpc(params.p_charge_amount, params.p_reference_code)
    }

    const result = await retryOrder(db, { orderId: 'order-1', actorId: 'buyer-1', actorRole: 'user' })

    assertEqual(result.ok, true, 'non-sub-agent retry: succeeds')
    const rpcParams = db.__rpcCalls[0]?.params
    assertEqual(rpcParams?.p_charge_amount, 3.5, 'non-sub-agent retry: still prices via resolveOwnerCost (active dealer -> dealer_price 3.5)')
    const earnings = db.__inserted['sub_agent_order_earnings'] ?? []
    assertEqual(earnings.length, 0, 'non-sub-agent retry: no sub-agent earning ever recorded')
}

// ── 3. Sub-agent retry with zero configured markup still works (no-markup default) ──
{
    const db = fakeDb({
        orders: [RETAIL_ORDER],
        data_packages: [PKG],
        sub_agents: [{ user_id: 'buyer-1', upline_user_id: 'lead-1', status: 'active' }],
        users: [LIFETIME_AGENT_RECRUITER],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [],
        sub_agent_order_earnings: [],
    })
    db.rpc = async (name: string, params: any) => {
        db.__rpcCalls.push({ name, params })
        return buildSuccessRpc(params.p_charge_amount, params.p_reference_code)
    }

    const result = await retryOrder(db, { orderId: 'order-1', actorId: 'buyer-1', actorRole: 'user' })

    assertEqual(result.ok, true, 'zero-markup sub-agent retry: succeeds')
    const rpcParams = db.__rpcCalls[0]?.params
    assertEqual(rpcParams?.p_charge_amount, 4, 'zero-markup sub-agent retry: charged exactly recruiterCost (4), no markup configured')
    const earnings = db.__inserted['sub_agent_order_earnings'] ?? []
    assertEqual(earnings.length, 0, 'zero-markup sub-agent retry: no earning row (recruiterEarns is 0, nothing to record)')
}

// ── 4. recordPendingSubAgentEarning is called ONLY after a successful claim ──
{
    const db = fakeDb({
        orders: [RETAIL_ORDER],
        data_packages: [PKG],
        sub_agents: [{ user_id: 'buyer-1', upline_user_id: 'lead-1', status: 'active' }],
        users: [LIFETIME_AGENT_RECRUITER],
        sub_agent_pricing: [{ sub_user_id: 'buyer-1', product_type: 'data', product_ref: 'pkg-1', markup: 1 }],
        sub_agent_default_pricing: [],
        sub_agent_order_earnings: [],
    })
    db.rpc = async (name: string, params: any) => {
        db.__rpcCalls.push({ name, params })
        return FAILURE_RPC // claim_order_retry rejects (e.g. insufficient_balance) despite a resolvable sub price
    }

    const result = await retryOrder(db, { orderId: 'order-1', actorId: 'buyer-1', actorRole: 'user' })

    assertEqual(result.ok, false, 'failed claim: retryOrder reports failure')
    assertEqual(result.outcome, 'insufficient_balance', 'failed claim: outcome passed through from the RPC')
    const earnings = db.__inserted['sub_agent_order_earnings'] ?? []
    assertEqual(earnings.length, 0, 'failed claim: earning is NEVER recorded when claim_order_retry does not return ok:true')
}

}

main()
