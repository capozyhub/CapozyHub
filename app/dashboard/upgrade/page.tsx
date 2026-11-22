'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { getCachedPricing, clearPricingCache, type RolePlanDTO } from '@/lib/pricing-cache'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { Check, Crown, Gem, Loader2, Wallet } from 'lucide-react'
import { toast } from '@/lib/toast'
import CongratsModal from '@/components/upgrade/CongratsModal'
import { AGENT_BENEFITS, DEALER_BENEFITS } from '@/components/upgrade/benefits'
import WalletUpgradeModal from '@/components/upgrade/WalletUpgradeModal'
import { cn } from '@/lib/utils'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'

const money = (n: number) => `GH₵ ${(n ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function UpgradePageInner() {
    const { dbUser, refreshUser } = useAuth()
    const router = useRouter()

    const [showCongrats, setShowCongrats] = useState(false)
    const [congratsTier, setCongratsTier] = useState<'agent' | 'dealer'>('agent')

    const [walletModal, setWalletModal] = useState<{
        plan: string
        planLabel: string
        price: number
        upgradeType: 'agent' | 'dealer'
        isLifetime: boolean
    } | null>(null)

    const [walletBalance, setWalletBalance] = useState<number>(0)
    const [walletLoading, setWalletLoading] = useState(false)

    const [agentPlans, setAgentPlans] = useState<RolePlanDTO[]>([])
    const [dealerPlans, setDealerPlans] = useState<RolePlanDTO[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let retryTimer: ReturnType<typeof setTimeout> | null = null

        const fetchPrices = async (isRetry = false) => {
            try {
                if (isRetry) clearPricingCache()

                const data = await getCachedPricing()

                if (data.agentPlans === undefined && !isRetry) {
                    retryTimer = setTimeout(() => fetchPrices(true), 1500)
                    return
                }

                setAgentPlans(data.agentPlans ?? [])
                setDealerPlans(data.dealerPlans ?? [])
                setIsLoading(false)
            } catch (err) {
                console.error('Failed to fetch upgrade prices:', err)
                toast.error('Failed to load upgrade prices.')
                setIsLoading(false)
            }
        }

        fetchPrices()
        return () => { if (retryTimer) clearTimeout(retryTimer) }
    }, [])

    // Returns false when the balance could not be loaded, so we never show a fake
    // "Insufficient Balance" built from a default of 0.
    const fetchWalletBalance = async (): Promise<boolean> => {
        setWalletLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('no session')

            const { data: wallet, error } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', user.id)
                .single()
            if (error || !wallet) throw error ?? new Error('no wallet')

            setWalletBalance(Number((wallet as any).balance ?? 0))
            return true
        } catch {
            toast.error('Could not load your wallet balance. Please try again.')
            return false
        } finally {
            setWalletLoading(false)
        }
    }

    const openPurchase = async (upgradeType: 'agent' | 'dealer', plan: RolePlanDTO) => {
        if (!(await fetchWalletBalance())) return
        setWalletModal({
            plan: plan.slug,
            planLabel: plan.label,
            price: plan.price,
            upgradeType,
            isLifetime: plan.days === null,
        })
    }

    const handleUpgradeSuccess = async () => {
        setCongratsTier(walletModal?.upgradeType ?? 'agent')
        setWalletModal(null)
        setShowCongrats(true)
        await refreshUser()
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Expiry-aware: the role column can lag the expiry until the daily downgrade cron runs.
    const effRole = effectiveRoleFromExpiry(
        dbUser?.role,
        dbUser?.agent_expires_at ?? null,
        (dbUser as any)?.dealer_expires_at ?? null,
    )
    const isPermanentAgent = effRole === 'agent' && dbUser?.agent_expires_at === null
    const isActiveDealer = effRole === 'dealer'
    const isAgentRole = effRole === 'agent'

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const agentExpiry = dbUser?.agent_expires_at as string | null | undefined
    const dealerExpiry = (dbUser as any)?.dealer_expires_at as string | null | undefined

    const heroTitle = isActiveDealer
        ? 'You are a Dealer'
        : isPermanentAgent
            ? 'Lifetime Agent'
            : isAgentRole
                ? 'You are an Agent'
                : 'Become an Agent'

    const heroSub = isActiveDealer
        ? (dealerExpiry ? `Your Dealer membership runs until ${fmtDate(dealerExpiry)}. Extending adds time from that date.` : 'Extend your Dealer membership below.')
        : isPermanentAgent
            ? 'Your Agent rank never expires. Dealer is the next step up.'
            : isAgentRole
                ? (agentExpiry ? `Your Agent pass runs until ${fmtDate(agentExpiry)}. Renewing adds time on top.` : 'Renew or extend your pass below.')
                : 'Unlock lower prices, bulk orders, sub-agents and API access. Every plan has the same benefits; only the length differs.'

    const dealerSection = (mode: 'upgrade' | 'extend') => (
        <section aria-label={mode === 'extend' ? 'Extend Dealer' : 'Upgrade to Dealer'} className="space-y-4">
            <div>
                <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                    {mode === 'extend' ? 'Extend your Dealership' : 'Upgrade to Dealer'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {mode === 'extend'
                        ? 'Pick how much time to add. It is added from your current expiry.'
                        : 'Open to Lifetime Agents. When a Dealer pass ends you go back to Lifetime Agent.'}
                </p>
            </div>

            {dealerPlans.length === 0 ? (
                <div className="surface rounded-3xl p-5 text-sm text-muted-foreground">No Dealer plans are available right now.</div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {dealerPlans.map(plan => (
                        <div
                            key={plan.id}
                            className={cn(
                                'neu-night flex flex-col rounded-3xl p-5 text-white',
                                plan.popular && 'ring-2 ring-brand-500/70',
                            )}
                        >
                            <p className="text-xs font-semibold text-white/50">{plan.days ? `${plan.days} days` : ''}</p>
                            <p className="mt-1 font-display text-lg font-semibold">{mode === 'extend' ? `+${plan.label}` : plan.label}</p>
                            <p className="mt-3 font-display text-3xl font-bold leading-none tracking-tight">
                                <span className="mr-1 text-lg font-semibold text-brand-500">GH₵</span>
                                {plan.price.toFixed(2)}
                            </p>
                            <button
                                type="button"
                                onClick={() => openPurchase('dealer', plan)}
                                disabled={walletLoading}
                                className="clay-gold mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60"
                            >
                                <Gem className="h-4 w-4" />
                                {mode === 'extend' ? `Add ${plan.label}` : `Choose ${plan.label}`}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="surface rounded-3xl p-5">
                <p className="text-sm font-semibold">Dealer includes</p>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {DEALER_BENEFITS.map(b => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <span className="clay-gold mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"><Check className="h-3 w-3" /></span>
                            {b}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )

    return (
        <>
            {showCongrats && (
                <CongratsModal
                    tier={congratsTier}
                    onClose={() => setShowCongrats(false)}
                    onBrowsePackages={() => router.push('/dashboard/data-packages')}
                />
            )}

            {walletModal && !walletLoading && (
                <WalletUpgradeModal
                    plan={walletModal.plan}
                    planLabel={walletModal.planLabel}
                    price={walletModal.price}
                    walletBalance={walletBalance}
                    upgradeType={walletModal.upgradeType}
                    isLifetime={walletModal.isLifetime}
                    currentAutoUpgrade={(dbUser as any)?.auto_upgrade_enabled ?? false}
                    currentAutoUpgradePlan={(dbUser as any)?.auto_upgrade_plan ?? null}
                    onClose={() => setWalletModal(null)}
                    onSuccess={handleUpgradeSuccess}
                />
            )}

            <div className="space-y-6">
                {/* The black stage Home and Data bundles use: one statement about where the member stands. */}
                <section aria-label="Membership" className="neu-night relative overflow-hidden rounded-3xl p-5 text-white sm:p-7">
                    <BrandSwoosh progress={1} className="pointer-events-none absolute -right-16 bottom-0 w-[28rem] max-w-none opacity-40 sm:-right-8 sm:opacity-50 lg:opacity-30" />
                    <div className="relative max-w-2xl">
                        <p className="flex items-center gap-2 text-sm font-medium text-white/60">
                            {isActiveDealer ? <Gem className="h-4 w-4 text-brand-500" /> : <Crown className="h-4 w-4 text-brand-500" />}
                            Membership
                        </p>
                        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">{heroTitle}</h1>
                        <p className="mt-3 text-sm text-white/70 sm:text-base">{heroSub}</p>

                        <div className="neu-night-in mt-5 inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm">
                            <Wallet className="h-4 w-4 flex-shrink-0 text-brand-500" />
                            <span className="text-white/70">Paid instantly from your Capozy wallet</span>
                        </div>
                    </div>
                </section>

                {!isPermanentAgent && !isActiveDealer && (
                    <>
                        <section aria-label="Agent plans" className="space-y-4">
                            <div>
                                <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                                    {isAgentRole ? 'Renew or extend' : 'Choose your plan'}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">Same benefits on every plan. Longer plans simply cost less per day.</p>
                            </div>

                            {agentPlans.length === 0 ? (
                                <div className="surface rounded-3xl p-5 text-sm text-muted-foreground">No Agent plans are available right now.</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {agentPlans.map(plan => {
                                        const discounted = plan.oldPrice > 0 && plan.oldPrice > plan.price
                                        const discountPercent = discounted ? Math.round(((plan.oldPrice - plan.price) / plan.oldPrice) * 100) : 0
                                        return (
                                            <div
                                                key={plan.id}
                                                className={cn(
                                                    'surface relative flex flex-col rounded-3xl p-5',
                                                    plan.popular && 'ring-2 ring-primary',
                                                )}
                                            >
                                                {plan.popular && (
                                                    <span className="clay-gold absolute -top-3 left-5 rounded-full px-3 py-1 text-[11px] font-bold">Most popular</span>
                                                )}
                                                <p className="font-display text-lg font-semibold">{plan.days === null ? 'Lifetime' : `${plan.days} days`}</p>
                                                {discounted && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        <span className="line-through">{money(plan.oldPrice)}</span>
                                                        <span className="ml-2 font-semibold text-foreground">Save {discountPercent}%</span>
                                                    </p>
                                                )}
                                                <p className="mt-3 font-display text-3xl font-bold leading-none tracking-tight">
                                                    <span className="mr-1 text-lg font-semibold text-muted-foreground">GH₵</span>
                                                    {plan.price.toFixed(2)}
                                                </p>
                                                {plan.days === null && (
                                                    <p className="mt-3 text-xs text-muted-foreground">One payment, never expires. Unlocks the Dealer upgrade.</p>
                                                )}
                                                <div className="mt-auto flex flex-col pt-5">
                                                    <button
                                                        type="button"
                                                        onClick={() => openPurchase('agent', plan)}
                                                        disabled={walletLoading}
                                                        className={cn(
                                                            plan.popular ? 'clay-gold' : 'clay-black',
                                                            'inline-flex h-11 items-center justify-center rounded-2xl text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60',
                                                        )}
                                                    >
                                                        {isAgentRole ? 'Renew / extend' : 'Get this plan'}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </section>

                        <section aria-label="Agent benefits" className="surface rounded-3xl p-5 sm:p-6">
                            <p className="font-display text-lg font-semibold">Every plan includes</p>
                            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {AGENT_BENEFITS.map(b => (
                                    <li key={b} className="flex items-start gap-2.5 text-sm">
                                        <span className="clay-gold mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"><Check className="h-3 w-3" /></span>
                                        {b}
                                    </li>
                                ))}
                            </ul>
                            <div className="neu-inset mt-5 space-y-1.5 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                                <p><span className="font-semibold text-foreground">Lifetime only:</span> unlocks the Dealer upgrade, with lower prices again.</p>
                                <p>Pay from your wallet and your role switches on straight away. Turn on auto-renew when you buy to never lapse.</p>
                            </div>
                        </section>
                    </>
                )}

                {isPermanentAgent && !isActiveDealer && dealerSection('upgrade')}
                {isActiveDealer && dealerSection('extend')}
            </div>
        </>
    )
}

export default function UpgradePage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <UpgradePageInner />
        </Suspense>
    )
}
