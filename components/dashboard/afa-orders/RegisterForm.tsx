'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { cn, formatCurrency, generateReferenceCode } from '@/lib/utils'
import { REGIONS, MIN_DOB_DATE, ageFrom, maskGcInput, validateGhanaCard, GC_HINT } from './meta'

const EMPTY_FORM = {
    full_name: '', phone: '', id_number: 'GHA-',
    date_of_birth: '', location: '', region: 'Greater Accra', notes: '',
}

interface RegisterFormProps {
    price: number
    priceLoading: boolean
    priceError: boolean
    pricingConfigured: boolean
    balance: number | null
    onPlaced: (newBalance: number | null) => void
    onViewOrders: () => void
}

/** The registration form, with a live summary and a confirm-then-pay dialog. Mirrors the airtime buy flow. */
export function RegisterForm({ price, priceLoading, priceError, pricingConfigured, balance, onPlaced, onViewOrders }: RegisterFormProps) {
    const [form, setForm] = useState({ ...EMPTY_FORM })
    const [gcError, setGcError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [placed, setPlaced] = useState<{ duplicate: boolean } | null>(null)
    const [reference, setReference] = useState('')

    const onGcChange = (raw: string) => {
        const masked = maskGcInput(raw)
        setForm(p => ({ ...p, id_number: masked }))
        setGcError(masked.length > 4 ? validateGhanaCard(masked) : null)
    }

    const canAfford = balance !== null && balance >= price
    const ready = !priceLoading && !priceError && pricingConfigured

    const openConfirm = (e: React.FormEvent) => {
        e.preventDefault()
        const gcCheck = validateGhanaCard(form.id_number)
        if (!form.id_number || form.id_number === 'GHA-' || gcCheck) {
            setGcError(gcCheck || GC_HINT)
            toast.error('Check the Ghana Card number', { description: GC_HINT })
            return
        }
        if (!form.date_of_birth) { toast.error('Add a date of birth'); return }
        if (ageFrom(form.date_of_birth) < 18) { toast.error('The applicant must be 18 or older'); return }
        setReference(generateReferenceCode())
        setPlaced(null)
        setConfirming(true)
    }

    const submit = async () => {
        setSubmitting(true)
        try {
            const res = await fetch('/api/user/afa-registration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    referenceCode: reference,
                    formData: {
                        full_name: form.full_name,
                        phone: form.phone,
                        id_type: 'Ghana Card',
                        id_number: form.id_number.trim(),
                        date_of_birth: form.date_of_birth,
                        location: form.location,
                        region: form.region,
                        notes: form.notes,
                    },
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (json?.error === 'INSUFFICIENT_BALANCE') {
                    toast.error(`You need ${formatCurrency(price)} but have ${formatCurrency(balance ?? 0)}`)
                    return
                }
                throw new Error(json?.error || 'Could not submit this registration')
            }
            setPlaced({ duplicate: !!json?.isDuplicate })
            onPlaced(typeof json?.new_balance === 'number' ? json.new_balance : null)
        } catch (e: any) {
            toast.error(e.message || 'Could not submit this registration')
        } finally {
            setSubmitting(false)
        }
    }

    const closeConfirm = () => {
        if (submitting) return
        const wasPlaced = !!placed
        setConfirming(false)
        if (wasPlaced) {
            setForm({ ...EMPTY_FORM })
            setGcError(null)
        }
    }

    if (!priceLoading && !pricingConfigured) {
        return (
            <div className="surface rounded-3xl p-8 text-center">
                <p className="font-display text-lg font-semibold">Registration isn&apos;t open for your account yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Ask your recruiter to switch this on for you, then come back.</p>
            </div>
        )
    }

    if (!priceLoading && priceError) {
        return (
            <div className="surface rounded-3xl p-8 text-center">
                <p className="font-display text-lg font-semibold">We can&apos;t load the registration fee</p>
                <p className="mt-1 text-sm text-muted-foreground">Check your connection and refresh the page.</p>
            </div>
        )
    }

    return (
        <div className="grid max-w-2xl gap-6 xl:max-w-none xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <form onSubmit={openConfirm} className="min-w-0 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Full name</Label>
                        <Input required disabled={submitting} value={form.full_name} maxLength={100}
                            onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                            placeholder="As it appears on the Ghana Card" className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Phone number</Label>
                        <Input required type="tel" disabled={submitting} value={form.phone}
                            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="024xxxxxxx" className="h-11" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Ghana Card number</Label>
                    <Input required disabled={submitting} value={form.id_number} aria-invalid={!!gcError}
                        onChange={e => onGcChange(e.target.value)}
                        placeholder="GHA-XXXXXXXXX-X"
                        className={cn('h-11 font-mono', gcError && 'ring-2 ring-red-500')} />
                    <p className={cn('text-xs', gcError ? 'font-medium text-red-500' : 'text-muted-foreground')}>{gcError || GC_HINT}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Date of birth</Label>
                        <Input required type="date" disabled={submitting} value={form.date_of_birth} max={MIN_DOB_DATE}
                            onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Region</Label>
                        <Select disabled={submitting} value={form.region} onValueChange={v => setForm(p => ({ ...p, region: v }))}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Town / area</Label>
                    <Input required disabled={submitting} value={form.location} maxLength={100}
                        onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                        placeholder="e.g. Kumasi" className="h-11" />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Input disabled={submitting} value={form.notes} maxLength={500}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Anything we should know" className="h-11" />
                </div>

                <Button type="submit" className="h-12 w-full text-base" disabled={!ready || !!gcError}>
                    Review &amp; continue
                </Button>
            </form>

            <aside aria-label="Summary" className="surface min-w-0 space-y-4 rounded-3xl p-5 xl:sticky xl:top-24">
                <h2 className="font-display text-lg font-semibold">Summary</h2>

                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Registration fee</span>
                    <span className="font-display text-lg font-bold tabular-nums">{priceLoading ? '—' : formatCurrency(price)}</span>
                </div>

                {balance !== null && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Wallet <span className="font-semibold text-foreground">{formatCurrency(balance)}</span></span>
                        {!priceLoading && canAfford && <span>After <span className="font-semibold text-foreground">{formatCurrency(balance - price)}</span></span>}
                    </div>
                )}

                {!priceLoading && balance !== null && !canAfford && (
                    <div className="space-y-2">
                        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                            <AlertCircle className="h-4 w-4" /> You need {formatCurrency(price)} but have {formatCurrency(balance)}.
                        </p>
                        <Button asChild className="h-11 w-full"><Link href="/dashboard/wallet">Top up wallet</Link></Button>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    One registration per person. Membership doesn&apos;t expire, so double-check the details — an application can&apos;t be edited once it&apos;s submitted.
                </p>
            </aside>

            <Dialog open={confirming} onOpenChange={open => { if (!open) closeConfirm() }}>
                <DialogContent
                    hideCloseButton
                    aria-describedby={undefined}
                    className="gap-0 overflow-hidden p-0 sm:max-w-md max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
                    onInteractOutside={e => { if (submitting) e.preventDefault() }}
                >
                    <DialogDescription className="sr-only">Review and pay for this AFA registration</DialogDescription>
                    <DialogClose
                        disabled={submitting}
                        className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>

                    <div className="space-y-5 px-6 pb-7 pt-8">
                        {placed ? (
                            <div className="flex flex-col items-center gap-2 text-center">
                                <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full">
                                    <CheckCircle2 className="h-8 w-8" />
                                </span>
                                <DialogTitle className="font-display text-xl font-semibold">
                                    {placed.duplicate ? 'Already submitted' : 'Registration submitted'}
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground">We&apos;ll process it within 24 hours — it&apos;ll show as Pending until then.</p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 pr-8">
                                <span className="well flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl">
                                    <ShieldCheck className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <DialogTitle className="font-display text-xl font-semibold">Confirm registration</DialogTitle>
                                    <p className="text-sm text-muted-foreground">Check the details before you pay.</p>
                                </div>
                            </div>
                        )}

                        <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                            {([
                                ['Full name', form.full_name],
                                ['Phone', form.phone],
                                ['Ghana Card', form.id_number],
                                ['Region', form.region],
                                ['Town', form.location],
                            ] as const).map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="font-semibold text-right">{value || '—'}</dd>
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                <dt className="font-medium">{placed ? 'Paid' : 'Total to pay'}</dt>
                                <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(price)}</dd>
                            </div>
                        </dl>

                        {placed ? (
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={closeConfirm}>Register another</Button>
                                <Button className="flex-1" onClick={() => { closeConfirm(); onViewOrders() }}>View my registrations</Button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={closeConfirm} disabled={submitting}>Cancel</Button>
                                <Button className="flex-1" onClick={submit} disabled={submitting}>
                                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay ${formatCurrency(price)}`}
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
