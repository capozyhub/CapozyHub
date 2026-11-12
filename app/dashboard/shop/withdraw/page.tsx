'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
    AlertCircle, ArrowLeft, BookUser, Check, CheckCircle2, Clock, Landmark,
    Loader2, Plus, ShieldCheck, Smartphone, Star, Trash2, XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { roleFeeSettingKeys, resolveRoleFeeSetting } from '@/lib/pricing/shop-fee-resolver'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClayButton, Notice } from '@/components/auth/fields'
import {
    AmountStep, ContinueRow, DoneStep, NameCheckPanel, PayoutStage, ReviewStep, SelectField, TextField,
    type PayoutStep,
} from '@/components/dashboard/payout/payout-stage'
import {
    FIELD, FOCUS, MOMO_NETWORKS, SELECT_TRIGGER, cleanMomoNumber, computeFee, round2, useAccountNameCheck,
    type MomoNetwork,
} from '@/components/dashboard/payout/payout-kit'

// ─────────────────────────────────────────────
// Constants and types
// ─────────────────────────────────────────────

const NETWORKS = MOMO_NETWORKS
type Network = MomoNetwork

// Telco brand colours are kept on purpose: people recognise their network at a glance.
const NETWORK_CHIP: Record<Network, string> = {
    'MTN MoMo': 'bg-yellow-400 text-black',
    'Telecel Cash': 'bg-red-600 text-white',
    'AirtelTigo Money': 'bg-blue-600 text-white',
}
const NETWORK_SHORT: Record<Network, string> = { 'MTN MoMo': 'MTN', 'Telecel Cash': 'TC', 'AirtelTigo Money': 'AT' }

const MAX_SAVED = 5

interface ShopWallet { id: string; balance: number; total_earned: number; total_withdrawn: number }

interface WithdrawalRequest {
    id: string
    amount: number
    fee: number
    net_amount: number
    account_name: string
    momo_number: string | null
    account_number: string | null
    network: string | null
    status: string
    failure_reason: string | null
    created_at: string
}

interface Limits { withdrawal_fee_percent: number; withdrawal_fee_flat: number; min_withdrawal_amount: number }

interface SavedDetail {
    id: string
    account_name: string
    momo_number: string
    network: Network
    is_default: boolean
    payment_type?: 'momo' | 'bank'
}

interface BankEntry { id: string; name: string }

