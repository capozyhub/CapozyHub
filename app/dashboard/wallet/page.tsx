'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import type { WalletTransaction } from '@/types/supabase'
import { TopUpForm } from '@/components/dashboard/wallet/TopUpForm'
import { ChargeModal } from '@/components/dashboard/wallet/ChargeModal'
import { ClaimPanel } from '@/components/dashboard/wallet/ClaimPanel'
import { ClaimSuccessModal } from '@/components/dashboard/wallet/ClaimSuccessModal'
import { TransactionsList } from '@/components/dashboard/wallet/TransactionsList'
import { useChargeFlow } from '@/components/dashboard/wallet/useChargeFlow'
import type { ClaimSuccessData, MomoPaymentAccount, WalletNetworkCode } from '@/components/dashboard/wallet/meta'

type Tab = 'topup' | 'claim'

export default function WalletPage() {
    const { dbUser } = useAuth()
    const userId = dbUser?.id

    const [tab, setTab] = useState<Tab>('topup')
    const [balance, setBalance] = useState(0)
    const [totalCredited, setTotalCredited] = useState(0)
    const [totalDebited, setTotalDebited] = useState(0)
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [loading, setLoading] = useState(true)

    const [paystackFeePercent, setPaystackFeePercent] = useState(1.95)
    const [minTopup, setMinTopup] = useState(5)
    const [maxTopup, setMaxTopup] = useState(5000)

    const [momoEnabled, setMomoEnabled] = useState(true)
    const [momoAccounts, setMomoAccounts] = useState<MomoPaymentAccount[]>([])
    const [momoAccountName, setMomoAccountName] = useState('')
    const [momoMinClaimable, setMomoMinClaimable] = useState(1)
    const [momoMaxClaimable, setMomoMaxClaimable] = useState(50000)

    const [userRef, setUserRef] = useState<{ code: string; is_active: boolean } | null>(null)
    const [refLoading, setRefLoading] = useState(true)
    const [claimSuccess, setClaimSuccess] = useState<ClaimSuccessData | null>(null)

    const loadWalletData = useCallback(async () => {
        if (!userId) return
        try {
            const [walletRes, txnsRes, momoSettingsRes] = await Promise.all([
                supabase.from('wallets').select('*').eq('user_id', userId).single(),
                supabase.from('wallet_transactions').select('*').eq('user_id', userId).eq('type', 'credit').order('created_at', { ascending: false }).limit(20),
                fetch('/api/wallet/claim-momo?settings_only=true', { credentials: 'include' }).then(r => r.json()).catch(() => null),
            ])

            const wallet = walletRes.data as any
            if (wallet) {
                setBalance(wallet.balance)
                setTotalCredited(wallet.total_credited)
                setTotalDebited(wallet.total_spent)
            }
            setTransactions((txnsRes.data as WalletTransaction[]) || [])

            if (momoSettingsRes && !momoSettingsRes.error) {
                setMomoEnabled(momoSettingsRes.momo_enabled !== false)
                setMomoAccounts(momoSettingsRes.momo_accounts || [])
                setMomoAccountName(momoSettingsRes.momo_account_name || '')
                setMomoMinClaimable(momoSettingsRes.momo_min_claimable || 1)
                setMomoMaxClaimable(momoSettingsRes.momo_max_claimable || 50000)
                if (momoSettingsRes.paystack_fee_percent !== undefined) setPaystackFeePercent(momoSettingsRes.paystack_fee_percent)
                if (momoSettingsRes.paystack_min_topup !== undefined) setMinTopup(Number(momoSettingsRes.paystack_min_topup) || 5)
                if (momoSettingsRes.paystack_max_topup !== undefined) setMaxTopup(Number(momoSettingsRes.paystack_max_topup) || 5000)
            }
        } catch (err) {
            console.error('Error fetching wallet data:', err)
        } finally {
            setLoading(false)
        }
    }, [userId])

    const loadReference = useCallback(async () => {
        setRefLoading(true)
        try {
            const res = await fetch('/api/wallet/reference', { credentials: 'include' })
            const data = await res.json()
            setUserRef(res.ok && data.reference ? data.reference : null)
        } catch {
            setUserRef(null)
        } finally {
            setRefLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!userId) return
        loadWalletData()
        loadReference()
    }, [userId, loadWalletData, loadReference])

    useEffect(() => {
        const handler = () => loadWalletData()
        window.addEventListener('app-refresh', handler)
        return () => window.removeEventListener('app-refresh', handler)
    }, [loadWalletData])

    const charge = useChargeFlow({ onPaid: loadWalletData })

    const generateReference = async () => {
        try {
            const res = await fetch('/api/wallet/reference', { method: 'POST', credentials: 'include' })
            const data = await res.json()
            if (res.ok && data.reference) {
                setUserRef(data.reference)
            } else {
                const { toast } = await import('@/lib/toast')
                toast.error(data.error || 'Failed to generate reference. Try again.')
            }
        } catch {
            const { toast } = await import('@/lib/toast')
            toast.error('Network error. Please try again.')
        }
    }

    const onCharge = (amount: number, phone: string, network: WalletNetworkCode) => {
        charge.startCharge(amount, phone, network)
    }

    const onClaimed = (data: ClaimSuccessData, newBalance: number) => {
        setClaimSuccess(data)
        setBalance(newBalance)
        loadWalletData()
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
                    <p className="text-sm text-muted-foreground">Top up with mobile money, or send &amp; claim to credit yourself instantly.</p>
                </div>
            </div>

            {/* Balance + lifetime stats */}
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

            <div role="tablist" className="well flex w-fit gap-1 rounded-2xl p-1">
                {([['topup', 'Top up'], ['claim', 'Send & claim']] as const).map(([key, label]) => (
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

            {!loading && (
                tab === 'topup' ? (
                    <TopUpForm
                        minTopup={minTopup}
                        maxTopup={maxTopup}
                        paystackFeePercent={paystackFeePercent}
                        isAgentOrDealer={dbUser?.role === 'agent' || dbUser?.role === 'dealer'}
                        onCharge={onCharge}
                    />
                ) : (
                    <ClaimPanel
                        momoEnabled={momoEnabled}
                        momoAccounts={momoAccounts}
                        momoAccountName={momoAccountName}
                        momoMinClaimable={momoMinClaimable}
                        momoMaxClaimable={momoMaxClaimable}
                        userRef={userRef}
                        refLoading={refLoading}
                        onGenerateRef={generateReference}
                        onClaimed={onClaimed}
                    />
                )
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

            <ClaimSuccessModal data={claimSuccess} onClose={() => setClaimSuccess(null)} />

            <div className="space-y-3">
                <h2 className="font-display text-lg font-semibold">Recent top-ups</h2>
                <TransactionsList transactions={transactions} />
            </div>
        </div>
    )
}
