'use client'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Smartphone, CheckCircle2, AlertTriangle, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { NetworkIcon } from '@/components/network-icon'
import { useChargePolling } from './useChargePolling'
import { StorefrontTermsGate } from './StorefrontTermsGate'
import { storefrontNeedsAccept, recordStorefrontAccept, getStoredStorefrontVersion } from '@/lib/storefront-terms'
import type { CurrentTerms } from '@/lib/terms'

const MOMO_PREFIX: Record<string, 'MTN' | 'Telecel' | 'AT'> = {
    '024': 'MTN', '025': 'MTN', '053': 'MTN', '054': 'MTN', '055': 'MTN', '059': 'MTN',
    '020': 'Telecel', '050': 'Telecel',
    '026': 'AT', '027': 'AT', '056': 'AT', '057': 'AT',
}
const FIELD = 'neu-inset mt-2 h-12 w-full rounded-xl border-0 px-4 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500'
const PROVIDERS: Array<{ id: 'MTN' | 'Telecel' | 'AT'; label: string; dot: string }> = [
    { id: 'MTN', label: 'MTN', dot: 'bg-amber-400' },
    { id: 'Telecel', label: 'Telecel', dot: 'bg-red-600' },
    { id: 'AT', label: 'AirtelTigo', dot: 'bg-brand-600' },
]

// Normalize a Ghana number to local 0XXXXXXXXX form (converts a 233 prefix), capped to 10 digits.
function toLocalMomo(v: string): string {
    const d = (v || '').replace(/\D/g, '')
    return (d.startsWith('233') ? '0' + d.slice(3) : d).slice(0, 10)
}

/**
 * Service-agnostic descriptor. Each storefront product (data / airtime / mashup / RC)
 * injects only what differs; the proven charge → OTP → poll → success machine is shared.
 */
export interface ChargeDescriptor {
    title: string                 // header line, e.g. "MTN · 5GB"
    network?: string              // colored header style via styleFor(); omit for non-network products (RC)
    amountLabel: string           // right-side header amount, e.g. formatCurrency(total)
    chargeUrl: string             // e.g. '/api/shop/charge' or '/api/shop/results-checker/charge'
    statusUrl: string             // matching status endpoint for polling
    beneficiary: { label: string; hint: string } | null  // null = no separate recipient (charge the MoMo number directly)
    // Pre-fills the MoMo field when the recipient was already collected upstream (e.g. airtime/
    // mashup's own recipient-number field) — stays editable, it's just a starting guess that the
    // payer and recipient are the same line. Ignored when `beneficiary` is set (that flow already
    // has its own "use this number for MoMo" carry-forward).
    initialMomoPhone?: string
    email: { hint: string } | null   // null = hide the email field (recipient/email already captured upstream)
    successText: (ctx: { beneficiary: string; momoPhone: string }) => string
    // Shown when payment is confirmed but the product is NOT yet delivered (backorder /
    // delayed fulfilment). Never reveals secrets. Defaults to a generic "being processed" line.
    receivedText?: (ctx: { beneficiary: string; momoPhone: string }) => string
    buildBody: (ctx: { beneficiary: string; momoPhone: string; provider: 'MTN' | 'Telecel' | 'AT'; email?: string }) => Record<string, unknown>
    onPaid?: (reference: string) => void   // fired once on confirmed+FULFILLED payment (RC uses it to reveal vouchers)
}

type Step = 'form' | 'charging' | 'otp' | 'pending' | 'received' | 'success' | 'failed'

