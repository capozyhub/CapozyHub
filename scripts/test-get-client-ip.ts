// scripts/test-get-client-ip.ts
// getClientIp (lib/api-auth.ts) must prefer the RIGHTMOST X-Forwarded-For hop — the one Vercel
// actually appends — never the leftmost, which is caller-controlled and lets an attacker forge
// a fresh IP per request to defeat every per-IP rate limit built on this function. Needs
// --env-file=.env.local because lib/api-auth.ts touches env-dependent modules at load time.
import { NextRequest } from 'next/server'
import { getClientIp } from '../lib/api-auth'

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

function req(headers: Record<string, string>): NextRequest {
    return new NextRequest('https://example.com/api/test', { headers })
}

assertEqual(
    getClientIp(req({ 'x-real-ip': '203.0.113.9' })),
    '203.0.113.9',
    'x-real-ip is trusted first',
)

assertEqual(
    getClientIp(req({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.7' })),
    '203.0.113.7',
    'multi-hop XFF: rightmost hop wins, not the caller-controlled leftmost',
)

assertEqual(
    getClientIp(req({ 'x-forwarded-for': '203.0.113.7' })),
    '203.0.113.7',
    'single-hop XFF: that one value',
)

assertEqual(
    getClientIp(req({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })),
    '203.0.113.9',
    'x-real-ip beats x-forwarded-for even when XFF is present',
)

assertEqual(
    getClientIp(req({ 'x-forwarded-for': '1.1.1.1 , 2.2.2.2 ,3.3.3.3' })),
    '3.3.3.3',
    'whitespace around hops is trimmed',
)

assertEqual(
    getClientIp(req({})),
    null,
    'no relevant headers -> null (cf-connecting-ip absent too, no live Cloudflare in front)',
)

assertEqual(
    getClientIp(req({ 'cf-connecting-ip': '203.0.113.5' })),
    '203.0.113.5',
    'cf-connecting-ip is only a last-resort fallback when nothing else is present',
)
