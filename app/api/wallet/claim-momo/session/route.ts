import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { ensureUserPaymentReference } from '@/lib/wallet-reference'
import { parseMoneyAmount, parseSettingNumber } from '@/lib/paystack-fees'

const DEFAULT_TTL_MINUTES = 20

// ── GET: resume the user's open session, if any (survives a page refresh) ──
export async function GET() {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabaseAdmin = createServerClient()
        // momo_claim_sessions is new enough that the generated Database type doesn't
        // know it yet; `as any` on the client itself (not the query) is what actually
        // bypasses the typed `.from()` overload — casting only the result errors first.
        const sessionsDb: any = supabaseAdmin
        const { data: session } = await sessionsDb
            .from('momo_claim_sessions')
            .select('id, reference_code, expected_amount, expires_at')
            .eq('user_id', authUser.id)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        return NextResponse.json({ session: session ?? null })
    } catch (error: any) {
        console.error('[ClaimSession GET] Exception:', error.message)
        return NextResponse.json({ session: null })
    }
}

// ── POST: start (or resume) a Send & Claim session ────────────────
// The session is purely informational — see the migration's header comment.
// Crediting still happens entirely through the existing reference-code-driven
// SMS-forward auto-claim (or the manual transaction-ID fallback); this route
// only pins an amount + countdown to something the waiting modal can poll.
export async function POST(request: NextRequest) {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const amount = parseMoneyAmount(body?.amount)
        if (amount === null) {
            return NextResponse.json({ error: 'Enter a valid amount (up to 2 decimal places)' }, { status: 400 })
        }

        const supabaseAdmin = createServerClient()
        const sessionsDb: any = supabaseAdmin

        const { data: settingsRows } = await (supabaseAdmin
            .from('admin_settings') as any)
            .select('key, value')
            .in('key', ['momo_claim_enabled', 'momo_min_claimable', 'momo_max_claimable', 'momo_claim_session_ttl_minutes'])
        const settings: Record<string, unknown> = {}
        ;((settingsRows as any[]) || []).forEach(s => { settings[s.key] = s.value })

        if (settings['momo_claim_enabled'] === 'false' || settings['momo_claim_enabled'] === false) {
            return NextResponse.json({ error: 'MoMo claim feature is currently unavailable.' }, { status: 503 })
        }

        const minClaimable = parseSettingNumber(settings['momo_min_claimable'], 1)
        const maxClaimable = parseSettingNumber(settings['momo_max_claimable'], 50000)
        if (amount < minClaimable || amount > maxClaimable) {
            return NextResponse.json(
                { error: `Amount must be between GHS ${minClaimable.toLocaleString()} and GHS ${maxClaimable.toLocaleString()}` },
                { status: 400 },
            )
        }

        const refResult = await ensureUserPaymentReference(supabaseAdmin, authUser.id)
        if ('error' in refResult) {
            return NextResponse.json({ error: refResult.error }, { status: 500 })
        }
        if (!refResult.is_active) {
            return NextResponse.json({ error: 'Your payment reference has been disabled. Please contact support.' }, { status: 409 })
        }

        // At most one open session per user. Resuming (same amount) avoids churn on a
        // refresh/double-click; a different amount supersedes the old one rather than
        // piling up sessions nothing will ever look at again.
        const { data: existing } = await sessionsDb
            .from('momo_claim_sessions')
            .select('id, expected_amount, reference_code, expires_at')
            .eq('user_id', authUser.id)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existing && Number(existing.expected_amount) === amount) {
            return NextResponse.json({ session: existing })
        }
        if (existing) {
            await sessionsDb.from('momo_claim_sessions')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .eq('status', 'pending') // guard against a late auto-claim winning the race
        }

        const ttlMinutes = parseSettingNumber(settings['momo_claim_session_ttl_minutes'], DEFAULT_TTL_MINUTES)
        const expiresAt = new Date(Date.now() + Math.max(5, ttlMinutes) * 60_000).toISOString()

        const { data: session, error: insertError } = await sessionsDb
            .from('momo_claim_sessions')
            .insert({
                user_id: authUser.id,
                reference_code: refResult.code,
                expected_amount: amount,
                expires_at: expiresAt,
            })
            .select('id, reference_code, expected_amount, expires_at')
            .single()

        if (insertError || !session) {
            console.error('[ClaimSession POST] Insert error:', insertError)
            return NextResponse.json({ error: 'Failed to start a payment session. Please try again.' }, { status: 500 })
        }

        return NextResponse.json({ session })
    } catch (error: any) {
        console.error('[ClaimSession POST] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── DELETE: cancel a pending session (the user closed/changed their mind) ──
// Idempotent: cancelling an already-credited/expired/cancelled session is a no-op.
export async function DELETE(request: NextRequest) {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const id = request.nextUrl.searchParams.get('id')
        if (!id) {
            return NextResponse.json({ error: 'Session id is required' }, { status: 400 })
        }

        const supabaseAdmin = createServerClient()
        const sessionsDb: any = supabaseAdmin
        await sessionsDb.from('momo_claim_sessions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', authUser.id)
            .eq('status', 'pending')

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[ClaimSession DELETE] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
