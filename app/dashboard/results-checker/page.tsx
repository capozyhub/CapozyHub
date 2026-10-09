'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { RCOrder, RCType } from '@/components/dashboard/results-checker/meta'
import { BuyPanel } from '@/components/dashboard/results-checker/BuyPanel'
import { HistoryPanel } from '@/components/dashboard/results-checker/HistoryPanel'

type Tab = 'buy' | 'history'

export default function ResultsCheckerPage() {
    const { dbUser } = useAuth()
    const userId = dbUser?.id

    const [tab, setTab] = useState<Tab>('buy')
    const [types, setTypes] = useState<RCType[]>([])
    const [orders, setOrders] = useState<RCOrder[]>([])
    const [balance, setBalance] = useState(0)
    const [enabled, setEnabled] = useState(true)
    const [maxQty, setMaxQty] = useState(50)
    const [loading, setLoading] = useState(true)
    const [ordersLoading, setOrdersLoading] = useState(false)

    const loadTypes = useCallback(async () => {
        const [typesRes, settings] = await Promise.all([
            fetch('/api/results-checker/types', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
            (supabase as any).from('admin_settings').select('key,value').in('key', ['results_checker_enabled', 'results_checker_max_quantity']),
        ])
        setTypes(typesRes?.types ?? [])
        const map: Record<string, string> = {}
        for (const r of settings?.data ?? []) map[r.key] = r.value
        setEnabled(map.results_checker_enabled !== 'false')
        const max = parseInt(map.results_checker_max_quantity ?? '', 10)
        if (Number.isFinite(max) && max > 0) setMaxQty(max)
    }, [])

    const loadWallet = useCallback(async () => {
        if (!userId) return
        const { data } = await (supabase as any).from('wallets').select('balance').eq('user_id', userId).single()
        setBalance(Number(data?.balance ?? 0))
    }, [userId])

    const loadOrders = useCallback(async () => {
        if (!userId) return
        setOrdersLoading(true)
        const { data, error } = await (supabase as any)
            .from('results_checker_orders')
            .select('id, reference_code, type_name, quantity, unit_price, total_paid, status, created_at, inventory_ids, results_checker_complaints(id, status)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)
        if (error) toast.error('Could not load your orders')
        else setOrders(data ?? [])
        setOrdersLoading(false)
    }, [userId])

    useEffect(() => {
        if (!userId) return
        Promise.all([loadTypes(), loadWallet(), loadOrders()]).finally(() => setLoading(false))
    }, [userId, loadTypes, loadWallet, loadOrders])

    const onPurchased = (newBalance: number | null) => {
        if (newBalance !== null) setBalance(newBalance)
        else loadWallet()
        loadOrders()
        loadTypes() // stock changed
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">Results checker</h1>
                    <p className="text-sm text-muted-foreground">Buy WAEC checker vouchers from your wallet. PINs show up the moment you pay.</p>
                </div>
                <Link href="/dashboard/wallet" className="neu-raised-sm neu-press rounded-2xl px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <p className="text-xs text-muted-foreground">Wallet</p>
                    <p className="font-display text-lg font-bold leading-tight tabular-nums">{formatCurrency(balance)}</p>
                </Link>
            </div>

            <div role="tablist" className="well flex w-fit gap-1 rounded-2xl p-1">
                {([['buy', 'Buy'], ['history', `Order history${orders.length ? ` (${orders.length})` : ''}`]] as const).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={cn('whitespace-nowrap rounded-xl px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : tab === 'buy' ? (
                <div className="max-w-xl">
                    <BuyPanel
                        types={types}
                        enabled={enabled}
                        maxQty={maxQty}
                        balance={balance}
                        ownPhone={dbUser?.phone_number ?? undefined}
                        ownEmail={dbUser?.email ?? undefined}
                        onPurchased={onPurchased}
                    />
                </div>
            ) : (
                <HistoryPanel
                    orders={orders}
                    loading={ordersLoading}
                    ownPhone={dbUser?.phone_number ?? undefined}
                    ownEmail={dbUser?.email ?? undefined}
                    onRefresh={loadOrders}
                    onComplaintFiled={id => setOrders(prev => prev.map(o => (o.id === id ? { ...o, results_checker_complaints: [{ id: 'new', status: 'open' }] } : o)))}
                />
            )}
        </div>
    )
}
