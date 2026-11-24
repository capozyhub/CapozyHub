import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { checkThreadCreateLimit } from '@/lib/support-rate-limit'
import { sendAdminPushNotification } from '@/lib/push-service'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REOPEN_WINDOW_DAYS = 14

// POST /api/support/threads/[id]/reopen: the customer says a closed complaint is still not solved.
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Invalid complaint' }, { status: 400 })
        }

        const supabase = await createRouteClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Shares the new-complaint limit: reopening is the same load on support.
        if (!(await checkThreadCreateLimit(user.id))) {
            return NextResponse.json({ success: false, error: 'Too many requests. Please wait a while.' }, { status: 429 })
        }

        // RLS-scoped read: returns the thread only if the caller owns it.
        const { data: thread } = await supabase
            .from('support_threads')
            .select('id, user_id, subject, status, closed_at, last_message_at, created_at')
            .eq('id', id)
            .maybeSingle()
        const t = thread as any
        if (!t || t.user_id !== user.id) {
            return NextResponse.json({ success: false, error: 'Complaint not found' }, { status: 404 })
        }
        if (t.status !== 'closed') {
            return NextResponse.json({ success: false, error: 'This complaint is already open.' }, { status: 409 })
        }
        // No close date (older rows): fall back to the last activity so the window still applies.
        const closedAt = new Date(t.closed_at ?? t.last_message_at ?? t.created_at).getTime()
        if (Number.isFinite(closedAt) && Date.now() - closedAt > REOPEN_WINDOW_DAYS * 86_400_000) {
            return NextResponse.json(
                { success: false, error: `This complaint was closed more than ${REOPEN_WINDOW_DAYS} days ago. Please open a new one.` },
                { status: 409 }
            )
        }

        const adminDb = createServerClient() as any

        // Same cap as opening a new complaint.
        const { count } = await adminDb
            .from('support_threads')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'open')
        if ((count ?? 0) >= 3) {
            return NextResponse.json(
                { success: false, error: 'You already have 3 open complaints. Please wait for a response first.' },
                { status: 409 }
            )
        }

        // Guarded on status='closed' so a double tap cannot reopen twice.
        const { data: reopened, error: reopenError } = await adminDb
            .from('support_threads')
            .update({ status: 'open', closed_at: null, closed_by: null })
            .eq('id', id)
            .eq('status', 'closed')
            .select('id')
        if (reopenError) {
            // Unique index: another complaint on the same order is already open.
            if ((reopenError as any).code === '23505') {
                return NextResponse.json(
                    { success: false, error: 'There is already an open complaint about this order. Add your message to it instead.' },
                    { status: 409 }
                )
            }
            throw reopenError
        }
        if (!reopened || reopened.length === 0) {
            return NextResponse.json({ success: false, error: 'This complaint is already open.' }, { status: 409 })
        }

        // A customer message, so it lands in "Needs a reply" on the admin side.
        const { data: message, error: messageError } = await adminDb
            .from('support_messages')
            .insert({
                thread_id: id,
                sender_role: 'user',
                sender_id: user.id,
                body: 'Reopened by the customer: this is still not solved.',
            })
            .select()
            .single()
        if (messageError) {
            // Put it back, so a failed message never leaves an open complaint that nobody is told about.
            await adminDb
                .from('support_threads')
                .update({ status: 'closed', closed_at: t.closed_at ?? new Date().toISOString() })
                .eq('id', id)
                .eq('status', 'open')
            throw messageError
        }

        waitUntil(
            sendAdminPushNotification({
                title: 'Complaint reopened',
                body: `Still not solved: ${String(t.subject).slice(0, 80)}`,
                url: '/admin/complaints',
            }).catch((e: unknown) => console.error('[Support] Reopen push error:', e))
        )

        return NextResponse.json({ success: true, data: { message } })
    } catch (error) {
        console.error('[Support] Error reopening thread:', error)
        return NextResponse.json({ success: false, error: 'Failed to reopen complaint' }, { status: 500 })
    }
}
