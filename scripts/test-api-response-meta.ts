// scripts/test-api-response-meta.ts
//
// Pins the shape of the developer-API success envelope's `meta` block: every
// response (v1 is gone) carries meta.version 'v2' by default and never a
// meta.deprecation block.
//
// Complements scripts/test-v2-response-version.ts, which statically asserts
// every v2 route passes the override. This one asserts what the helper actually
// emits once it has.
import { apiSuccess } from '@/lib/api-auth'

async function metaOf(res: Response): Promise<any> {
    const body = await res.json()
    return body.meta
}

function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

async function main() {
    // ── Default: no meta.version override ───────────────────────────────────
    const def = await metaOf(apiSuccess({ ok: 1 }) as unknown as Response)
    assert(def.version === 'v2', `default version, got "${def.version}"`)
    assert(def.deprecation === undefined, 'default carries NO deprecation block')
    assert(typeof def.timestamp === 'string', 'carries a timestamp')

    // ── Explicit override ────────────────────────────────────────────────────
    const explicit = await metaOf(apiSuccess({ ok: 1 }, { version: 'v2' }) as unknown as Response)
    assert(explicit.version === 'v2', `explicit override wins, got "${explicit.version}"`)
    assert(explicit.deprecation === undefined, 'explicit carries NO deprecation block')

    // ── Caller meta still merges, and cannot be clobbered by the defaults ────
    const withExtra = await metaOf(
        apiSuccess({ ok: 1 }, { version: 'v2', message: 'Order already exists' }) as unknown as Response
    )
    assert(withExtra.message === 'Order already exists', 'caller meta keys survive')
    assert(withExtra.version === 'v2', 'caller version survives alongside other meta keys')
    assert(withExtra.deprecation === undefined, 'still has no deprecation')

    console.log('All api-response-meta tests passed.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
