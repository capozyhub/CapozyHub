'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import type { ClaimSessionInfo, ClaimSessionStep, ClaimSuccessData } from './meta'

interface UseClaimSessionOptions {
    userId: string | undefined
    /** Called once with the full breakdown the moment a credit is detected. */
    onCredited: (data: ClaimSuccessData) => void
}

const POLL_MS = 4_000

/** Owns the Send & Claim session state machine: start → waiting (poll + countdown) →
 * credited, plus resuming an open session across a refresh and a manual
 * transaction-ID fallback. The session row itself is purely informational — crediting
 * is still entirely done by the existing reference-code-driven SMS-forward auto-claim
 * (or the untouched manual claim endpoint); this hook only watches for it to happen.
 * Mirrors useChargeFlow.ts's generation-counter pattern so a cancelled/superseded/
 * unmounted session can never act after the fact. */
export function useClaimSession({ userId, onCredited }: UseClaimSessionOptions) {
    const [step, setStep] = useState<ClaimSessionStep>('idle')
    const [session, setSession] = useState<ClaimSessionInfo | null>(null)
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [manualChecking, setManualChecking] = useState(false)

    const generationRef = useRef(0)
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const userIdRef = useRef(userId)
    userIdRef.current = userId

    const clearTimers = useCallback(() => {
        if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
        if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    }, [])

    useEffect(() => () => { generationRef.current++; clearTimers() }, [clearTimers])

    const startCountdown = useCallback((expiresAt: string, generation: number) => {
        const tick = () => {
            if (generationRef.current !== generation) return
            const remaining = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
            setSecondsLeft(remaining)
            if (remaining <= 0) {
                clearTimers()
                setStep('expired')
            }
        }
        tick()
        countdownTimerRef.current = setInterval(tick, 1000)
    }, [clearTimers])

    // Builds the success payload from a credited session: the linked momo_transactions
    // row (RLS already restricts this to rows the caller claimed) plus a fresh wallet
    // balance read. Both are ordinary user-scoped Supabase reads — no new API route.
    const resolveCreditedSession = useCallback(async (momoTransactionId: string, generation: number) => {
        const { data: txn } = await supabase
            .from('momo_transactions')
            .select('transaction_id, amount, sender_name, sender_network, claim_fee_percent, claim_fee_amount, net_amount')
            .eq('id', momoTransactionId)
            .single()
        if (generationRef.current !== generation || !txn) return

        const uid = userIdRef.current
        const { data: wallet } = uid
            ? await supabase.from('wallets').select('balance').eq('user_id', uid).single()
            : { data: null as any }
        if (generationRef.current !== generation) return

        const t = txn as any
        clearTimers()
        setStep('credited')
        onCredited({
            amount: Number(t.amount),
            fee_percent: Number(t.claim_fee_percent) || 0,
            fee_amount: Number(t.claim_fee_amount) || 0,
            net_amount: Number(t.net_amount),
            new_balance: wallet ? Number((wallet as any).balance) : 0,
            transaction_id: t.transaction_id,
            sender_name: t.sender_name ?? undefined,
            sender_network: t.sender_network ?? undefined,
        })
    }, [onCredited, clearTimers])

    const poll = useCallback((sessionId: string, generation: number) => {
        const run = async () => {
            if (generationRef.current !== generation) return
            // momo_claim_sessions is new enough that the generated Database type doesn't
            // know it yet; `as any` on the client is what bypasses the typed `.from()`
            // overload (casting only the query result errors first).
            const { data } = await (supabase as any)
                .from('momo_claim_sessions')
                .select('status, momo_transaction_id')
                .eq('id', sessionId)
                .single()
            if (generationRef.current !== generation) return

            const row = data as any
            if (row?.status === 'credited' && row.momo_transaction_id) {
                await resolveCreditedSession(row.momo_transaction_id, generation)
                return
            }
            if (row?.status === 'cancelled') { setStep('idle'); return }
            pollTimerRef.current = setTimeout(run, POLL_MS)
        }
        pollTimerRef.current = setTimeout(run, POLL_MS)
    }, [resolveCreditedSession])

    const beginWaiting = useCallback((s: ClaimSessionInfo, generation: number) => {
        setSession(s)
        setStep('waiting')
        startCountdown(s.expires_at, generation)
        poll(s.id, generation)
    }, [startCountdown, poll])

    // Resume an open session on mount — survives a refresh or switching tabs and back.
    useEffect(() => {
        if (!userId) return
        const generation = generationRef.current
        ;(async () => {
            try {
                const res = await fetch('/api/wallet/claim-momo/session', { credentials: 'include' })
                const data = await res.json()
                if (generationRef.current !== generation) return
                if (data.session) beginWaiting(data.session, generation)
            } catch { /* nothing to resume — not an error */ }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        })()
    }, [userId])

    const start = useCallback(async (amount: number) => {
        generationRef.current++
        const generation = generationRef.current
        clearTimers()
        setStep('starting')
        try {
            const res = await fetch('/api/wallet/claim-momo/session', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount }),
            })
            const data = await res.json()
            if (generationRef.current !== generation) return
            if (!res.ok) {
                toast.error(data.error || 'Could not start a payment session')
                setStep('idle')
                return
            }
            beginWaiting(data.session, generation)
        } catch {
            if (generationRef.current !== generation) return
            toast.error('Network error. Please try again.')
            setStep('idle')
        }
    }, [beginWaiting, clearTimers])

    const cancel = useCallback(() => {
        generationRef.current++
        clearTimers()
        const id = session?.id
        setStep('idle')
        setSession(null)
        if (id) {
            // Best-effort: the money side doesn't depend on this row, so a failed
            // cancel just leaves a session that quietly expires on its own.
            fetch(`/api/wallet/claim-momo/session?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
        }
    }, [clearTimers, session])

    const retry = useCallback(() => {
        generationRef.current++
        clearTimers()
        setSession(null)
        setStep('idle')
    }, [clearTimers])

    // Manual fallback: paste a transaction ID directly. Reuses the existing claim
    // endpoint untouched — same rate limits, same atomic RPC, same audit trail.
    const manualClaim = useCallback(async (transactionId: string) => {
        setManualChecking(true)
        try {
            const res = await fetch('/api/wallet/claim-momo', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: transactionId }),
            })
            const data = await res.json()
            if (!res.ok) {
                if (data.error === 'already_claimed') {
                    toast.info(data.is_own_claim ? 'You already claimed this transaction.' : 'This transaction has already been claimed by another user.')
                } else {
                    toast.error(data.error || 'That claim did not go through. Please try again.')
                }
                return
            }
            clearTimers()
            setStep('credited')
            onCredited({
                amount: data.amount,
                fee_percent: data.fee_percent,
                fee_amount: data.fee_amount,
                net_amount: data.net_amount,
                new_balance: data.new_balance,
                transaction_id: data.transaction_id,
                sender_name: data.sender_name,
                sender_network: data.sender_network,
            })
        } catch {
            toast.error('Network error. Please try again.')
        } finally {
            setManualChecking(false)
        }
    }, [onCredited, clearTimers])

    return { step, session, secondsLeft, manualChecking, start, cancel, retry, manualClaim }
}
