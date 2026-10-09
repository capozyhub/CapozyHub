'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Phone, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'
import { quoteAirtime } from '@/lib/airtime-pricing'
import { calcMashupBundle, type BundlePreference } from '@/lib/mashup-bundle'
import { getNetworkFromPrefix, validateGhanaianPhone } from '@/lib/phone-validation'
import { QUICK_AMOUNTS, carrierToNetwork, type AirtimeNetwork, type PurchaseMode } from './meta'
import { isMashupEnabled, isNetworkEnabled } from './use-airtime-settings'
import { NetworkPicker } from './NetworkPicker'
import { MashupEstimate, MashupPreference } from './MashupOptions'
import { PriceBreakdown } from './PriceBreakdown'
import { OrderDialog, type OrderDraft } from './OrderDialog'

interface BuyFormProps {
    settings: Record<string, string> | null
    /** The buyer's EFFECTIVE pricing role (lapsed agents and dealers price as customers). */
    role: string
    balance: number | null
    onPlaced: (newBalance: number | null) => void
    onViewHistory: () => void
}

export function BuyForm({ settings, role, balance, onPlaced, onViewHistory }: BuyFormProps) {
    const mashupAvailable = isMashupEnabled(settings)

    const [mode, setMode] = useState<PurchaseMode>('airtime')
    const [network, setNetwork] = useState<AirtimeNetwork | null>(null)
    const [networkChosen, setNetworkChosen] = useState(false)
    const [phone, setPhone] = useState('')
    const [amount, setAmount] = useState('')
    const [feeOnTop, setFeeOnTop] = useState(true)
    const [bundlePreference, setBundlePreference] = useState<BundlePreference>('balanced')
    const [draft, setDraft] = useState<OrderDraft | null>(null)

    useEffect(() => {
        if (mode === 'mashup' && !mashupAvailable) setMode('airtime')
    }, [mode, mashupAvailable])

    const effectiveNetwork: AirtimeNetwork | null = mode === 'mashup' ? 'MTN' : network
    const typed = parseFloat(amount) || 0

    const phoneCheck = useMemo(() => (phone.length === 10 ? validateGhanaianPhone(phone) : null), [phone])
    const detected = carrierToNetwork(phoneCheck?.network)
    const phoneError = phoneCheck && !phoneCheck.isValid ? phoneCheck.error || 'Invalid phone number' : ''
    const networkMismatch = !phoneError && detected && effectiveNetwork && detected !== effectiveNetwork
        ? `This number looks like ${detected}, not ${effectiveNetwork}. Check before you pay.`
        : ''

    // The very same arithmetic and limits the server applies when the order is placed.
    const quoted = useMemo(() => {
        if (typed <= 0 || !effectiveNetwork || !settings) return null
        return quoteAirtime({ settings, network: effectiveNetwork, role, amount: typed, useExactAmount: feeOnTop, orderType: mode })
    }, [typed, effectiveNetwork, settings, role, feeOnTop, mode])

    const quote = quoted?.ok ? quoted.quote : null
    const amountError = quoted && !quoted.ok ? quoted.message : ''
    const bundle = useMemo(() => (mode === 'mashup' ? calcMashupBundle(typed, bundlePreference) : null), [mode, typed, bundlePreference])

    const canAfford = quote !== null && balance !== null && balance >= quote.totalPaid
    const ready = !!quote && !!phoneCheck?.isValid && !!effectiveNetwork && canAfford

    const onPhoneChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10)
        setPhone(digits)
        // Follow the number's carrier until the member picks a network themselves.
        if (!networkChosen && digits.length >= 3) {
            const net = carrierToNetwork(getNetworkFromPrefix(digits.slice(0, 3)))
            if (net) setNetwork(net)
        }
        if (digits.length === 0 && !networkChosen) setNetwork(null)
    }

    const proceed = () => {
        if (!ready || !quote || !effectiveNetwork || !phoneCheck) return
        setDraft({
            network: effectiveNetwork,
            phone: phoneCheck.normalizedNumber,
            mode,
            amount: typed,
            feeOnTop,
            bundlePreference,
            quote,
            bundle,
        })
    }

    const afterPlaced = (newBalance: number | null) => {
        onPlaced(newBalance)
        setPhone('')
        setAmount('')
        setNetwork(null)
        setNetworkChosen(false)
    }

    return (
        <div className="space-y-5">
            {mashupAvailable && (
                <div role="tablist" aria-label="Product" className="well flex gap-1 rounded-2xl p-1">
                    {([['airtime', 'Airtime', Phone], ['mashup', 'MTN Mashup', Zap]] as const).map(([key, label, Icon]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={mode === key}
                            onClick={() => setMode(key)}
                            className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', mode === key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                        >
                            <Icon className="h-4 w-4" /> {label}
                        </button>
                    ))}
                </div>
            )}

            {mode === 'airtime' ? (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Network</p>
                    <NetworkPicker
                        selected={network}
                        isEnabled={n => isNetworkEnabled(settings, n)}
                        onSelect={n => { setNetwork(n); setNetworkChosen(true) }}
                    />
                </div>
            ) : (
                <>
                    <div className="neu-inset rounded-2xl px-4 py-3">
                        <p className="text-sm font-semibold">MTN Mashup bundle</p>
                        <p className="text-xs text-muted-foreground">Data and voice minutes in one bundle, for MTN numbers.</p>
                    </div>
                    <MashupPreference value={bundlePreference} onChange={setBundlePreference} />
                </>
            )}

            <div className="space-y-1.5">
                <Label htmlFor="beneficiary-phone" className="text-sm font-medium">Beneficiary number</Label>
                <div className="relative">
                    <Input
                        id="beneficiary-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0241234567"
                        value={phone}
                        onChange={e => onPhoneChange(e.target.value)}
                        aria-invalid={!!phoneError}
                        aria-describedby="phone-help"
                        className={cn('h-12 pr-10 font-mono text-base font-semibold', phoneError && 'ring-2 ring-red-500')}
                    />
                    {phoneCheck?.isValid && <CheckCircle2 className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" aria-hidden />}
                </div>
                <p id="phone-help" role={phoneError || networkMismatch ? 'alert' : undefined} className={cn('min-h-4 text-xs', phoneError ? 'font-medium text-red-500' : networkMismatch ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground')}>
                    {phoneError || networkMismatch || (phone.length > 0 && phone.length < 10 ? `${10 - phone.length} more digits` : '')}
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="airtime-amount" className="text-sm font-medium">Amount (GHS)</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
                    {QUICK_AMOUNTS.map(q => (
                        <button
                            key={q}
                            type="button"
                            aria-pressed={typed === q}
                            onClick={() => setAmount(String(q))}
                            className={cn('rounded-xl px-4 py-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', typed === q ? 'clay-gold' : 'neu-raised-sm neu-press')}
                        >
                            {q}
                        </button>
                    ))}
                </div>
                <Input
                    id="airtime-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    aria-invalid={!!amountError}
                    className={cn('h-12 text-base font-semibold tabular-nums', amountError && 'ring-2 ring-red-500')}
                />
                {amountError && (
                    <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-500"><AlertCircle className="h-3.5 w-3.5" /> {amountError}</p>
                )}
            </div>

            <label className="neu-raised-sm flex cursor-pointer items-start gap-3 rounded-2xl p-4">
                <input
                    type="checkbox"
                    checked={feeOnTop}
                    onChange={e => setFeeOnTop(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span className="min-w-0">
                    <span className="block text-sm font-semibold">Add the fee on top</span>
                    <span className="block text-xs text-muted-foreground">
                        {feeOnTop ? 'They get exactly the amount you enter. The fee is added to what you pay.' : 'You pay exactly the amount you enter. The fee comes out of what they get.'}
                    </span>
                </span>
            </label>

            {bundle && typed > 0 && <MashupEstimate bundle={bundle} />}
            {quote && <PriceBreakdown quote={quote} typed={typed} mode={mode} feeOnTop={feeOnTop} />}

            {quote && balance !== null && !canAfford ? (
                <div className="space-y-2">
                    <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                        <AlertCircle className="h-4 w-4" /> You need {formatCurrency(quote.totalPaid)} but have {formatCurrency(balance)}.
                    </p>
                    <Button asChild className="h-12 w-full text-base"><Link href="/dashboard/wallet">Top up wallet</Link></Button>
                </div>
            ) : (
                <Button className="h-12 w-full text-base" disabled={!ready} onClick={proceed}>
                    {quote ? `Continue · ${formatCurrency(quote.totalPaid)}` : 'Continue'}
                </Button>
            )}

            <OrderDialog draft={draft} onClose={() => setDraft(null)} onPlaced={afterPlaced} onViewHistory={onViewHistory} />
        </div>
    )
}
