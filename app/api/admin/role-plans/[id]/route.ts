import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAdminAccess } from '@/lib/auth-utils'

function serviceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LABEL_LEN = 80
const MAX_PRICE = 100_000
const MAX_DURATION_DAYS = 3650

// ─── PATCH /api/admin/role-plans/[id] — edit label / days / price / state ────────
// upgrade_type and slug are immutable after creation: the slug is the charge-time
// identifier stored on users.auto_upgrade_plan and membership_upgrades.plan, and
// changing it out from under those would silently break auto-renew and history.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    try {
        const { id } = await params
        if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid plan id' }, { status: 400 })

        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

        const supabase = serviceClient()
        const { data: existing, error: fetchError } = await supabase
            .from('role_upgrade_plans')
            .select('upgrade_type')
            .eq('id', id)
            .maybeSingle()
        if (fetchError) throw fetchError
        if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

        const label = typeof body.label === 'string' ? body.label.trim() : ''
        if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })
        if (label.length > MAX_LABEL_LEN) {
            return NextResponse.json({ error: `Label must be ${MAX_LABEL_LEN} characters or less` }, { status: 400 })
        }

        const price = Number(body.price)
        if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
            return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 })
        }

        let oldPrice: number | null = null
        if (body.old_price !== null && body.old_price !== undefined && body.old_price !== '') {
            oldPrice = Number(body.old_price)
            if (!Number.isFinite(oldPrice) || oldPrice < 0 || oldPrice > MAX_PRICE) {
                return NextResponse.json({ error: 'Old price must be a non-negative number' }, { status: 400 })
            }
        }

        let durationDays: number | null = null
        if (body.duration_days !== null && body.duration_days !== undefined && body.duration_days !== '') {
            durationDays = Number(body.duration_days)
            if (!Number.isInteger(durationDays) || durationDays <= 0 || durationDays > MAX_DURATION_DAYS) {
                return NextResponse.json({ error: 'Duration must be a positive whole number of days' }, { status: 400 })
            }
        }
        if (durationDays === null && existing.upgrade_type === 'dealer') {
            return NextResponse.json({ error: 'Dealer plans must have a duration in days' }, { status: 400 })
        }

        const sortOrder = Number.isFinite(Number(body.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0

        const { data, error } = await supabase
            .from('role_upgrade_plans')
            .update({
                label,
                duration_days: durationDays,
                price,
                old_price: oldPrice,
                is_popular: !!body.is_popular,
                sort_order: sortOrder,
                active: body.active === undefined ? true : !!body.active,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ plan: data })
    } catch (e) {
        console.error('[RolePlans PATCH]', e)
        return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }
}

// ─── DELETE /api/admin/role-plans/[id] ───────────────────────────────────────────
// Hard delete, by design: the admin confirms in the UI before this is called. Anyone
// with auto-renew set to this plan gets INVALID_PLAN on their next renewal attempt,
// and the auto-upgrade cron already turns the flag off and notifies them when a saved
// plan can no longer be bought (PERMANENT_FAILURE_CODES in app/api/cron/auto-upgrade).
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    try {
        const { id } = await params
        if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid plan id' }, { status: 400 })

        const supabase = serviceClient()
        const { error } = await supabase.from('role_upgrade_plans').delete().eq('id', id)
        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('[RolePlans DELETE]', e)
        return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
    }
}
