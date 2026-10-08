// scripts/test-commission-subagent-name-enrichment.ts
import { attachSubAgentNames } from '../lib/commission-subagent-names'

function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else { console.log('PASS:', msg) }
}

function fakeDb(earningRows: any[], userRows: Record<string, { first_name: string; last_name: string }>) {
    return {
        from: (table: string) => {
            if (table === 'sub_agent_order_earnings') {
                return { select: () => ({ in: async () => ({ data: earningRows, error: null }) }) }
            }
            if (table === 'users') {
                return { select: () => ({ in: async (_col: string, ids: string[]) => ({ data: ids.map((id) => ({ id, ...userRows[id] })), error: null }) }) }
            }
            throw new Error(`unexpected table ${table}`)
        },
    } as any
}

async function main() {
    const db = fakeDb(
        [{ order_table: 'shop_orders', order_reference: 'ref-1', sub_user_id: 'sub-1' }],
        { 'sub-1': { first_name: 'Ama', last_name: 'Owusu' } },
    )
    const transactions = [
        { id: 't1', type: 'sub_agent_margin', order_table: 'shop_orders', order_reference: 'ref-1', amount: 2 },
        { id: 't2', type: 'commission', order_table: null, order_reference: null, amount: 5 },
    ]
    const enriched = await attachSubAgentNames(db, transactions)
    assert(enriched[0].subAgentName === 'Ama Owusu', 'sub_agent_margin row gets the resolved name')
    assert(enriched[1].subAgentName === undefined, 'non-sub-agent row is left alone')
    process.exit(process.exitCode || 0)
}

main()
