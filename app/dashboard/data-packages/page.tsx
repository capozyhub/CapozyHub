'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, Loader2, Search, Wifi } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { resolveOwnerCost } from '@/lib/pricing/cost-basis'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import type { DataPackage } from '@/types/supabase'
import { filterPackagesForSubAgent, type SubAgentPricingMap } from '@/lib/sub-agent-package-filter'
import { NETWORKS, networkLabel } from '@/components/dashboard/data-packages/network-meta'
import { NetworkTabs } from '@/components/dashboard/data-packages/NetworkTabs'
import { PackageGrid } from '@/components/dashboard/data-packages/PackageGrid'
import { PurchaseSheet } from '@/components/dashboard/data-packages/PurchaseSheet'
import { BulkPanel } from '@/components/dashboard/data-packages/BulkPanel'

type Tab = 'single' | 'bulk' | 'mtn_mashup'

const PKG_CACHE_KEY = 'cz-packages-cache'
const PKG_CACHE_TTL = 5 * 60 * 1000
const NETWORK_KEY = 'cz-selected-network'
const VIEW_KEY = 'cz-view-mode'

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
    const body = (
        <>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-lg font-bold leading-tight tabular-nums">{value}</p>
        </>
    )
    return href ? (
        <Link href={href} className="neu-raised-sm neu-press rounded-2xl px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{body}</Link>
    ) : (
        <div className="neu-raised-sm rounded-2xl px-4 py-2.5">{body}</div>
    )
}

