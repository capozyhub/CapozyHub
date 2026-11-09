// app/dashboard/commission/withdraw/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClayButton, Notice } from '@/components/auth/fields'
import { BrandSwoosh } from '@/components/brand-swoosh'

const NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] as const
type Network = typeof NETWORKS[number]

const MANUAL_NAME_CHARS = /[^A-Za-zÀ-ÖØ-öø-ÿ '.\-]/g
const round2 = (n: number) => Math.round(n * 100) / 100
// The server only accepts digit-only numbers: accept spaces, dashes and +233 and normalise.
const cleanNumber = (raw: string) => raw.replace(/[\s-]/g, '').replace(/^\+?233/, '0')

const FIELD = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500'
const SELECT_TRIGGER = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none focus:ring-2 focus:ring-black focus:ring-offset-0 dark:focus:ring-brand-500'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

interface Limits { balance: number; min: number; feePercent: number; feeFlat: number }

export default function CommissionWithdrawPage() {
    const [limits, setLimits] = useState<Limits>({ balance: 0, min: 0, feePercent: 0, feeFlat: 0 })
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [hasWallet, setHasWallet] = useState(true)

    // 1 amount, 2 destination, 3 review, 4 done
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
    const [receipt, setReceipt] = useState<{ net: number; name: string; number: string; network: string } | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const [amount, setAmount] = useState('')
    const [network, setNetwork] = useState<Network | ''>('')
    const [momoNumber, setMomoNumber] = useState('')

    // Name check
    const [verifiedName, setVerifiedName] = useState<string | null>(null)
    const [validating, setValidating] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    // Free-text names are only for "the provider could not resolve this", never for a bad
    // number format or an exhausted daily quota.
    const [manualAllowed, setManualAllowed] = useState(false)
    const [manualName, setManualName] = useState('')
    const lastChecked = useRef('')

    const loadWallet = useCallback(() => {
        fetch('/api/commission/wallet')
            .then(r => r.json())
            .then(res => {
                if (!res.success) throw new Error('load failed')
                const d = res.data
                setHasWallet(!!d.has_wallet)
                setLimits({
                    balance: Number(d.balance) || 0,
                    min: Number(d.min_withdrawal) || 0,
                    feePercent: Number(d.withdrawal_fee_percent) || 0,
                    feeFlat: Number(d.withdrawal_fee_flat) || 0,
                })
                setLoadFailed(false)
            })
            .catch(() => setLoadFailed(true))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadWallet() }, [loadWallet])

    const normalizedManualName = manualName.trim().replace(/\s+/g, ' ')
    const canUseManual = !!validationError && manualAllowed && !validating && !verifiedName
    const manualNameValid = normalizedManualName.length >= 2
    const hasUsableName = !!verifiedName || (canUseManual && manualNameValid)
    const receiverName = verifiedName || (canUseManual && manualNameValid ? normalizedManualName : '')

    const resetCheck = () => {
        lastChecked.current = ''
        setVerifiedName(null)
        setValidationError(null)
        setManualAllowed(false)
        setManualName('') // a manual name typed for one number must never ride along with another
    }

    const runCheck = useCallback((phone: string, net: string) => {
        setValidating(true)
        setVerifiedName(null)
        setValidationError(null)
        setManualAllowed(false)
        setManualName('')

        fetch('/api/shop/validate-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, network: net }),
        })
            .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
            .then(({ ok, data }) => {
                if (data.success && data.name) {
                    setVerifiedName(data.name)
                } else {
                    setManualAllowed(ok) // 200 + success:false = the provider could not resolve it
                    setValidationError(data.details?.[0] || data.error || 'We could not confirm this account.')
                }
            })
            .catch(() => {
                setManualAllowed(false)
                setValidationError('Network problem while checking the account. Please try again.')
            })
            .finally(() => setValidating(false))
    }, [])

    // Check the name by itself as soon as a full number and a network are in.
    useEffect(() => {
        if (!network) return
        const num = cleanNumber(momoNumber)
        if (!/^0\d{9}$/.test(num)) return
        const key = `${network}:${num}`
        const t = setTimeout(() => {
            if (lastChecked.current === key) return
            lastChecked.current = key
            runCheck(num, network)
        }, 400)
        return () => clearTimeout(t)
    }, [network, momoNumber, runCheck])

    // Rounded exactly as the server rounds it.
    const amountNum = parseFloat(amount) || 0
    const totalFee = round2((amountNum * limits.feePercent) / 100 + limits.feeFlat)
    const netAmount = round2(amountNum - totalFee)
    const accountNumber = cleanNumber(momoNumber)

    const amountBlocker =
        amountNum <= 0 ? 'Type an amount to continue.'
            : amountNum > limits.balance ? 'That is more than your commission balance.'
                : amountNum < limits.min ? `The smallest withdrawal is ${formatCurrency(limits.min)}.`
                    : netAmount <= 0 ? 'That is too small to cover the fee.'
                        : null
    const destBlocker =
        !network ? 'Choose a network.'
            : !/^0\d{9}$/.test(accountNumber) ? 'Enter a 10-digit mobile money number.'
                : validating ? 'Checking the account name…'
                    : !hasUsableName ? (canUseManual ? 'Type the account holder name to continue.' : 'We need to confirm the account name first.')
                        : null
    const canSubmit = !amountBlocker && !destBlocker && !submitting

    const setAmountClean = (raw: string) => { if (/^\d*\.?\d{0,2}$/.test(raw)) setAmount(raw) }

    const handleSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            const usingManual = !verifiedName && canUseManual && manualNameValid
            const res = await fetch('/api/commission/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountNum, momoNumber: accountNumber, network,
                    ...(usingManual ? { manualAccountName: normalizedManualName } : {}),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!data.success) throw new Error(data.error || 'Could not submit the withdrawal.')

            setReceipt({ net: netAmount, name: receiverName, number: accountNumber, network: String(network) })
            setStep(4)
            setAmount('')
            resetCheck()
            loadWallet()
        } catch (err: any) {
            // Stay on the review step so nothing the person typed is lost.
            toast.error(err.message || 'Could not submit the withdrawal.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>

    const stage = {
        1: { heading: 'How much commission do you want to cash out?', lead: `You have ${formatCurrency(limits.balance)} earned from your network. You will see the fee before anything moves.` },
        2: { heading: `Where should the ${formatCurrency(amountNum)} go?`, lead: 'Enter the mobile money number. We confirm the name on it first, so it never lands with the wrong person.' },
        3: { heading: 'One last look.', lead: 'Your commission balance is debited the moment you confirm.' },
        4: { heading: 'Done. It is on its way.', lead: 'An admin approves commission payouts, so it is not instant. We will update the status in your commission wallet.' },
    }[step]
    const progress = { 1: 0.25, 2: 0.55, 3: 0.85, 4: 1 }[step]

    const backBtn = (to: 1 | 2) => (
        <button type="button" onClick={() => setStep(to)} className={cn('mx-auto flex items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground', FOCUS)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
    )

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="space-y-4">
                <Link href="/dashboard/commission" className={cn('-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground', FOCUS)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Commission wallet
                </Link>
                {loadFailed && (
                    <Notice>
                        We could not load your commission wallet just now. Your money is safe.{' '}
                        <button type="button" onClick={() => { setLoading(true); loadWallet() }} className={cn('font-semibold underline underline-offset-4', FOCUS)}>Try again</button>
                    </Notice>
                )}
                {!loadFailed && !hasWallet && <Notice tone="info">You do not have a commission wallet yet. It is created when you earn your first commission.</Notice>}
            </div>

            <div className="overflow-hidden rounded-[2rem] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.35)] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <aside className="relative isolate overflow-hidden bg-black px-6 pb-28 pt-8 text-white sm:px-10 sm:pb-32 lg:flex lg:min-h-[34rem] lg:flex-col lg:justify-between lg:p-10 lg:pb-10">
                    <BrandSwoosh
                        progress={progress}
                        className="pointer-events-none absolute bottom-10 -right-[28%] -z-10 w-full sm:bottom-12 sm:-right-[8%] sm:w-[75%] lg:-bottom-8 lg:-right-[30%] lg:w-[135%]"
                    />
                    <div>
                        <p className="mb-3 text-sm font-semibold text-brand-400" aria-live="polite">{step === 4 ? 'All set' : `Step ${step} of 3`}</p>
                        <h1 key={step} className="max-w-md font-display text-[1.9rem] font-bold leading-[1.05] tracking-tight text-white text-balance animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:text-4xl xl:text-5xl">
                            {stage.heading}
                        </h1>
                        <p className="mt-4 hidden max-w-md text-lg leading-relaxed text-silver-200 sm:block">{stage.lead}</p>
                    </div>
                    <div className="mt-8 lg:mt-0">
                        <p className="text-xs uppercase tracking-wider text-silver-200">Commission balance</p>
                        <p className="font-display text-3xl font-bold tabular-nums text-brand-500">{formatCurrency(limits.balance)}</p>
                        <p className="mt-1 text-xs text-silver-200">
                            Smallest withdrawal {formatCurrency(limits.min)} · Fee {limits.feePercent}%{limits.feeFlat > 0 ? ` + ${formatCurrency(limits.feeFlat)}` : ''}
                        </p>
                    </div>
                </aside>

                <section className="relative -mt-8 rounded-t-[2rem] bg-neu px-5 pb-8 pt-7 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10 lg:mt-0 lg:rounded-none lg:px-10 lg:py-10 lg:shadow-none">
                    <div key={step} className="mx-auto w-full max-w-[30rem] animate-in fade-in duration-300 motion-reduce:animate-none">

                        {step === 1 && (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="amount" className="text-sm font-semibold">Amount in cedis</Label>
                                    <div className="neu-inset flex items-center gap-2 rounded-2xl px-4">
                                        <span className="font-display text-xl font-semibold text-muted-foreground">GHS</span>
                                        <Input
                                            id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} autoFocus
                                            onChange={(e) => setAmountClean(e.target.value)}
                                            className="h-16 border-0 bg-transparent px-1 font-display text-3xl font-bold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                        />
                                    </div>
                                </div>
                                {limits.balance > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {limits.min > 0 && limits.min <= limits.balance && (
                                            <button type="button" onClick={() => setAmount(String(limits.min))} className={cn('neu-press neu-raised-sm rounded-full px-4 py-1.5 text-sm font-semibold', FOCUS)}>
                                                Smallest · {formatCurrency(limits.min)}
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setAmount(String(Math.floor(limits.balance * 100) / 100))} className={cn('neu-press neu-raised-sm rounded-full px-4 py-1.5 text-sm font-semibold', FOCUS)}>
                                            All of it
                                        </button>
                                    </div>
                                )}
                                <div className="well space-y-1.5 rounded-2xl px-4 py-3.5 text-sm" aria-live="polite">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="tabular-nums">{amountNum > 0 ? formatCurrency(totalFee) : '—'}</span></div>
                                    <div className="flex justify-between font-semibold"><span>You will receive</span><span className="tabular-nums">{amountNum > 0 ? formatCurrency(Math.max(0, netAmount)) : '—'}</span></div>
                                </div>
                                <ClayButton type="button" onClick={() => setStep(2)} disabled={!!amountBlocker}>
                                    Continue <ArrowRight className="h-4 w-4" />
                                </ClayButton>
                                {amountBlocker && amountNum > 0 && <p className="text-center text-sm text-red-700 dark:text-red-400" role="alert">{amountBlocker}</p>}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Network</Label>
                                    <div className="neu-inset rounded-xl">
                                        <Select value={network} onValueChange={(v) => { setNetwork(v as Network); resetCheck() }}>
                                            <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="Choose a network" /></SelectTrigger>
                                            <SelectContent>{NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="momo" className="text-sm font-semibold">Mobile money number</Label>
                                    <div className="neu-inset rounded-xl">
                                        <Input
                                            id="momo" value={momoNumber} inputMode="tel" autoComplete="off" placeholder="024 123 4567" className={cn(FIELD, 'font-mono')}
                                            onChange={(e) => { setMomoNumber(e.target.value); resetCheck() }}
                                        />
                                    </div>
                                </div>

                                <div aria-live="polite" className="space-y-2">
                                    {validating && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking the account name…</p>}
                                    {verifiedName && !validating && (
                                        <div className="neu-inset flex items-center gap-3 rounded-xl px-4 py-3">
                                            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">Account holder</p>
                                                <p className="truncate font-semibold">{verifiedName}</p>
                                            </div>
                                        </div>
                                    )}
                                    {validationError && !validating && !canUseManual && <Notice>{validationError}</Notice>}
                                    {canUseManual && (
                                        <div className="space-y-2">
                                            <Notice tone="info">
                                                We could not look this account up automatically. Type the exact name registered on it. An admin checks it before paying, and a wrong name will delay or cancel the payout.
                                            </Notice>
                                            <div className="neu-inset rounded-xl">
                                                <Input
                                                    value={manualName} maxLength={100} autoComplete="off" spellCheck={false} aria-label="Account holder name" placeholder="Name on the account" className={FIELD}
                                                    onChange={(e) => setManualName(e.target.value.replace(MANUAL_NAME_CHARS, '').slice(0, 100))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {validationError && !validating && (
                                        <button
                                            type="button" disabled={!network || !/^0\d{9}$/.test(accountNumber)}
                                            onClick={() => { lastChecked.current = `${network}:${accountNumber}`; runCheck(accountNumber, String(network)) }}
                                            className={cn('rounded-full text-sm font-semibold text-brand-800 underline underline-offset-4 disabled:opacity-50 dark:text-brand-400', FOCUS)}
                                        >
                                            Check again
                                        </button>
                                    )}
                                </div>

                                <ClayButton type="button" onClick={() => setStep(3)} disabled={!!destBlocker}>
                                    Continue <ArrowRight className="h-4 w-4" />
                                </ClayButton>
                                {destBlocker && <p className="text-center text-sm text-muted-foreground" aria-live="polite">{destBlocker}</p>}
                                {backBtn(1)}
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-5">
                                <div className="neu-inset space-y-4 rounded-2xl p-5">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">You will receive</p>
                                        <p className="font-display text-4xl font-bold tabular-nums">{formatCurrency(Math.max(0, netAmount))}</p>
                                    </div>
                                    <dl className="space-y-2 border-t border-border/60 pt-4 text-sm">
                                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Taken from commission</dt><dd className="font-semibold tabular-nums">{formatCurrency(amountNum)}</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fee</dt><dd className="tabular-nums">{formatCurrency(totalFee)}</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">To</dt><dd className="text-right font-semibold">{receiverName}</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Number</dt><dd className="font-mono">{accountNumber}</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Network</dt><dd>{network}</dd></div>
                                    </dl>
                                </div>
                                <p className="text-center text-sm text-muted-foreground">Check the number once more. A payout to the wrong account may not be recoverable.</p>
                                <ClayButton type="button" onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
                                    {submitting ? 'Sending your request' : <>Confirm and withdraw<Check className="h-4 w-4" /></>}
                                </ClayButton>
                                {!submitting && backBtn(2)}
                            </div>
                        )}

                        {step === 4 && receipt && (
                            <div className="space-y-5 text-center">
                                <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full"><Check className="h-7 w-7" /></span>
                                <div>
                                    <p className="font-display text-3xl font-bold tabular-nums">{formatCurrency(receipt.net)}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">to {receipt.name}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{receipt.number} · {receipt.network}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">Your commission balance has been debited. If the payout cannot be made, the full amount goes back to it.</p>
                                <Link href="/dashboard/commission" className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold', FOCUS)}>
                                    Back to commission wallet
                                </Link>
                                <ClayButton type="button" variant="black" onClick={() => { setReceipt(null); setStep(1) }}>Make another withdrawal</ClayButton>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}
