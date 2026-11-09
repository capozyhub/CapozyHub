'use client'

/**
 * StorefrontUtilitiesTab — guest-facing entry point for the storefront's Utilities tab
 * (ECG / Ghana Water / DSTV / GOtv / StarTimes). Structurally organized like
 * StorefrontDataTab: this file owns the biller grid + top-level state, and delegates the
 * purchase flow to a colocated sheet (UtilityFlowSheet).
 *
 * Payment itself runs through the parent's shared <ServiceChargeSheet> — passed down as
 * `onProceedToPayment` — so there is no redirect-return resume state to keep here (the old
 * Hubtel-hosted-checkout-page model needed one; the in-app OTP+poll model does not).
 *
 * Gating is NOT re-derived here — `enabledBillers`/`minAmount`/`maxAmount` and the decision to
 * even mount this tab all come from server-computed props (app/shop/[shopSlug]/page.tsx),
 * mirroring how the utility API routes resolve the same gates server-side.
 */

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { UTILITY_BILLERS, UTILITY_BILLER_KEYS, type UtilityBiller } from '@/lib/hubtel-utility/billers'
import { UTILITY_BILLER_META } from './UtilityBillerMeta'
import { UtilityFlowSheet } from './UtilityFlowSheet'
import type { ChargeDescriptor } from './ServiceChargeSheet'
import { UtilityBillerLogo } from '@/components/utility-biller-logo'
import { Clock, Receipt } from 'lucide-react'
import { ServiceHeading } from '@/components/storefront/ui'

interface Props {
    shopSlug: string
    enabledBillers: Partial<Record<UtilityBiller, boolean>>
    minAmount: number
    maxAmount: number
    onProceedToPayment: (descriptor: ChargeDescriptor) => void
}

export function StorefrontUtilitiesTab({ shopSlug, enabledBillers, minAmount, maxAmount, onProceedToPayment }: Props) {
    const billers = UTILITY_BILLER_KEYS.filter((k) => enabledBillers[k] === true)

    const [flowBiller, setFlowBiller] = useState<UtilityBiller | null>(null)
    const [flowOpen, setFlowOpen] = useState(false)

    const accountInputRef = useRef<HTMLInputElement>(null)

    const openBiller = (biller: UtilityBiller) => {
        setFlowBiller(biller)
        setFlowOpen(true)
        // Focus starts inside this click gesture (double rAF) — iOS drops the keyboard
        // if the focus call is deferred via setTimeout instead.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { accountInputRef.current?.focus() })
        })
    }

    if (billers.length === 0) {
        return (
            <div className="neu-inset flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
                <Clock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="font-display text-lg font-bold text-foreground">Bill payments are not on yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">This shop has not switched them on. Check back soon.</p>
            </div>
        )
    }

    return (
        <section className="animate-in fade-in duration-300 motion-reduce:animate-none">
            <ServiceHeading icon={Receipt} title="Pay a bill" blurb="Electricity, water and TV. We check the account before you pay." />

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {billers.map((biller) => {
                    const def = UTILITY_BILLERS[biller]
                    const meta = UTILITY_BILLER_META[biller]
                    return (
                        <li key={biller}>
                            <button
                                type="button"
                                onClick={() => openBiller(biller)}
                                className="neu-raised-sm neu-press flex h-full w-full flex-col items-center gap-2.5 rounded-2xl px-3 py-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500"
                            >
                                <UtilityBillerLogo biller={biller} FallbackIcon={meta.Icon} badgeClassName={meta.badge} size={56} />
                                <span className="text-sm font-semibold leading-tight text-foreground">{def.label}</span>
                                <span className="text-xs leading-tight text-muted-foreground">{meta.blurb}</span>
                            </button>
                        </li>
                    )
                })}
            </ul>
            <UtilityFlowSheet
                biller={flowBiller}
                open={flowOpen}
                onClose={() => setFlowOpen(false)}
                shopSlug={shopSlug}
                minAmount={minAmount}
                maxAmount={maxAmount}
                accountInputRef={accountInputRef}
                onProceedToPayment={onProceedToPayment}
            />
        </section>
    )
}
