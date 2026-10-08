/**
 * Guard: MoMo name lookup (lib/momo-verify.ts) provider chain.
 *
 * Found 2026-09-28: the Paystack fallback sent bank_code 'VDF' for Telecel, which
 * Paystack rejects ("Unknown bank code: VDF") — so whenever Moolre failed, every
 * Telecel lookup failed too. This pins the codes to Paystack's real Ghana
 * mobile-money list (MTN / VOD / ATL) and the chain order Moolre -> Paystack ->
 * one Moolre retry. fetch is stubbed; no network calls.
 *
 * Run: npx tsx scripts/test-momo-verify.ts
 */
process.env.MOOLRE_TRANSFER_API_USER = 'u'
process.env.MOOLRE_TRANSFER_API_KEY = 'k'
process.env.MOOLRE_ACCOUNT_NUMBER = 'a'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_x'

type Call = { provider: 'moolre' | 'paystack'; bankCode?: string; channel?: number }
let calls: Call[] = []
let script: Array<'ok' | 'fail'> = []

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input)
    const outcome = script.shift() ?? 'fail'
    if (url.includes('moolre.com')) {
        const body = JSON.parse(init?.body ?? '{}')
        calls.push({ provider: 'moolre', channel: body.channel })
        return new Response(JSON.stringify(outcome === 'ok' ? { status: 1, code: 'AVD01', data: 'KOFI MENSAH' } : { status: 0, code: 'AVD02', message: 'Failed' }))
    }
    if (url.includes('api.paystack.co/bank/resolve')) {
        const bankCode = new URL(url).searchParams.get('bank_code') ?? undefined
        calls.push({ provider: 'paystack', bankCode })
        // Mirror Paystack: unknown bank codes are rejected outright.
        if (!['MTN', 'VOD', 'ATL'].includes(bankCode ?? '')) {
            return new Response(JSON.stringify({ status: false, message: `Unknown bank code: ${bankCode}` }), { status: 400 })
        }
        return new Response(JSON.stringify(outcome === 'ok' ? { status: true, data: { account_name: 'AMA SERWAA' } } : { status: false, message: 'Could not resolve' }))
    }
    throw new Error('unexpected fetch ' + url)
}) as typeof fetch

let failures = 0
const expect = (name: string, cond: boolean, detail = '') => {
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ' — ' + detail}`)
    if (!cond) failures++
}

;(async () => {
    const { resolveNameSingle } = await import('../lib/momo-verify')
    const run = async (phone: string, outcomes: Array<'ok' | 'fail'>) => {
        calls = []; script = [...outcomes]
        const r = await resolveNameSingle(phone)
        return { r, calls: [...calls] }
    }

    // 1. Moolre succeeds -> Paystack never called.
    let t = await run('233241234567', ['ok'])
    expect('Moolre hit returns moolre result', t.r?.provider === 'moolre')
    expect('Moolre hit makes exactly one call', t.calls.length === 1, JSON.stringify(t.calls))

    // 2. Telecel: Moolre fails -> Paystack fallback uses VOD and succeeds.
    t = await run('233201234567', ['fail', 'ok'])
    expect('Telecel fallback reaches Paystack', t.calls[1]?.provider === 'paystack', JSON.stringify(t.calls))
    expect('Telecel Paystack bank_code is VOD', t.calls[1]?.bankCode === 'VOD', JSON.stringify(t.calls))
    expect('Telecel fallback returns the Paystack name', t.r?.provider === 'paystack' && t.r?.fullName === 'AMA SERWAA')
    expect('Telecel Moolre channel is 6', t.calls[0]?.channel === 6)

    // 3. MTN and AirtelTigo codes.
    t = await run('233551234567', ['fail', 'ok'])
    expect('MTN Paystack bank_code is MTN', t.calls[1]?.bankCode === 'MTN')
    t = await run('233271234567', ['fail', 'ok'])
    expect('AT Paystack bank_code is ATL', t.calls[1]?.bankCode === 'ATL')

    // 4. Moolre fails, Paystack fails -> one Moolre retry, which succeeds.
    t = await run('233241234567', ['fail', 'fail', 'ok'])
    expect('Full miss retries Moolre once', t.calls.map(c => c.provider).join(',') === 'moolre,paystack,moolre', JSON.stringify(t.calls))
    expect('Retry result is returned', t.r?.provider === 'moolre')

    // 5. Everything fails -> null, and no more than 3 calls (no retry storm).
    t = await run('233501234567', ['fail', 'fail', 'fail'])
    expect('All fail returns null', t.r === null)
    expect('All fail makes exactly 3 calls', t.calls.length === 3, JSON.stringify(t.calls))

    // 6. Unknown prefix -> no provider call at all.
    t = await run('233991234567', [])
    expect('Unknown network prefix returns null without calling out', t.r === null && t.calls.length === 0, JSON.stringify(t.calls))

    globalThis.fetch = realFetch
    console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
    process.exit(failures ? 1 : 0)
})()
