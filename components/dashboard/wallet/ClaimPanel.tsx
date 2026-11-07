'use client'

import { useState } from 'react'
import { AlertTriangle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import type { MomoPaymentAccount } from './meta'

interface ClaimPanelProps {
    momoEnabled: boolean
    momoAccounts: MomoPaymentAccount[]
    momoMinClaimable: number
    momoMaxClaimable: number
    starting: boolean
    onStart: (amount: number) => void
}

/** Amount-first Send & Claim: type how much you're sending, we generate the
 * reference and show where to send it in a waiting modal (ClaimWaitingModal) that
 * auto-detects the credit. Replaces the old flow (get a reference → see the numbers
 * → separately paste a transaction ID), which only auto-credited silently in the
 * background while the UI still demanded a manual step every time. */
export function ClaimPanel({ momoEnabled, momoAccounts, momoMinClaimable, momoMaxClaimable, starting, onStart }: ClaimPanelProps) {
    const [amount, setAmount] = useState('')

    const typed = parseFloat(amount) || 0
    const inRange = typed >= momoMinClaimable && typed <= momoMaxClaimable
    const ready = inRange && momoAccounts.length > 0 && !starting

    if (!momoEnabled) {
        return (
            <div className="surface rounded-3xl p-8 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
                <p className="mt-3 font-display text-lg font-semibold">Temporarily unavailable</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Use the Top Up tab to fund your wallet via mobile money instead.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                Send between {formatCurrency(momoMinClaimable)} and {formatCurrency(momoMaxClaimable)}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="claim-amount" className="text-sm font-medium">How much are you sending?</Label>
                <Input
                    id="claim-amount"
                    type="number"
                    inputMode="decimal"
                    min={momoMinClaimable}
                    max={momoMaxClaimable}
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="h-12 text-base font-semibold tabular-nums"
                />
            </div>

            {momoAccounts.length === 0 && (
                <p className="text-xs italic text-muted-foreground">No payment numbers configured. Please contact support.</p>
            )}

            <p className="text-xs text-muted-foreground">
                We'll generate your payment reference and show you where to send it — your wallet is credited automatically the moment it lands.
            </p>

            <Button
                className="h-12 w-full gap-2 text-base"
                disabled={!ready}
                onClick={() => onStart(typed)}
            >
                <Zap className="h-5 w-5" />
                {starting ? 'Preparing…' : 'Generate payment details'}
            </Button>
        </div>
    )
}
