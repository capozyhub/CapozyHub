'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { useAirtimeSettings } from '@/components/dashboard/airtime/use-airtime-settings'
import { BuyForm } from '@/components/dashboard/airtime/BuyForm'
import { HistoryPanel } from '@/components/dashboard/airtime/HistoryPanel'

type Tab = 'buy' | 'history'

export default function AirtimePage() {
    const { dbUser } = useAuth()
    const { settings, loading: settingsLoading } = useAirtimeSettings()
    const [tab, setTab] = useState<Tab>('buy')
    const [balance, setBalance] = useState<number | null>(null)
    // Bumped after each purchase so History reloads the next time it is opened.
    const [historyKey, setHistoryKey] = useState(0)

    const userId = dbUser?.id
    const loadWallet = useCallback(async () => {
        if (!userId) return
        const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).single()
        setBalance(Number((data as any)?.balance ?? 0))
    }, [userId])

    useEffect(() => { loadWallet() }, [loadWallet])

    // Priced by the same rule the server uses: a lapsed agent or dealer pays customer prices.
    const role = effectiveRoleFromExpiry(dbUser?.role, (dbUser as any)?.agent_expires_at ?? null, (dbUser as any)?.dealer_expires_at ?? null)

    const onPlaced = (newBalance: number | null) => {
        if (newBalance !== null) setBalance(newBalance)
        else loadWallet()
        setHistoryKey(k => k + 1)
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">Airtime &amp; Mashup</h1>
                    <p className="text-sm text-muted-foreground">Top up any network, or buy an MTN Mashup bundle, from your wallet.</p>
                </div>
                <Link href="/dashboard/wallet" className="neu-raised-sm neu-press rounded-2xl px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <p className="text-xs text-muted-foreground">Wallet</p>
                    <p className="font-display text-lg font-bold leading-tight tabular-nums">{balance === null ? '—' : formatCurrency(balance)}</p>
                </Link>
            </div>

            <div role="tablist" className="well flex w-fit gap-1 rounded-2xl p-1">
                {([['buy', 'Buy'], ['history', 'History']] as const).map(([key, label]) => (
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

            {tab === 'buy' ? (
                settingsLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : !settings ? (
                    <div className="surface rounded-3xl p-8 text-center">
                        <p className="font-display text-lg font-semibold">Airtime is unavailable right now</p>
                        <p className="mt-1 text-sm text-muted-foreground">We could not load the current prices. Refresh the page to try again.</p>
                    </div>
                ) : (
                    <div className="max-w-xl">
                        <BuyForm settings={settings} role={role} balance={balance} onPlaced={onPlaced} onViewHistory={() => setTab('history')} />
                    </div>
                )
            ) : (
                <HistoryPanel reloadKey={historyKey} />
            )}
        </div>
    )
}