export function ServiceChargeSheet({
    open, onClose, descriptor, brandName,
}: {
    open: boolean
    onClose: () => void
    descriptor: ChargeDescriptor | null
    brandName: string
}) {
    const [step, setStep] = useState<Step>('form')
    // Beneficiary = the number that RECEIVES the product (data/airtime/voucher SMS).
    const [beneficiaryPhone, setBeneficiaryPhone] = useState('')
    // MoMo number = the wallet that gets CHARGED.
    const [momoPhone, setMomoPhone] = useState('')
    const [provider, setProvider] = useState<'MTN' | 'Telecel' | 'AT' | ''>('')
    const [autoDetected, setAutoDetected] = useState(false)
    const [useSameForMomo, setUseSameForMomo] = useState(true)
    const [email, setEmail] = useState('')
    const [reference, setReference] = useState('')
    const [displayText, setDisplayText] = useState('')
    const [otp, setOtp] = useState('')
    const [total, setTotal] = useState<number | null>(null)
    const [failedMessage, setFailedMessage] = useState('')
    // Guest terms gate (storefront buyers aren't logged in).
    const [showTermsGate, setShowTermsGate] = useState(false)
    const [storefrontTerms, setStorefrontTerms] = useState<CurrentTerms | null>(null)

    const hasBeneficiary = !!descriptor?.beneficiary
    // Reference is needed inside the (memoized) poll callbacks — a ref avoids stale closures.
    const refForPaid = useRef('')

    const { start, stop, iHavePaid, pollCount, checking, PATIENT_POLLS } = useChargePolling(
        () => { setStep('success'); if (refForPaid.current) descriptor?.onPaid?.(refForPaid.current) },
        () => setStep('failed'),
        descriptor?.statusUrl,
        // Payment confirmed but not yet fulfilled — surface a holding screen and KEEP polling.
        // Deliberately does NOT call descriptor.onPaid (which would reveal not-yet-existing vouchers).
        () => setStep(prev => (prev === 'success' ? prev : 'received')),
    )

    useEffect(() => {
        if (open) {
            setStep('form'); setBeneficiaryPhone('')
            // Carried forward from the recipient collected upstream (still fully editable) when
            // this flow has no separate beneficiary field of its own.
            setMomoPhone(!descriptor?.beneficiary ? toLocalMomo(descriptor?.initialMomoPhone || '') : '')
            setProvider(''); setAutoDetected(false)
            // Off by default: the payer and recipient are frequently different people (buying
            // data for someone else), so defaulting to "same number" pre-fills a MoMo field the
            // buyer then has to notice and correct. Ticking it on is what pulls the beneficiary
            // number into the MoMo field (see the sync effect below).
            setUseSameForMomo(false); setEmail('')
            setReference(''); refForPaid.current = ''; setOtp(''); setDisplayText(''); setTotal(null); setFailedMessage(''); setShowTermsGate(false)
        } else stop()
    }, [open, descriptor, stop])

    // Keep the MoMo number synced to the beneficiary while the "use same number" box is ticked.
    useEffect(() => {
        if (useSameForMomo && hasBeneficiary) setMomoPhone(toLocalMomo(beneficiaryPhone))
    }, [useSameForMomo, hasBeneficiary, beneficiaryPhone])

    // Auto-detect the MoMo network from the number being charged.
    useEffect(() => {
        if (momoPhone.length >= 3) {
            const found = MOMO_PREFIX[momoPhone.slice(0, 3)]
            if (found) { setProvider(found); setAutoDetected(true) } else setAutoDetected(false)
        } else setAutoDetected(false)
    }, [momoPhone])

    const toggleSameForMomo = () => {
        if (useSameForMomo) { setUseSameForMomo(false); setMomoPhone('') }
        else { setUseSameForMomo(true); setMomoPhone(toLocalMomo(beneficiaryPhone)) }
    }

    // Synchronous re-entry guard: `step` only flips to 'charging' after the terms fetch
    // resolves, so without this a second tap in that window starts a second charge.
    const authorizingRef = useRef(false)

    const authorize = async () => {
        if (!descriptor || authorizingRef.current) return
        authorizingRef.current = true
        try {
            await runAuthorize()
        } finally {
            authorizingRef.current = false
        }
    }

    const runAuthorize = async () => {
        if (!descriptor) return

        // Guest terms gate — block the first charge until the current agreement is accepted.
        let terms = storefrontTerms
        if (!terms) {
            try {
                const r = await fetch('/api/terms/current')
                const j = await r.json()
                if (j?.success) { terms = j.data as CurrentTerms; setStorefrontTerms(terms) }
            } catch { /* terms unavailable — fail open rather than block a sale */ }
        }
        if (terms && storefrontNeedsAccept(terms.minAcceptableVersion)) {
            setShowTermsGate(true)
            return
        }
        if (!terms && !getStoredStorefrontVersion()) {
            // Couldn't load the current terms and this guest has never accepted — block
            // rather than fail open (a blocked /api/terms/current must not bypass consent).
            toast.error('Could not load Terms & Conditions. Please refresh and try again.')
            return
        }

        const beneficiary = hasBeneficiary ? beneficiaryPhone.replace(/\s+/g, '') : momoPhone
        if (hasBeneficiary && !/^(0\d{9}|233\d{9})$/.test(beneficiary)) {
            toast.error(`Enter the ${descriptor.beneficiary!.label.toLowerCase()}`)
            return
        }
        if (!/^0[0-9]{9}$/.test(momoPhone)) {
            toast.error('Enter a valid Mobile Money number (e.g. 0241234567)')
            return
        }
        if (!provider) {
            toast.error('Select your mobile money network')
            return
        }
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            toast.error('Enter a valid email or leave it blank')
            return
        }

        setStep('charging')
        try {
            const res = await fetch(descriptor.chargeUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(descriptor.buildBody({ beneficiary, momoPhone, provider, email: email.trim() || undefined })),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (data.needsManualSelection) { setProvider(''); setAutoDetected(false); setStep('form'); toast.error('Select your MoMo network.'); return }
                throw new Error(data.error || `Payment service error (HTTP ${res.status})`)
            }
            setReference(data.reference); refForPaid.current = data.reference; setDisplayText(data.display_text || '')
            if (typeof data.total === 'number') setTotal(data.total)
            if (data.status === 'send_otp') setStep('otp')
            else if (data.status === 'success') { setStep('pending'); start(data.reference) }
            else if (data.status === 'failed') throw new Error(data.display_text || 'Payment could not be processed')
            else { setStep('pending'); start(data.reference) }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Payment failed'
            toast.error(msg); setFailedMessage(msg); setStep('failed')
        }
    }

    const submitOtp = async () => {
        if (!otp.trim() || step === 'charging') { if (!otp.trim()) toast.error('Enter the OTP'); return }
        setStep('charging')
        try {
            // The OTP route accepts both SHOP- and RC- references, so it is shared across services.
            const res = await fetch('/api/shop/charge/submit-otp', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference, otp }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || `OTP submission failed (HTTP ${res.status})`)
            setDisplayText(data.display_text || '')
            if (typeof data.total === 'number') setTotal(data.total)
            // Hubtel's pre-charge verification replays the charge under a NEW reference
            // (the transient UTLV- verify-reference is never the thing that gets polled) —
            // Paystack's own submit-otp response never includes `reference`, so this stays
            // a no-op there and keeps polling the original charge-time reference.
            const pollRef = data.reference || reference
            if (data.reference && data.reference !== reference) { setReference(data.reference); refForPaid.current = data.reference }
            if (data.status === 'success') { setStep('pending'); start(pollRef) }
            else if (data.status === 'send_otp') { setOtp(''); setStep('otp'); toast.info(data.display_text || 'Re-enter OTP') }
            else if (data.status === 'failed') throw new Error(data.display_text || 'Payment failed')
            else { setStep('pending'); start(pollRef) }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'OTP failed'
            toast.error(msg); setFailedMessage(msg); setStep('failed')
        }
    }

    const beneficiaryDisplay = hasBeneficiary ? beneficiaryPhone.replace(/\s+/g, '') : momoPhone

    if (!descriptor) return null

    return (
        <>
        <Dialog open={open} onOpenChange={(o) => { if (!o && (step === 'form' || step === 'success' || step === 'received' || step === 'failed')) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                onInteractOutside={(e) => { if (step !== 'form' && step !== 'success' && step !== 'received' && step !== 'failed') e.preventDefault() }}
                onEscapeKeyDown={(e) => { if (step !== 'form' && step !== 'success' && step !== 'received' && step !== 'failed') e.preventDefault() }}
                className="!fixed !left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0 w-full max-w-full sm:max-w-md sm:mx-auto rounded-t-[2rem] rounded-b-none p-0 gap-0 bg-neu shadow-[0_-18px_40px_rgba(0,0,0,0.35)] border-x-0 border-b-0 border-t-0 max-h-[92dvh] overflow-y-auto overscroll-contain"
            >
                <DialogTitle className="sr-only">{descriptor.title}</DialogTitle>
                <div className="relative flex items-center justify-center pt-3 pb-1">
                    <div className="h-1 w-9 rounded-full bg-foreground/15" />
                    {(step === 'form' || step === 'success' || step === 'received' || step === 'failed') && (
                        <button onClick={onClose} className="neu-raised-sm neu-press absolute right-4 top-2 flex h-9 w-9 items-center justify-center rounded-full" aria-label="Close">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Order summary: a black plate, like the stage on the page behind */}
                <div className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-black px-4 py-3.5 text-white">
                    <div className="flex min-w-0 items-center gap-3">
                        {descriptor.network && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10"><NetworkIcon network={descriptor.network} size={22} /></span>}
                        <span className="truncate font-display text-lg font-bold tracking-tight">{descriptor.title}</span>
                    </div>
                    <span className="font-display text-lg font-bold tabular-nums text-brand-400">{descriptor.amountLabel}</span>
                </div>

                <div className="space-y-5 px-5 pb-10 pt-5">
                    {step === 'form' && (
                        <>
                            {hasBeneficiary && (
                                <>
                                    <div>
                                        <label htmlFor="sheet-beneficiary" className="text-sm font-semibold text-foreground">
                                            {descriptor.beneficiary!.label} <span className="font-normal text-muted-foreground">{descriptor.beneficiary!.hint}</span>
                                        </label>
                                        <input
                                            id="sheet-beneficiary"
                                            inputMode="numeric" placeholder="024 123 4567" value={beneficiaryPhone}
                                            onChange={(e) => setBeneficiaryPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                                            className={FIELD}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={toggleSameForMomo}
                                        className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <span className={cn(
                                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                            useSameForMomo ? 'clay-gold' : 'neu-inset'
                                        )}>
                                            {useSameForMomo && <Check className="h-3 w-3" strokeWidth={3} />}
                                        </span>
                                        I am paying from this same number
                                    </button>
                                </>
                            )}

                            <div>
                                <label htmlFor="sheet-momo" className="text-sm font-semibold text-foreground">
                                    Mobile Money number <span className="font-normal text-muted-foreground">(the one paying)</span>
                                </label>
                                <input
                                    id="sheet-momo"
                                    inputMode="numeric" placeholder="024 123 4567" value={momoPhone}
                                    onChange={(e) => setMomoPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    disabled={useSameForMomo && hasBeneficiary}
                                    className={cn(FIELD, useSameForMomo && hasBeneficiary && 'cursor-not-allowed opacity-60')}
                                />
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    Network {autoDetected && provider && <span className="ml-2 text-xs font-medium text-muted-foreground">we picked this from your number</span>}
                                </p>
                                <div role="radiogroup" aria-label="Mobile money network" className="mt-2 grid grid-cols-3 gap-2.5">
                                    {PROVIDERS.map(p => (
                                        <button key={p.id} type="button" role="radio" aria-checked={provider === p.id}
                                            onClick={() => { setProvider(p.id); setAutoDetected(false) }}
                                            className={cn('flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold text-foreground',
                                                provider === p.id ? 'neu-inset ring-2 ring-black dark:ring-brand-500' : 'neu-raised-sm neu-press')}>
                                            <span className={cn('h-2.5 w-2.5 rounded-full', p.dot)} /> {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {descriptor.email && (
                                <div>
                                    <label htmlFor="sheet-email" className="text-sm font-semibold text-foreground">
                                        Email <span className="font-normal text-muted-foreground">{descriptor.email.hint}</span>
                                    </label>
                                    <input
                                        id="sheet-email"
                                        type="email" inputMode="email" placeholder="you@example.com" value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={FIELD}
                                    />
                                </div>
                            )}

                            <button onClick={authorize} className="clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                                <Smartphone className="h-5 w-5" /> Pay with Mobile Money
                            </button>
                            <p className="text-center text-xs text-muted-foreground">A small processing fee is added. You will see the exact total on your phone before you approve.</p>
                        </>
                    )}

                    {step === 'charging' && (
                        <div className="flex flex-col items-center gap-3 py-10"><Loader2 className="h-9 w-9 animate-spin text-foreground" /><p className="font-display text-lg font-bold text-foreground">Sending the prompt…</p></div>
                    )}

                    {step === 'otp' && (
                        <div className="space-y-4">
                            <p className="text-center text-sm font-medium text-foreground">{displayText || 'Enter the code we just sent to your phone.'}</p>
                            <input aria-label="Verification code" inputMode="numeric" placeholder="······" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6}
                                className="neu-inset h-14 w-full rounded-xl border-0 text-center font-mono text-2xl tracking-[0.4em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500" />
                            <button onClick={submitOtp} disabled={!otp} className="clay-gold flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-base font-semibold disabled:opacity-60">Confirm code</button>
                            <button onClick={() => { stop(); setStep('form') }} className="w-full text-sm text-muted-foreground hover:text-foreground">Go back</button>
                        </div>
                    )}

                    {step === 'pending' && (
                        <div className="flex flex-col items-center gap-5 py-4 text-center">
                            <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"><Smartphone className="h-8 w-8" /></span>
                            <div className="space-y-1.5">
                                <p className="font-display text-2xl font-bold tracking-tight text-foreground">
                                    {total != null ? `Approve GHS ${total.toFixed(2)}` : 'Approve on your phone'}
                                </p>
                                <p className="text-sm text-muted-foreground">Enter your MoMo PIN on the prompt sent to <span className="font-semibold text-foreground">{momoPhone}</span>. We will pick it up as soon as you do.</p>
                            </div>
                            <button onClick={async () => { const o = await iHavePaid(refForPaid.current); if (o === 'pending') toast.info("Nothing yet. Approve the prompt on your phone, then try again.") }}
                                disabled={checking} className="clay-black flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-60">
                                {checking ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking…</> : <><CheckCircle2 className="h-5 w-5" /> I have approved it</>}
                            </button>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{pollCount >= PATIENT_POLLS ? "Taking longer than usual. Once you approve, it will go through on its own." : 'Waiting for your approval…'}</span>
                            </div>
                            <button onClick={() => { stop(); onClose() }} className="text-sm text-muted-foreground hover:text-foreground">Close for now</button>
                        </div>
                    )}

                    {step === 'received' && (
                        <div className="flex flex-col items-center gap-5 py-6 text-center">
                            <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"><CheckCircle2 className="h-8 w-8" /></span>
                            <div>
                                <p className="font-display text-2xl font-bold tracking-tight text-foreground">We have your payment</p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {descriptor.receivedText
                                        ? descriptor.receivedText({ beneficiary: beneficiaryDisplay, momoPhone })
                                        : "Your order is being prepared. You will be told the moment it is delivered."}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /><span>Finishing up…</span>
                            </div>
                            <button onClick={onClose} className="clay-black flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-base font-semibold">Done</button>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center gap-5 py-6 text-center">
                            <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"><CheckCircle2 className="h-8 w-8" /></span>
                            <div>
                                <p className="font-display text-2xl font-bold tracking-tight text-foreground">All done.</p>
                                <p className="mt-2 text-sm text-muted-foreground">{descriptor.successText({ beneficiary: beneficiaryDisplay, momoPhone })}</p>
                            </div>
                            <button onClick={onClose} className="clay-black flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-base font-semibold">Done</button>
                        </div>
                    )}

                    {step === 'failed' && (
                        <div className="flex flex-col items-center gap-4 py-6 text-center">
                            <span className="neu-inset flex h-16 w-16 items-center justify-center rounded-full"><AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" /></span>
                            <p className="font-display text-xl font-bold tracking-tight text-foreground">That payment did not go through</p>
                            {failedMessage && <p className="text-sm text-muted-foreground">{failedMessage}</p>}
                            <button onClick={() => setStep('form')} className="clay-black flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-base font-semibold">Try again</button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
        <StorefrontTermsGate
            open={showTermsGate}
            terms={storefrontTerms}
            brandName={brandName}
            onAccept={() => { if (storefrontTerms) recordStorefrontAccept(storefrontTerms.version); setShowTermsGate(false); void authorize() }}
            onCancel={() => setShowTermsGate(false)}
        />
        </>
    )
}
