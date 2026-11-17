import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

/**
 * Durable "engine health" for the operational panel. Derived from persistent
 * signals only: the auto-fulfillment switch and today's failure rate. No
 * supplier is contacted from here; supplier float returns when a supplier is
 * configured (Stage 6).
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const supabase = createServerClient()
        const dayStart = new Date().toISOString().split('T')[0]

        const [settingsRes, todayRes, failedTodayRes] = await Promise.all([
            supabase.from('admin_settings').select('key, value').in('key', ['auto_fulfillment_enabled']),
            supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
            supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', dayStart),
        ])

        if (settingsRes.error || todayRes.error || failedTodayRes.error) {
            console.error('[AdminEngineStatus] query error:', settingsRes.error?.message || todayRes.error?.message || failedTodayRes.error?.message)
            return NextResponse.json({ error: 'Failed to load engine status' }, { status: 500 })
        }

        const settings: Record<string, string> = {}
        ;(settingsRes.data as { key: string; value: string }[] | null)?.forEach(r => { settings[r.key] = r.value })

        const todayCount = todayRes.count || 0
        const failedToday = failedTodayRes.count || 0
        const failedRateToday = todayCount > 0 ? Math.round((failedToday / todayCount) * 100) : 0

        return NextResponse.json({
            autoFulfillmentEnabled: settings.auto_fulfillment_enabled === 'true',
            todayOrders: todayCount,
            failedToday,
            failedRateToday,
        })
    } catch (error) {
        console.error('Admin Engine Status Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
