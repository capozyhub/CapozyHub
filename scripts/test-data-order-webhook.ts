// scripts/test-data-order-webhook.ts
//
// notifyDataOrderWebhook is the shared helper wired into every data-order
// terminal-state resolver (finding R1). Its whole job is "no-op safely unless
// this order is genuinely an API order" — get that wrong and either every web/
// shop/USSD order silently tries a webhook lookup for nothing, or an API
// order's webhook silently never fires. Uses a fake supabase client, no DB.
import { notifyDataOrderWebhook } from '@/lib/data-order-webhook'

function fakeSupabase(row: any, opts: { error?: any; dispatched: any[] }) {
    const client = {
        from(table: string) {
            if (table !== 'orders') throw new Error(`unexpected table: ${table}`)
            return client
        },
        select() { return client },
        eq() { return client },
        async maybeSingle() { return { data: row, error: opts.error ?? null } },
    }
    return client
}

function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

async function main() {
    // ── A web/shop/USSD order (no api_key_id) must be a silent no-op ────────
    // No network call should even be attempted — dispatchApiWebhook itself
    // would no-op too, but the point is this never gets that far uselessly.
    {
        const client = fakeSupabase(
            { api_key_id: null, reference_code: 'SHOP-123', network: 'MTN', size: '5GB' },
            { dispatched: [] },
        )
        // Reaching here without throwing, for both event types, is the assertion.
        await notifyDataOrderWebhook(client, 'order-1', 'order.completed')
        await notifyDataOrderWebhook(client, 'order-1', 'order.failed')
    }

    // ── Order not found (bad id, or a race) must not throw ──────────────────
    {
        const client = fakeSupabase(null, { dispatched: [] })
        await notifyDataOrderWebhook(client, 'missing-order', 'order.completed')
    }

    // ── A DB error on the lookup must not throw into the caller ─────────────
    // The caller here is a webhook route mid-response — this must never be
    // what turns a clean 200 ack into an unhandled exception.
    {
        const client = fakeSupabase(null, { error: { message: 'connection reset' }, dispatched: [] })
        await notifyDataOrderWebhook(client, 'order-2', 'order.completed')
    }

    // ── An API order (api_key_id set) reaches dispatchApiWebhook — proven by ─
    //    it running the full lookup->dispatch path without throwing, using a
    //    key with no webhook_url configured (the live, current state of every
    //    api_keys row) so this stays a pure unit test with no network I/O.
    {
        let selectedApiKeyId: string | null = null
        const client = {
            from(table: string) {
                if (table === 'orders') {
                    return {
                        select() { return this },
                        eq() { return this },
                        async maybeSingle() {
                            return { data: { api_key_id: 'key-abc', reference_code: 'API-order_001', network: 'MTN', size: '5GB' }, error: null }
                        },
                    }
                }
                if (table === 'api_keys') {
                    return {
                        select() { return this },
                        eq(_col: string, val: string) { selectedApiKeyId = val; return this },
                        async maybeSingle() { return { data: { webhook_url: null, webhook_secret: null }, error: null } },
                    }
                }
                throw new Error(`unexpected table: ${table}`)
            },
        }
        await notifyDataOrderWebhook(client, 'order-3', 'order.completed')
        assert(selectedApiKeyId === 'key-abc', `expected api_keys lookup keyed on 'key-abc', got ${selectedApiKeyId}`)
    }

    console.log('All data-order-webhook tests passed.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
