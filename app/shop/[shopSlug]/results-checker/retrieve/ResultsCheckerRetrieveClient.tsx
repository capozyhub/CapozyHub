'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    Eye,
    EyeOff,
    GraduationCap,
    Loader2,
    Mail,
    MessageCircle,
    Phone,
    Search,
    ShieldCheck,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { downloadResultsCheckerVouchers, type ResultsCheckerVoucher } from '@/lib/results-checker-utils'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { CopyrightFooter } from '@/components/CopyrightFooter'
import { isStorefrontHost } from '@/lib/storefront-host'
import { StorefrontPageFrame } from '@/components/storefront/page-frame'

interface ShopRetrieveProps {
    shop: {
        shop_name: string
        shop_slug: string
        logo_url: string | null
        owner_phone: string
        owner_email: string | null
        whatsapp_number: string | null
        brand_color: string
    }
}

interface RetrievedOrder {
    id: string
    reference_code: string
    type_name: string
    quantity: number
    total_paid: number
    status: string
    payment_status: string
    created_at: string
    customer_phone: string | null
    customer_email: string | null
    inventory_ids: string[]
}

interface RetrievedPayload {
    order: RetrievedOrder
    vouchers: ResultsCheckerVoucher[]
}

function CopyAction({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false)

    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(value)
                setCopied(true)
                toast.success(`${label} copied`)
                window.setTimeout(() => setCopied(false), 1500)
            }}
            className="neu-raised-sm neu-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground"
            title={`Copy ${label}`}
        >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
    )
}

