// scripts/test-webhook-config-route.ts
//
// Static guard on app/api/user/api-keys/webhook/route.ts — the ONLY route that
// can write api_keys.webhook_url. Four properties matter enough that a silent
// regression in any of them is a security or support problem, and none of them
// are visible to tsc or lint:
//
//   1. SSRF validation runs ON WRITE, not only at dispatch time.
//   2. The per-key config cache is invalidated after every write, or the
//      developer sees "saved" and receives nothing for up to 60s.
//   3. Every DB touch is scoped to the caller's own user_id. This route uses a
//      service-role client, which bypasses RLS — so that filter IS the
//      authorization check, not a convenience.
//   4. The signing secret is never returned by GET. It is shown once on
//      creation and is unrecoverable afterwards.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROUTE = join(process.cwd(), 'app', 'api', 'user', 'api-keys', 'webhook', 'route.ts')
const src = readFileSync(ROUTE, 'utf8')

function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

// 1. SSRF validation on write, using the SAME validator the dispatcher uses —
//    so what saves is exactly what will be allowed to fire.
assert(src.includes('validateWebhookUrl('), 'PUT validates the URL with validateWebhookUrl before saving')
assert(
    src.includes("from '@/lib/api-webhook'"),
    'validator is imported from lib/api-webhook (shared with the dispatcher), not reimplemented locally'
)

// 2. Cache invalidation after BOTH mutating verbs.
const invalidateCount = (src.match(/invalidateWebhookConfig\(/g) || []).length
assert(
    invalidateCount >= 2,
    `invalidateWebhookConfig must be called after PUT and after DELETE; found ${invalidateCount} call(s)`
)

// 3. Every api_keys query/update is user-scoped. Counts .eq('user_id', ...)
//    against the number of api_keys touches — service-role bypasses RLS, so a
//    missing filter here would let one developer configure another's webhook.
const apiKeysTouches = (src.match(/from\('api_keys'\)/g) || []).length
const userScopes = (src.match(/\.eq\('user_id', authUser\.id\)/g) || []).length
assert(apiKeysTouches > 0, 'route actually touches api_keys')
assert(
    userScopes >= apiKeysTouches,
    `every api_keys access must be scoped to the caller: ${apiKeysTouches} touch(es) vs ${userScopes} user_id filter(s)`
)

// 4. GET must not leak the secret. It may SELECT the column to report a
//    boolean, but must never place the raw value in the response body.
assert(src.includes('hasSecret'), 'GET reports only whether a secret exists')
assert(
    !/webhookSecret\s*:\s*\w*\.webhook_secret/.test(src) && !/signingSecret\s*:\s*\w*\.webhook_secret/.test(src),
    'GET must never return the stored webhook_secret value'
)
// The one place a secret is returned is the freshly generated one on PUT.
assert(src.includes('signingSecret: newSecret'), 'PUT returns the newly generated secret exactly once')

// 5. Secrets are generated with a CSPRNG, not Math.random.
assert(src.includes('randomBytes('), 'signing secret uses crypto randomBytes')
assert(!src.includes('Math.random'), 'signing secret must not use Math.random')

console.log('All webhook-config-route tests passed.')
