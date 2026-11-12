'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shop-overview warning banner for Task F4 (KFT SMS v2). Task F3 made shop
// customer order confirmations suppress-until-ready — they only send once a
// shop has SMS activated + an admin-approved sender ID + spare credits. 182
// live shops will otherwise silently stop getting confirmations sent, so
// this banner must be impossible to misread: it shows the single
// highest-priority reason confirmations are off, with a fix-it CTA.
//
// Renders nothing while loading, on fetch error, or once every gate is
// clear (activated && approved sender && not low on credits && the owner's
// own confirmations toggle is on).

interface ConfirmationStatus {
    activated: boolean
    senderStatus: string | null
    hasApprovedSender: boolean
    credits: number
    lowCredits: boolean
    confirmationsEnabled: boolean
}

interface Gap {
    tier: 'warning' | 'neutral'
    title: string
    body: string
}

const SESSION_KEY = 'shop-confirmation-banner-dismissed'

// The dismissal is scoped to the exact combination of gates that produced
// it — sessionStorage stores this fingerprint, not a bare boolean, so if the
// underlying shop state changes (e.g. sender gets approved, then credits run
// low) the fingerprint changes and the banner reappears for the new gap.
function fingerprint(s: ConfirmationStatus): string {
    return [
        'csb',
        s.activated ? 1 : 0,
        s.hasApprovedSender ? 1 : 0,
        s.senderStatus ?? 'none',
        s.lowCredits ? 1 : 0,
        s.confirmationsEnabled ? 1 : 0,
    ].join(':')
}

// Highest-priority gap first: an unactivated shop is the loudest problem, a
// missing/pending sender is next, low credits (a ticking clock) after that,
// and the owner's own "I turned this off myself" choice is quietest of all.
function resolveGap(s: ConfirmationStatus): Gap {
    if (!s.activated) {
        return {
            tier: 'warning',
            title: 'Customer order confirmations are OFF',
            body: 'Activate SMS on your shop to start texting customers an order confirmation automatically.',
        }
    }

    if (!s.hasApprovedSender) {
        const body = s.senderStatus === 'under_review'
            ? 'Your sender ID is awaiting admin approval — confirmations will start as soon as it is approved.'
            : s.senderStatus === 'rejected'
                ? 'Your sender ID request was rejected. Request a new one so customers get order confirmations.'
                : s.senderStatus === 'revoked'
                    ? 'Your sender ID was revoked. Request a new one so customers get order confirmations.'
                    : 'Request a sender ID so customers get order confirmations — shops need their own approved sender before we can text customers.'
        return { tier: 'warning', title: 'Customer order confirmations are paused', body }
    }

    if (s.lowCredits) {
        return {
            tier: 'warning',
            title: `Low SMS credits (${s.credits} left)`,
            body: 'Confirmations pause automatically at 0 credits. Top up now to keep customers informed.',
        }
    }

    return {
        tier: 'neutral',
        title: 'Customer order confirmations are off',
        body: 'You turned off order-confirmation SMS in your shop settings. Customers won’t get a text when they order.',
    }
}

export function ConfirmationStatusBanner() {
    const [status, setStatus] = useState<ConfirmationStatus | null>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        let cancelled = false
        fetch('/api/shop/confirmation-status')
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (cancelled || !json?.success) return
                setStatus(json.data as ConfirmationStatus)
            })
            .catch(() => { /* silent — banner just stays hidden */ })
        return () => { cancelled = true }
    }, [])

    if (!status) return null

    const fullyHealthy = status.activated && status.hasApprovedSender && !status.lowCredits && status.confirmationsEnabled
    if (fullyHealthy) return null

    const key = fingerprint(status)
    if (dismissed) return null
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_KEY) === key) return null

    const gap = resolveGap(status)
    const isWarning = gap.tier === 'warning'

    const handleDismiss = () => {
        try { window.sessionStorage.setItem(SESSION_KEY, key) } catch { /* private mode etc — dismiss still works for this render */ }
        setDismissed(true)
    }

    return (
        <section aria-label="Order text messages" className="neu-raised-sm relative rounded-3xl p-4 pr-12">
            <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="neu-inset absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
                <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3">
                <span className={cn('neu-inset flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', isWarning ? 'text-brand-700 dark:text-brand-500' : 'text-muted-foreground')}>
                    {isWarning ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold">{gap.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{gap.body}</p>
                    <Link
                        href="/dashboard/shop/sms"
                        className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-brand-500"
                    >
                        {isWarning ? 'Fix in Shop SMS' : 'Manage in Shop SMS'} <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            </div>
        </section>
    )
}