const STATUS: Record<string, { label: string; tone: string; icon: typeof Clock; spin?: boolean }> = {
    pending: { label: 'In review', tone: 'text-amber-700 dark:text-amber-400', icon: Clock },
    shop_owner_pending: { label: 'In review', tone: 'text-amber-700 dark:text-amber-400', icon: Clock },
    moolre_pending: { label: 'Sending', tone: 'text-sky-700 dark:text-sky-400', icon: Loader2, spin: true },
    paystack_pending: { label: 'Sending', tone: 'text-sky-700 dark:text-sky-400', icon: Loader2, spin: true },
    completed: { label: 'Paid', tone: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    failed: { label: 'Failed', tone: 'text-red-700 dark:text-red-400', icon: AlertCircle },
    reversed: { label: 'Returned to wallet', tone: 'text-red-700 dark:text-red-400', icon: XCircle },
}

// Saved/typed MoMo numbers are normalised to the local 0XXXXXXXXX form; bank account numbers are only trimmed.
const cleanNumber = (raw: string, type: 'momo' | 'bank') => (type === 'momo' ? cleanMomoNumber(raw) : raw.trim())

function NetworkChip({ network, size = 'md' }: { network: Network; size?: 'sm' | 'md' }) {
    return (
        <span className={cn('flex shrink-0 items-center justify-center rounded-xl font-bold', size === 'md' ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[10px]', NETWORK_CHIP[network])}>
            {NETWORK_SHORT[network]}
        </span>
    )
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function ShopWithdrawPage() {
    const { dbUser } = useAuth()

    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [history, setHistory] = useState<WithdrawalRequest[]>([])
    const [savedDetails, setSavedDetails] = useState<SavedDetail[]>([])
    const [limits, setLimits] = useState<Limits>({ withdrawal_fee_percent: 0, withdrawal_fee_flat: 0, min_withdrawal_amount: 0 })
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [banks, setBanks] = useState<BankEntry[]>([])

    // Form
    const [amount, setAmount] = useState('')
    const [selectedSavedId, setSelectedSavedId] = useState<string>('manual')
    const [network, setNetwork] = useState<Network | 'Bank' | ''>('')
    const [momoNumber, setMomoNumber] = useState('')
    const [paymentType, setPaymentType] = useState<'momo' | 'bank'>('momo')
    const [selectedBankId, setSelectedBankId] = useState('')
    const [branch, setBranch] = useState('')
    const [saveForLater, setSaveForLater] = useState(false)
    // 1 amount, 2 destination, 3 review, 4 done
    const [step, setStep] = useState<PayoutStep>(1)
    const [receipt, setReceipt] = useState<{ net: number; name: string; number: string; via: string } | null>(null)

    // Saved methods dialog
    const [savedModalOpen, setSavedModalOpen] = useState(false)
    const [newNetwork, setNewNetwork] = useState<Network | ''>('')
    const [newMomoNumber, setNewMomoNumber] = useState('')
    const [addingDetail, setAddingDetail] = useState(false)

    const isManual = selectedSavedId === 'manual'
    const accountNumber = cleanNumber(momoNumber, paymentType)

    // Name check. MoMo is checked by itself once a full number and a network are in; saved
    // accounts were verified when saved and bank accounts are checked on demand.
    const nc = useAccountNameCheck(isManual && paymentType === 'momo' && network && network !== 'Bank' ? { network, number: accountNumber } : null)
    const { setVerifiedName } = nc

    // ─── Data ────────────────────────────────────────────────────────────────
    // applyDefault is true only on the first load. Later refreshes (after a submit,
    // delete or set-default) must not overwrite what the user is in the middle of picking.
    const fetchData = useCallback(async (applyDefault = false) => {
        try {
            const db = supabase as any
            const ownerRole = dbUser!.role || 'customer'
            const feeKeys = [
                ...roleFeeSettingKeys(ownerRole, 'withdrawal_fee_percent'),
                ...roleFeeSettingKeys(ownerRole, 'withdrawal_fee_flat'),
                ...roleFeeSettingKeys(ownerRole, 'min_withdrawal_amount'),
            ]

            // Wallet first: the history query must be scoped to THIS wallet. RLS also lets
            // admins read every wallet and Leads read their sub-agents', so an unscoped
            // select would mix other people's withdrawals into this page.
            const walletRes = await db.from('shop_wallets').select('*').eq('owner_id', dbUser!.id).maybeSingle()

            const [historyRes, settingsRes, shopRes, savedRes] = await Promise.all([
                walletRes.data
                    ? db.from('shop_wallet_transactions').select('*').eq('type', 'withdrawal')
                        .eq('shop_wallet_id', walletRes.data.id).order('created_at', { ascending: false }).limit(20)
                    : Promise.resolve({ data: [] }),
                db.from('shop_global_settings').select('key, value').in('key', feeKeys),
                db.from('shop_profiles').select('withdrawal_fee_percent, withdrawal_fee_flat, min_withdrawal_amount').eq('owner_id', dbUser!.id).maybeSingle(),
                db.from('shop_payment_details').select('*').eq('shop_owner_id', dbUser!.id).order('is_default', { ascending: false }),
            ])

            if (walletRes.error && walletRes.error.code !== 'PGRST116') throw walletRes.error
            if (walletRes.data) setWallet(walletRes.data)
            setHistory(historyRes.data || [])
            setSavedDetails(savedRes.data || [])
            setLoadFailed(false)

            // Same resolver and same hardcoded defaults (50 / 2% / 0) as /api/shop/withdraw and
            // process_shop_withdrawal, so the summary shown here is what is charged.
            const globalMap: Record<string, string | number | null> = {}
            for (const row of (settingsRes.data || [])) globalMap[row.key] = row.value
            const sp = shopRes.data
            setLimits({
                min_withdrawal_amount: resolveRoleFeeSetting(globalMap, ownerRole, 'min_withdrawal_amount', 50, sp?.min_withdrawal_amount),
                withdrawal_fee_percent: resolveRoleFeeSetting(globalMap, ownerRole, 'withdrawal_fee_percent', 2, sp?.withdrawal_fee_percent),
                withdrawal_fee_flat: resolveRoleFeeSetting(globalMap, ownerRole, 'withdrawal_fee_flat', 0, sp?.withdrawal_fee_flat),
            })

            // Saved details are MoMo-only (shop_payment_details.network is constrained to the
            // MoMo networks), so only a MoMo default can be pre-selected.
            const defaultDetail = applyDefault
                ? (savedRes.data as SavedDetail[] | null)?.find(d => d.is_default && (d.payment_type || 'momo') === 'momo')
                : null
            if (defaultDetail) {
                setSelectedSavedId(defaultDetail.id)
                setNetwork(defaultDetail.network)
                setMomoNumber(defaultDetail.momo_number)
                setPaymentType('momo')
                setVerifiedName(defaultDetail.account_name) // verified when it was saved
            }
        } catch (err) {
            console.error('[withdraw] load failed', err)
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }, [dbUser, setVerifiedName])

    useEffect(() => {
        if (dbUser) fetchData(true)
    }, [dbUser, fetchData])

    // Bank transfers need the provider's bank list. When it can't be loaded the option is
    // simply not offered, instead of leading people into a dead end.
    useEffect(() => {
        fetch('/api/shop/banks')
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.banks)) setBanks(d.banks) })
            .catch(() => { /* bank option stays hidden */ })
    }, [])

    const resetCheck = nc.reset

    // ─── Selection handlers ──────────────────────────────────────────────────
    const selectSaved = (id: string) => {
        setSelectedSavedId(id)
        resetCheck()
        if (id === 'manual') {
            setNetwork('')
            setMomoNumber('')
            setSelectedBankId('')
            setBranch('')
            return
        }
        const d = savedDetails.find(s => s.id === id)
        if (!d) return
        setNetwork(d.network)
        setMomoNumber(d.momo_number)
        setPaymentType('momo')
        setSelectedBankId('')
        setBranch('')
        setVerifiedName(d.account_name)
    }

    const switchMethod = (type: 'momo' | 'bank') => {
        if (type === paymentType) return
        setPaymentType(type)
        setSelectedSavedId('manual')
        setNetwork(type === 'bank' ? 'Bank' : '')
        setSelectedBankId('')
        setBranch('')
        setMomoNumber('')
        setSaveForLater(false)
        resetCheck()
    }

    // ─── Money maths (rounded exactly as the server rounds it) ───────────────
    const balance = wallet?.balance || 0
    const amountNum = parseFloat(amount) || 0
    const { fee: totalFee, net: netAmount } = computeFee(amountNum, limits.withdrawal_fee_percent, limits.withdrawal_fee_flat)
    const bankName = banks.find(b => b.id === selectedBankId)?.name
    const savedActive = !isManual ? savedDetails.find(s => s.id === selectedSavedId) : null

    // Why the current step's button is disabled, in plain words. Each step has its own.
    const amountBlocker =
        amountNum <= 0 ? 'Type an amount to continue.'
            : amountNum > balance ? 'That is more than you have available.'
                : amountNum < limits.min_withdrawal_amount ? `The smallest withdrawal is ${formatCurrency(limits.min_withdrawal_amount)}.`
                    : netAmount <= 0 ? 'That is too small to cover the fee.'
                        : null
    const destBlocker =
        !network || (paymentType === 'bank' && !selectedBankId) ? (paymentType === 'bank' ? 'Choose your bank.' : 'Choose a network.')
            : !accountNumber ? (paymentType === 'bank' ? 'Enter the account number.' : 'Enter the mobile money number.')
                : nc.validating ? 'Checking the account name…'
                    : !nc.hasUsableName ? (nc.canUseManual ? 'Type the account holder name to continue.' : 'We need to confirm the account name first.')
                        : null
    const canSubmit = !amountBlocker && !destBlocker && !submitting

    const handleSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            const isSaved = selectedSavedId !== 'manual'
            const res = await fetch('/api/shop/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountNum,
                    momoNumber: accountNumber,
                    network,
                    payment_type: paymentType,
                    bankId: selectedBankId || undefined,
                    branch: branch.trim() || undefined,
                    saveForLater: saveForLater && !isSaved && paymentType === 'momo',
                    // A saved account is looked up server-side by id; nothing about it is trusted from here.
                    ...(isSaved ? { savedDetailId: selectedSavedId } : {}),
                    ...(!isSaved && nc.usingManual ? { manualAccountName: nc.normalizedManualName } : {}),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                const detail = Array.isArray(data.details) && data.details.length > 0
                    ? String(data.details[0]).replace(/^[^:]*:\s*/, '')
                    : null
                throw new Error(detail || data.error || 'Could not submit the withdrawal.')
            }

            setReceipt({
                net: netAmount,
                name: nc.receiverName,
                number: accountNumber,
                via: paymentType === 'bank' ? (bankName || 'Bank') : String(network),
            })
            setStep(4)
            setAmount('')
            setSaveForLater(false)
            // A saved account stays selected for next time; a one-off account is checked again.
            if (!isSaved) resetCheck()
            fetchData()
        } catch (err: any) {
            // Stay on the review step so nothing the person typed is lost.
            toast.error(err.message || 'Could not submit the withdrawal.')
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Saved methods ───────────────────────────────────────────────────────
    const handleAddSaved = async () => {
        if (!newNetwork) { toast.error('Choose a network.'); return }
        if (!newMomoNumber.trim()) { toast.error('Enter the mobile money number.'); return }
        if (savedDetails.length >= MAX_SAVED) { toast.error(`You can keep up to ${MAX_SAVED} saved accounts.`); return }

        setAddingDetail(true)
        try {
            // The server confirms the name with the provider and stores it; saved accounts are
            // trusted as verified at withdrawal time, so the browser never writes them.
            const res = await fetch('/api/shop/payment-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ momoNumber: cleanNumber(newMomoNumber, 'momo'), network: newNetwork }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                toast.error(data.error || 'We could not confirm that account.')
                return
            }
            toast.success(`Saved ${data.data?.account_name || 'account'}.`)
            setNewNetwork('')
            setNewMomoNumber('')
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Could not save the account.')
        } finally {
            setAddingDetail(false)
        }
    }

    const handleDeleteSaved = async (id: string) => {
        const d = savedDetails.find(s => s.id === id)
        if (!window.confirm(`Remove ${d ? `${d.account_name} (${d.momo_number})` : 'this account'}? You will need to confirm it again to add it back.`)) return
        const { error } = await (supabase as any).from('shop_payment_details').delete().eq('id', id)
        if (error) { toast.error('Could not remove the account.'); return }
        toast.success('Account removed.')
        if (selectedSavedId === id) selectSaved('manual') // never leave the form pointing at a deleted row
        fetchData()
    }

    const handleSetDefault = async (id: string) => {
        const res = await fetch('/api/shop/payment-details', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (!res.ok) toast.error('Could not change the default account.')
        fetchData()
    }

    // ─── Render ──────────────────────────────────────────────────────────────
    if (loading) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
    }

    const showMethodSwitch = banks.length > 0
    const showManualForm = isManual || paymentType === 'bank'
    const via = paymentType === 'bank' ? (bankName || 'Bank') : String(network || '')

    // The headline talks to you, one question at a time, like the sign-up flow.
    const stage = {
        1: { heading: 'How much do you want to cash out?', lead: `You have ${formatCurrency(balance)} ready. You will see the fee before anything leaves your wallet.` },
        2: { heading: `Where should the ${formatCurrency(amountNum)} go?`, lead: 'Pick a saved account or add a new one. We confirm the name first, so it never lands with the wrong person.' },
        3: { heading: 'One last look.', lead: 'Your wallet is debited the moment you confirm.' },
        4: { heading: 'Done. It is on its way.', lead: 'We review payouts on business days. Follow this one under Past payouts below.' },
    }[step]

    // Quick-fill buttons under the amount box: the smallest allowed, half, and everything.
    const chips = [
        ...[limits.min_withdrawal_amount, round2(Math.floor(balance) / 2)]
            .filter((v, i, a) => v > 0 && v >= limits.min_withdrawal_amount && v <= balance && a.indexOf(v) === i)
            .map((v, i) => ({ label: `${i === 0 ? 'Smallest' : 'Half'} · ${formatCurrency(v)}`, value: v })),
        ...(balance > 0 ? [{ label: 'All of it', value: Math.floor(balance * 100) / 100 }] : []),
    ]

    return (
        <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="space-y-4">
                <Link href="/dashboard/shop" className={cn('-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground', FOCUS)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Your shop
                </Link>
                {loadFailed && (
                    <Notice>
                        We could not load your wallet just now. Your money is safe.{' '}
                        <button type="button" onClick={() => fetchData(true)} className={cn('font-semibold underline underline-offset-4', FOCUS)}>Try again</button>
                    </Notice>
                )}
            </div>

            {/* The stage: the same black panel and drawing swoosh as sign-in and sign-up */}
            <PayoutStage
                step={step} heading={stage.heading} lead={stage.lead}
                balanceLabel="Ready to withdraw" balance={balance}
                footnote={`Smallest withdrawal ${formatCurrency(limits.min_withdrawal_amount)} · Fee ${limits.withdrawal_fee_percent}%${limits.withdrawal_fee_flat > 0 ? ` + ${formatCurrency(limits.withdrawal_fee_flat)}` : ''}`}
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
                        {showMethodSwitch && (
                            <div role="radiogroup" aria-label="Payout type" className="well flex w-fit gap-1 rounded-2xl p-1">
                                {([['momo', 'Mobile money', Smartphone], ['bank', 'Bank account', Landmark]] as const).map(([key, label, Icon]) => (
                                    <button key={key} type="button" role="radio" aria-checked={paymentType === key} onClick={() => switchMethod(key)}
                                        className={cn('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors', FOCUS, paymentType === key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}>
                                        <Icon className="h-4 w-4" /> {label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {paymentType === 'momo' && (
                            <div className="space-y-2.5">
                                {savedDetails.length > 0 && (
                                    <div role="radiogroup" aria-label="Saved accounts" className="grid gap-2.5">
                                        {savedDetails.map(d => {
                                            const on = selectedSavedId === d.id
                                            return (
                                                <button key={d.id} type="button" role="radio" aria-checked={on} onClick={() => selectSaved(d.id)}
                                                    className={cn('flex items-center gap-3 rounded-2xl p-3.5 text-left transition-shadow', FOCUS, on ? 'neu-inset ring-2 ring-black dark:ring-brand-500' : 'neu-raised-sm')}>
                                                    <NetworkChip network={d.network} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-semibold">{d.account_name}</span>
                                                        <span className="block font-mono text-xs text-muted-foreground">{d.momo_number}</span>
                                                    </span>
                                                    {on && <Check className="h-4 w-4 shrink-0" />}
                                                </button>
                                            )
                                        })}
                                        <button type="button" role="radio" aria-checked={isManual} onClick={() => selectSaved('manual')}
                                            className={cn('flex items-center gap-3 rounded-2xl p-3.5 text-left transition-shadow', FOCUS, isManual ? 'neu-inset ring-2 ring-black dark:ring-brand-500' : 'neu-raised-sm')}>
                                            <span className="well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Plus className="h-4 w-4" /></span>
                                            <span className="flex-1 text-sm font-semibold">A different account</span>
                                            {isManual && <Check className="h-4 w-4 shrink-0" />}
                                        </button>
                                    </div>
                                )}
                                <button type="button" onClick={() => setSavedModalOpen(true)} className={cn('flex items-center gap-1.5 rounded-full text-sm font-semibold text-brand-800 underline-offset-4 hover:underline dark:text-brand-400', FOCUS)}>
                                    <BookUser className="h-4 w-4" /> {savedDetails.length === 0 ? 'Save an account for later' : 'Manage saved accounts'}
                                </button>
                            </div>
                        )}

                        {savedActive && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span>Sending to <strong className="text-foreground">{savedActive.account_name}</strong>, confirmed when you saved it.</span>
                            </p>
                        )}

                        {showManualForm && (
                            <div className="space-y-4">
                                {paymentType === 'momo' ? (
                                    <SelectField
                                        label="Network" value={network} placeholder="Choose a network"
                                        options={NETWORKS.map(n => ({ value: n, label: n }))}
                                        onChange={(v) => { setNetwork(v as Network); resetCheck() }}
                                    />
                                ) : (
                                    <>
                                        <SelectField
                                            label="Bank" value={selectedBankId} placeholder="Choose your bank"
                                            options={banks.map(b => ({ value: b.id, label: b.name }))}
                                            onChange={(v) => { setSelectedBankId(v); resetCheck() }}
                                        />
                                        <TextField id="branch" label="Branch" hint="optional" value={branch} onChange={setBranch} placeholder="e.g. Accra Main" />
                                    </>
                                )}

                                <TextField
                                    id="momo" label={paymentType === 'momo' ? 'Mobile money number' : 'Account number'} mono
                                    value={momoNumber} inputMode={paymentType === 'momo' ? 'tel' : 'text'}
                                    placeholder={paymentType === 'momo' ? '024 123 4567' : 'Account number'}
                                    onChange={(v) => { setMomoNumber(v); resetCheck() }}
                                />

                                <NameCheckPanel
                                    nc={nc}
                                    recheck={!nc.verifiedName && !nc.validating && (paymentType === 'bank' || nc.validationError) ? {
                                        label: nc.validationError ? 'Check again' : 'Check the account name',
                                        disabled: !network || !accountNumber || (paymentType === 'bank' && !selectedBankId),
                                        onClick: () => nc.check(accountNumber, String(network), selectedBankId || undefined),
                                    } : null}
                                />

                                {paymentType === 'momo' && !!nc.verifiedName && !nc.validating && savedDetails.length < MAX_SAVED && (
                                    <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                                        <input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} className="h-5 w-5 cursor-pointer accent-black dark:accent-brand-500" />
                                        Remember this account for next time
                                    </label>
                                )}
                            </div>
                        )}

                        <ContinueRow blocker={destBlocker} onContinue={() => setStep(3)} onBack={() => setStep(1)} />
                    </div>
                )}

                {step === 3 && (
                    <ReviewStep
                        net={netAmount} submitting={submitting} canSubmit={canSubmit}
                        onConfirm={handleSubmit} onBack={() => setStep(2)}
                        rows={[
                            { label: 'Taken from wallet', value: formatCurrency(amountNum), strong: true },
                            { label: 'Fee', value: formatCurrency(totalFee) },
                            { label: 'To', value: nc.receiverName, strong: true },
                            { label: paymentType === 'bank' ? 'Account' : 'Number', value: accountNumber, mono: true },
                            { label: paymentType === 'bank' ? 'Bank' : 'Network', value: via },
                        ]}
                    />
                )}

                {step === 4 && receipt && (
                    <DoneStep
                        net={receipt.net} name={receipt.name} detail={`${receipt.number} · ${receipt.via}`}
                        note="Your wallet has been debited. If we cannot pay it out, the full amount goes back to your wallet."
                    >
                        <ClayButton type="button" variant="black" onClick={() => { setReceipt(null); setStep(1) }}>
                            Make another withdrawal
                        </ClayButton>
                    </DoneStep>
                )}
            </PayoutStage>

            {/* Past payouts: a ledger, not a stack of cards */}
            <section className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <h2 className="font-display text-2xl font-semibold tracking-tight">Past payouts</h2>
                        <p className="text-sm text-muted-foreground">Everything you have taken out of your shop wallet.</p>
                    </div>
                    <Link href="/dashboard/shop/earnings" className={cn('shrink-0 rounded text-sm font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400', FOCUS)}>All earnings</Link>
                </div>
                {history.length === 0 ? (
                    <div className="well rounded-3xl p-8 text-center text-sm text-muted-foreground">No payouts yet. The first one you make will show up here.</div>
                ) : (
                    <ul className="neu-inset divide-y divide-border/60 overflow-hidden rounded-3xl">
                        {history.map(row => {
                            const cfg = STATUS[row.status] ?? STATUS.pending
                            const Icon = cfg.icon
                            const number = row.momo_number || row.account_number
                            return (
                                <li key={row.id} className="grid gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                                    <p className="text-xs text-muted-foreground sm:text-sm">
                                        {new Date(row.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{row.account_name}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {[number, row.network].filter(Boolean).join(' · ')} · took {formatCurrency(row.amount)}, fee {formatCurrency(row.fee)}
                                        </p>
                                        {(row.status === 'reversed' || row.status === 'failed') && row.failure_reason && (
                                            <p className="mt-1 text-xs text-red-700 dark:text-red-400">{row.failure_reason}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center sm:gap-0.5">
                                        <p className="font-display text-lg font-bold tabular-nums">{formatCurrency(row.net_amount)}</p>
                                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', cfg.tone)}>
                                            <Icon className={cn('h-3.5 w-3.5', cfg.spin && 'animate-spin')} /> {cfg.label}
                                        </span>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>

            {/* Saved accounts */}
            <Dialog open={savedModalOpen} onOpenChange={setSavedModalOpen}>
                <DialogContent className="max-w-md rounded-3xl" aria-describedby={undefined}>
                    <DialogHeader><DialogTitle className="font-display">Saved accounts</DialogTitle></DialogHeader>

                    <div className="max-h-64 space-y-2.5 overflow-y-auto">
                        {savedDetails.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No saved accounts yet. Add one below.</p>}
                        {savedDetails.map(d => (
                            <div key={d.id} className="well flex items-center gap-3 rounded-2xl p-3">
                                <NetworkChip network={d.network} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{d.account_name}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{d.momo_number}</p>
                                </div>
                                <button type="button" onClick={() => handleSetDefault(d.id)} aria-label={d.is_default ? 'Default account' : `Make ${d.account_name} the default`} className={cn('flex h-9 w-9 items-center justify-center rounded-lg', FOCUS, d.is_default ? 'text-brand-600' : 'text-muted-foreground hover:text-foreground')}>
                                    <Star className="h-4 w-4" fill={d.is_default ? 'currentColor' : 'none'} />
                                </button>
                                <button type="button" onClick={() => handleDeleteSaved(d.id)} aria-label={`Remove ${d.account_name}`} className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:text-red-700', FOCUS)}>
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {savedDetails.length < MAX_SAVED ? (
                        <div className="space-y-3 border-t pt-4">
                            <p className="text-sm font-semibold">Add an account ({savedDetails.length}/{MAX_SAVED})</p>
                            <div className="neu-inset rounded-xl">
                                <Select value={newNetwork} onValueChange={(v) => setNewNetwork(v as Network)}>
                                    <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="Choose a network" /></SelectTrigger>
                                    <SelectContent>{NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="neu-inset rounded-xl">
                                <Input inputMode="tel" autoComplete="off" placeholder="024 123 4567" value={newMomoNumber} onChange={(e) => setNewMomoNumber(e.target.value)} aria-label="Mobile money number" className={cn(FIELD, 'font-mono')} />
                            </div>
                            <p className="text-xs text-muted-foreground">We confirm the name on the account before saving it.</p>
                            <ClayButton type="button" onClick={handleAddSaved} loading={addingDetail}>
                                {addingDetail ? 'Checking' : 'Confirm and save'}
                            </ClayButton>
                        </div>
                    ) : (
                        <p className="border-t pt-3 text-center text-sm text-muted-foreground">You have {MAX_SAVED} saved accounts. Remove one to add another.</p>
                    )}

                    <DialogFooter><ClayButton type="button" variant="black" onClick={() => setSavedModalOpen(false)}>Done</ClayButton></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
