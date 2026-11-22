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

const MAX_LABEL_LEN = 80
const MAX_PRICE = 100_000
const MAX_DURATION_DAYS = 3650

interface ValidatedInput {
    upgrade_type: 'agent' | 'dealer'
    label: string
    duration_days: number | null
    price: number
    old_price: number | null
    is_popular: boolean
    sort_order: number
    active: boolean
}

/** Shared validation for create/update bodies. Returns an error string, or the cleaned input. */
function validatePlanInput(body: any, { requireType }: { requireType: boolean }): { error: string } | { value: ValidatedInput } {
    if (!body || typeof body !== 'object') return { error: 'Invalid request body' }

    let upgradeType: 'agent' | 'dealer' | undefined
    if (requireType || body.upgrade_type !== undefined) {
        if (body.upgrade_type !== 'agent' && body.upgrade_type !== 'dealer') {
            return { error: 'upgrade_type must be "agent" or "dealer"' }
        }
        upgradeType = body.upgrade_type
    }

    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) return { error: 'Label is required' }
    if (label.length > MAX_LABEL_LEN) return { error: `Label must be ${MAX_LABEL_LEN} characters or less` }

    const price = Number(body.price)
    if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
        return { error: 'Price must be a positive number' }
    }

    let oldPrice: number | null = null
    if (body.old_price !== null && body.old_price !== undefined && body.old_price !== '') {
        oldPrice = Number(body.old_price)
        if (!Number.isFinite(oldPrice) || oldPrice < 0 || oldPrice > MAX_PRICE) {
            return { error: 'Old price must be a non-negative number' }
        }
    }

    let durationDays: number | null = null
    if (body.duration_days !== null && body.duration_days !== undefined && body.duration_days !== '') {
        durationDays = Number(body.duration_days)
        if (!Number.isInteger(durationDays) || durationDays <= 0 || durationDays > MAX_DURATION_DAYS) {
            return { error: 'Duration must be a positive whole number of days' }
        }
    }
    // Lifetime (null duration) is only ever valid for an agent plan.
    if (durationDays === null && upgradeType === 'dealer') {
        return { error: 'Dealer plans must have a duration in days' }
    }

    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0

    return {
        value: {
            upgrade_type: (upgradeType ?? 'agent'),
            label,
            duration_days: durationDays,
            price,
            old_price: oldPrice,
            is_popular: !!body.is_popular,
            sort_order: sortOrder,
            active: body.active === undefined ? true : !!body.active,
        },
    }
}

// ─── GET /api/admin/role-plans — list every Agent + Dealer plan ──────────────────
export async function GET() {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    try {
        const supabase = serviceClient()
        const { data, error } = await supabase
            .from('role_upgrade_plans')
            .select('*')
            .order('upgrade_type', { ascending: true })
            .order('sort_order', { ascending: true })

        if (error) throw error

        const plans = data ?? []

        // Exact counts (head: true — never truncated by the 1000-row cap), so an admin
        // can see how many people are relying on auto-renew before deleting a plan.
        const withCounts = await Promise.all(
            plans.map(async (p: any) => {
                const { count } = await supabase
                    .from('users')
                    .select('id', { count: 'exact', head: true })
                    .eq('auto_upgrade_enabled', true)
                    .eq('auto_upgrade_plan', p.slug)
                return { ...p, auto_upgrade_count: count ?? 0 }
            })
        )

        return NextResponse.json({ plans: withCounts })
    } catch (e) {
        console.error('[RolePlans GET]', e)
        return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
    }
}

// ─── POST /api/admin/role-plans — create a new plan ───────────────────────────────
export async function POST(request: NextRequest) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    try {
        const body = await request.json().catch(() => null)
        const validated = validatePlanInput(body, { requireType: true })
        if ('error' in validated) {
            return NextResponse.json({ error: validated.error }, { status: 400 })
        }

        const id = crypto.randomUUID()
        const supabase = serviceClient()
        const { data, error } = await supabase
            .from('role_upgrade_plans')
            .insert({
                id,
                // A freshly created plan uses its own id as the charge-time slug — the
                // fixed legacy codes ('3d', '1m', …) only exist on the seeded rows.
                slug: id,
                ...validated.value,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ plan: data }, { status: 201 })
    } catch (e) {
        console.error('[RolePlans POST]', e)
        return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
    }
}
