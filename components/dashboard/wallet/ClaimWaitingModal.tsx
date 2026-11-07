'use client'

import { useState } from 'react'
import { Check, CheckCircle2, Copy, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { NETWORK_BADGE, type ClaimSessionInfo, type ClaimSessionStep, type ClaimSuccessData, type MomoPaymentAccount } from './meta'

interface ClaimWaitingModalProps {
    step: ClaimSessionStep
    session: ClaimSessionInfo | null
    secondsLeft: number
    momoAccounts: MomoPaymentAccount[]
    momoAccountName: string
    claimSuccess: ClaimSuccessData | null
    manualChecking: boolean
    onManualClaim: (transactionId: string) => void
    onCancel: () => void
    onRetry: () => void
    onDone: () => void
    onViewHistory: () => void
}

function formatCountdown(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false)
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <span className={mono ? 'font-mono text-sm font-bold tracking-wide' : 'text-sm font-bold'}>{value}</span>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2.5 text-xs"
                    onClick={() => {
                        navigator.clipboard.writeText(value)
                        setCopied(true)
                        toast.success('Copied')
                        setTimeout(() => setCopied(false), 1800)
                    }}
                >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
        </div>
    )
}

/** The Send & Claim waiting room: shows the one-time reference + where to send the
 * money, then waits (polling in useClaimSession) for the credit to land and switches
 * straight to a success breakdown in place — no separate success modal. Dismissible
 * (unlike the top-up ChargeModal): nothing server-side is "stuck" while this is open,
 * the auto-claim happens independently via the SMS-forward webhook, and the member
 * still gets an SMS/email/push the moment it lands even with the modal closed. */
export function ClaimWaitingModal({
    step, session, secondsLeft, momoAccounts, momoAccountName, claimSuccess,
    manualChecking, onManualClaim, onCancel, onRetry, onDone, onViewHistory,
}: ClaimWaitingModalProps) {
    const [showManual, setShowManual] = useState(false)
    const [txnIdInput, setTxnIdInput] = useState('')

    const open = step !== 'idle'
    const closeAction = step === 'credited' ? onDone : onCancel

    const submitManual = () => {
        const digits = txnIdInput.replace(/\D/g, '')
        if (digits.length < 8) { toast.error('Transaction ID must be at least 8 digits'); return }
        onManualClaim(digits)
    }

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) closeAction() }}>
            <DialogContent hideCloseButton aria-describedby={undefined} className="gap-0 overflow-hidden p-0 sm:max-w-md">
                <div className="flex items-center justify-between px-6 pt-6">
                    <DialogTitle className="font-display text-xl font-semibold">Payment details</DialogTitle>
                    <button
                        type="button"
                        onClick={closeAction}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4 px-6 pb-6 pt-4">
                    {step === 'starting' && (
                        <div className="flex flex-col items-center gap-3 py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Preparing your payment details…</p>
                        </div>
                    )}

                    {(step === 'waiting' || step === 'expired') && session && (
                        <>
                            {step === 'waiting' ? (
                                <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                                    <p className="text-xs font-semibold uppercase tracking-wide">Important payment instruction</p>
                                    <p className="mt-1">Use the exact reference below when you send — it's how we find and credit your payment automatically.</p>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-red-300/70 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300">
                                    This session expired before a payment was detected. Already sent the money? Enter your transaction ID below — otherwise start a new session.
                                </div>
                            )}

                            <div className="surface divide-y divide-border/60 overflow-hidden rounded-2xl">
                                {momoAccountName && <CopyRow label="Account name" value={momoAccountName} mono={false} />}
                                {momoAccounts.map((acct, i) => {
                                    const badge = NETWORK_BADGE[acct.network] || NETWORK_BADGE.Unknown
                                    return (
                                        <CopyRow key={i} label={`MoMo number · ${badge.label}`} value={acct.number} />
                                    )
                                })}
                                <CopyRow label="Reference" value={session.reference_code} />
                                <CopyRow label="Amount" value={formatCurrency(session.expected_amount)} mono={false} />
                            </div>

                            {step === 'waiting' && (
                                <div className="flex flex-col items-center gap-2 py-2 text-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Waiting for your payment…</span>
                                    </div>
                                    <p className="font-mono text-xs text-muted-foreground">Expires in {formatCountdown(secondsLeft)}</p>
                                </div>
                            )}

                            {!showManual ? (
                                <button
                                    type="button"
                                    onClick={() => setShowManual(true)}
                                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    Already sent but not reflecting? Enter your transaction ID
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        placeholder="Paste transaction ID"
                                        value={txnIdInput}
                                        maxLength={15}
                                        onChange={e => setTxnIdInput(e.target.value.replace(/\D/g, ''))}
                                        disabled={manualChecking}
                                        className="h-10 flex-1 font-mono tracking-wider"
                                    />
                                    <Button onClick={submitManual} disabled={txnIdInput.length < 8 || manualChecking} className="h-10 shrink-0 px-4">
                                        {manualChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
                                    </Button>
                                </div>
                            )}

                            {step === 'expired' ? (
                                <Button onClick={onRetry} variant="outline" className="w-full">Start a new session</Button>
                            ) : (
                                <button type="button" onClick={onCancel} className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline">
                                    Cancel
                                </button>
                            )}
                        </>
                    )}

                    {step === 'credited' && claimSuccess && (
                        <>
                            <div className="flex flex-col items-center gap-2 py-2 text-center">
                                <span className="clay-gold flex h-14 w-14 items-center justify-center rounded-full">
                                    <CheckCircle2 className="h-7 w-7" />
                                </span>
                                <p className="font-display text-lg font-semibold">Payment confirmed</p>
                                <p className="text-sm text-muted-foreground">Your wallet was credited instantly.</p>
                            </div>

                            <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">Transaction</dt>
                                    <dd className="font-mono font-semibold">#{claimSuccess.transaction_id}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">Amount sent</dt>
                                    <dd className="font-semibold tabular-nums">{formatCurrency(claimSuccess.amount)}</dd>
                                </div>
                                {claimSuccess.fee_amount > 0 && (
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Fee ({claimSuccess.fee_percent}%)</dt>
                                        <dd className="font-semibold tabular-nums text-red-500">-{formatCurrency(claimSuccess.fee_amount)}</dd>
                                    </div>
                                )}
                                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                    <dt className="font-medium">Credited</dt>
                                    <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(claimSuccess.net_amount)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">New balance</dt>
                                    <dd className="font-semibold tabular-nums">{formatCurrency(claimSuccess.new_balance)}</dd>
                                </div>
                            </dl>

                            <button
                                type="button"
                                onClick={onViewHistory}
                                className="w-full rounded-xl bg-foreground/[0.04] px-4 py-3 text-center text-sm font-semibold transition-colors hover:bg-foreground/[0.07]"
                            >
                                View top-up history
                            </button>

                            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                                Payment confirmed and wallet credited.
                            </div>

                            <Button className="w-full" onClick={onDone}>Done</Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
