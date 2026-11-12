// app/dashboard/commission/withdraw/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { ClayButton, Notice } from '@/components/auth/fields'
import {
    AmountStep, ContinueRow, DoneStep, NameCheckPanel, PayoutStage, ReviewStep, SelectField, TextField,
    type PayoutStep,
} from '@/components/dashboard/payout/payout-stage'
import {
    FOCUS, MOMO_NETWORKS, cleanMomoNumber, computeFee, isLocalMomoNumber, useAccountNameCheck, type MomoNetwork,
} from '@/components/dashboard/payout/payout-kit'

interface Limits { balance: number; min: number; feePercent: number; feeFlat: number }

export default function CommissionWithdrawPage() {
    const [limits, setLimits] = useState<Limits>({ balance: 0, min: 0, feePercent: 0, feeFlat: 0 })
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [hasWallet, setHasWallet] = useState(true)

    const [step, setStep] = useState<PayoutStep>(1)
    const [receipt, setReceipt] = useState<{ net: number; name: string; number: string; network: string } | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const [amount, setAmount] = useState('')
    const [network, setNetwork] = useState<MomoNetwork | ''>('')
    const [momoNumber, setMomoNumber] = useState('')

    const accountNumber = cleanMomoNumber(momoNumber)
    const nc = useAccountNameCheck(network ? { network, number: accountNumber } : null)

    const loadWallet = useCallback(() => {
        fetch('/api/commission/wallet')
            .then(r => r.json())
            .then(res => {
                if (!res.success) throw new Error('load failed')
                const d = res.data
                setHasWallet(!!d.has_wallet)
                setLimits({
                    balance: Number(d.balance) || 0,
                    min: Number(d.min_withdrawal) || 0,
                    feePercent: Number(d.withdrawal_fee_percent) || 0,
                    feeFlat: Number(d.withdrawal_fee_flat) || 0,
                })
                setLoadFailed(false)
            })
            .catch(() => setLoadFailed(true))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadWallet() }, [loadWallet])

    const amountNum = parseFloat(amount) || 0
    const { fee: totalFee, net: netAmount } = computeFee(amountNum, limits.feePercent, limits.feeFlat)

    const amountBlocker =
        amountNum <= 0 ? 'Type an amount to continue.'
            : amountNum > limits.balance ? 'That is more than your commission balance.'
                : amountNum < limits.min ? `The smallest withdrawal is ${formatCurrency(limits.min)}.`
                    : netAmount <= 0 ? 'That is too small to cover the fee.'
                        : null
    const destBlocker =
        !network ? 'Choose a network.'
            : !isLocalMomoNumber(accountNumber) ? 'Enter a 10-digit mobile money number.'
                : nc.validating ? 'Checking the account name…'
                    : !nc.hasUsableName ? (nc.canUseManual ? 'Type the account holder name to continue.' : 'We need to confirm the account name first.')
                        : null
    const canSubmit = !amountBlocker && !destBlocker && !submitting

    const handleSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/commission/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountNum, momoNumber: accountNumber, network,
                    ...(nc.usingManual ? { manualAccountName: nc.normalizedManualName } : {}),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!data.success) throw new Error(data.error || 'Could not submit the withdrawal.')

            setReceipt({ net: netAmount, name: nc.receiverName, number: accountNumber, network: String(network) })
            setStep(4)
            setAmount('')
            nc.reset()
            loadWallet()
        } catch (err: any) {
            // Stay on the review step so nothing the person typed is lost.
            toast.error(err.message || 'Could not submit the withdrawal.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>

    const stage = {
        1: { heading: 'How much commission do you want to cash out?', lead: `You have ${formatCurrency(limits.balance)} earned from your network. You will see the fee before anything moves.` },
        2: { heading: `Where should the ${formatCurrency(amountNum)} go?`, lead: 'Enter the mobile money number. We confirm the name on it first, so it never lands with the wrong person.' },
        3: { heading: 'One last look.', lead: 'Your commission balance is debited the moment you confirm.' },
        4: { heading: 'Done. It is on its way.', lead: 'An admin approves commission payouts, so it is not instant. We will update the status in your commission wallet.' },
    }[step]

    const chips = [
        ...(limits.min > 0 && limits.min <= limits.balance ? [{ label: `Smallest · ${formatCurrency(limits.min)}`, value: limits.min }] : []),
        ...(limits.balance > 0 ? [{ label: 'All of it', value: Math.floor(limits.balance * 100) / 100 }] : []),
    ]

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="space-y-4">
                <Link href="/dashboard/commission" className={cn('-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground', FOCUS)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Commission wallet
                </Link>
                {loadFailed && (
                    <Notice>
                        We could not load your commission wallet just now. Your money is safe.{' '}
                        <button type="button" onClick={() => { setLoading(true); loadWallet() }} className={cn('font-semibold underline underline-offset-4', FOCUS)}>Try again</button>
                    </Notice>
                )}
                {!loadFailed && !hasWallet && <Notice tone="info">You do not have a commission wallet yet. It is created when you earn your first commission.</Notice>}
            </div>

            <PayoutStage
                step={step} heading={stage.heading} lead={stage.lead}
                balanceLabel="Commission balance" balance={limits.balance}
                footnote={`Smallest withdrawal ${formatCurrency(limits.min)} · Fee ${limits.feePercent}%${limits.feeFlat > 0 ? ` + ${formatCurrency(limits.feeFlat)}` : ''}`}
            >
                {step === 1 && (
                    <AmountStep
                        amount={amount} onAmountChange={setAmount} chips={chips}
                        amountNum={amountNum} fee={totalFee} net={netAmount}
                        blocker={amountBlocker} onContinue={() => setStep(2)}
                    />
                )}

                {step === 2 && (
                    <div className="space-y-5">
                        <SelectField
                            label="Network" value={network} placeholder="Choose a network"
                            options={MOMO_NETWORKS.map(n => ({ value: n, label: n }))}
                            onChange={(v) => { setNetwork(v as MomoNetwork); nc.reset() }}
                        />
                        <TextField
                            id="momo" label="Mobile money number" value={momoNumber} inputMode="tel" mono placeholder="024 123 4567"
                            onChange={(v) => { setMomoNumber(v); nc.reset() }}
                        />
                        <NameCheckPanel
                            nc={nc}
                            recheck={nc.validationError && !nc.validating ? {
                                label: 'Check again',
                                disabled: !network || !isLocalMomoNumber(accountNumber),
                                onClick: () => nc.check(accountNumber, String(network)),
                            } : null}
                        />
                        <ContinueRow blocker={destBlocker} onContinue={() => setStep(3)} onBack={() => setStep(1)} />
                    </div>
                )}

                {step === 3 && (
                    <ReviewStep
                        net={netAmount} submitting={submitting} canSubmit={canSubmit}
                        onConfirm={handleSubmit} onBack={() => setStep(2)}
                        rows={[
                            { label: 'Taken from commission', value: formatCurrency(amountNum), strong: true },
                            { label: 'Fee', value: formatCurrency(totalFee) },
                            { label: 'To', value: nc.receiverName, strong: true },
                            { label: 'Number', value: accountNumber, mono: true },
                            { label: 'Network', value: network },
                        ]}
                    />
                )}

                {step === 4 && receipt && (
                    <DoneStep
                        net={receipt.net} name={receipt.name} detail={`${receipt.number} · ${receipt.network}`}
                        note="Your commission balance has been debited. If the payout cannot be made, the full amount goes back to it."
                    >
                        <Link href="/dashboard/commission" className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold', FOCUS)}>
                            Back to commission wallet
                        </Link>
                        <ClayButton type="button" variant="black" onClick={() => { setReceipt(null); setStep(1) }}>Make another withdrawal</ClayButton>
                    </DoneStep>
                )}
            </PayoutStage>
        </div>
    )
}
