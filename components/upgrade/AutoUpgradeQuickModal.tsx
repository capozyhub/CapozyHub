'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Loader2, Zap, ZapOff, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { getCachedPricing } from '@/lib/pricing-cache'

type AgentPlan = '3d' | '14d' | '30d'
type DealerPlan = '1m' | '3m' | '6m'
type Plan = AgentPlan | DealerPlan

interface AutoUpgradeQuickModalProps {
    mode: 'enable' | 'manage'
    userRole: 'agent' | 'dealer'
    /** For agents: agent_expires_at. For dealers: dealer_expires_at */
    expiresAt: string | null
    currentPlan: string | null
    firstName: string
    onClose: () => void
    onUpdated: () => void
}

const AGENT_PLANS: { id: AgentPlan; label: string }[] = [
    { id: '3d', label: '3 days' },
    { id: '14d', label: '14 days' },
    { id: '30d', label: '30 days' },
]
const DEALER_PLANS: { id: DealerPlan; label: string }[] = [
    { id: '1m', label: '1 month' },
    { id: '3m', label: '3 months' },
    { id: '6m', label: '6 months' },
]

const PLAN_PRICE_DEFAULTS: Record<Plan, number> = {
    '3d': 9.99,
    '14d': 49.99,
    '30d': 99.99,
    '1m': 99.99,
    '3m': 199.99,
    '6m': 299.99,
}

const PLAN_LABEL: Record<string, string> = {
    '3d': '3 days', '14d': '14 days', '30d': '30 days',
    '1m': '1 month', '3m': '3 months', '6m': '6 months',
}

const money = (n: number) => `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AutoUpgradeQuickModal({
    mode,
    userRole,
    expiresAt,
    currentPlan,
    firstName,
    onClose,
    onUpdated,
}: AutoUpgradeQuickModalProps) {
    const isDealer = userRole === 'dealer'
    const plans: { id: Plan; label: string }[] = isDealer ? DEALER_PLANS : AGENT_PLANS

    const isValidForRole = (p: string | null): p is Plan => !!p && plans.some(x => x.id === p)
    const defaultPlan: Plan = isValidForRole(currentPlan) ? currentPlan : isDealer ? '3m' : '30d'

    const [selectedPlan, setSelectedPlan] = useState<Plan>(defaultPlan)
    const [prices, setPrices] = useState<Record<Plan, number>>(PLAN_PRICE_DEFAULTS)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        getCachedPricing().then(data => {
            setPrices(prev => ({
                '3d': data.prices?.['3d'] ?? prev['3d'],
                '14d': data.prices?.['14d'] ?? prev['14d'],
                '30d': data.prices?.['30d'] ?? prev['30d'],
                '1m': data.dealerPrice1m ?? prev['1m'],
                '3m': data.dealerPrice3m ?? prev['3m'],
                '6m': data.dealerPrice ?? prev['6m'],
            }))
        }).catch(() => null)
    }, [])

    const shownPlan: Plan = mode === 'manage' && isValidForRole(currentPlan) ? currentPlan : selectedPlan
    const price = prices[shownPlan]

    const expiryFormatted = expiresAt
        ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null

    const save = async (enabled: boolean) => {
        setIsSaving(true)
        try {
            const res = await fetch('/api/user/upgrade/toggle-auto-upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enabled ? { enabled: true, plan: selectedPlan } : { enabled: false }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || `Failed to turn auto-renew ${enabled ? 'on' : 'off'}`)
                return
            }
            toast.success(enabled ? 'Auto-renew is on' : 'Auto-renew is off')
            onUpdated()
        } catch {
            toast.error('Something went wrong. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => { if (!open && !isSaving) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="gap-0 overflow-hidden p-0 sm:max-w-sm max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
                onInteractOutside={e => { if (isSaving) e.preventDefault() }}
            >
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-brand-500" />
                <DialogDescription className="sr-only">Manage automatic membership renewal</DialogDescription>
                <DialogClose
                    disabled={isSaving}
                    className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>

                <div className="space-y-5 px-6 pb-6 pt-9">
                    <div className="flex items-center gap-4">
                        <span className="clay-gold flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl">
                            {mode === 'manage' ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">Auto-renew</p>
                            <DialogTitle className="font-display text-lg font-bold leading-tight tracking-tight">
                                {mode === 'manage' ? 'Auto-renew is on' : 'Never miss a renewal'}
                            </DialogTitle>
                        </div>
                    </div>

                    {mode === 'enable' && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                {firstName ? `${firstName}, pick` : 'Pick'} the plan to renew from your wallet when your membership ends.
                            </p>
                            <div role="radiogroup" aria-label="Plan" className="well grid grid-cols-3 gap-1 rounded-2xl p-1">
                                {plans.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selectedPlan === p.id}
                                        onClick={() => setSelectedPlan(p.id)}
                                        className={cn(
                                            'rounded-xl py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                            selectedPlan === p.id ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">Plan</dt>
                            <dd className="font-semibold">{PLAN_LABEL[shownPlan] ?? '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">Renewal cost</dt>
                            <dd className="font-display text-base font-bold">{money(price)}</dd>
                        </div>
                        {expiryFormatted && (
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                <dt className="text-muted-foreground">Renews on</dt>
                                <dd className="font-semibold">{expiryFormatted}</dd>
                            </div>
                        )}
                    </dl>

                    <p className="neu-inset rounded-2xl px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                        Keep at least <span className="font-semibold text-foreground">{money(price)}</span> in your wallet before that date. If the balance is too low we switch auto-renew off and message you.
                    </p>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="well h-12 flex-1 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                            {mode === 'manage' ? 'Keep on' : 'Cancel'}
                        </button>
                        {mode === 'manage' ? (
                            <button
                                type="button"
                                onClick={() => save(false)}
                                disabled={isSaving}
                                className="clay-black inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ZapOff className="h-4 w-4" />}
                                Turn off
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => save(true)}
                                disabled={isSaving}
                                className="clay-gold inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                Turn on
                            </button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
