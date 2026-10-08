// scripts/test-webhook-config-cache.ts
//
// dispatchApiWebhook is called inside every terminal-state transition, several
// of which run in sequential loops of up to 50 (the admin bulk route, and the
// hubtel-commission-reconcile cron which has FOUR such loops in one 60s
// invocation). The per-key config cache is what stops that being ~200 api_keys
// SELECTs per cron run whose answer is almost always "no webhook configured".
//
// Uses a fake supabase client that counts queries — no DB, no network.
import { dispatchApiWebhook, invalidateWebhookConfig } from '@/lib/api-webhook'

function fakeSupabase(row: any, opts: { error?: any } = {}) {
    const state = { queries: 0 }
    const client = {
        from() { return client },
        select() { return client },
        eq() { return client },
        async maybeSingle() {
            state.queries++
            return { data: row, error: opts.error ?? null }
        },
    }
    return { client, state }
}

function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

const baseParams = {
    event: 'order.completed',
    product: 'airtime' as const,
    reference: 'ref-1',
    status: 'completed',
}

async function main() {
    // ── Unconfigured key: the common case, and the one the cache exists for ──
    {
        const keyId = `unconfigured-${Date.now()}`
        const { client, state } = fakeSupabase({ webhook_url: null, webhook_secret: null })
        for (let i = 0; i < 50; i++) {
            await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        }
        assert(state.queries === 1, `50 dispatches for an unconfigured key should cost 1 query, cost ${state.queries}`)
    }

    // ── A transient DB error must NOT be cached as "no webhook" ─────────────
    // Caching it would silently suppress every delivery for the whole 60s TTL.
    {
        const keyId = `errorcase-${Date.now()}`
        const { client, state } = fakeSupabase(null, { error: { message: 'connection reset' } })
        await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        assert(state.queries === 2, `an errored read must be retried, not cached; got ${state.queries} queries`)
    }

    // ── Invalidation works, so the Phase 3 config UI can make a newly saved ──
    //    webhook take effect immediately instead of after up to 60s.
    {
        const keyId = `invalidate-${Date.now()}`
        const { client, state } = fakeSupabase({ webhook_url: null, webhook_secret: null })
        await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        assert(state.queries === 1, 'second dispatch served from cache')
        invalidateWebhookConfig(keyId)
        await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        assert(state.queries === 2, 'after invalidation the config is re-read')
    }

    // ── Distinct keys do not share a cache entry ────────────────────────────
    {
        const stamp = Date.now()
        const { client, state } = fakeSupabase({ webhook_url: null, webhook_secret: null })
        await dispatchApiWebhook(client, { apiKeyId: `a-${stamp}`, ...baseParams })
        await dispatchApiWebhook(client, { apiKeyId: `b-${stamp}`, ...baseParams })
        assert(state.queries === 2, 'two different keys must each be read once')
    }

    // ── A configured but SSRF-blocked URL must not attempt delivery, and must ─
    //    still never throw into the money path that called it.
    {
        const keyId = `blocked-${Date.now()}`
        const { client } = fakeSupabase({ webhook_url: 'https://localhost./x', webhook_secret: 's3cret' })
        await dispatchApiWebhook(client, { apiKeyId: keyId, ...baseParams })
        // Reaching here without throwing is the assertion.
    }

    console.log('All webhook-config-cache tests passed.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
