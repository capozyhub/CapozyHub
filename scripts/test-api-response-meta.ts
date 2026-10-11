// scripts/test-api-response-meta.ts
//
// Pins the shape of the developer-API success envelope's `meta` block: a
// timestamp, any caller keys, and no version or deprecation fields.
import { apiSuccess } from '@/lib/api-auth'

async function metaOf(res: Response): Promise<any> {
    const body = await res.json()
    return body.meta
}

function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

async function main() {
    const def = await metaOf(apiSuccess({ ok: 1 }) as unknown as Response)
    assert(def.version === undefined, 'default carries NO version')
    assert(def.deprecation === undefined, 'default carries NO deprecation block')
    assert(typeof def.timestamp === 'string', 'carries a timestamp')

    const withExtra = await metaOf(
        apiSuccess({ ok: 1 }, { message: 'Order already exists' }) as unknown as Response
    )
    assert(withExtra.message === 'Order already exists', 'caller meta keys survive')
    assert(withExtra.version === undefined, 'still no version alongside caller keys')
    assert(typeof withExtra.timestamp === 'string', 'timestamp survives alongside caller keys')

    console.log('All api-response-meta tests passed.')
}

main().catch(err => { console.error(err.message); process.exit(1) })