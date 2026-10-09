'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, Clock, GraduationCap, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { bulkTierFor, maxQuantityFor, unitPriceFor, type RCType } from './meta'
import { PurchaseDialog, type PurchaseDraft } from './PurchaseDialog'

interface BuyPanelProps {
    types: RCType[]
    enabled: boolean
    maxQty: number
    balance: number
    ownPhone?: string
    ownEmail?: string
    onPurchased: (newBalance: number | null) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function BuyPanel({ types, enabled, maxQty, balance, ownPhone, ownEmail, onPurchased }: BuyPanelProps) {
    const [typeId, setTypeId] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [draft, setDraft] = useState<PurchaseDraft | null>(null)

    const type = types.find(t => t.id === typeId)
    const cap = maxQuantityFor(type, maxQty)
    const unselectable = (t: RCType) => t.available_count === 0 || t.configured === false

    // Never hold a quantity above what the chosen type can supply.
    useEffect(() => { setQuantity(q => Math.min(Math.max(1, q), cap)) }, [cap])

    const unitPrice = type ? unitPriceFor(type, quantity) : 0
    const total = Math.round(unitPrice * quantity * 100) / 100
    const tier = type ? bulkTierFor(type, quantity) : null
    const canAfford = balance >= total

    const phoneError = useMemo(() => (phone.trim() && !validateGhanaianPhone(phone).isValid ? 'Enter a valid Ghana number' : ''), [phone])
    const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : ''
    const ready = !!type && !unselectable(type) && enabled && !phoneError && !emailError && canAfford

    const proceed = () => {
        if (!type || !ready) return
        setDraft({
            typeId: type.id,
            typeName: type.name,
            quantity,
            unitPrice,
            total,
            recipientPhone: phone.trim() ? validateGhanaianPhone(phone).normalizedNumber : '',
            recipientEmail: email.trim(),
        })
    }

    return (
        <div className="space-y-5">
            {!enabled && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p><span className="font-semibold">Results Checker is paused.</span> Please try again later.</p>
                </div>
            )}

            <div className={cn('space-y-5', !enabled && 'pointer-events-none opacity-50')}>
                <div className="space-y-2">
                    <p id="rc-exam" className="text-sm font-medium">Exam</p>
                    {types.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                            <Clock className="h-9 w-9 opacity-30" />
                            <p className="text-sm">No voucher types are available right now.</p>
                        </div>
                    ) : (
                        <div role="radiogroup" aria-labelledby="rc-exam" className="grid gap-2.5">
                            {types.map(t => {
                                const out = t.available_count === 0
                                const blocked = unselectable(t)
                                const active = typeId === t.id
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        disabled={blocked}
                                        onClick={() => setTypeId(active ? '' : t.id)}
                                        className={cn(
                                            'flex items-center gap-3 rounded-2xl p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                            active ? 'well ring-2 ring-primary/70' : 'neu-raised-sm neu-press',
                                            blocked && 'cursor-not-allowed opacity-50',
                                        )}
                                    >
                                        <span className="well flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"><GraduationCap className="h-5 w-5 text-primary" /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block break-words text-sm font-semibold leading-snug">{t.name}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {out ? 'Sold out' : t.configured === false ? 'Not available for your account' : (t.bulk_pricing?.length ? 'Bulk discounts available' : 'In stock')}
                                            </span>
                                        </span>
                                        <span className="flex-shrink-0 font-display text-base font-bold tabular-nums">{formatCurrency(t.price)}</span>
                                        <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')} aria-hidden>
                                            {active && <Check className="h-3 w-3" strokeWidth={3} />}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {type && !unselectable(type) && (
                    <>
                        {!!type.bulk_pricing?.length && (
                            <div className="neu-inset space-y-2 rounded-2xl p-4">
                                <p className="text-xs font-semibold">Bulk prices (each)</p>
                                <div className="flex flex-wrap gap-2">
                                    {type.bulk_pricing.map(b => {
                                        const on = quantity >= b.min_qty && quantity <= b.max_qty
                                        return (
                                            <span key={`${b.min_qty}-${b.max_qty}`} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', on ? 'clay-gold' : 'well text-muted-foreground')}>
                                                {b.min_qty}{b.max_qty >= 99999 ? '+' : `–${b.max_qty}`} · {formatCurrency(b.unit_price)}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label htmlFor="rc-qty" className="text-sm font-medium">Quantity</Label>
                                <p className="text-xs text-muted-foreground">Up to {cap}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" aria-label="Fewer" disabled={quantity <= 1} onClick={() => setQuantity(q => Math.max(1, q - 1))} className="neu-raised-sm neu-press flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Minus className="h-4 w-4" /></button>
                                <Input
                                    id="rc-qty"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={cap}
                                    value={quantity}
                                    onChange={e => setQuantity(Math.max(1, Math.min(cap, parseInt(e.target.value, 10) || 1)))}
                                    className="h-10 w-16 text-center font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button type="button" aria-label="More" disabled={quantity >= cap} onClick={() => setQuantity(q => Math.min(cap, q + 1))} className="neu-raised-sm neu-press flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="h-4 w-4" /></button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium">Also send to <span className="font-normal text-muted-foreground">(optional)</span></p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Input type="tel" inputMode="tel" aria-label="Recipient phone" aria-invalid={!!phoneError} placeholder="Phone, e.g. 0241234567" value={phone} onChange={e => setPhone(e.target.value)} className={cn('h-11', phoneError && 'ring-2 ring-red-500')} />
                                    {phoneError && <p role="alert" className="text-xs font-medium text-red-500">{phoneError}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Input type="email" aria-label="Recipient email" aria-invalid={!!emailError} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={cn('h-11', emailError && 'ring-2 ring-red-500')} />
                                    {emailError && <p role="alert" className="text-xs font-medium text-red-500">{emailError}</p>}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Leave both empty to send to your own phone and email. The vouchers always appear on screen too.</p>
                        </div>

                        <dl className="well space-y-2 rounded-2xl p-4 text-sm" aria-label="Price breakdown">
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Price each{tier ? ' (bulk)' : ''}</dt><dd className="font-semibold tabular-nums">{formatCurrency(unitPrice)}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Quantity</dt><dd className="font-semibold tabular-nums">{quantity}</dd></div>
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2"><dt className="font-medium">Total</dt><dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(total)}</dd></div>
                        </dl>

                        {!canAfford ? (
                            <div className="space-y-2">
                                <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-500"><AlertCircle className="h-4 w-4" /> You need {formatCurrency(total)} but have {formatCurrency(balance)}.</p>
                                <Button asChild className="h-12 w-full text-base"><Link href="/dashboard/wallet">Top up wallet</Link></Button>
                            </div>
                        ) : (
                            <Button className="h-12 w-full text-base" disabled={!ready} onClick={proceed}>Continue · {formatCurrency(total)}</Button>
                        )}
                    </>
                )}
            </div>

            <PurchaseDialog draft={draft} ownPhone={ownPhone} ownEmail={ownEmail} onClose={() => setDraft(null)} onPurchased={onPurchased} />
        </div>
    )
}