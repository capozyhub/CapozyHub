// scripts/test-sub-agent-pricing.ts
import { resolveSubAgentMarkup, hasSubAgentPricingConfigured } from '../lib/sub-agent-pricing'

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

async function main() {
// ── Per-sub override wins ──
{
    const db = fakeDb({
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'data', product_ref: 'pkg-1', markup: 2 }],
        sub_agent_default_pricing: [{ recruiter_id: 'lead', product_type: 'data', product_ref: 'pkg-1', markup: 1 }],
    })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 2, 'per-sub override wins over the recruiter default')
}

// ── Falls back to the recruiter default when no override exists ──
{
    const db = fakeDb({
        sub_agent_pricing: [],
        sub_agent_default_pricing: [{ recruiter_id: 'lead', product_type: 'data', product_ref: 'pkg-1', markup: 1 }],
    })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 1, 'falls back to recruiter default')
}

// ── Falls back to ZERO when neither exists (new sub, unpriced product) ──
{
    const db = fakeDb({ sub_agent_pricing: [], sub_agent_default_pricing: [] })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 0, 'absence of both rows means zero markup')
}

// ── A different product's rows never leak across product_ref ──
{
    const db = fakeDb({
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'data', product_ref: 'pkg-OTHER', markup: 9 }],
        sub_agent_default_pricing: [],
    })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 0, 'a row for a different product_ref does not apply')
}

// ── A different product_type never leaks (override) ──
{
    const db = fakeDb({
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'afa', product_ref: 'pkg-1', markup: 9 }],
        sub_agent_default_pricing: [],
    })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 0, 'a row for a different product_type does not apply (override)')
}

// ── A different recruiter's default never leaks ──
{
    const db = fakeDb({
        sub_agent_pricing: [],
        sub_agent_default_pricing: [{ recruiter_id: 'other-lead', product_type: 'data', product_ref: 'pkg-1', markup: 9 }],
    })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 0, 'a default row for a different recruiter does not apply')
}

// ── A different sub's override never leaks ──
{
    const db = fakeDb({
        sub_agent_pricing: [{ sub_user_id: 'other-sub', product_type: 'data', product_ref: 'pkg-1', markup: 9 }],
        sub_agent_default_pricing: [],
    })
    const m = await resolveSubAgentMarkup(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(m, 0, 'an override row for a different sub_user_id does not apply')
}

// ── hasSubAgentPricingConfigured: override row exists → true ──
{
    const db = fakeDb({
        sub_agent_pricing: [{ id: 'p1', sub_user_id: 'kofi', product_type: 'data', product_ref: 'pkg-1', markup: 2 }],
        sub_agent_default_pricing: [],
    })
    const configured = await hasSubAgentPricingConfigured(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(configured, true, 'existence check: override row present -> true')
}

// ── hasSubAgentPricingConfigured: only a default row exists → true ──
{
    const db = fakeDb({
        sub_agent_pricing: [],
        sub_agent_default_pricing: [{ id: 'd1', recruiter_id: 'lead', product_type: 'data', product_ref: 'pkg-1', markup: 1 }],
    })
    const configured = await hasSubAgentPricingConfigured(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(configured, true, 'existence check: only default row present -> true')
}

// ── hasSubAgentPricingConfigured: neither exists → false ──
{
    const db = fakeDb({ sub_agent_pricing: [], sub_agent_default_pricing: [] })
    const configured = await hasSubAgentPricingConfigured(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(configured, false, 'existence check: neither row present -> false')
}

// ── hasSubAgentPricingConfigured: default exists but for a DIFFERENT product_ref → false ──
{
    const db = fakeDb({
        sub_agent_pricing: [],
        sub_agent_default_pricing: [{ id: 'd1', recruiter_id: 'lead', product_type: 'data', product_ref: 'pkg-OTHER', markup: 1 }],
    })
    const configured = await hasSubAgentPricingConfigured(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(configured, false, 'existence check: default row for a different product_ref does not apply')
}

// ── hasSubAgentPricingConfigured: override exists but for a DIFFERENT sub_user_id → false ──
{
    const db = fakeDb({
        sub_agent_pricing: [{ id: 'p1', sub_user_id: 'other-sub', product_type: 'data', product_ref: 'pkg-1', markup: 9 }],
        sub_agent_default_pricing: [],
    })
    const configured = await hasSubAgentPricingConfigured(db, 'lead', 'kofi', 'data', 'pkg-1')
    assertEqual(configured, false, 'existence check: override row for a different sub_user_id does not apply')
}
}

main()
