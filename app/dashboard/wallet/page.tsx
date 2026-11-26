'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { WalletTransaction } from '@/types/supabase'
import { TopUpForm } from '@/components/dashboard/wallet/TopUpForm'
import { ChargeModal } from '@/components/dashboard/wallet/ChargeModal'
import { TransactionsList } from '@/components/dashboard/wallet/TransactionsList'
import { useChargeFlow } from '@/components/dashboard/wallet/useChargeFlow'
import type { WalletNetworkCode } from '@/components/dashboard/wallet/meta'

export default function WalletPage() {
    const { dbUser } = useAuth()
    const userId = dbUser?.id

    const [balance, setBalance] = useState(0)
    const [totalCredited, setTotalCredited] = useState(0)
    const [totalDebited, setTotalDebited] = useState(0)
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [loading, setLoading] = useState(true)

    const [paystackFeePercent, setPaystackFeePercent] = useState(1.95)
    const [minTopup, setMinTopup] = useState(5)
    const [maxTopup, setMaxTopup] = useState(5000)

    const [walletError, setWalletError] = useState(false)
    const [txnsError, setTxnsError] = useState(false)

    const loadWalletData = useCallback(async () => {
        if (!userId) return
        try {
            const [walletRes, txnsRes, settingsRes] = await Promise.all([
                supabase.from('wallets').select('*').eq('user_id', userId).single(),
                // Top-ups log source: 'payment'; refunds and admin credits are also
                // type: 'credit' but belong on the transactions page, not under "Recent top-ups".
                supabase.from('wallet_transactions').select('*').eq('user_id', userId).eq('type', 'credit').eq('source', 'payment').order('created_at', { ascending: false }).limit(20),
                fetch('/api/wallet/topup-settings', { credentials: 'include' }).then(r => r.json()).catch(() => null),
            ])

            const wallet = walletRes.data as any
            if (wallet) {
                setBalance(wallet.balance)
                setTotalCredited(wallet.total_credited)
                setTotalDebited(wallet.total_spent)
                setWalletError(false)
            } else {
                // PGRST116 ("no rows") means the wallet hasn't been created yet, which the
                // charge route handles lazily — that's not a failure worth alarming over.
                // Anything else means we genuinely couldn't read the balance; show it rather
                // than silently rendering GHS 0.00 as if the account were empty.
                setWalletError(walletRes.error?.code !== 'PGRST116')
            }
            setTxnsError(!!txnsRes.error)
            if (!txnsRes.error) setTransactions((txnsRes.data as WalletTransaction[]) || [])

            if (settingsRes && !settingsRes.error) {
                if (settingsRes.paystack_fee_percent !== undefined) setPaystackFeePercent(settingsRes.paystack_fee_percent)
                if (settingsRes.paystack_min_topup !== undefined) setMinTopup(Number(settingsRes.paystack_min_topup) || 5)
                if (settingsRes.paystack_max_topup !== undefined) setMaxTopup(Number(settingsRes.paystack_max_topup) || 5000)
            }
        } catch (err) {
            console.error('Error fetching wallet data:', err)
            setWalletError(true)
        } finally {
            setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        if (!userId) return
        loadWalletData()
    }, [userId, loadWalletData])

    useEffect(() => {
        const handler = () => loadWalletData()
        window.addEventListener('app-refresh', handler)
        return () => window.removeEventListener('app-refresh', handler)
    }, [loadWalletData])

    const charge = useChargeFlow({ onPaid: loadWalletData })

    const onCharge = (amount: number, phone: string, network: WalletNetworkCode) => {
        charge.startCharge(amount, phone, network)
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
                    <p className="text-sm text-muted-foreground">Top up with mobile money. Your balance is ready the moment the payment clears.</p>
                </div>
            </div>

            {/* Balance + lifetime stats */}
            {!loading && walletError ? (
                <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
                    <div className="flex items-center gap-2.5 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                        <span>We couldn&apos;t load your balance. Your money is safe. This only affects what you see here.</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadWalletData()}
                        className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold underline-offset-2 hover:underline"
                    >
                        Try again
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="surface rounded-3xl p-5 sm:col-span-1">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-display text-3xl font-bold tabular-nums">{loading ? '—' : formatCurrency(balance)}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Available now
                        </div>
                    </div>
                    <div className="well rounded-3xl p-5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                            <TrendingUp className="h-3.5 w-3.5" /> <span className="text-xs">Total credited</span>
                        </div>
                        <p className="font-display text-xl font-bold tabular-nums">{loading ? '—' : formatCurrency(totalCredited)}</p>
                    </div>
                    <div className="well rounded-3xl p-5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                            <TrendingDown className="h-3.5 w-3.5" /> <span className="text-xs">Total spent</span>
                        </div>
                        <p className="font-display text-xl font-bold tabular-nums">{loading ? '—' : formatCurrency(totalDebited)}</p>
                    </div>
                </div>
            )}

            {!loading && (
                <TopUpForm
                    minTopup={minTopup}
                    maxTopup={maxTopup}
                    paystackFeePercent={paystackFeePercent}
                    isAgentOrDealer={dbUser?.role === 'agent' || dbUser?.role === 'dealer'}
                    onCharge={onCharge}
                />
            )}

            <ChargeModal
                step={charge.step}
                displayText={charge.displayText}
                phone={charge.phoneForDisplay}
                otpValue={charge.otpValue}
                onOtpChange={charge.setOtpValue}
                pollCount={charge.pollCount}
                checkingPaid={charge.checkingPaid}
                onSubmitOtp={charge.submitOtp}
                onIHavePaid={charge.handleIHavePaid}
                onCancel={charge.cancel}
                onRetry={charge.retry}
            />

            <div className="space-y-3">
                <h2 className="font-display text-lg font-semibold">Recent top-ups</h2>
                {txnsError ? (
                    <div role="alert" className="well rounded-3xl p-5 text-sm">
                        We couldn&apos;t load your top-ups.{' '}
                        <button type="button" onClick={() => loadWalletData()} className="font-semibold underline underline-offset-2">Try again</button>
                    </div>
                ) : (
                    <TransactionsList transactions={transactions} />
                )}
            </div>
        </div>
    )
}
