'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, X } from 'lucide-react'
import { NetworkIcon } from '@/components/network-icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'
import { cn, formatCurrency, generateReferenceCode } from '@/lib/utils'
import { detectNetwork, validateGhanaianPhone } from '@/lib/phone-validation'
import type { Bundle } from './types'
import { carrierFamily, NETWORK_COLOR, networkLabel } from './network-meta'
import { errorMessage, isPriceChanged, readJson } from './api'

interface PlacedDetails {
    referenceCode: string
    network: string
    size: string
    phoneNumber: string
    price: number
    newBalance: number | null
}

interface PurchaseSheetProps {
    pkg: Bundle | null
    price: number
    /** Null when the balance could not be read: the sheet then lets the server decide. */
    balance: number | null
    onClose: () => void
    /** Called once an order goes through, with the wallet balance after it (null if unknown). */
    onPurchased: (newBalance: number | null) => void
    /** The server says the price has moved: reload the list so the sheet shows the new one. */
    onPriceChanged: () => void
}

/** Pay for one bundle: a bottom sheet on phones, a dialog on larger screens. */
export function PurchaseSheet({ pkg, price, balance, onClose, onPurchased, onPriceChanged }: PurchaseSheetProps) {
    const router = useRouter()
    const phoneRef = useRef<HTMLInputElement>(null)
    const [phone, setPhone] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [buying, setBuying] = useState(false)
    const [placed, setPlaced] = useState<PlacedDetails | null>(null)
    // One reference per attempt. Sent with every retry of the same purchase, so a double tap
    // or a retry after a dropped connection can never buy twice.
    const [reference, setReference] = useState('')

    useEffect(() => {
        if (!pkg) return
        setPhone('')
        setPhoneError('')
        setPlaced(null)
        setReference(generateReferenceCode())
    }, [pkg?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const canAfford = balance === null || balance >= price
    // Ties the sheet back to the card it was opened from — the same accent PackageGrid uses.
    const accent = NETWORK_COLOR[(placed ?? pkg)?.network ?? ''] ?? '#8E8E8E'

    const onPhoneChange = (value: string) => {
        setPhone(value)
        setPhoneError('')
        if (!pkg || value.replace(/\D/g, '').length < 10) return
        const check = validateGhanaianPhone(value)
        if (!check.isValid) {
            setPhoneError(check.error || 'Invalid phone number')
            return
        }
        // AT BigTime works on any number; every other bundle is for its own network.
        const detected = detectNetwork(value)
        if (pkg.network !== 'AT-BigTime' && detected !== carrierFamily(pkg.network)) {
            setPhoneError(`This number is on ${detected}, not ${networkLabel(pkg.network)}`)
        }
    }

    const buy = async () => {
        if (!pkg) return
        const check = validateGhanaianPhone(phone)
        if (!check.isValid) { setPhoneError(check.error || 'Invalid phone number'); return }
        if (!canAfford) { setPhoneError('Insufficient wallet balance'); return }

        setBuying(true)
        try {
            const res = await fetch('/api/orders/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageId: pkg.id, phoneNumber: check.normalizedNumber, referenceCode: reference, expectedPrice: price }),
            })
            const data = await readJson(res)
            if (isPriceChanged(res, data)) onPriceChanged()
            if (!res.ok) throw new Error(errorMessage(res, data, 'Purchase failed'))

            const o = data.order ?? {}
            const newBalance = typeof o.new_balance === 'number' ? o.new_balance : null
            setPlaced({
                referenceCode: o.reference_code ?? reference,
                network: o.network ?? pkg.network,
                size: o.size ?? pkg.size,
                phoneNumber: o.phone_number ?? check.normalizedNumber,
                price: typeof o.price === 'number' ? o.price : price,
                newBalance,
            })
            onPurchased(newBalance)
            toast.success(data.isDuplicate ? 'That order was already placed' : 'Order placed')
        } catch (e: any) {
            toast.error(e.message || 'Could not place the order')
        } finally {
            setBuying(false)
        }
    }

    return (
        <Dialog open={!!pkg} onOpenChange={open => { if (!open && !buying) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="gap-0 overflow-hidden p-0 sm:max-w-md max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
                onOpenAutoFocus={e => { e.preventDefault(); if (!placed) setTimeout(() => phoneRef.current?.focus(), 50) }}
                onInteractOutside={e => { if (buying) e.preventDefault() }}
            >
                {/* The network's own colour, same as its PackageGrid card — this sheet is that card, opened. */}
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: accent }} />
                <DialogDescription className="sr-only">Buy a data bundle</DialogDescription>
                <DialogClose
                    disabled={buying}
                    className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>

                {placed ? (
                    <div className="space-y-5 px-6 pb-7 pt-9">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <span
                                className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"
                                style={{ boxShadow: `8px 10px 20px rgba(246,169,0,0.38), inset -6px -8px 12px rgba(155,98,0,0.45), inset 6px 7px 12px rgba(255,255,255,0.65), 0 0 0 3px ${accent}` }}
                            >
                                <CheckCircle2 className="h-8 w-8" />
                            </span>
                            <DialogTitle className="font-display text-xl font-semibold">Order placed</DialogTitle>
                            <p className="text-sm text-muted-foreground">We&apos;re delivering your bundle now.</p>
                        </div>

                        <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Recipient</dt>
                                <dd className="font-semibold">{placed.phoneNumber}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Bundle</dt>
                                <dd className="flex items-center gap-1.5 font-semibold">
                                    {placed.size}
                                    <span
                                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                        style={{ backgroundColor: `${accent}1A`, color: accent }}
                                    >
                                        {networkLabel(placed.network)}
                                    </span>
                                </dd>
                            </div>
                            {[
                                ['Paid', formatCurrency(placed.price)],
                                ...(placed.newBalance !== null ? [['Wallet now', formatCurrency(placed.newBalance)]] : []),
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="font-semibold">{value}</dd>
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                <dt className="text-muted-foreground">Reference</dt>
                                <dd className="break-all text-right font-mono text-xs text-muted-foreground">{placed.referenceCode}</dd>
                            </div>
                        </dl>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={onClose}>Done</Button>
                            <Button className="flex-1 gap-2" onClick={() => { onClose(); router.push('/dashboard/my-orders') }}>
                                <ExternalLink className="h-4 w-4" /> View orders
                            </Button>
                        </div>
                    </div>
                ) : (
                    pkg && (
                        <div className="pb-6">
                            <div className="flex items-start gap-4 px-6 pb-5 pt-9">
                                <span
                                    className="well flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
                                    style={{ boxShadow: `var(--neu-in), 0 0 0 2.5px ${accent}` }}
                                >
                                    <NetworkIcon network={pkg.network} size={34} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <DialogTitle className="font-display text-3xl font-bold leading-none tracking-tight">{pkg.size}</DialogTitle>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span
                                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                                            style={{ backgroundColor: `${accent}1A`, color: accent }}
                                        >
                                            {networkLabel(pkg.network)}
                                        </span>
                                        {pkg.description && pkg.description !== 'Instant Delivery' && (
                                            <span className="truncate text-xs text-muted-foreground">{pkg.description}</span>
                                        )}
                                    </div>
                                </div>
                                <span className="clay-gold flex-shrink-0 rounded-2xl px-3.5 py-2 font-display text-lg font-bold tabular-nums">
                                    {formatCurrency(price)}
                                </span>
                            </div>

                            <div className="space-y-4 px-6">
                                <div className="space-y-1.5">
                                    <Label htmlFor="recipient" className="text-sm font-medium">Send to</Label>
                                    <Input
                                        ref={phoneRef}
                                        id="recipient"
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        placeholder="0241234567"
                                        value={phone}
                                        onChange={e => onPhoneChange(e.target.value)}
                                        aria-invalid={!!phoneError}
                                        className={cn('h-12 text-base font-semibold', phoneError && 'ring-2 ring-red-500')}
                                    />
                                    {phoneError && (
                                        <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-500">
                                            <AlertCircle className="h-3.5 w-3.5" /> {phoneError}
                                        </p>
                                    )}
                                </div>

                                <dl className="well space-y-2 rounded-2xl p-4 text-sm">
                                    <div className="flex items-center justify-between">
                                        <dt className="text-muted-foreground">Wallet</dt>
                                        <dd className="font-semibold tabular-nums">{balance === null ? '—' : formatCurrency(balance)}</dd>
                                    </div>
                                    {balance !== null && canAfford && (
                                        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                                            <dt className="font-medium">After this order</dt>
                                            <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(balance - price)}</dd>
                                        </div>
                                    )}
                                </dl>

                                {canAfford ? (
                                    <Button onClick={buy} disabled={buying || !phone || !!phoneError} className="h-12 w-full text-base">
                                        {buying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay ${formatCurrency(price)}`}
                                    </Button>
                                ) : (
                                    <Button asChild className="h-12 w-full text-base">
                                        <Link href="/dashboard/wallet" onClick={onClose}>Top up wallet</Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )
                )}
            </DialogContent>
        </Dialog>
    )
}
