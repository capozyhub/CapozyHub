'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Crown, Gem, Loader2, Wallet, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface WalletUpgradeModalProps {
    plan: string
    planLabel: string
    price: number
    walletBalance: number
    upgradeType: 'agent' | 'dealer'
    /** Whether user already has auto-upgrade enabled for this plan */
    currentAutoUpgrade: boolean
    currentAutoUpgradePlan: string | null
    onClose: () => void
    onSuccess: () => void
}

const money = (n: number) => `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function WalletUpgradeModal({
    plan,
    planLabel,
    price,
    walletBalance,
    upgradeType,
    currentAutoUpgrade,
    currentAutoUpgradePlan,
    onClose,
    onSuccess,
}: WalletUpgradeModalProps) {
    const [isProcessing, setIsProcessing] = useState(false)
    // One key per modal instance: a retry/double-click of the same purchase can never charge twice.
    const [idempotencyKey] = useState(() => crypto.randomUUID().replace(/-/g, ''))

    const isDealer = upgradeType === 'dealer'
    const isPermanent = plan === 'permanent'
    const UpgradeIcon = isDealer ? Gem : Crown

    // Opt-in only: recurring charges must be a deliberate choice. Starts from the saved setting.
    const alreadyAutoForPlan = currentAutoUpgrade && currentAutoUpgradePlan === plan
    const [autoUpgrade, setAutoUpgrade] = useState(alreadyAutoForPlan && !isPermanent)

    const hasFunds = walletBalance >= price
    const shortfall = price - walletBalance
    const newBalance = walletBalance - price

    const handleConfirm = async () => {
        setIsProcessing(true)
        try {
            const res = await fetch('/api/user/upgrade/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan,
                    upgrade_type: upgradeType,
                    expected_price: price,
                    idempotency_key: idempotencyKey,
                }),
            })

            const data = await res.json().catch(() => ({}))

            if (!res.ok) {
                if (data.code === 'PRICE_CHANGED') {
                    toast.error('The price has changed. Please reopen this plan to see the new price.')
                    onClose()
                    return
                }
                if (data.insufficientBalance) {
                    toast.error(`Insufficient balance. You need GHS ${data.shortfall?.toFixed(2)} more.`)
                } else {
                    toast.error(data.error || 'Upgrade failed. Please try again.')
                }
                setIsProcessing(false)
                return
            }

            // Sync the auto-upgrade preference. The purchase already succeeded, so a failure here
            // is reported honestly rather than failing the upgrade or pretending it saved.
            const wantsAuto = autoUpgrade && !isPermanent
            if (wantsAuto || (currentAutoUpgrade && !wantsAuto)) {
                const ok = await fetch('/api/user/upgrade/toggle-auto-upgrade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(wantsAuto ? { enabled: true, plan } : { enabled: false }),
                }).then(r => r.ok).catch(() => false)
                if (!ok) {
                    toast.warning(
                        wantsAuto
                            ? 'Upgrade done, but auto-renew could not be saved. You can turn it on from your dashboard.'
                            : 'Upgrade done, but auto-renew could not be turned off. Please check it on your dashboard.'
                    )
                }
            }

            toast.success(`${planLabel} activated!`)
            onSuccess()
        } catch {
            toast.error('Something went wrong. Please try again.')
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => { if (!open && !isProcessing) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="gap-0 overflow-hidden p-0 sm:max-w-md max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
                onInteractOutside={e => { if (isProcessing) e.preventDefault() }}
                onEscapeKeyDown={e => { if (isProcessing) e.preventDefault() }}
            >
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-brand-500" />
                <DialogDescription className="sr-only">Confirm your membership upgrade</DialogDescription>
                <DialogClose
                    disabled={isProcessing}
                    className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>

                <div className="space-y-5 px-6 pb-6 pt-9">
                    <div className="flex items-center gap-4">
                        <span className="clay-gold flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl">
                            <UpgradeIcon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">Confirm upgrade</p>
                            <DialogTitle className="font-display text-xl font-bold leading-tight tracking-tight">{planLabel}</DialogTitle>
                        </div>
                    </div>

                    <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">Price</dt>
                            <dd className="font-display text-lg font-bold">{money(price)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">Wallet balance</dt>
                            <dd className="font-semibold">{money(walletBalance)}</dd>
                        </div>
                        {hasFunds && (
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                <dt className="text-muted-foreground">Balance after</dt>
                                <dd className="font-semibold">{money(newBalance)}</dd>
                            </div>
                        )}
                    </dl>

                    {!hasFunds && (
                        <div role="alert" className="neu-inset rounded-2xl p-4">
                            <p className="text-sm font-semibold">Not enough in your wallet</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Add at least <span className="font-semibold text-foreground">{money(shortfall)}</span> to continue.
                            </p>
                            <Link
                                href="/dashboard/wallet"
                                className="clay-gold mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold"
                            >
                                <Wallet className="h-4 w-4" /> Top up wallet
                            </Link>
                        </div>
                    )}

                    {hasFunds && !isPermanent && (
                        <div className="neu-inset flex items-start gap-3 rounded-2xl p-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">Auto-renew</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                    Renew this plan from your wallet when it ends. If the balance is too low we switch it off and message you.
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={autoUpgrade}
                                aria-label="Auto-renew"
                                disabled={isProcessing}
                                onClick={() => setAutoUpgrade(v => !v)}
                                className={cn(
                                    'relative mt-0.5 h-7 w-12 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                                    autoUpgrade ? 'bg-brand-500' : 'well',
                                )}
                            >
                                <span
                                    className={cn(
                                        'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                                        autoUpgrade ? 'left-6' : 'left-1',
                                    )}
                                />
                            </button>
                        </div>
                    )}

                    {hasFunds && (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isProcessing}
                                className="well h-12 flex-1 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isProcessing}
                                className="clay-gold inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60"
                            >
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                                {isProcessing ? 'Paying' : 'Pay from wallet'}
                            </button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
