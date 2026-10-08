// scripts/test-agentportal-webhook.ts
// Fire a correctly-signed synthetic AgentPortal webhook event at a real endpoint.
// Run with: npx tsx scripts/test-agentportal-webhook.ts [options]
//
// No args needed for a smoke test — sends order.completed for a random (non-existent)
// order UUID as the item's `reference`. Proves signature verification works end-to-end
// (AGENTPORTAL_WEBHOOK_SECRET matches what's set in Vercel) and that the "no matching
// order" path returns 200 gracefully. Touches no real data unless --reference points at a
// real order.
//
// Options:
//   --url=<endpoint>       default: https://www.kingflexygh.com/api/webhooks/agentportal
//                          use http://localhost:3000/api/webhooks/agentportal for local testing
//   --reference=<uuid>     default: random UUID (guaranteed no match, safe smoke test)
//   --status=success|failed   default: success
//   --msisdn=<string>      default: 0000000000
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

    const secret = process.env.AGENTPORTAL_WEBHOOK_SECRET || ''
    if (!secret) {
        console.error('AGENTPORTAL_WEBHOOK_SECRET not set in .env.local — cannot sign a test payload.')
        process.exit(1)
    }

    const url = args.url || 'https://www.kingflexygh.com/api/webhooks/agentportal'
    const reference = args.reference || crypto.randomUUID()
    const isRandom = !args.reference
    const status = args.status === 'failed' ? 'failed' : 'success'

    const payload = {
        event: 'order.completed',
        version: 2,
        order_id: crypto.randomUUID(),
        account_id: crypto.randomUUID(),
        group_name: 'TEST-GROUP-1',
        status: 'DONE',
        uploaded_count: 1,
        success_count: status === 'success' ? 1 : 0,
        failure_count: status === 'failed' ? 1 : 0,
        missing_count: 0,
        items: [
            {
                order_item_id: crypto.randomUUID(),
                batch_id: crypto.randomUUID(),
                msisdn: args.msisdn || '0000000000',
                data_mb: 1024,
                status,
                reference,
                failed_reason: status === 'failed' ? 'test failure' : null,
                refunded_at: status === 'failed' ? new Date().toISOString() : null,
                created_at: new Date().toISOString(),
            },
        ],
        items_truncated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    const rawBody = JSON.stringify(payload)
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    console.log(`${isRandom ? '[SMOKE TEST]' : '[REPLAY]'} POST ${url}`)
    console.log(`reference: ${reference}${isRandom ? ' (random — expect "no matching order", 0 real orders touched)' : ' (REAL — this WILL update that order if it matches pending/processing)'}`)
    console.log(`status: ${status}`)
    console.log('')

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
        },
        body: rawBody,
    })

    console.log(`HTTP ${response.status}`)
    console.log(await response.text())
}

run().catch((e) => { console.error(e); process.exit(1) })