export default function DataPackagesPage() {
    const { dbUser } = useAuth()

    const [packages, setPackages] = useState<DataPackage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedNetwork, setSelectedNetwork] = useState<string>('MTN')
    const [tab, setTab] = useState<Tab>('single')
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [balance, setBalance] = useState(0)
    const [ordersToday, setOrdersToday] = useState(0)
    const [outOfStock, setOutOfStock] = useState<Record<string, boolean>>({})
    const [selected, setSelected] = useState<DataPackage | null>(null)

    // A sub-agent only sees bundles their recruiter has priced for them, at that price.
    const isSubAgent = dbUser?.role === 'subagent'
    const [subPricing, setSubPricing] = useState<SubAgentPricingMap>({})
    const [subPricingLoaded, setSubPricingLoaded] = useState(false)

    const canBulk = ['agent', 'dealer', 'admin', 'sub-admin'].includes(dbUser?.role ?? '')

    // Remembered choices
    useEffect(() => {
        try {
            const net = localStorage.getItem(NETWORK_KEY)
            const view = localStorage.getItem(VIEW_KEY)
            if (net && (NETWORKS as readonly string[]).includes(net)) setSelectedNetwork(net)
            if (view === 'grid' || view === 'list') setViewMode(view)
        } catch { /* storage unavailable */ }
    }, [])

    useEffect(() => {
        fetch('/api/admin-settings?keys=data_network_stock', { cache: 'no-store' })
            .then(r => r.json())
            .then(j => setOutOfStock((j?.data_network_stock as Record<string, boolean>) || {}))
            .catch(() => { /* stock badges just stay off */ })
    }, [])

    const userId = dbUser?.id

    const loadPackages = useCallback(async () => {
        // Show the cached list at once on repeat visits, then refresh it.
        try {
            const raw = localStorage.getItem(PKG_CACHE_KEY)
            if (raw) {
                const { data, ts } = JSON.parse(raw)
                if (Date.now() - ts < PKG_CACHE_TTL && Array.isArray(data)) { setPackages(data); setIsLoading(false) }
            }
        } catch { /* ignore a bad cache */ }

        try {
            const { data, error } = await supabase.from('data_packages').select('*').eq('is_available', true).order('sort_order', { ascending: true })
            if (error) throw error
            setPackages(data || [])
            try { localStorage.setItem(PKG_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch { /* quota */ }
        } catch {
            toast.error('Could not load the bundles')
        } finally {
            setIsLoading(false)
        }
    }, [])

    const loadWallet = useCallback(async () => {
        if (!userId) return
        const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).single()
        setBalance((data as any)?.balance || 0)
    }, [userId])

    const loadOrdersToday = useCallback(async () => {
        if (!userId) return
        const start = new Date(); start.setHours(0, 0, 0, 0)
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .neq('status', 'failed')
        setOrdersToday(count || 0)
    }, [userId])

    useEffect(() => {
        if (!userId) return
        loadPackages()
        loadWallet()
        loadOrdersToday()
    }, [userId, loadPackages, loadWallet, loadOrdersToday])

    useEffect(() => {
        if (!isSubAgent) return
        let cancelled = false
        setSubPricingLoaded(false)
        fetch(`/api/dashboard/subagents/my-pricing?network=${encodeURIComponent(selectedNetwork)}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(j => { if (!cancelled) setSubPricing(j?.success && j.data ? j.data : {}) })
            .catch(() => { if (!cancelled) setSubPricing({}) }) // fail closed: nothing is buyable on error
            .finally(() => { if (!cancelled) setSubPricingLoaded(true) })
        return () => { cancelled = true }
    }, [isSubAgent, selectedNetwork])

    /**
     * The price shown. The server works out the real charge the same way (resolveOwnerCost, which
     * honours expiry), so a lapsed agent is shown, and charged, the customer price.
     */
    const priceFor = useCallback((pkg: DataPackage): number => {
        if (isSubAgent) {
            const sub = subPricing[pkg.id]
            if (sub) return sub.subPrice
        }
        return resolveOwnerCost(pkg as any, {
            role: dbUser?.role,
            agent_expires_at: dbUser?.agent_expires_at,
            dealer_expires_at: (dbUser as any)?.dealer_expires_at,
        })
    }, [isSubAgent, subPricing, dbUser?.role, dbUser?.agent_expires_at, dbUser])

    const visible = useMemo(() => {
        let list = packages.filter(p => p.network === selectedNetwork && (p as any).category !== 'mtn_mashup')
        if (isSubAgent) list = filterPackagesForSubAgent(list, subPricing)
        const q = search.trim().toLowerCase()
        if (q) list = list.filter(p => p.size.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
        return list
    }, [packages, selectedNetwork, search, isSubAgent, subPricing])

    const mashup = useMemo(
        () => packages.filter(p => (p as any).category === 'mtn_mashup').sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        [packages],
    )

    const selectNetwork = (network: string) => {
        setSelectedNetwork(network)
        try { localStorage.setItem(NETWORK_KEY, network) } catch { /* ignore */ }
    }
    const chooseView = (mode: 'grid' | 'list') => {
        setViewMode(mode)
        try { localStorage.setItem(VIEW_KEY, mode) } catch { /* ignore */ }
    }

    const onPurchased = (newBalance: number | null) => {
        if (newBalance !== null) setBalance(newBalance)
        else loadWallet()
        loadOrdersToday()
    }

    const tabs: { key: Tab; label: string }[] = [
        { key: 'single', label: 'Single' },
        ...(mashup.length > 0 ? [{ key: 'mtn_mashup' as const, label: 'Special MTN mashup' }] : []),
        ...(canBulk ? [{ key: 'bulk' as const, label: 'Bulk order' }] : []),
    ]

    const ViewToggle = (
        <div className="well flex rounded-xl p-1" role="group" aria-label="Layout">
            {([['grid', LayoutGrid, 'Grid view'], ['list', List, 'List view']] as const).map(([mode, Icon, label]) => (
                <button
                    key={mode}
                    type="button"
                    aria-label={label}
                    aria-pressed={viewMode === mode}
                    onClick={() => chooseView(mode)}
                    className={cn('rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', viewMode === mode ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                >
                    <Icon className="h-4 w-4" />
                </button>
            ))}
        </div>
    )

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">Data bundles</h1>
                    <p className="text-sm text-muted-foreground">Pick a network, choose a bundle and pay from your wallet.</p>
                </div>
                <div className="flex gap-3">
                    <Stat label="Wallet" value={formatCurrency(balance)} href="/dashboard/wallet" />
                    <Stat label="Orders today" value={String(ordersToday)} />
                </div>
            </div>

            <NetworkTabs selected={selectedNetwork} outOfStock={outOfStock} onSelect={selectNetwork} />

            <div className="flex flex-wrap items-center gap-3">
                {tabs.length > 1 && (
                    <div role="tablist" className="well flex gap-1 rounded-2xl p-1">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.key}
                                onClick={() => setTab(t.key)}
                                className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tab === t.key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
                {tab === 'single' && (
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:justify-end">
                        <div className="relative min-w-0 flex-1 sm:max-w-xs">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input aria-label="Search bundles" placeholder="Search bundles" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 text-sm" />
                        </div>
                        {ViewToggle}
                    </div>
                )}
                {tab === 'mtn_mashup' && <div className="ml-auto">{ViewToggle}</div>}
            </div>

            {tab === 'single' && (
                isLoading || (isSubAgent && !subPricingLoaded) ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : outOfStock[selectedNetwork] ? (
                    <div className="surface rounded-3xl p-8 text-center">
                        <p className="font-display text-lg font-semibold">{networkLabel(selectedNetwork)} is out of stock</p>
                        <p className="mt-1 text-sm text-muted-foreground">Check back soon, or pick another network.</p>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                        <Wifi className="h-10 w-10 opacity-30" />
                        <p className="text-sm">{search ? 'No bundles match your search' : 'No bundles available for this network yet'}</p>
                    </div>
                ) : (
                    <PackageGrid packages={visible} mode={viewMode} getPrice={priceFor} onBuy={setSelected} />
                )
            )}

            {tab === 'mtn_mashup' && (
                <div className="space-y-4">
                    <div className="neu-inset rounded-2xl px-4 py-3">
                        <p className="text-sm font-semibold">Special MTN mashup</p>
                        <p className="text-xs text-muted-foreground">Curated MTN bundles, processed by our team. Status updates appear under Order history.</p>
                    </div>
                    <PackageGrid packages={mashup} mode={viewMode} getPrice={priceFor} onBuy={setSelected} tag="Mashup" />
                </div>
            )}

            {tab === 'bulk' && canBulk && (
                <BulkPanel
                    key={selectedNetwork}
                    packages={packages}
                    network={selectedNetwork}
                    getPrice={priceFor}
                    balance={balance}
                    onPlaced={onPurchased}
                />
            )}

            <PurchaseSheet
                pkg={selected}
                price={selected ? priceFor(selected) : 0}
                balance={balance}
                onClose={() => setSelected(null)}
                onPurchased={onPurchased}
            />
        </div>
    )
}
