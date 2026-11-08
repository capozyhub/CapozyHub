'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Loader2, Phone, Zap } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { NetworkIcon } from '@/components/network-icon'
import { ClayButton } from '@/components/auth/fields'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'
import { cn, formatCurrency, generateReferenceCode } from '@/lib/utils'
import { quoteAirtime } from '@/lib/airtime-pricing'
import { calcMashupBundle, type BundlePreference } from '@/lib/mashup-bundle'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { AIRTIME_NETWORKS, QUICK_AMOUNTS, carrierToNetwork, type AirtimeNetwork, type PurchaseMode } from './meta'
import { isAirtimeEnabled, isMashupEnabled, isNetworkEnabled } from './use-airtime-settings'
import { MashupEstimate, MashupPreference } from './MashupOptions'

interface BuyFormProps {
    settings: Record<string, string> | null
    /** The buyer's EFFECTIVE pricing role (lapsed agents and dealers price as customers). */
    role: string
    balance: number | null
    onPlaced: (newBalance: number | null) => void
    onViewHistory: () => void
}

interface Receipt {
    referenceCode: string
    newBalance: number | null
    duplicate: boolean
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
const FIELD = 'h-14 rounded-xl border-0 bg-transparent px-4 text-lg font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground/70 shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500'

const STEPS = [
    { heading: 'What are you topping up?', lead: 'Pick a network for airtime, or go for an MTN Mashup bundle with data and talk time together.' },
    { heading: 'Whose number is it?', lead: 'It can be yours or anyone else’s. We check it against the network you chose.' },
    { heading: 'How much do you want to send?', lead: 'You will see exactly what leaves your wallet before you pay.' },
    { heading: 'Check it, then pay.', lead: 'Nothing is charged until you press the button.' },
] as const

export function BuyForm({ settings, role, balance, onPlaced, onViewHistory }: BuyFormProps) {
    const mashupAvailable = isMashupEnabled(settings)
    const airtimeOn = isAirtimeEnabled(settings)

    const [step, setStep] = useState(1)
    const [mode, setMode] = useState<PurchaseMode>('airtime')
    const [network, setNetwork] = useState<AirtimeNetwork | null>(null)
    const [phone, setPhone] = useState('')
    const [amount, setAmount] = useState('')
    const [feeOnTop, setFeeOnTop] = useState(true)
    const [bundlePreference, setBundlePreference] = useState<BundlePreference>('balanced')
    // One reference per attempt, sent with every retry: a double tap or a retry after a dropped
    // connection can never buy twice.
    const [reference, setReference] = useState('')
    const [paying, setPaying] = useState(false)
    const [receipt, setReceipt] = useState<Receipt | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (mode === 'mashup' && !mashupAvailable) setMode('airtime')
    }, [mode, mashupAvailable])

    // Fresh idempotency key each time the review step is reached.
    useEffect(() => {
        if (step === 4 && !receipt) setReference(generateReferenceCode())
    }, [step, receipt])

    const effectiveNetwork: AirtimeNetwork | null = mode === 'mashup' ? 'MTN' : network
    const typed = parseFloat(amount) || 0

    const phoneCheck = useMemo(() => (phone.length === 10 ? validateGhanaianPhone(phone) : null), [phone])
    const detected = carrierToNetwork(phoneCheck?.network)
    const phoneError = phoneCheck && !phoneCheck.isValid ? phoneCheck.error || 'That does not look like a Ghana mobile number.' : ''
    const networkMismatch = !phoneError && detected && effectiveNetwork && detected !== effectiveNetwork
        ? `This looks like a ${detected} number, but you picked ${effectiveNetwork}. Check before you pay.`
        : ''

    // The very same arithmetic and limits the server applies when the order is placed.
    const quoted = useMemo(() => {
        if (typed <= 0 || !effectiveNetwork || !settings) return null
        return quoteAirtime({ settings, network: effectiveNetwork, role, amount: typed, useExactAmount: feeOnTop, orderType: mode })
    }, [typed, effectiveNetwork, settings, role, feeOnTop, mode])

    const quote = quoted?.ok ? quoted.quote : null
    const amountError = quoted && !quoted.ok ? quoted.message : ''
    // Estimate from what is actually delivered (after the fee when it comes out of the amount).
    const bundle = useMemo(
        () => (mode === 'mashup' && quote ? calcMashupBundle(quote.airtimeAmount, bundlePreference) : null),
        [mode, quote, bundlePreference],
    )

    const canAfford = quote !== null && balance !== null && balance >= quote.totalPaid
    const productOn = mode === 'mashup' ? mashupAvailable : airtimeOn && !!effectiveNetwork && isNetworkEnabled(settings, effectiveNetwork)

    const stepReady = step === 1 ? productOn
        : step === 2 ? !!phoneCheck?.isValid
        : step === 3 ? !!quote && canAfford
        : !!quote && !!phoneCheck?.isValid && productOn && canAfford

    const product = mode === 'mashup' ? 'Mashup bundle' : 'airtime'

    const restart = () => {
        setStep(1)
        setNetwork(null)
        setPhone('')
        setAmount('')
        setReceipt(null)
        setCopied(false)
    }

    const pay = async () => {
        if (paying || !stepReady || !quote || !effectiveNetwork || !phoneCheck?.normalizedNumber) return
        setPaying(true)
        try {
            const res = await fetch('/api/airtime/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    beneficiaryPhone: phoneCheck.normalizedNumber,
                    network: effectiveNetwork,
                    amount: typed,
                    useExactAmount: feeOnTop,
                    type: mode,
                    bundle_preference: mode === 'mashup' ? bundlePreference : undefined,
                    referenceCode: reference,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'We could not place that order.')

            const o = data.order ?? {}
            const newBalance = typeof o.new_balance === 'number' ? o.new_balance : null
            setReceipt({ referenceCode: o.reference_code ?? reference, newBalance, duplicate: !!data.isDuplicate })
            onPlaced(newBalance)
        } catch (e: any) {
            toast.error(e.message || 'We could not place that order.')
        } finally {
            setPaying(false)
        }
    }

    const copyReference = async () => {
        if (!receipt) return
        try {
            await navigator.clipboard.writeText(receipt.referenceCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Could not copy')
        }
    }

    const onContinue = (e: React.FormEvent) => {
        e.preventDefault()
        if (!stepReady) return
        if (step < 4) setStep(step + 1)
        else void pay()
    }

    const heading = receipt ? (receipt.duplicate ? 'You already placed this one.' : 'Done. It is on its way.') : STEPS[step - 1].heading
    const lead = receipt
        ? `Your ${product} is queued and shows as Pending until our team delivers it.`
        : STEPS[step - 1].lead
    const progress = receipt ? 1 : step / 4

    // The ticket on the stage fills in as you answer.
    const ticket: [string, string][] = [
        ...(effectiveNetwork ? [['Network', effectiveNetwork] as [string, string]] : []),
        ...(step > 1 && mode === 'mashup' ? [['Product', 'MTN Mashup'] as [string, string]] : []),
        ...(phoneCheck?.isValid ? [['Number', phone] as [string, string]] : []),
        ...(quote ? [['You pay', formatCurrency(quote.totalPaid)] as [string, string]] : []),
    ]

    return (
        <div className="overflow-hidden rounded-[2rem] bg-black shadow-[14px_14px_30px_rgba(0,0,0,0.35)] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* ── Stage ───────────────────────────────────────────────── */}
            <aside className="relative isolate overflow-hidden px-6 pb-24 pt-8 text-white sm:px-10 sm:pb-28 lg:flex lg:min-h-[34rem] lg:flex-col lg:justify-between lg:p-10 lg:pb-10">
                <BrandSwoosh
                    progress={progress}
                    className="pointer-events-none absolute -right-[30%] bottom-6 -z-10 w-full sm:-right-[10%] sm:w-[70%] lg:-bottom-6 lg:-right-[26%] lg:w-[125%]"
                />

                <div className="max-w-md">
                    {!receipt && <p className="mb-3 text-sm font-semibold text-brand-400" aria-live="polite">Step {step} of 4</p>}
                    <h2
                        key={heading}
                        className="font-display text-[1.75rem] font-bold leading-[1.05] tracking-tight text-white text-balance animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:text-4xl"
                    >
                        {heading}
                    </h2>
                    <p className="mt-4 hidden text-base leading-relaxed text-silver-200 sm:block">{lead}</p>
                </div>

                {ticket.length > 0 && (
                    <dl className="neu-night mt-8 hidden max-w-xs space-y-2 rounded-2xl p-4 text-sm lg:block">
                        {ticket.map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4">
                                <dt className="text-silver-200">{label}</dt>
                                <dd className="font-semibold tabular-nums text-white">{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </aside>

            {/* ── The question ────────────────────────────────────────── */}
            <div className="relative -mt-8 rounded-t-[2rem] bg-neu px-5 pb-8 pt-7 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10 lg:mt-0 lg:flex lg:items-center lg:rounded-none lg:px-12 lg:shadow-none">
                <div className="mx-auto w-full max-w-[28rem]">
                    {receipt ? (
                        <div className="space-y-5">
                            <div className="flex flex-col items-center gap-3 text-center">
                                <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"><CheckCircle2 className="h-8 w-8" /></span>
                                <p className="text-sm text-muted-foreground">
                                    {formatCurrency(quote?.totalPaid ?? 0)} paid for {product} to <strong className="text-foreground">{phone}</strong>.
                                    {receipt.newBalance !== null && <> Wallet now {formatCurrency(receipt.newBalance)}.</>}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={copyReference}
                                className={cn('neu-raised-sm neu-press flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left', FOCUS)}
                            >
                                <span className="min-w-0">
                                    <span className="block text-xs text-muted-foreground">Your reference</span>
                                    <span className="block truncate font-mono text-sm font-semibold">{receipt.referenceCode}</span>
                                </span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
                                </span>
                            </button>
                            <ClayButton type="button" onClick={restart}>Top up another number<ArrowRight className="h-4 w-4" /></ClayButton>
                            <ClayButton type="button" variant="black" onClick={onViewHistory}>See my receipts</ClayButton>
                        </div>
                    ) : (
                        <form onSubmit={onContinue} className="space-y-6" key={step}>
                            {step === 1 && (
                                <>
                                    {mashupAvailable && (
                                        <div role="radiogroup" aria-label="Product" className="grid grid-cols-2 gap-2.5">
                                            {([['airtime', 'Airtime', 'Any network', Phone], ['mashup', 'MTN Mashup', 'Data + talk time', Zap]] as const).map(([key, label, hint, Icon]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={mode === key}
                                                    onClick={() => setMode(key)}
                                                    className={cn('flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition-all', FOCUS, mode === key ? 'neu-inset ring-2 ring-black dark:ring-brand-500' : 'neu-raised-sm neu-press')}
                                                >
                                                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', mode === key ? 'clay-gold' : 'neu-inset')}><Icon className="h-4 w-4" /></span>
                                                    <span className="mt-1 text-sm font-semibold">{label}</span>
                                                    <span className="text-xs text-muted-foreground">{hint}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {mode === 'airtime' ? (
                                        <div className="space-y-2.5">
                                            <p id="network-label" className="text-sm font-semibold">Which network?</p>
                                            <div role="radiogroup" aria-labelledby="network-label" className="grid grid-cols-3 gap-2.5">
                                                {AIRTIME_NETWORKS.map(net => {
                                                    const active = network === net.id
                                                    const enabled = airtimeOn && isNetworkEnabled(settings, net.id)
                                                    return (
                                                        <button
                                                            key={net.id}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={active}
                                                            disabled={!enabled}
                                                            onClick={() => setNetwork(net.id)}
                                                            className={cn('flex flex-col items-center gap-2 rounded-2xl px-1 py-4 transition-all', FOCUS, active ? 'neu-inset' : 'neu-raised-sm neu-press', !enabled && 'cursor-not-allowed opacity-50')}
                                                            style={active ? { boxShadow: `var(--neu-in), 0 0 0 2px ${net.color}` } : undefined}
                                                        >
                                                            <NetworkIcon network={net.id} size={40} priority />
                                                            <span className="text-sm font-semibold">{net.label}</span>
                                                            <span className="text-[11px] text-muted-foreground">{enabled ? (active ? 'Selected' : 'Available') : 'Paused'}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {!airtimeOn && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">Airtime top-ups are paused right now.</p>}
                                        </div>
                                    ) : (
                                        <div className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3.5">
                                            <NetworkIcon network="MTN" size={36} />
                                            <p className="text-sm text-muted-foreground">Mashup is for <strong className="text-foreground">MTN numbers</strong>. One bundle, data and talk time.</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {step === 2 && (
                                <div className="space-y-2.5">
                                    <Label htmlFor="beneficiary-phone" className="text-sm font-semibold">Mobile number</Label>
                                    <div className={cn('neu-inset relative rounded-xl', phoneError && 'ring-2 ring-red-500')}>
                                        <Input
                                            id="beneficiary-phone"
                                            type="tel"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            autoFocus
                                            placeholder="024 123 4567"
                                            value={phone}
                                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            aria-invalid={!!phoneError}
                                            aria-describedby="phone-help"
                                            className={cn(FIELD, 'pr-12 font-mono tracking-wider')}
                                        />
                                        {phoneCheck?.isValid && <CheckCircle2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" aria-hidden />}
                                    </div>
                                    <p id="phone-help" role={phoneError || networkMismatch ? 'alert' : undefined} className={cn('min-h-5 text-xs', phoneError ? 'font-medium text-red-600 dark:text-red-400' : networkMismatch ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                                        {phoneError || networkMismatch || (phone.length > 0 && phone.length < 10 ? `${10 - phone.length} more digit${10 - phone.length === 1 ? '' : 's'} to go.` : 'Ten digits, starting with 0.')}
                                    </p>
                                </div>
                            )}

                            {step === 3 && (
                                <>
                                    <div className="space-y-2.5">
                                        <Label htmlFor="airtime-amount" className="text-sm font-semibold">Amount in GHS</Label>
                                        <div className={cn('neu-inset rounded-xl', amountError && 'ring-2 ring-red-500')}>
                                            <Input
                                                id="airtime-amount"
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="0.01"
                                                autoFocus
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                aria-invalid={!!amountError}
                                                aria-describedby="amount-help"
                                                className={cn(FIELD, 'font-display text-2xl tabular-nums')}
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
                                            {QUICK_AMOUNTS.map(q => (
                                                <button
                                                    key={q}
                                                    type="button"
                                                    aria-pressed={typed === q}
                                                    onClick={() => setAmount(String(q))}
                                                    className={cn('rounded-full px-4 py-2 text-sm font-semibold tabular-nums', FOCUS, typed === q ? 'clay-black' : 'neu-raised-sm neu-press')}
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                        <p id="amount-help" role={amountError ? 'alert' : undefined} className={cn('flex min-h-5 items-center gap-1 text-xs', amountError ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                                            {amountError && <AlertCircle className="h-3.5 w-3.5" />}
                                            {amountError || 'Up to two decimal places.'}
                                        </p>
                                    </div>

                                    {mode === 'mashup' && <MashupPreference value={bundlePreference} onChange={setBundlePreference} />}

                                    <div className="space-y-2.5">
                                        <p id="fee-label" className="text-sm font-semibold">Who covers the service fee?</p>
                                        <div role="radiogroup" aria-labelledby="fee-label" className="neu-inset grid grid-cols-2 gap-1 rounded-full p-1">
                                            {([[true, 'I will, on top'], [false, 'Take it from the amount']] as const).map(([val, label]) => (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={feeOnTop === val}
                                                    onClick={() => setFeeOnTop(val)}
                                                    className={cn('rounded-full px-3 py-2.5 text-sm font-semibold transition-colors', FOCUS, feeOnTop === val ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {feeOnTop ? 'They receive exactly what you type. The fee is added to your bill.' : 'You pay exactly what you type. They receive a little less.'}
                                        </p>
                                    </div>

                                    {bundle && <MashupEstimate bundle={bundle} />}

                                    {quote && (
                                        <div className="neu-inset space-y-1.5 rounded-2xl p-4 text-sm" aria-label="Price">
                                            <Row label={mode === 'mashup' ? 'Bundle value' : 'They receive'} value={formatCurrency(quote.airtimeAmount)} />
                                            <Row label={`Service fee (${quote.feeRate}%)`} value={formatCurrency(quote.feeAmount)} />
                                            <div className="border-t border-border pt-2"><Row label="You pay" value={formatCurrency(quote.totalPaid)} strong /></div>
                                        </div>
                                    )}

                                    {quote && balance !== null && !canAfford && (
                                        <div className="space-y-2.5">
                                            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                                                <AlertCircle className="h-4 w-4 shrink-0" /> You need {formatCurrency(quote.totalPaid)} but your wallet has {formatCurrency(balance)}.
                                            </p>
                                            <Link href="/dashboard/wallet" className={cn('clay-black flex min-h-[3.25rem] items-center justify-center rounded-full text-base font-semibold', FOCUS)}>Top up your wallet</Link>
                                        </div>
                                    )}
                                </>
                            )}

                            {step === 4 && quote && effectiveNetwork && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <span className="neu-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"><NetworkIcon network={effectiveNetwork} size={32} /></span>
                                        <div className="min-w-0">
                                            <p className="font-display text-lg font-bold leading-tight">{mode === 'mashup' ? 'MTN Mashup bundle' : `${effectiveNetwork} airtime`}</p>
                                            <p className="font-mono text-sm text-muted-foreground">{phone}</p>
                                        </div>
                                    </div>
                                    {bundle && <MashupEstimate bundle={bundle} />}
                                    <dl className="neu-inset space-y-2 rounded-2xl p-4 text-sm">
                                        <Row label={mode === 'mashup' ? 'Bundle value' : 'They receive'} value={formatCurrency(quote.airtimeAmount)} />
                                        <Row label="Service fee" value={formatCurrency(quote.feeAmount)} />
                                        {balance !== null && <Row label="Wallet after" value={formatCurrency(balance - quote.totalPaid)} />}
                                        <div className="border-t border-border pt-2.5"><Row label="Total" value={formatCurrency(quote.totalPaid)} strong /></div>
                                    </dl>
                                    {networkMismatch && <p role="alert" className="text-xs font-medium text-amber-700 dark:text-amber-400">{networkMismatch}</p>}
                                </>
                            )}

                            <ClayButton type="submit" loading={paying} disabled={!stepReady}>
                                {step < 4
                                    ? <>Continue<ArrowRight className="h-4 w-4" /></>
                                    : paying ? 'Placing your order' : <>Pay {quote ? formatCurrency(quote.totalPaid) : ''}<ArrowRight className="h-4 w-4" /></>}
                            </ClayButton>

                            {step > 1 && (
                                <button type="button" onClick={() => setStep(step - 1)} disabled={paying} className={cn('mx-auto flex items-center gap-1.5 rounded text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50', FOCUS)}>
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                                </button>
                            )}
                            {paying && <p className="sr-only" role="status"><Loader2 className="inline h-3 w-3 animate-spin" /> Placing your order</p>}
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
            <dd className={cn('tabular-nums', strong ? 'font-display text-xl font-bold' : 'font-semibold')}>{value}</dd>
        </div>
    )
}
