'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Clock } from 'lucide-react'
import { toast } from '@/lib/toast'
import { generateReferenceCode } from '@/lib/utils'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { maxQuantityFor, type RCType, type Voucher } from './meta'
import { useQuote } from './use-quote'
import { ExamCard } from './ExamCard'
import { OrderPanel } from './OrderPanel'
import { ReceiptDialog, type Receipt } from './ReceiptDialog'

interface ShopViewProps {
    types: RCType[]
    enabled: boolean
    maxQty: number
    balance: number
    ownPhone?: string
    ownEmail?: string
    onPurchased: (newBalance: number | null) => void
    onViewVouchers: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ShopView({ types, enabled, maxQty, balance, ownPhone, ownEmail, onPurchased, onViewVouchers }: ShopViewProps) {
    const [typeId, setTypeId] = useState('')
    const [qtyText, setQtyText] = useState('1')
    const [giftOpen, setGiftOpen] = useState(false)
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [paying, setPaying] = useState(false)
    const [receipt, setReceipt] = useState<Receipt | null>(null)
    const [quoteKey, setQuoteKey] = useState(0)
    const panelRef = useRef<HTMLElement>(null)
    // One reference per distinct order. It is reused while the same order is retried (a double tap,
    // or a dropped connection) so it can never buy twice, and replaced the moment the order changes.
    const attempt = useRef<{ sig: string; ref: string } | null>(null)

    const type = types.find(t => t.id === typeId)
    const cap = maxQuantityFor(type, maxQty)
    const parsed = parseInt(qtyText, 10)
    const qty = Number.isInteger(parsed) && parsed >= 1 && parsed <= cap ? parsed : null
    const quote = useQuote(typeId, qty, quoteKey)

    // Never hold a quantity above what the chosen exam can supply.
    useEffect(() => {
        const n = parseInt(qtyText, 10)
        if (Number.isInteger(n) && n > cap) setQtyText(String(cap))
    }, [cap, qtyText])

    const recipientPhone = giftOpen ? phone.trim() : ''
    const recipientEmail = giftOpen ? email.trim() : ''
    const phoneError = useMemo(() => (recipientPhone && !validateGhanaianPhone(recipientPhone).isValid ? 'Enter a valid Ghana number' : ''), [recipientPhone])
    const emailError = recipientEmail && !EMAIL_RE.test(recipientEmail) ? 'Enter a valid email address' : ''

    const select = (id: string) => {
        setTypeId(prev => (prev === id ? '' : id))
        if (typeId !== id && typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
            setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
        }
    }

    const commitQty = () => setQtyText(String(Math.min(cap, Math.max(1, parseInt(qtyText, 10) || 1))))

    const pay = async () => {
        if (!type || !qty || quote.status !== 'ok' || quote.typeId !== type.id || quote.quantity !== qty || paying) return
        const normalizedPhone = recipientPhone ? validateGhanaianPhone(recipientPhone).normalizedNumber : ''
        const sig = [type.id, qty, normalizedPhone, recipientEmail].join('|')
        if (attempt.current?.sig !== sig) attempt.current = { sig, ref: `RC-${generateReferenceCode()}` }

        setPaying(true)
        try {
            const res = await fetch('/api/results-checker/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    typeId: type.id,
                    quantity: qty,
                    recipientPhone: normalizedPhone || undefined,
                    recipientEmail: recipientEmail || undefined,
                    referenceCode: attempt.current.ref,
                    expectedTotal: quote.total,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (data.priceChanged) setQuoteKey(k => k + 1) // show the new total; nothing was charged
                throw new Error(data.error || 'That did not go through. You were not charged.')
            }

            setReceipt({
                referenceCode: data.order?.reference_code ?? attempt.current.ref,
                typeName: type.name,
                quantity: qty,
                total: Number(data.order?.total_paid ?? quote.total),
                vouchers: (data.vouchers ?? []) as Voucher[],
                duplicate: !!data.isDuplicate,
            })
            attempt.current = null
            onPurchased(typeof data.newBalance === 'number' ? data.newBalance : null)
        } catch (e: any) {
            toast.error(e.message || 'That did not go through. You were not charged.')
        } finally {
            setPaying(false)
        }
    }

    return (
        <div className="space-y-5">
            {!enabled && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p><span className="font-semibold">Results checkers are paused for now.</span> Please check back soon.</p>
                </div>
            )}

            <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] ${enabled ? '' : 'pointer-events-none opacity-50'}`}>
                <section aria-label="Choose an exam">
                    {types.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                            <Clock className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No results checkers on sale right now.</p>
                        </div>
                    ) : (
                        <div role="radiogroup" aria-label="Exam" className="grid gap-4 sm:grid-cols-2">
                            {types.map(t => <ExamCard key={t.id} type={t} selected={t.id === typeId} onSelect={() => select(t.id)} />)}
                        </div>
                    )}
                </section>

                <OrderPanel
                    ref={panelRef}
                    type={type}
                    enabled={enabled}
                    cap={cap}
                    qtyText={qtyText}
                    qty={qty}
                    quote={quote}
                    balance={balance}
                    giftOpen={giftOpen}
                    phone={phone}
                    email={email}
                    phoneError={phoneError}
                    emailError={emailError}
                    paying={paying}
                    onQtyText={setQtyText}
                    onQtyCommit={commitQty}
                    onQtyStep={n => setQtyText(String(Math.min(cap, Math.max(1, n))))}
                    onGiftToggle={setGiftOpen}
                    onPhone={setPhone}
                    onEmail={setEmail}
                    onRetryQuote={() => setQuoteKey(k => k + 1)}
                    onPay={pay}
                />
            </div>

            <ReceiptDialog receipt={receipt} ownPhone={ownPhone} ownEmail={ownEmail} onClose={() => setReceipt(null)} onViewAll={onViewVouchers} />
        </div>
    )
}