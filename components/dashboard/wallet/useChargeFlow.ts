'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast'
import { fetchWithTimeout, PATIENT_POLLS, type ChargeStep, type WalletNetworkCode } from './meta'

interface UseChargeFlowOptions {
    /** Called once a charge is confirmed paid — the caller refreshes wallet data and resets the form. */
    onPaid: () => void
}

/** Owns the entire direct MoMo charge state machine: initiate → OTP (sometimes) →
 * pending → background poll → paid/failed. Extracted out of the wallet page so the
 * page itself only renders the modal; the polling/timeout plumbing lives here. */
export function useChargeFlow({ onPaid }: UseChargeFlowOptions) {
    const [step, setStep] = useState<ChargeStep>('idle')
    const [reference, setReference] = useState('')
    const [displayText, setDisplayText] = useState('')
    const [otpValue, setOtpValue] = useState('')
    const [pollCount, setPollCount] = useState(0)
    const [checkingPaid, setCheckingPaid] = useState(false)
    const [phoneForDisplay, setPhoneForDisplay] = useState('')
    const checkingPaidRef = useRef(false)
    const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current) }, [])

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    }, [])

    const handlePaidSuccess = useCallback(() => {
        stopPolling()
        toast.success('Wallet topped up successfully!')
        onPaid()
        setStep('idle')
        setReference('')
        setOtpValue('')
    }, [stopPolling, onPaid])

    // Hits the DB-authoritative check-pending endpoint. A network/parse hiccup is
    // treated as 'pending' (keep waiting), never a failure.
    const checkChargeStatus = useCallback(async (ref: string): Promise<'paid' | 'pending' | 'terminal'> => {
        try {
            const res = await fetchWithTimeout(`/api/payments/charge/check-pending?reference=${encodeURIComponent(ref)}`, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            }, 20_000)
            const data = await res.json()
            if (data.paid) return 'paid'
            if (data.terminal) return 'terminal'
            return 'pending'
        } catch {
            return 'pending'
        }
    }, [])

    // Never fails on pending/timeout — backs off from 10s to 20s polls after PATIENT_POLLS cycles.
    const startPolling = useCallback((ref: string) => {
        setPollCount(0)
        const poll = async (count: number) => {
            const outcome = await checkChargeStatus(ref)
            if (outcome === 'paid') { handlePaidSuccess(); return }
            if (outcome === 'terminal') {
                stopPolling()
                toast.error('Payment was declined. Please try again.')
                setStep('failed')
                return
            }
            setPollCount(count + 1)
            const delay = count < PATIENT_POLLS ? 10_000 : 20_000
            pollTimerRef.current = setTimeout(() => poll(count + 1), delay)
        }
        pollTimerRef.current = setTimeout(() => poll(0), 10_000)
    }, [checkChargeStatus, handlePaidSuccess, stopPolling])

    const confirmOnce = useCallback(async (ref: string) => {
        setStep('verifying')
        const outcome = await checkChargeStatus(ref)
        if (outcome === 'paid') { handlePaidSuccess(); return }
        if (outcome === 'terminal') {
            stopPolling()
            toast.error('Payment was declined. Please try again.')
            setStep('failed')
            return
        }
        setStep('pending')
        startPolling(ref)
    }, [checkChargeStatus, handlePaidSuccess, startPolling, stopPolling])

    const handleIHavePaid = useCallback(async () => {
        if (!reference || checkingPaidRef.current) return
        checkingPaidRef.current = true
        setCheckingPaid(true)
        const outcome = await checkChargeStatus(reference)
        if (outcome === 'paid') {
            handlePaidSuccess()
        } else if (outcome === 'terminal') {
            stopPolling()
            toast.error('Payment was declined. Please try again.')
            setStep('failed')
        } else {
            toast.info("Not received yet. Approve the prompt on your phone, then tap “I've paid” again.")
        }
        checkingPaidRef.current = false
        setCheckingPaid(false)
    }, [reference, checkChargeStatus, handlePaidSuccess, stopPolling])

    const startCharge = useCallback(async (amount: number, phone: string, network: WalletNetworkCode) => {
        setPhoneForDisplay(phone)
        setStep('charging')
        try {
            const res = await fetchWithTimeout('/api/payments/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount, phone, provider: network }),
            }, 30_000)
            const data = await res.json()
            if (!res.ok) {
                if (data.needsManualSelection) {
                    setStep('idle')
                    toast.error('Could not detect your network. Please select it manually.')
                    return
                }
                throw new Error(data.error || 'Failed to initiate payment')
            }
            setReference(data.reference)
            setDisplayText(data.display_text || '')

            if (data.status === 'send_otp' || data.status === 'send_birthday') {
                setStep('otp_required')
            } else if (data.status === 'success') {
                await confirmOnce(data.reference)
            } else if (data.status === 'failed' || data.status === 'timeout') {
                throw new Error(data.display_text || 'Payment could not be processed')
            } else {
                // 'pending' or any undocumented status Paystack may return — the
                // mobile prompt has already been sent server-side, so treat as pending.
                setStep('pending')
                startPolling(data.reference)
            }
        } catch (err: any) {
            toast.error(err.message || 'Payment failed')
            setStep('failed')
        }
    }, [confirmOnce, startPolling])

    const submitOtp = useCallback(async () => {
        if (!otpValue.trim()) { toast.error('Enter the OTP'); return }
        setStep('charging')
        try {
            const res = await fetchWithTimeout('/api/payments/charge/submit-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ reference, otp: otpValue }),
            }, 30_000)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'OTP submission failed')
            setDisplayText(data.display_text || '')

            if (data.status === 'success') {
                await confirmOnce(reference)
            } else if (data.status === 'send_otp' || data.status === 'send_birthday') {
                setOtpValue('')
                setStep('otp_required')
                toast.info(data.display_text || 'Please re-enter OTP')
            } else if (data.status === 'failed' || data.status === 'timeout') {
                throw new Error(data.display_text || 'Payment failed')
            } else {
                setStep('pending')
                startPolling(reference)
            }
        } catch (err: any) {
            toast.error(err.message || 'OTP submission failed')
            setStep('failed')
        }
    }, [otpValue, reference, confirmOnce, startPolling])

    const cancel = useCallback(() => {
        stopPolling()
        setStep('idle')
        setOtpValue('')
    }, [stopPolling])

    const retry = useCallback(() => setStep('idle'), [])

    return {
        step, displayText, otpValue, setOtpValue, pollCount, checkingPaid, phoneForDisplay,
        startCharge, submitOtp, handleIHavePaid, cancel, retry,
    }
}
