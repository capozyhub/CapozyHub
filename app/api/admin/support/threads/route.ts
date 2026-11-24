import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'
import { touchAdminPresence } from '@/lib/admin-presence'
import { ORDER_COLUMNS, originOf } from '@/lib/support-origin'

export const dynamic = 'force-dynamic'

// GET /api/admin/support/threads?status=open|closed|all&days=30
// One inbox: chat threads (website and shop orders alike) plus any older
// order complaints from the retired `complaints` table, in the same shape.
// Open items are ALWAYS returned regardless of the date window, so an open
// complaint can never age out of the console.
export async function GET(request: Request) {
    try {
        // Admin-only: support threads carry customer PII (phone/WhatsApp).
        const access = await validateAdminAccess(false, request)
        if (access.error) return NextResponse.json({ success: false, error: access.error }, { status: access.status })
        touchAdminPresence(access.user!.id).catch(() => { })

        const url = new URL(request.url)
        const status = ['open', 'closed', 'all'].includes(url.searchParams.get('status') || '')
            ? (url.searchParams.get('status') as 'open' | 'closed' | 'all')
            : 'all'
        const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 90)

        const supabase = createServerClient() as any
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        let query = supabase
            .from('support_threads')
            .select(`
                *,
                users (first_name, last_name, email, phone_number),
                orders (${ORDER_COLUMNS})
            `)
            .order('last_message_at', { ascending: false })
            .limit(300)

        if (status === 'open') {
            query = query.eq('status', 'open')
        } else if (status === 'closed') {
            query = query.eq('status', 'closed').gte('last_message_at', since)
        } else {
            // all: closed threads respect the window, open ones always included
            query = query.or(`status.eq.open,last_message_at.gte.${since}`)
        }

        let legacyQuery = supabase
            .from('complaints')
            .select(`
                id, user_id, title, description, status, resolution_notes, created_at, updated_at,
                users (first_name, last_name, email, phone_number),
                orders (${ORDER_COLUMNS})
            `)
            .order('created_at', { ascending: false })
            .limit(200)
        if (status === 'open') {
            legacyQuery = legacyQuery.in('status', ['pending', 'in_review'])
        } else if (status === 'closed') {
            legacyQuery = legacyQuery.in('status', ['resolved', 'rejected']).gte('created_at', since)
        } else {
            legacyQuery = legacyQuery.or(`status.in.(pending,in_review),created_at.gte.${since}`)
        }

        const [{ data: threads, error }, { data: legacy, error: legacyError }] = await Promise.all([query, legacyQuery])
        if (error) throw error
        if (legacyError) throw legacyError

        const ids = (threads || []).map((t: any) => t.id)
        const previews: Record<string, { body: string; sender_role: string; created_at: string }> = {}
        const unread: Record<string, number> = {}
        if (ids.length > 0) {
            // Previews: newest messages first, capped. First row seen per thread is its latest message.
            // Unread: its own query, so an old unread message can never fall outside the preview cap.
            const [{ data: recent, error: recentError }, { data: unreadRows, error: unreadError }] = await Promise.all([
                supabase
                    .from('support_messages')
                    .select('thread_id, body, sender_role, created_at')
                    .in('thread_id', ids)
                    .order('created_at', { ascending: false })
                    .limit(3000),
                supabase
                    .from('support_messages')
                    .select('thread_id')
                    .in('thread_id', ids)
                    .eq('sender_role', 'user')
                    .is('read_by_admin_at', null)
                    .limit(5000),
            ])
            if (recentError) throw recentError
            if (unreadError) throw unreadError
            for (const m of recent || []) {
                if (!previews[m.thread_id]) {
                    previews[m.thread_id] = { body: m.body, sender_role: m.sender_role, created_at: m.created_at }
                }
            }
            for (const m of unreadRows || []) unread[m.thread_id] = (unread[m.thread_id] || 0) + 1
        }

        // Who is handling each thread. Failure here (e.g. migration not applied yet) must not hide the inbox.
        const assigned: Record<string, { admin_id: string; name: string }> = {}
        if (ids.length > 0) {
            const { data: rows, error: assignError } = await supabase
                .from('support_thread_assignments')
                .select('thread_id, admin_id, users:admin_id (first_name, last_name, email)')
                .in('thread_id', ids)
            if (assignError) {
                console.error('[Admin Support] Assignments unavailable:', assignError.message)
            } else {
                for (const r of rows || []) {
                    const n = `${r.users?.first_name ?? ''} ${r.users?.last_name ?? ''}`.trim()
                    assigned[r.thread_id] = { admin_id: r.admin_id, name: n || r.users?.email || 'Teammate' }
                }
            }
        }

        const threadRows = (threads || []).map((t: any) => ({
            ...t,
            assignee: assigned[t.id] ?? null,
            kind: 'thread' as const,
            origin: originOf(t.orders),
            last_message: previews[t.id] ?? null,
            unread_count: unread[t.id] ?? 0,
        }))

        // Older complaints: same shape, so the console treats them as one more conversation.
        const legacyRows = (legacy || []).map((c: any) => ({
            id: c.id,
            kind: 'report' as const,
            user_id: c.user_id,
            order_id: null,
            subject: c.title,
            category: 'order',
            phone_number: c.users?.phone_number ?? '',
            whatsapp_number: c.users?.phone_number ?? '',
            status: c.status === 'pending' || c.status === 'in_review' ? 'open' : 'closed',
            report_status: c.status,
            closed_at: c.status === 'pending' || c.status === 'in_review' ? null : (c.updated_at ?? null),
            last_message_at: c.updated_at ?? c.created_at,
            created_at: c.created_at,
            users: c.users ?? null,
            orders: c.orders ?? null,
            origin: originOf(c.orders),
            last_message: { body: c.resolution_notes || c.description, sender_role: c.resolution_notes ? 'admin' : 'user', created_at: c.updated_at ?? c.created_at },
            unread_count: 0,
        }))

        const data = [...threadRows, ...legacyRows].sort(
            (a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)
        )

        return NextResponse.json({ success: true, data, viewer_id: access.user!.id })
    } catch (error) {
        console.error('[Admin Support] Error listing threads:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch support threads' }, { status: 500 })
    }
}
