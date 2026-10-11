'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { RegisterForm } from '@/components/dashboard/afa-orders/RegisterForm'
import { OrdersPanel } from '@/components/dashboard/afa-orders/OrdersPanel'
import type { AfaOrder } from '@/components/dashboard/afa-orders/meta'

type Tab = 'register' | 'orders'

export default function AfaOrdersPage() {
    const { dbUser } = useAuth()
    const userId = dbUser?.id

    const [tab, setTab] = useState<Tab>('register')
    const [orders, setOrders] = useState<AfaOrder[]>([])
    const [ordersLoading, setOrdersLoading] = useState(true)
    const [balance, setBalance] = useState<number | null>(null)
    const [price, setPrice] = useState(0)
    const [priceLoading, setPriceLoading] = useState(true)
    const [priceError, setPriceError] = useState(false)
    // True unless the price endpoint explicitly reports `configured: false` — only
    // a sub-agent with no AFA pricing set up ever sees that.
    const [pricingConfigured, setPricingConfigured] = useState(true)

    const loadWallet = useCallback(async () => {
        if (!userId) return
        const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).single()
        setBalance(Number((data as any)?.balance ?? 0))
    }, [userId])

    const loadOrders = useCallback(async () => {
        if (!userId) return
        setOrdersLoading(true)
        const { data } = await (supabase.from('afa_orders') as any)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        setOrders(data ?? [])
        setOrdersLoading(false)
    }, [userId])

    const loadPrice = useCallback(async () => {
        try {
            const res = await fetch('/api/user/afa-price', { cache: 'no-store' })
            const json = await res.json()
            if (!res.ok) throw new Error()
            setPricingConfigured(json?.configured !== false)
            const p = parseFloat(json?.price)
            if (!json?.price || isNaN(p) || p <= 0) throw new Error()
            setPrice(p)
            setPriceError(false)
        } catch {
            setPriceError(true)
        } finally {
            setPriceLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!userId) return
        loadWallet()
        loadOrders()
        loadPrice()
    }, [userId, loadWallet, loadOrders, loadPrice])

    const onPlaced = (newBalance: number | null) => {
        if (newBalance !== null) setBalance(newBalance)
        else loadWallet()
        loadOrders()
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">AFA registration</h1>
                    <p className="text-sm text-muted-foreground">Register an MTN AFA number from your wallet — it&apos;s a one-time registration, and membership doesn&apos;t expire.</p>
                </div>
                <Link href="/dashboard/wallet" className="neu-raised-sm neu-press rounded-2xl px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <p className="text-xs text-muted-foreground">Wallet</p>
                    <p className="font-display text-lg font-bold leading-tight tabular-nums">{balance === null ? '—' : formatCurrency(balance)}</p>
                </Link>
            </div>

            <div role="tablist" className="well flex w-fit gap-1 rounded-2xl p-1">
                {([['register', 'Register'], ['orders', `My registrations${orders.length ? ` · ${orders.length}` : ''}`]] as const).map(([key, label]) => (
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

            {tab === 'register' ? (
                <RegisterForm
                    price={price}
                    priceLoading={priceLoading}
                    priceError={priceError}
                    pricingConfigured={pricingConfigured}
                    balance={balance}
                    onPlaced={onPlaced}
                    onViewOrders={() => setTab('orders')}
                />
            ) : (
                <OrdersPanel orders={orders} loading={ordersLoading} onRefresh={loadOrders} onRegister={() => setTab('register')} />
            )}
        </div>
    )
}
