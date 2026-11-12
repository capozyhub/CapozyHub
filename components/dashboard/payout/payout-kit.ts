// Shared pieces for the payout wizards (shop wallet and commission wallet withdrawals).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const MOMO_NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] as const
export type MomoNetwork = typeof MOMO_NETWORKS[number]

export const MANUAL_NAME_CHARS = /[^A-Za-zÀ-ÖØ-öø-ÿ '.\-]/g

export const FIELD = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500'
export const SELECT_TRIGGER = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none focus:ring-2 focus:ring-black focus:ring-offset-0 dark:focus:ring-brand-500'
export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

export const round2 = (n: number) => Math.round(n * 100) / 100

/** The server only accepts digit-only numbers: accept spaces, dashes and +233 and normalise. */
export const cleanMomoNumber = (raw: string) => raw.replace(/[\s-]/g, '').replace(/^\+?233/, '0')

export const isLocalMomoNumber = (n: string) => /^0\d{9}$/.test(n)

/** Rounded exactly as the server rounds it. */
export function computeFee(amount: number, percent: number, flat: number) {
    const fee = round2((amount * percent) / 100 + flat)
    return { fee, net: round2(amount - fee) }
}

/**
 * Account-name verification for a payout destination, shared by every payout page.
 *
 * `auto` runs the check by itself (debounced) once a full number and network are in; pass
 * null to turn that off (bank accounts are checked on demand, saved accounts are already
 * verified). A free-text name is only unlocked when the provider answered "cannot resolve
 * this account" (HTTP 200, success:false), never for a malformed number or a spent quota.
 */
export function useAccountNameCheck(auto: { network: string; number: string } | null) {
    const [verifiedName, setVerifiedName] = useState<string | null>(null)
    const [validating, setValidating] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [manualAllowed, setManualAllowed] = useState(false)
    const [manualName, setManualName] = useState('')
    const lastChecked = useRef('')

    const reset = useCallback(() => {
        lastChecked.current = ''
        setVerifiedName(null)
        setValidationError(null)
        setManualAllowed(false)
        setManualName('') // a manual name typed for one number must never ride along with another
    }, [])

    const check = useCallback((phone: string, network: string, bankId?: string) => {
        lastChecked.current = `${network}:${phone}`
        setValidating(true)
        setVerifiedName(null)
        setValidationError(null)
        setManualAllowed(false)
        setManualName('')

        fetch('/api/shop/validate-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, network, bankId }),
        })
            .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
            .then(({ ok, data }) => {
                if (data.success && data.name) {
                    setVerifiedName(data.name)
                } else {
                    setManualAllowed(ok)
                    setValidationError(data.details?.[0] || data.error || 'We could not confirm this account.')
                }
            })
            .catch(() => {
                setManualAllowed(false)
                setValidationError('Network problem while checking the account. Please try again.')
            })
            .finally(() => setValidating(false))
    }, [])

    const autoNetwork = auto?.network
    const autoNumber = auto?.number
    useEffect(() => {
        if (!autoNetwork || !autoNumber || !isLocalMomoNumber(autoNumber)) return
        const key = `${autoNetwork}:${autoNumber}`
        const t = setTimeout(() => {
            if (lastChecked.current === key) return
            check(autoNumber, autoNetwork)
        }, 400)
        return () => clearTimeout(t)
    }, [autoNetwork, autoNumber, check])

    const normalizedManualName = manualName.trim().replace(/\s+/g, ' ')
    const canUseManual = !!validationError && manualAllowed && !validating && !verifiedName
    const manualNameValid = normalizedManualName.length >= 2
    const hasUsableName = !!verifiedName || (canUseManual && manualNameValid)
    const receiverName = verifiedName || (canUseManual && manualNameValid ? normalizedManualName : '')
    /** True when the name being sent is the typed one (unverified, flagged for admin review). */
    const usingManual = !verifiedName && canUseManual && manualNameValid

    return {
        verifiedName, setVerifiedName, validating, validationError,
        manualName, setManualName, normalizedManualName,
        canUseManual, hasUsableName, receiverName, usingManual,
        reset, check,
    }
}

export type AccountNameCheck = ReturnType<typeof useAccountNameCheck>
