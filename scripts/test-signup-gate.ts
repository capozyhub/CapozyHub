import assert from 'node:assert/strict'
import { signupsPaused } from '../lib/signup-gate'

const cases: Array<[string | undefined, boolean]> = [
    [undefined, false],
    ['', false],
    ['false', false],
    ['0', false],
    ['true', true],
    [' TRUE ', true],
]

for (const [value, expected] of cases) {
    if (value === undefined) delete process.env.SIGNUPS_PAUSED
    else process.env.SIGNUPS_PAUSED = value
    assert.equal(signupsPaused(), expected, `SIGNUPS_PAUSED=${JSON.stringify(value)}`)
}

// The route must check the gate before doing anything else.
async function main() {
    process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'dummy'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'dummy'
    process.env.SIGNUPS_PAUSED = 'true'
    const { POST } = await import('../app/api/auth/signup/route')
    const res = await POST(new Request('http://localhost/api/auth/signup', { method: 'POST', body: '{}' }) as any)
    assert.equal(res.status, 403)
    assert.equal((await res.json()).code, 'signups_paused')
    console.log('signup gate: ok')
}

main().catch(err => { console.error(err); process.exit(1) })
