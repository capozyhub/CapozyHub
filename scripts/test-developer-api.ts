// scripts/test-developer-api.ts
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, sep } from 'path'
import { isDevApiPath, DEV_API_BASE_URL } from '@/lib/developer-api'

let failed = 0
function assertEqual<T>(actual: T, expected: T, label: string) {
    if (actual !== expected) { console.error(`FAIL: ${label} (got ${String(actual)}, expected ${String(expected)})`); failed++ }
    else console.log(`PASS: ${label}`)
}

// Public developer-API paths
for (const p of [
    '/api/packages', '/api/account/role', '/api/wallet/balance', '/api/wallet/topup',
    '/api/data/purchase', '/api/data/bulk', '/api/orders/KFT123', '/api/sms/campaigns',
    '/api/sms/messages/abc', '/api/utilities/orders/ref1', '/api/airtime/orders/ref1',
    '/api/afa/register', '/api/resultschecker/types',
]) assertEqual(isDevApiPath(p), true, `public: ${p}`)

// Internal routes sharing the /api namespace must NEVER be treated as public:
// public paths get open CORS and skip session handling.
for (const p of [
    '/api/orders/purchase', '/api/orders/bulk-purchase', '/api/orders/confirm-received', '/api/orders/retry',
    '/api/sms/my-campaigns', '/api/sms/my-campaigns/abc', '/api/sms/account', '/api/utilities/verify',
    '/api/utilities/create', '/api/airtime/create', '/api/wallet/claim-momo', '/api/admin/orders',
    '/api/webhooks/paystack', '/api/v2/packages', '/api/packages/extra', '/api/packages/', '/api',
    '/api/orders/', '/api/orders/a/b', '/x/api/packages',
]) assertEqual(isDevApiPath(p), false, `internal: ${p}`)

assertEqual(DEV_API_BASE_URL, 'https://api.capozygh.com/api', 'DEV_API_BASE_URL value')

// Coverage guard: every route file that authenticates by API key must be in the
// public list, and nothing else may be. Dynamic segments become a sample value.
function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
        const f = join(dir, n)
        return statSync(f).isDirectory() ? walk(f) : n === 'route.ts' ? [f] : []
    })
}
const root = join(process.cwd(), 'app', 'api')
for (const f of walk(root)) {
    const src = readFileSync(f, 'utf8')
    const usesApiKey = /validateApiKey|@\/lib\/api-handlers\//.test(src)
    const path = '/api/' + relative(root, join(f, '..')).split(sep).join('/').replace(/\[[^\]]+\]/g, 'sample')
    if (usesApiKey || isDevApiPath(path)) {
        assertEqual(isDevApiPath(path), usesApiKey, `route/pattern agree: ${path}`)
    }
}

if (failed) { console.error(`${failed} developer-api test(s) failed`); process.exit(1) }
console.log('All developer-api tests passed.')