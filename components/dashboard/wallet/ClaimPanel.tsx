'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, Plus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { NETWORK_BADGE, type ClaimSuccessData, type MomoPaymentAccount } from './meta'

interface ClaimPanelProps {
    momoEnabled: boolean
    momoAccounts: MomoPaymentAccount[]
    momoAccountName: string
    momoMinClaimable: number
    momoMaxClaimable: number
    userRef: { code: string; is_active: boolean } | null
    refLoading: boolean
    onGenerateRef: () => Promise<void>
    onClaimed: (data: ClaimSuccessData, newBalance: number) => void
}

export function ClaimPanel({ momoEnabled, momoAccounts, momoAccountName, momoMinClaimable, momoMaxClaimable, userRef, refLoading, onGenerateRef, onClaimed }: ClaimPanelProps) {
    const [refGenerating, setRefGenerating] = useState(false)
    const [refCopied, setRefCopied] = useState(false)
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
    const [txnIdInput, setTxnIdInput] = useState('')
    const [claiming, setClaiming] = useState(false)
    // Frontend cooldown is UX polish only — the server is the real enforcer.
    const [claimAttempts, setClaimAttempts] = useState(0)
    const [cooldownUntil, setCooldownUntil] = useState(0)
    const [cooldownSeconds, setCooldownSeconds] = useState(0)
    const claimInFlight = useRef(false)

    useEffect(() => {
        if (cooldownUntil <= 0) return
        const interval = setInterval(() => {
            const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000)
            if (remaining <= 0) {
                setCooldownSeconds(0)
                setCooldownUntil(0)
                setClaimAttempts(0)
                clearInterval(interval)
            } else {
                setCooldownSeconds(remaining)
            }
        }, 500)
        return () => clearInterval(interval)
    }, [cooldownUntil])

    const generateRef = async () => {
        if (refGenerating) return
        setRefGenerating(true)
        try {
            await onGenerateRef()
        } finally {
            setRefGenerating(false)
        }
    }

    const claim = async () => {
        if (claimInFlight.current) return
        claimInFlight.current = true

        const digits = txnIdInput.replace(/\D/g, '')
        if (digits.length < 8) {
            toast.error('Transaction ID must be at least 8 digits')
            claimInFlight.current = false
            return
        }

        const now = Date.now()
        if (cooldownUntil > now) {
            toast.error(`Too many attempts. Please wait ${cooldownSeconds}s`)
            claimInFlight.current = false
            return
        }
        const nextAttempts = claimAttempts + 1
        setClaimAttempts(nextAttempts)
        if (nextAttempts >= 3) {
            setCooldownUntil(now + 30_000)
            setCooldownSeconds(30)
        }

        setClaiming(true)
        try {
            const res = await fetch('/api/wallet/claim-momo', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: digits }),
            })
            const data = await res.json()

            if (!res.ok) {
                if (data.error === 'already_claimed') {
                    toast.info(data.is_own_claim ? 'You already claimed this transaction.' : 'This transaction has already been claimed by another user.')
                } else {
                    toast.error(data.error || 'That claim did not go through. Please try again.')
                }
                return
            }

            onClaimed({
                amount: data.amount,
                fee_percent: data.fee_percent,
                fee_amount: data.fee_amount,
                net_amount: data.net_amount,
                new_balance: data.new_balance,
                transaction_id: data.transaction_id,
            }, data.new_balance)
            toast.success(`${formatCurrency(data.net_amount)} credited to your wallet!`)
            setTxnIdInput('')
            setClaimAttempts(0)
        } catch {
            toast.error('Network error. Please try again.')
        } finally {
            setClaiming(false)
            claimInFlight.current = false
        }
    }

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

            {/* Step 1 — reference code */}
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 · Your reference code</p>
                {refLoading ? (
                    <div className="flex h-11 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : userRef ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="well flex flex-1 items-center justify-center rounded-2xl px-4 py-2.5">
                                <span className={`font-mono text-xl font-bold tracking-[4px] ${userRef.is_active ? 'text-foreground' : 'text-muted-foreground'}`}>{userRef.code}</span>
                            </div>
                            <Button
                                size="icon"
                                variant="outline"
                                className="h-11 w-11 shrink-0"
                                onClick={() => {
                                    navigator.clipboard.writeText(userRef.code)
                                    setRefCopied(true)
                                    toast.success('Reference copied')
                                    setTimeout(() => setRefCopied(false), 2000)
                                }}
                            >
                                {refCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        {!userRef.is_active && <p className="text-xs font-medium text-red-500">This reference has been disabled. Contact support.</p>}
                        <p className="text-xs text-muted-foreground">Include this as your payment reference — required for cross-network transfers (e.g. Telecel → MTN).</p>
                    </div>
                ) : (
                    <Button onClick={generateRef} disabled={refGenerating} variant="outline" className="h-11 w-full gap-2">
                        {refGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Get my reference code
                    </Button>
                )}
            </div>

            {/* Step 2 — where to send */}
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 · Send money to</p>
                {momoAccounts.length > 0 ? (
                    <div className="surface divide-y divide-border/60 overflow-hidden rounded-2xl">
                        {momoAccounts.map((acct, i) => {
                            const badge = NETWORK_BADGE[acct.network] || NETWORK_BADGE.Unknown
                            return (
                                <div key={i} className="flex items-center justify-between px-4 py-3">
                                    <div>
                                        <div className="mb-0.5 flex items-center gap-1.5">
                                            <span className={`h-2 w-2 rounded-full ${badge.bg}`} />
                                            <p className="text-xs font-semibold text-muted-foreground">{badge.label}</p>
                                        </div>
                                        <p className="font-mono text-base font-semibold tracking-wide">{acct.number}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 px-3 text-xs"
                                        onClick={() => {
                                            navigator.clipboard.writeText(acct.number)
                                            setCopiedIndex(i)
                                            setTimeout(() => setCopiedIndex(null), 1800)
                                            toast.success('Number copied')
                                        }}
                                    >
                                        {copiedIndex === i ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                                    </Button>
                                </div>
                            )
                        })}
                        {momoAccountName && (
                            <div className="flex items-center justify-between bg-foreground/[0.03] px-4 py-2.5">
                                <span className="text-xs text-muted-foreground">Account name</span>
                                <span className="text-xs font-semibold uppercase">{momoAccountName}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs italic text-muted-foreground">No payment numbers configured.</p>
                )}
            </div>

            {/* Step 3 — claim */}
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3 · Claim your funds</p>
                <p className="text-xs text-muted-foreground">After sending, paste the transaction ID from your MoMo confirmation SMS — your wallet is credited instantly.</p>
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Paste transaction ID"
                        value={txnIdInput}
                        pattern="\d*"
                        maxLength={15}
                        onChange={e => setTxnIdInput(e.target.value.replace(/\D/g, ''))}
                        disabled={claiming || cooldownSeconds > 0}
                        className="h-11 flex-1 font-mono tracking-wider"
                    />
                    <Button onClick={claim} disabled={txnIdInput.length < 8 || claiming || cooldownSeconds > 0} className="h-11 shrink-0 gap-2 px-5">
                        {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : <><Zap className="h-4 w-4" /> Claim</>}
                    </Button>
                </div>
            </div>
        </div>
    )
}
