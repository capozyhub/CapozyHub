'use client'

import { useMemo, useState } from 'react'
import { Check, Smartphone } from 'lucide-react'
import { NetworkIcon } from '@/components/network-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, calculatePaystackFee, formatCurrency } from '@/lib/utils'
import { detectWalletNetwork, networkIconKey, QUICK_AMOUNTS, WALLET_NETWORKS, type WalletNetworkCode } from './meta'

interface TopUpFormProps {
    minTopup: number
    maxTopup: number
    paystackFeePercent: number
    isAgentOrDealer: boolean
    onCharge: (amount: number, phone: string, network: WalletNetworkCode) => void
}

export function TopUpForm({ minTopup, maxTopup, paystackFeePercent, isAgentOrDealer, onCharge }: TopUpFormProps) {
    const [amount, setAmount] = useState('')
    const [phone, setPhone] = useState('')
    const [network, setNetwork] = useState<WalletNetworkCode | null>(null)
    const [networkChosen, setNetworkChosen] = useState(false)

    const typed = parseFloat(amount) || 0
    const inRange = typed >= minTopup && typed <= maxTopup

    const fee = inRange ? calculatePaystackFee(typed, paystackFeePercent) : 0
    const total = typed + fee

    const onPhoneChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10)
        setPhone(digits)
        if (!networkChosen && digits.length >= 3) {
            const detected = detectWalletNetwork(digits)
            if (detected) setNetwork(detected)
        }
        if (digits.length === 0 && !networkChosen) setNetwork(null)
    }

    const ready = inRange && phone.length === 10 && !!network

    return (
        <div className="space-y-5">
            {isAgentOrDealer && (
                <p className="text-xs text-muted-foreground">A Paystack transaction fee applies to agent and dealer top-ups.</p>
            )}

            <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                Top up between {formatCurrency(minTopup)} and {formatCurrency(maxTopup)}
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-medium">Quick amount</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
                    {QUICK_AMOUNTS.filter(q => q >= minTopup && q <= maxTopup).map(q => (
                        <button
                            key={q}
                            type="button"
                            aria-pressed={typed === q}
                            onClick={() => setAmount(String(q))}
                            className={cn('rounded-xl px-4 py-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', typed === q ? 'clay-gold' : 'neu-raised-sm neu-press')}
                        >
                            {formatCurrency(q)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="topup-amount" className="text-sm font-medium">Or enter an amount</Label>
                <Input
                    id="topup-amount"
                    type="number"
                    inputMode="decimal"
                    min={minTopup}
                    max={maxTopup}
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="h-12 text-base font-semibold tabular-nums"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="topup-phone" className="text-sm font-medium">Mobile money number</Label>
                <Input
                    id="topup-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="0241234567"
                    value={phone}
                    onChange={e => onPhoneChange(e.target.value)}
                    className="h-12 font-mono text-base font-semibold"
                    maxLength={10}
                />
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-medium">
                    Network
                    {!networkChosen && network && <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">Auto-detected</span>}
                </Label>
                <div role="radiogroup" aria-label="Network" className="grid grid-cols-3 gap-2.5">
                    {WALLET_NETWORKS.map(net => {
                        const active = network === net.code
                        return (
                            <button
                                key={net.code}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => { setNetwork(net.code); setNetworkChosen(true) }}
                                className={cn(
                                    'relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    active ? 'well' : 'neu-raised-sm neu-press',
                                )}
                            >
                                {active && (
                                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                    </span>
                                )}
                                <NetworkIcon network={networkIconKey(net.code)} size={32} />
                                <span className="text-xs font-semibold">{net.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {inRange && (
                <dl className="well space-y-2 rounded-2xl p-4 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Top-up amount</dt>
                        <dd className="font-semibold tabular-nums">{formatCurrency(typed)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Transaction fee ({paystackFeePercent}%)</dt>
                        <dd className="font-semibold tabular-nums">{formatCurrency(fee)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                        <dt className="font-medium">Total to pay</dt>
                        <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(total)}</dd>
                    </div>
                </dl>
            )}

            <Button
                className="h-12 w-full gap-2 text-base"
                disabled={!ready}
                onClick={() => network && onCharge(typed, phone, network)}
            >
                <Smartphone className="h-5 w-5" />
                {inRange ? `Pay ${formatCurrency(total)}` : 'Pay with mobile money'}
            </Button>
        </div>
    )
}
