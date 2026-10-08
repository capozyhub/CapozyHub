// scripts/test-sub-agent-earnings.ts
import { recordPendingSubAgentEarning } from '../lib/sub-agent-earnings'

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

// ── Fake db capturing the insert payload ──
function fakeDb(opts: { insertError?: any } = {}) {
    const inserted: any[] = []
    return {
        db: {
            from(table: string) {
                return {
                    insert(row: any) {
                        inserted.push({ table, row })
                        return { error: opts.insertError ?? null }
                    },
                }
            },
        } as any,
        inserted,
    }
}

async function main() {

// ── Zero-amount earnings are never written (nothing to track for airtime/mashup) ──
{
    const { db, inserted } = fakeDb()
    const r = await recordPendingSubAgentEarning(db, {
        orderReference: 'REF-1', orderTable: 'orders', recruiterId: 'lead', subUserId: 'kofi', amount: 0,
    })
    assertEqual(r.success, true, 'zero amount: reports success')
    assertEqual(inserted.length, 0, 'zero amount: writes NO ledger row')
}

// ── Positive amount writes exactly one pending row ──
{
    const { db, inserted } = fakeDb()
    const r = await recordPendingSubAgentEarning(db, {
        orderReference: 'REF-2', orderTable: 'orders', recruiterId: 'lead', subUserId: 'kofi', amount: 1.5,
    })
    assertEqual(r.success, true, 'positive amount: reports success')
    assertEqual(inserted.length, 1, 'positive amount: writes exactly one row')
    assertEqual(inserted[0].row.status, 'pending', 'written row starts pending')
    assertEqual(inserted[0].row.amount, 1.5, 'written row carries the correct amount')
}

// ── A duplicate order_reference is a benign no-op, never a thrown error ──
{
    const { db } = fakeDb({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    const r = await recordPendingSubAgentEarning(db, {
        orderReference: 'REF-3', orderTable: 'orders', recruiterId: 'lead', subUserId: 'kofi', amount: 1,
    })
    assertEqual(r.success, true, 'duplicate order_reference: treated as already-recorded, not a failure')
}

// ── A real DB error is surfaced, not swallowed ──
{
    const { db } = fakeDb({ insertError: { code: '42501', message: 'permission denied' } })
    const r = await recordPendingSubAgentEarning(db, {
        orderReference: 'REF-4', orderTable: 'orders', recruiterId: 'lead', subUserId: 'kofi', amount: 1,
    })
    assertEqual(r.success, false, 'a real error is surfaced, not silently treated as success')
}

}

main()
