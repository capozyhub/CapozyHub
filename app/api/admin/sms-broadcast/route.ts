import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { sendSmsBatch, normalizeGhanaPhone } from '@/lib/sms-service'

// Allow large broadcasts up to 60 s on Vercel Hobby/Pro; raise to 300 on Fluid
export const maxDuration = 60

async function requireAdmin() {
    const client = await createRouteClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return { error: 'Unauthorized', status: 401 }
    const { data } = await client.from('users').select('role').eq('id', user.id).single()
    if (data?.role !== 'admin') return { error: 'Forbidden - Admin only', status: 403 }
    return { user }
}

/**
 * POST /api/admin/sms-broadcast
 *
 * Body:
 *   message       - The raw message (may contain [FirstName], [LastName], [Phone])
 *   audience      - 'users' | 'group'
 *   userIds?      - string[] (when audience = 'users')
 *   groupId?      - string   (when audience = 'group')
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

        const body = await request.json()
        const { message, audience, userIds, groupId } = body

        if (!message || typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 })
        }
        if (!['users', 'group'].includes(audience)) {
            return NextResponse.json({ error: 'audience must be "users" or "group"' }, { status: 400 })
        }
        if (audience === 'users' && (!Array.isArray(userIds) || userIds.length === 0)) {
            return NextResponse.json({ error: 'userIds array required when audience = "users"' }, { status: 400 })
        }
        if (audience === 'group' && !groupId) {
            return NextResponse.json({ error: 'groupId required when audience = "group"' }, { status: 400 })
        }

        const supabase = createServerClient()

        // ── Fetch recipients ──────────────────────────────────────────────────
        let recipients: Array<{ first_name: string | null; last_name: string | null; phone_number: string }> = []

        if (audience === 'users') {
            const { data, error } = await (supabase as any)
                .from('users')
                .select('first_name, last_name, phone_number')
                .in('id', userIds)
                .not('phone_number', 'is', null)

            if (error) throw error
            recipients = data || []
        } else {
            const { data, error } = await (supabase as any)
                .from('sms_contacts')
                .select('first_name, last_name, phone_number')
                .eq('group_id', groupId)

            if (error) throw error
            recipients = data || []
        }

        if (recipients.length === 0) {
            return NextResponse.json({ error: 'No recipients with valid phone numbers found' }, { status: 400 })
        }

        // ── Resolve personalized messages ─────────────────────────────────────
        const hasVariables = /\[(FirstName|LastName|Phone)\]/i.test(message)

        const resolved = recipients
            .map(r => {
                const phone = normalizeGhanaPhone(r.phone_number)
                if (!phone) return null
                const msg = hasVariables
                    ? message
                        .replace(/\[FirstName\]/gi, r.first_name || '')
                        .replace(/\[LastName\]/gi,  r.last_name  || '')
                        .replace(/\[Phone\]/gi,      phone)
                    : message
                return { phone, message: msg }
            })
            .filter(Boolean) as Array<{ phone: string; message: string }>

        if (resolved.length === 0) {
            return NextResponse.json({ error: 'No valid phone numbers after normalization' }, { status: 400 })
        }

        const result = await sendSmsBatch(resolved)

        return NextResponse.json({
            success: true,
            results: {
                total:    resolved.length,
                sent:     result.sent,
                failed:   result.failed,
                errors:   result.errors.slice(0, 20),
            },
        })
    } catch (e: any) {
        console.error('[SMSBroadcast] Error:', e)
        return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
    }
}
