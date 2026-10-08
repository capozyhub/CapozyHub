import { beginSelfServiceReset } from '../lib/sub-agent-key'

function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else { console.log('PASS:', msg) }
}

function fakeDb(matchingSub: { id: string; phone_number: string; email: string; first_name: string } | null) {
    return {
        from: (table: string) => {
            if (table === 'users') {
                return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: matchingSub, error: null }) }) }) }
            }
            if (table === 'sub_agents') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: matchingSub ? { user_id: matchingSub.id } : null, error: null }) }) }),
                    update: () => ({ eq: async () => ({ error: null }) }),
                }
            }
            throw new Error(`unexpected table ${table}`)
        },
    } as any
}

function fakeDeps() {
    const smsCalls: any[] = []
    const emailCalls: any[] = []
    return { deps: { sendSms: async (o: any) => { smsCalls.push(o); return { success: true } }, sendEmail: async (o: any) => { emailCalls.push(o); return { success: true } } }, smsCalls, emailCalls }
}

async function testKnownAccountDeliversToChosenChannelOnly() {
    const db = fakeDb({ id: 'sub-1', phone_number: '0241234567', email: 'sub@example.com', first_name: 'Kofi' })
    const { deps, smsCalls, emailCalls } = fakeDeps()
    const result = await beginSelfServiceReset(db, { type: 'email', value: 'sub@example.com' }, 'email', deps)
    assert(result.attempted === true, 'known account: attempted')
    assert(emailCalls.length === 1, 'email channel chosen -> email sent')
    assert(smsCalls.length === 0, 'email channel chosen -> sms NOT sent')
}

async function testUnknownAccountStillReturnsAttempted() {
    const db = fakeDb(null)
    const { deps, smsCalls, emailCalls } = fakeDeps()
    const result = await beginSelfServiceReset(db, { type: 'email', value: 'nobody@example.com' }, 'email', deps)
    assert(result.attempted === true, 'unknown account: STILL reports attempted (enumeration-safe — caller cannot distinguish)')
    assert(smsCalls.length === 0 && emailCalls.length === 0, 'unknown account: no delivery actually happens')
}

async function main() {
    await testKnownAccountDeliversToChosenChannelOnly()
    await testUnknownAccountStillReturnsAttempted()
    process.exit(process.exitCode || 0)
}

main()
