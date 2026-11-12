import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/fetch-all-rows'

// GET — all ledger data for the profit-logs page.
// Centralising here means every DB query runs behind a server-side
// auth.getUser() check instead of relying solely on browser-side RLS.
export async function GET() {
    try {
        const supabase = await createRouteClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

        const { data: shopData } = await supabase
            .from('shop_profiles')
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle()

        if (!shopData) {
            return NextResponse.json({ success: true, data: { wallet: null, orders: [], rcOrders: [], withdrawals: [], smsPurchases: [], smsActs: [], utilityCommissions: [] } })
        }

        const shopId = (shopData as any).id

        const { data: walletRow } = await supabase
            .from('shop_wallets')
            .select('id, balance, total_earned, total_withdrawn')
            .eq('owner_id', user.id)
            .maybeSingle()

        const walletId: string | null = (walletRow as any)?.id ?? null

        // Every ledger source is paged past the 1000-row request cap (up to 10,000 each, stable
        // order with id last) so the running balance is built from the whole history.
        const all = (table: string, cols: string, apply: (q: any) => any) =>
            fetchAllRows(() => apply((supabase as any).from(table).select(cols)).order('created_at', { ascending: false }).order('id', { ascending: false }))
        const none = Promise.resolve({ rows: [] as any[], truncated: false, failed: false })

        const [ordersRes, rcRes, afaRes, wdRes, smsRes, smsActRes, utilCommRes] = await Promise.allSettled([
            all('shop_orders', 'id, network, package_size, package_id, guest_phone, profit, status, created_at, source', q => q.eq('shop_id', shopId)),
            all('results_checker_orders', 'id, type_name, quantity, customer_phone, shop_markup, status, created_at, source', q => q.eq('shop_id', shopId).neq('payment_status', 'pending_payment')),
            // AFA rows have no package_id/network shape; select only non-KYC columns (never full_name/ghana_card).
            all('afa_orders', 'id, phone, selling_price, profit, status, created_at, source', q => q.eq('shop_id', shopId)),
            walletId ? all('shop_wallet_transactions', 'id, amount, fee, net_amount, status, account_name, momo_number, created_at', q => q.eq('shop_wallet_id', walletId).eq('type', 'withdrawal')) : none,
            all('shop_sms_purchases', 'id, credits, price, created_at, shop_sms_bundles(name)', q => q.eq('shop_id', shopId)),
            all('shop_sms_activations', 'id, amount_paid, created_at', q => q.eq('shop_id', shopId)),
            walletId ? all('shop_wallet_transactions', 'id, amount, description, created_at', q => q.eq('shop_wallet_id', walletId).eq('type', 'utility_commission')) : none,
        ])

        const rowsOf = (r: PromiseSettledResult<{ rows: any[] }>) => (r.status === 'fulfilled' ? r.value.rows : [])
        const incomplete = [ordersRes, rcRes, afaRes, wdRes, smsRes, smsActRes, utilCommRes].some(
            r => r.status === 'rejected' || r.value.truncated || r.value.failed,
        )

        return NextResponse.json({
            success: true,
            data: {
                wallet:              walletRow || null,
                orders:              rowsOf(ordersRes),
                rcOrders:            rowsOf(rcRes),
                afaOrders:           rowsOf(afaRes),
                withdrawals:         rowsOf(wdRes),
                smsPurchases:        rowsOf(smsRes),
                smsActs:             rowsOf(smsActRes),
                utilityCommissions:  rowsOf(utilCommRes),
                incomplete,
            },
        })    } catch (err) {
        console.error('[ProfitLogs] API error:', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
