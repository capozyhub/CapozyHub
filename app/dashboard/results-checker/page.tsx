'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { RCOrder, RCType } from '@/components/dashboard/results-checker/meta'
import { ShopView } from '@/components/dashboard/results-checker/ShopView'
import { VaultPanel } from '@/components/dashboard/results-checker/VaultPanel'

type Tab = 'buy' | 'vouchers'

export default function ResultsCheckerPage() {
    const { dbUser } = useAuth()
    const userId = dbUser?.id

    const [tab, setTab] = useState<Tab>('buy')
    const [types, setTypes] = useState<RCType[]>([])
    const [orders, setOrders] = useState<RCOrder[]>([])
    const [balance, setBalance] = useState(0)
    // The server decides whether buying is on and how many can be bought at once; the page just shows it.
    const [enabled, setEnabled] = useState(true)
    const [maxQty, setMaxQty] = useState(50)
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [ordersLoading, setOrdersLoading] = useState(false)

    const loadTypes = useCallback(async () => {
        try {
            const res = await fetch('/api/results-checker/types', { cache: 'no-store' })
            const json = await res.json()
            if (!res.ok || !json.types) throw new Error()
            setTypes(json.types)
            setEnabled(json.enabled !== false)
            if (Number.isFinite(json.maxQuantity) && json.maxQuantity > 0) setMaxQty(json.maxQuantity)
            setLoadFailed(false)
        } catch {
            setLoadFailed(true)
        }
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
        if (error) toast.error('We could not load your vouchers.')
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
        <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-xl">
                    <h1 className="font-display text-3xl font-bold tracking-tight">Results checker</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Pick your exam, pay from your wallet, and your serial number and PIN appear straight away.</p>
                </div>
                <Link href="/dashboard/wallet" className="neu-raised-sm neu-press rounded-2xl px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <p className="text-xs text-muted-foreground">Your wallet</p>
                    <p className="font-display text-lg font-bold leading-tight tabular-nums">{formatCurrency(balance)}</p>
                </Link>
            </div>

            <div role="tablist" className="well flex w-fit gap-1 rounded-2xl p-1">
                {([['buy', 'Buy'], ['vouchers', `My vouchers${orders.length ? ` · ${orders.length}` : ''}`]] as const).map(([key, label]) => (
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
                loadFailed ? (
                    <div className="surface rounded-3xl p-8 text-center">
                        <p className="font-display text-lg font-semibold">We couldn’t load the exams</p>
                        <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
                        <button type="button" onClick={loadTypes} className="clay-gold mt-4 rounded-xl px-5 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Try again</button>
                    </div>
                ) : (
                    <ShopView
                        types={types}
                        enabled={enabled}
                        maxQty={maxQty}
                        balance={balance}
                        ownPhone={dbUser?.phone_number ?? undefined}
                        ownEmail={dbUser?.email ?? undefined}
                        onPurchased={onPurchased}
                        onViewVouchers={() => setTab('vouchers')}
                    />
                )
            ) : (
                <VaultPanel
                    orders={orders}
                    loading={ordersLoading}
                    ownPhone={dbUser?.phone_number ?? undefined}
                    ownEmail={dbUser?.email ?? undefined}
                    onRefresh={loadOrders}
                    onComplaintFiled={id => setOrders(prev => prev.map(o => (o.id === id ? { ...o, results_checker_complaints: [{ id: 'new', status: 'open' }] } : o)))}
                    onBuy={() => setTab('buy')}
                />
            )}
        </div>
    )
}
