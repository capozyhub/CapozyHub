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
import type { DataPackage } from '@/types/supabase'
import { carrierFamily, networkLabel } from './network-meta'

interface PlacedDetails {
    referenceCode: string
    network: string
    size: string
    phoneNumber: string
    price: number
    newBalance: number | null
}

interface PurchaseSheetProps {
    pkg: DataPackage | null
    price: number
    balance: number
    onClose: () => void
    /** Called once an order goes through, with the wallet balance after it (null if unknown). */
    onPurchased: (newBalance: number | null) => void
}

/** Pay for one bundle: a bottom sheet on phones, a dialog on larger screens. */
export function PurchaseSheet({ pkg, price, balance, onClose, onPurchased }: PurchaseSheetProps) {
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

    const canAfford = balance >= price

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
                body: JSON.stringify({ packageId: pkg.id, phoneNumber: check.normalizedNumber, referenceCode: reference }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Purchase failed')

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
                <DialogDescription className="sr-only">Buy a data bundle</DialogDescription>
                <DialogClose
                    disabled={buying}
                    className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>

                {placed ? (
                    <div className="space-y-5 px-6 pb-8 pt-8">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full">
                                <CheckCircle2 className="h-8 w-8" />
                            </span>
                            <DialogTitle className="font-display text-xl font-semibold">Order placed</DialogTitle>
                            <p className="text-sm text-muted-foreground">We&apos;re delivering your bundle now.</p>
                        </div>

                        <dl className="well space-y-3 rounded-2xl p-4 text-sm">
                            {[
                                ['Recipient', placed.phoneNumber],
                                ['Bundle', `${networkLabel(placed.network)} ${placed.size}`],
                                ['Paid', formatCurrency(placed.price)],
                                ...(placed.newBalance !== null ? [['Wallet now', formatCurrency(placed.newBalance)]] : []),
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="font-semibold">{value}</dd>
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
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
                            <div className="flex items-center gap-4 px-6 pb-5 pt-8">
                                <span className="well flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl">
                                    <NetworkIcon network={pkg.network} size={36} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <DialogTitle className="font-display text-3xl font-bold leading-none tracking-tight">{pkg.size}</DialogTitle>
                                    <p className="mt-1 truncate text-sm text-muted-foreground">{networkLabel(pkg.network)}{pkg.description && pkg.description !== 'Instant Delivery' ? ` · ${pkg.description}` : ''}</p>
                                </div>
                                <p className="font-display text-2xl font-bold tabular-nums">{formatCurrency(price)}</p>
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

                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Wallet <span className="font-semibold text-foreground">{formatCurrency(balance)}</span></span>
                                    {canAfford && <span>After <span className="font-semibold text-foreground">{formatCurrency(balance - price)}</span></span>}
                                </div>

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
