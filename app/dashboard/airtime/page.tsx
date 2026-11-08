'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { useAirtimeSettings } from '@/components/dashboard/airtime/use-airtime-settings'
import { BuyForm } from '@/components/dashboard/airtime/BuyForm'
import { HistoryPanel } from '@/components/dashboard/airtime/HistoryPanel'

type Tab = 'buy' | 'history'

const TABS: { key: Tab; label: string }[] = [
    { key: 'buy', label: 'Top up' },
    { key: 'history', label: 'Receipts' },
]

export default function AirtimePage() {
    const { dbUser } = useAuth()
    const { settings, loading: settingsLoading } = useAirtimeSettings()
    const [tab, setTab] = useState<Tab>('buy')
    const [balance, setBalance] = useState<number | null>(null)
    // Bumped after each purchase so Receipts reloads the next time it is opened.
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
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div role="tablist" aria-label="Airtime" className="neu-inset flex gap-1 rounded-full p-1.5">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => setTab(key)}
                            className={cn(
                                'whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                                tab === key ? 'clay-black' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <Link
                    href="/dashboard/wallet"
                    className="neu-raised-sm neu-press flex items-center gap-3 rounded-full py-2 pl-2 pr-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                    <span className="clay-gold flex h-9 w-9 items-center justify-center rounded-full"><Wallet className="h-4 w-4" /></span>
                    <span className="leading-tight">
                        <span className="block text-[11px] text-muted-foreground">In your wallet</span>
                        <span className="block font-display text-base font-bold tabular-nums">{balance === null ? '…' : formatCurrency(balance)}</span>
                    </span>
                </Link>
            </div>

            {tab === 'buy' ? (
                settingsLoading ? (
                    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : !settings ? (
                    <div className="neu-raised rounded-[2rem] p-10 text-center">
                        <p className="font-display text-xl font-bold">We cannot show prices right now.</p>
                        <p className="mt-2 text-sm text-muted-foreground">Refresh the page in a moment and try again.</p>
                    </div>
                ) : (
                    <BuyForm settings={settings} role={role} balance={balance} onPlaced={onPlaced} onViewHistory={() => setTab('history')} />
                )
            ) : (
                <HistoryPanel reloadKey={historyKey} />
            )}
        </div>
    )
}
