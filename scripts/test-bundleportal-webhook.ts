// scripts/test-bundleportal-webhook.ts
// Fire a correctly-signed synthetic Bundle Portal webhook event at a real endpoint.
// Run with: npx tsx scripts/test-bundleportal-webhook.ts [options]
//
// No args needed for a smoke test — sends order.completed for a random (non-existent) order
// UUID. Proves signature verification works end-to-end (BUNDLEPORTAL_WEBHOOK_SECRET matches
// what's set in Vercel) and that the "no matching order" path returns 200 gracefully. Touches
// no real data unless --order-id points at a real order.
//
// Options:
//   --url=<endpoint>        default: https://www.kingflexygh.com/api/webhooks/bundleportal
//                            use http://localhost:3000/api/webhooks/bundleportal for local testing
//   --order-id=<uuid>       default: random UUID (guaranteed no match, safe smoke test)
//   --event=order.completed|order.failed|order.cancelled|order.refunded   default: order.completed
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found — run from the project root.')
        process.exit(1)
    }
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        let value = trimmed.slice(eq + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        process.env[trimmed.slice(0, eq).trim()] = value
    }
}

function parseArgs() {
    const args: Record<string, string> = {}
    for (const arg of process.argv.slice(2)) {
        const [key, ...rest] = arg.replace(/^--/, '').split('=')
        args[key] = rest.join('=')
    }
    return args
}

async function run() {
    loadEnvLocal()
    const args = parseArgs()

    const secret = process.env.BUNDLEPORTAL_WEBHOOK_SECRET || ''
    if (!secret) {
        console.error('BUNDLEPORTAL_WEBHOOK_SECRET not set in .env.local — cannot sign a test payload.')
        process.exit(1)
    }

    const url = args.url || 'https://www.kingflexygh.com/api/webhooks/bundleportal'
    const orderId = args['order-id'] || crypto.randomUUID()
    const isRandom = !args['order-id']
    const event = ['order.completed', 'order.failed', 'order.cancelled', 'order.refunded'].includes(args.event || '')
        ? args.event
        : 'order.completed'

    const payload = {
        event,
        order_id: orderId,
        reference: 'KT-TEST-' + crypto.randomBytes(4).toString('hex'),
        status: event === 'order.completed' ? 'completed' : 'failed',
        network: 'mtn',
        bundle: '5GB',
        recipient: '0244000000',
        amount: 20.0,
        failure_reason: event === 'order.completed' ? null : 'test failure',
        settled_at: new Date().toISOString(),
    }

    const rawBody = JSON.stringify(payload)
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    console.log(`${isRandom ? '[SMOKE TEST]' : '[REPLAY]'} POST ${url}`)
    console.log(`order_id: ${orderId}${isRandom ? ' (random — expect "no matching order", 0 real orders touched)' : ' (REAL — this WILL update that order if it matches pending/processing)'}`)
    console.log(`event: ${event}`)
    console.log('')

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-BundlePortal-Signature': signature,
        },
        body: rawBody,
    })

    console.log(`HTTP ${response.status}`)
    console.log(await response.text())
}

run().catch((e) => { console.error(e); process.exit(1) })
