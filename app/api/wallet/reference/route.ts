import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { ensureUserPaymentReference } from '@/lib/wallet-reference'

// ── GET: Fetch the authenticated user's reference code ───────
export async function GET() {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabaseAdmin = createServerClient()

        const { data: refData, error } = await (supabaseAdmin
            .from('user_payment_references') as any)
            .select('reference_code, is_active, created_at')
            .eq('user_id', authUser.id)
            .single()

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = "no rows returned" — expected when user has no ref yet
            console.error('[Reference GET] DB error:', error.message)
            return NextResponse.json({ error: 'Failed to fetch reference' }, { status: 500 })
        }

        if (!refData) {
            // User has no reference yet
            return NextResponse.json({ reference: null })
        }

        return NextResponse.json({
            reference: {
                code: (refData as any).reference_code,
                is_active: (refData as any).is_active,
                created_at: (refData as any).created_at,
            }
        })
    } catch (error: any) {
        console.error('[Reference GET] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── POST: Generate (or fetch) the authenticated user's reference code ──
export async function POST() {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabaseAdmin = createServerClient()
        const result = await ensureUserPaymentReference(supabaseAdmin, authUser.id)

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: 500 })
        }

        return NextResponse.json({ reference: result })
    } catch (error: any) {
        console.error('[Reference POST] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
