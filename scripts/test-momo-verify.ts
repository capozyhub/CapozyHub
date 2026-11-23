/**
 * Guard: MoMo name lookup (lib/momo-verify.ts), Paystack only.
 *
 * Pins the Paystack bank codes to its real Ghana mobile-money list (MTN / VOD / ATL) —
 * 'VDF' for Telecel was once rejected with "Unknown bank code: VDF" — and the retry
 * policy: one attempt, plus exactly one retry on a miss. fetch is stubbed; no network.
 *
 * Run: npx tsx scripts/test-momo-verify.ts
 */
process.env.PAYSTACK_SECRET_KEY = 'sk_test_x'

type Call = { bankCode?: string }
let calls: Call[] = []
let script: Array<'ok' | 'fail'> = []

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any) => {
    const url = String(input)
    const outcome = script.shift() ?? 'fail'
    if (url.includes('api.paystack.co/bank/resolve')) {
        const bankCode = new URL(url).searchParams.get('bank_code') ?? undefined
        calls.push({ bankCode })
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

    // 1. First attempt succeeds -> exactly one call.
    let t = await run('233241234567', ['ok'])
    expect('Hit returns the Paystack result', t.r?.provider === 'paystack' && t.r?.fullName === 'AMA SERWAA')
    expect('Hit makes exactly one call', t.calls.length === 1, JSON.stringify(t.calls))

    // 2. Bank codes per network.
    t = await run('233201234567', ['ok'])
    expect('Telecel bank_code is VOD', t.calls[0]?.bankCode === 'VOD', JSON.stringify(t.calls))
    t = await run('233551234567', ['ok'])
    expect('MTN bank_code is MTN', t.calls[0]?.bankCode === 'MTN')
    t = await run('233271234567', ['ok'])
    expect('AT bank_code is ATL', t.calls[0]?.bankCode === 'ATL')

    // 3. Miss then hit -> one retry, which succeeds.
    t = await run('233241234567', ['fail', 'ok'])
    expect('Miss retries once', t.calls.length === 2, JSON.stringify(t.calls))
    expect('Retry result is returned', t.r?.fullName === 'AMA SERWAA')

    // 4. Everything fails -> null, and no more than 2 calls (no retry storm).
    t = await run('233501234567', ['fail', 'fail', 'fail'])
    expect('All fail returns null', t.r === null)
    expect('All fail makes exactly 2 calls', t.calls.length === 2, JSON.stringify(t.calls))

    // 5. Unknown prefix -> no provider call at all.
    t = await run('233991234567', [])
    expect('Unknown network prefix returns null without calling out', t.r === null && t.calls.length === 0, JSON.stringify(t.calls))

    // 6. The picked network wins over the number's prefix (number portability).
    calls = []; script = ['ok']
    const hinted = await resolveNameSingle('233241234567', 'Telecel Cash')
    expect('Network hint overrides the prefix', calls[0]?.bankCode === 'VOD' && hinted?.network === 'TELECEL', JSON.stringify(calls))

    globalThis.fetch = realFetch
    console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
    process.exit(failures ? 1 : 0)
})()