'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { AlertCircle, Gift, Loader2, Minus, Plus, RefreshCw, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { examLabel, nextBulkTier, type RCType } from './meta'
import type { QuoteState } from './use-quote'

const QUICK_QUANTITIES = [1, 2, 5, 10]

interface OrderPanelProps {
    type: RCType | undefined
    enabled: boolean
    cap: number
    qtyText: string
    qty: number | null
    quote: QuoteState
    balance: number
    giftOpen: boolean
    phone: string
    email: string
    phoneError: string
    emailError: string
    paying: boolean
    onQtyText: (text: string) => void
    onQtyCommit: () => void
    onQtyStep: (qty: number) => void
    onGiftToggle: (open: boolean) => void
    onPhone: (v: string) => void
    onEmail: (v: string) => void
    onRetryQuote: () => void
    onPay: () => void
}

/** The order on the right (below the exams on a phone): how many, who for, the price, and one Pay button. */
export const OrderPanel = forwardRef<HTMLElement, OrderPanelProps>(function OrderPanel(p, ref) {
    const { type, quote } = p
    const quoteOk = quote.status === 'ok' && quote.typeId === type?.id && quote.quantity === p.qty ? quote : null
    const total = quoteOk?.total ?? null
    const shortfall = total !== null ? Math.max(0, Math.round((total - p.balance) * 100) / 100) : 0
    const tier = type && p.qty ? nextBulkTier(type, p.qty) : null
    const canPay = !!quoteOk && shortfall === 0 && p.enabled && !p.phoneError && !p.emailError && !p.paying

    return (
        <aside ref={ref} aria-label="Your order" className="surface space-y-5 rounded-3xl p-5 xl:sticky xl:top-24">
            <h2 className="font-display text-lg font-semibold">Your order</h2>

            {!type ? (
                <p className="rounded-2xl bg-foreground/[0.04] p-4 text-sm text-muted-foreground">Pick an exam to see your price.</p>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-display text-xl font-bold leading-none">{examLabel(type.name)}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{type.name}</p>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                            <label htmlFor="rc-qty" className="text-sm font-medium">How many?</label>
                            <div className="flex items-center gap-2">
                                <button type="button" aria-label="One fewer" disabled={!p.qty || p.qty <= 1} onClick={() => p.qty && p.onQtyStep(p.qty - 1)} className="neu-raised-sm neu-press flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Minus className="h-4 w-4" /></button>
                                <Input
                                    id="rc-qty"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={p.qtyText}
                                    onChange={e => p.onQtyText(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    onBlur={p.onQtyCommit}
                                    aria-describedby="rc-qty-hint"
                                    className="h-10 w-16 text-center font-semibold"
                                />
                                <button type="button" aria-label="One more" disabled={!p.qty || p.qty >= p.cap} onClick={() => p.qty && p.onQtyStep(p.qty + 1)} className="neu-raised-sm neu-press flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="h-4 w-4" /></button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <p id="rc-qty-hint" className="text-xs text-muted-foreground">Up to {p.cap} at a time</p>
                            <div className="flex gap-1.5" role="group" aria-label="Quick quantities">
                                {QUICK_QUANTITIES.filter(q => q <= p.cap).map(q => (
                                    <button key={q} type="button" aria-pressed={p.qty === q} onClick={() => p.onQtyStep(q)} className={cn('rounded-lg px-3 py-1 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', p.qty === q ? 'clay-gold' : 'well text-muted-foreground hover:text-foreground')}>{q}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {tier && (
                        <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            <Tag className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            Get {tier.min_qty} or more and pay {formatCurrency(tier.unit_price)} each.
                        </p>
                    )}

                    <div>
                        <button
                            type="button"
                            aria-expanded={p.giftOpen}
                            onClick={() => p.onGiftToggle(!p.giftOpen)}
                            className="flex items-center gap-2 rounded-lg text-sm font-medium text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <Gift className="h-4 w-4" /> {p.giftOpen ? 'Buying for yourself instead' : 'Buying for someone else?'}
                        </button>
                        {p.giftOpen && (
                            <div className="mt-3 space-y-2">
                                <p className="text-xs text-muted-foreground">We’ll send the vouchers to them. You still see them here.</p>
                                <Input type="tel" inputMode="tel" aria-label="Their phone number" aria-invalid={!!p.phoneError} placeholder="Their phone, e.g. 0241234567" value={p.phone} onChange={e => p.onPhone(e.target.value)} className={cn('h-11', p.phoneError && 'ring-2 ring-red-500')} />
                                {p.phoneError && <p role="alert" className="text-xs font-medium text-red-500">{p.phoneError}</p>}
                                <Input type="email" aria-label="Their email" aria-invalid={!!p.emailError} placeholder="Their email" value={p.email} onChange={e => p.onEmail(e.target.value)} className={cn('h-11', p.emailError && 'ring-2 ring-red-500')} />
                                {p.emailError && <p role="alert" className="text-xs font-medium text-red-500">{p.emailError}</p>}
                            </div>
                        )}
                    </div>

                    <div className="well space-y-1.5 rounded-2xl p-4" aria-live="polite">
                        {p.quote.status === 'error' ? (
                            <div className="flex items-start justify-between gap-3">
                                <p role="alert" className="flex items-start gap-1.5 text-sm text-red-500"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {p.quote.message}</p>
                                <button type="button" onClick={p.onRetryQuote} className="flex flex-shrink-0 items-center gap-1 rounded-lg text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{quoteOk?.bulkApplied ? 'Bulk price each' : 'Price each'}</span>
                                    <span className="font-semibold tabular-nums">{quoteOk ? formatCurrency(quoteOk.unitPrice) : '—'}</span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <span className="text-sm font-medium">Total</span>
                                    {total !== null ? (
                                        <span className="font-display text-2xl font-bold tabular-nums">{formatCurrency(total)}</span>
                                    ) : (
                                        <span className="h-8 w-28 animate-pulse rounded-lg bg-foreground/10" aria-label="Working out your price" />
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Wallet <span className="font-semibold text-foreground">{formatCurrency(p.balance)}</span></span>
                        {total !== null && shortfall === 0 && <span>After <span className="font-semibold text-foreground">{formatCurrency(p.balance - total)}</span></span>}
                    </div>

                    {shortfall > 0 ? (
                        <div className="space-y-2">
                            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-500"><AlertCircle className="h-4 w-4" /> You’re {formatCurrency(shortfall)} short.</p>
                            <Button asChild className="h-12 w-full text-base"><Link href="/dashboard/wallet">Top up wallet</Link></Button>
                        </div>
                    ) : (
                        <Button className="h-12 w-full text-base" disabled={!canPay} onClick={p.onPay}>
                            {p.paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Paying…</> : total !== null ? `Pay ${formatCurrency(total)}` : 'Pay'}
                        </Button>
                    )}
                </>
            )}
        </aside>
    )
})