export default function ResultsCheckerRetrieveClient({ shop }: ShopRetrieveProps) {
    const searchParams = useSearchParams()
    const initialReference = searchParams.get('reference') || ''
    const [reference, setReference] = useState(initialReference)
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<RetrievedPayload | null>(null)
    const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set())
    const [isStorefront, setIsStorefront] = useState(false)
    const [canAutoLookup, setCanAutoLookup] = useState(false)
    const autoTriggered = useRef(false)
    const headerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (headerRef.current) {
            headerRef.current.style.setProperty('--brand-color', shop.brand_color || '#0f172a')
        }
    }, [shop.brand_color])

    // White-label toast notifications with the shop's own name on this storefront page.
    useEffect(() => {
        toast.setBrand(shop.shop_name)
        return () => toast.setBrand(null)
    }, [shop.shop_name])

    useEffect(() => {
        setIsStorefront(isStorefrontHost(window.location.hostname))

        try {
            const savedPhone = localStorage.getItem('shop_last_phone')
            if (savedPhone) {
                setPhone(savedPhone)
                setCanAutoLookup(true)
            }
        } catch {}
    }, [])

    const baseLinkPath = isStorefront ? '' : '/shop'
    const storefrontHref = `${baseLinkPath}/${shop.shop_slug}`
    const trackerHref = `${baseLinkPath}/status?shop=${shop.shop_slug}&name=${encodeURIComponent(shop.shop_name)}`

    const runRetrieve = async (nextReference: string, nextPhone: string) => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/results-checker/retrieve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reference: nextReference.trim(),
                    phone: nextPhone.trim(),
                }),
            })
            const data = await res.json()

            if (!res.ok) {
                setResult(null)
                setError(data.error || 'Unable to retrieve voucher details right now.')
                return
            }

            setResult(data)
            try {
                localStorage.setItem('shop_last_phone', nextPhone.trim())
            } catch {}
        } catch {
            setResult(null)
            setError('Network error while retrieving voucher details.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!initialReference || !phone || !canAutoLookup || autoTriggered.current) {
            return
        }

        autoTriggered.current = true
        void runRetrieve(initialReference, phone)
    }, [canAutoLookup, initialReference, phone])

    const FIELD = 'neu-inset h-[3.25rem] w-full rounded-full border-0 bg-transparent px-5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500'
    const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
    const done = result?.order.status === 'completed'

    return (
        <StorefrontPageFrame
            name={shop.shop_name}
            logoUrl={shop.logo_url}
            brandColor={shop.brand_color}
            backHref={storefrontHref}
            backLabel="Back to shop"
            headerAction={<ThemeToggle brandName={shop.shop_name} />}
        >
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground">Get your voucher back</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Enter the reference from your receipt and the phone number you bought with. Your PIN comes straight back.
            </p>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void runRetrieve(reference, phone)
                }}
                className="mt-6 space-y-5"
            >
                <div>
                    <label htmlFor="rc-ref" className="mb-2 block px-1 text-sm font-semibold text-foreground">Reference</label>
                    <input id="rc-ref" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="RC-XXXXXXXX" className={FIELD} />
                </div>
                <div>
                    <label htmlFor="rc-buyer" className="mb-2 block px-1 text-sm font-semibold text-foreground">Phone you bought with</label>
                    <input id="rc-buyer" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="024 123 4567" className={FIELD} />
                </div>
                <button
                    type="submit"
                    disabled={loading || !reference.trim() || !phone.trim()}
                    className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-50', FOCUS)}
                >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Looking…</> : <><Search className="h-4 w-4" /> Find my voucher</>}
                </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Limited tries, to keep PINs safe</span>
                <Link href={trackerHref} className="font-semibold text-foreground underline-offset-4 hover:underline">Track other orders</Link>
            </div>

            {error && (
                <p role="alert" className="neu-inset mt-6 rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-foreground">{error}</p>
            )}

            {result && (
                <section className="mt-8" aria-live="polite">
                    <div className="rounded-3xl bg-black p-5 text-white">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="break-all font-mono text-xs text-silver-200">{result.order.reference_code}</p>
                                <h2 className="mt-1 font-display text-xl font-bold tracking-tight">{result.order.quantity} × {result.order.type_name}</h2>
                            </div>
                            <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold', done ? 'clay-gold' : 'neu-night text-white')}>
                                {done ? 'Ready' : 'Preparing'}
                            </span>
                        </div>
                        <dl className="mt-4 space-y-2 border-t border-white/15 pt-4 text-sm">
                            <div className="flex justify-between gap-4"><dt className="text-silver-200">Paid</dt><dd className="font-semibold tabular-nums">{formatCurrency(result.order.total_paid)}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-silver-200">Phone</dt><dd className="font-semibold">{result.order.customer_phone || '-'}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-silver-200">Email</dt><dd className="truncate font-semibold">{result.order.customer_email || '-'}</dd></div>
                        </dl>
                    </div>

                    {done && result.vouchers.length > 0 ? (
                        <div className="mt-5 space-y-4">
                            <ul className="space-y-3">
                                {result.vouchers.map((voucher, index) => {
                                    const pinKey = `${voucher.serial_number}-${index}`
                                    const isRevealed = revealedPins.has(pinKey)
                                    return (
                                        <li key={pinKey} className="neu-inset space-y-3 rounded-2xl p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-foreground">Voucher {index + 1}</span>
                                                <CopyAction value={`Serial: ${voucher.serial_number}\nPIN: ${voucher.pin}`} label="voucher details" />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Serial <span className="ml-1 font-mono text-sm text-foreground">{voucher.serial_number}</span></p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    aria-label={isRevealed ? 'Hide PIN' : 'Show PIN'}
                                                    onClick={() => {
                                                        const next = new Set(revealedPins)
                                                        if (next.has(pinKey)) next.delete(pinKey)
                                                        else next.add(pinKey)
                                                        setRevealedPins(next)
                                                    }}
                                                    className={cn('neu-raised-sm flex min-h-[2.75rem] w-full items-center justify-between rounded-full px-4 text-left', FOCUS)}
                                                >
                                                    <span className={cn('font-mono text-base font-bold tracking-wider', isRevealed ? 'text-foreground' : 'select-none text-muted-foreground blur-[3px]')}>
                                                        {isRevealed ? voucher.pin : '••••••••••'}
                                                    </span>
                                                    {isRevealed ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                                </button>
                                                <CopyAction value={voucher.pin} label="PIN" />
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                            <button
                                type="button"
                                onClick={() => downloadResultsCheckerVouchers(
                                    result.order,
                                    result.vouchers,
                                    result.order.customer_phone || '',
                                    result.order.customer_email || '',
                                    shop.shop_name
                                )}
                                className={cn('clay-black flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold', FOCUS)}
                            >
                                <Download className="h-4 w-4" /> Save receipt
                            </button>
                        </div>
                    ) : (
                        <p className="neu-inset mt-5 rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-foreground">
                            Your payment is recorded but the voucher is not ready yet. Try again in a minute, or message the shop if it stays this way.
                        </p>
                    )}
                </section>
            )}

            <h2 className="mb-3 mt-10 font-display text-xl font-bold tracking-tight text-foreground">Still stuck?</h2>
            <div className="flex flex-wrap gap-3">
                {shop.whatsapp_number && (
                    <a href={`https://wa.me/${shop.whatsapp_number}`} target="_blank" rel="noreferrer" className={cn('clay-gold inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-5 text-sm font-semibold', FOCUS)}>
                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                    </a>
                )}
                <a href={`tel:${shop.owner_phone}`} className={cn('neu-raised-sm neu-press inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-5 text-sm font-semibold text-foreground', FOCUS)}>
                    <Phone className="h-4 w-4" aria-hidden="true" /> Call
                </a>
                {shop.owner_email && (
                    <a href={`mailto:${shop.owner_email}`} className={cn('neu-raised-sm neu-press inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-5 text-sm font-semibold text-foreground', FOCUS)}>
                        <Mail className="h-4 w-4" aria-hidden="true" /> Email
                    </a>
                )}
            </div>

            <CopyrightFooter variant="shop" shopName={shop.shop_name} className="pt-10" />
        </StorefrontPageFrame>
    )
}