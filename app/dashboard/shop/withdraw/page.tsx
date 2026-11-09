'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
    AlertCircle, ArrowLeft, ArrowRight, BookUser, Check, CheckCircle2, Clock, Landmark,
    Loader2, Plus, ShieldCheck, Smartphone, Star, Trash2, XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { roleFeeSettingKeys, resolveRoleFeeSetting } from '@/lib/pricing/shop-fee-resolver'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClayButton, Notice } from '@/components/auth/fields'

// ─────────────────────────────────────────────
// Constants and types
// ─────────────────────────────────────────────

const NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] as const
type Network = typeof NETWORKS[number]

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

const MANUAL_NAME_CHARS = /[^A-Za-zÀ-ÖØ-öø-ÿ '.\-]/g
const round2 = (n: number) => Math.round(n * 100) / 100

// The server only accepts digit-only MoMo numbers. Accept what people actually type
// (spaces, dashes, +233...) and normalise to the local 0XXXXXXXXX form.
const cleanNumber = (raw: string, type: 'momo' | 'bank') =>
    type === 'momo' ? raw.replace(/[\s-]/g, '').replace(/^\+?233/, '0') : raw.trim()

const FIELD = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500'
const SELECT_TRIGGER = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none focus:ring-2 focus:ring-black focus:ring-offset-0 dark:focus:ring-brand-500'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

function StepHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="clay-black mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">{n}</span>
            <div>
                <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
                {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
            </div>
        </div>
    )
}

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
    const [confirmOpen, setConfirmOpen] = useState(false)

    // Name check
    const [verifiedName, setVerifiedName] = useState<string | null>(null)
    const [validating, setValidating] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    // True only when the provider answered "can't resolve this account" (or was down).
    // A malformed number or an exhausted daily quota must NOT unlock free-text names.
    const [manualAllowed, setManualAllowed] = useState(false)
    const [manualName, setManualName] = useState('')
    const lastChecked = useRef('')

    // Saved methods dialog
    const [savedModalOpen, setSavedModalOpen] = useState(false)
    const [newNetwork, setNewNetwork] = useState<Network | ''>('')
    const [newMomoNumber, setNewMomoNumber] = useState('')
    const [addingDetail, setAddingDetail] = useState(false)

    const isManual = selectedSavedId === 'manual'
    const normalizedManualName = manualName.trim().replace(/\s+/g, ' ')
    const canUseManual = !!validationError && manualAllowed && !validating && !verifiedName
    const manualNameValid = normalizedManualName.length >= 2

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
    }, [dbUser])

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

    // ─── Name check ──────────────────────────────────────────────────────────
    const resetCheck = () => {
        lastChecked.current = ''
        setVerifiedName(null)
        setValidationError(null)
        setManualAllowed(false)
        setManualName('')
    }

    const runCheck = useCallback((phone: string, net: string, bankId?: string) => {
        setValidating(true)
        setVerifiedName(null)
        setValidationError(null)
        setManualAllowed(false)
        setManualName('') // a stale manual name must never ride along with a new number

        fetch('/api/shop/validate-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, network: net, bankId }),
        })
            .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
            .then(({ ok, data }) => {
                if (data.success && data.name) {
                    setVerifiedName(data.name)
                } else {
                    // Free-text names are only for "the provider couldn't resolve it" (HTTP 200,
                    // success:false). A 400 (bad format), 429 (daily limit) or 5xx is not that.
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

    // MoMo: check the name by itself as soon as a full number and a network are in.
    useEffect(() => {
        if (!isManual || paymentType !== 'momo' || !network || network === 'Bank') return
        const num = cleanNumber(momoNumber, 'momo')
        if (!/^0\d{9}$/.test(num)) return
        const key = `${network}:${num}`
        const t = setTimeout(() => {
            if (lastChecked.current === key) return
            lastChecked.current = key
            runCheck(num, network)
        }, 400)
        return () => clearTimeout(t)
    }, [isManual, paymentType, network, momoNumber, runCheck])

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
    const totalFee = round2((amountNum * limits.withdrawal_fee_percent) / 100 + limits.withdrawal_fee_flat)
    const netAmount = round2(amountNum - totalFee)
    const accountNumber = cleanNumber(momoNumber, paymentType)
    const bankName = banks.find(b => b.id === selectedBankId)?.name
    const hasUsableName = !!verifiedName || (canUseManual && manualNameValid)
    const receiverName = verifiedName || (canUseManual && manualNameValid ? normalizedManualName : '')
    const savedActive = !isManual ? savedDetails.find(s => s.id === selectedSavedId) : null

    // The single reason the button is disabled, shown under it in plain words.
    const blocker =
        amountNum <= 0 ? 'Enter how much you want to withdraw.'
            : amountNum > balance ? 'That is more than your available balance.'
                : amountNum < limits.min_withdrawal_amount ? `The minimum withdrawal is ${formatCurrency(limits.min_withdrawal_amount)}.`
                    : netAmount <= 0 ? 'That amount does not cover the processing fee.'
                        : !network || (paymentType === 'bank' && !selectedBankId) ? (paymentType === 'bank' ? 'Choose your bank.' : 'Choose a network.')
                            : !accountNumber ? (paymentType === 'bank' ? 'Enter the account number.' : 'Enter the mobile money number.')
                                : validating ? 'Checking the account name…'
                                    : !hasUsableName ? (canUseManual ? 'Type the account holder name to continue.' : 'We need to confirm the account name first.')
                                        : null
    const canSubmit = !blocker && !submitting

    const setAmountClean = (raw: string) => {
        if (/^\d*\.?\d{0,2}$/.test(raw)) setAmount(raw)
    }
    const withdrawAll = () => setAmount(String(Math.floor(balance * 100) / 100))

    const handleSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            const isSaved = selectedSavedId !== 'manual'
            const usingManualFallback = !verifiedName && canUseManual && manualNameValid
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
                    ...(!isSaved && usingManualFallback ? { manualAccountName: normalizedManualName } : {}),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                const detail = Array.isArray(data.details) && data.details.length > 0
                    ? String(data.details[0]).replace(/^[^:]*:\s*/, '')
                    : null
                throw new Error(detail || data.error || 'Could not submit the withdrawal.')
            }

            toast.success('Withdrawal requested. We will review it on the next business day.')
            setConfirmOpen(false)
            setAmount('')
            setSaveForLater(false)
            // A saved account stays selected for next time; a one-off account is checked again.
            if (!isSaved) resetCheck()
            fetchData()
        } catch (err: any) {
            setConfirmOpen(false)
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

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
                <Link href="/dashboard/shop" className={cn('-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground', FOCUS)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Your shop
                </Link>
                <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Withdraw your earnings</h1>
                <p className="text-sm text-muted-foreground">Move profit from your shop wallet to mobile money{showMethodSwitch ? ' or a bank account' : ''}.</p>
            </div>

            {loadFailed && (
                <Notice>
                    We could not load your wallet just now. Your money is safe.{' '}
                    <button type="button" onClick={() => fetchData(true)} className={cn('font-semibold underline underline-offset-4', FOCUS)}>Try again</button>
                </Notice>
            )}

            {/* Balance */}
            <section className="relative isolate overflow-hidden rounded-[2rem] bg-black p-6 text-white sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -bottom-24 right-24 -z-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
                <p className="text-sm text-silver-200">Ready to withdraw</p>
                <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight text-brand-500 sm:text-5xl">{formatCurrency(balance)}</p>
                <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <div><dt className="text-silver-200">Earned so far</dt><dd className="font-semibold tabular-nums">{formatCurrency(wallet?.total_earned || 0)}</dd></div>
                    <div><dt className="text-silver-200">Paid out so far</dt><dd className="font-semibold tabular-nums">{formatCurrency(wallet?.total_withdrawn || 0)}</dd></div>
                    <div><dt className="text-silver-200">Minimum</dt><dd className="font-semibold tabular-nums">{formatCurrency(limits.min_withdrawal_amount)}</dd></div>
                    <div><dt className="text-silver-200">Fee</dt><dd className="font-semibold tabular-nums">{limits.withdrawal_fee_percent}%{limits.withdrawal_fee_flat > 0 ? ` + ${formatCurrency(limits.withdrawal_fee_flat)}` : ''}</dd></div>
                </dl>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-12">
                {/* Steps */}
                <div className="neu-raised space-y-8 rounded-[2rem] p-6 sm:p-8 lg:col-span-7">
                    {/* 1 — amount */}
                    <section className="space-y-4">
                        <StepHeading n={1} title="How much?" />
                        <div className="neu-inset flex items-center gap-2 rounded-2xl px-4">
                            <span className="font-display text-xl font-semibold text-muted-foreground">GHS</span>
                            <Input
                                id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount}
                                onChange={(e) => setAmountClean(e.target.value)} aria-label="Amount to withdraw in cedis"
                                className="h-16 border-0 bg-transparent px-1 font-display text-3xl font-bold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[limits.min_withdrawal_amount, round2(Math.floor(balance) / 2)].filter((v, i, a) => v > 0 && v >= limits.min_withdrawal_amount && v <= balance && a.indexOf(v) === i).map((v, i) => (
                                <button key={i} type="button" onClick={() => setAmount(String(v))} className={cn('neu-press neu-raised-sm rounded-full px-4 py-1.5 text-sm font-semibold', FOCUS)}>
                                    {i === 0 ? `Minimum ${formatCurrency(v)}` : `Half ${formatCurrency(v)}`}
                                </button>
                            ))}
                            {balance > 0 && (
                                <button type="button" onClick={withdrawAll} className={cn('neu-press neu-raised-sm rounded-full px-4 py-1.5 text-sm font-semibold', FOCUS)}>
                                    Everything
                                </button>
                            )}
                        </div>
                    </section>

                    {/* 2 — destination */}
                    <section className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <StepHeading n={2} title="Where should it go?" hint="We confirm the name on the account before you send." />
                            {paymentType === 'momo' && (
                                <button type="button" onClick={() => setSavedModalOpen(true)} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-800 hover:underline dark:text-brand-400', FOCUS)}>
                                    <BookUser className="h-4 w-4" /> {savedDetails.length === 0 ? 'Save an account' : 'Manage saved'}
                                </button>
                            )}
                        </div>

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

                        {paymentType === 'momo' && savedDetails.length > 0 && (
                            <div role="radiogroup" aria-label="Saved accounts" className="grid gap-2.5 sm:grid-cols-2">
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
                                    <span className="flex-1 text-sm font-semibold">Another account</span>
                                    {isManual && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                            </div>
                        )}

                        {savedActive && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                Sending to <strong className="text-foreground">{savedActive.account_name}</strong>, confirmed when you saved it.
                            </p>
                        )}

                        {showManualForm && (
                            <div className="space-y-4">
                                {paymentType === 'momo' ? (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Network</Label>
                                        <div className="neu-inset rounded-xl">
                                            <Select value={network} onValueChange={(v) => { setNetwork(v as Network); resetCheck() }}>
                                                <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="Choose a network" /></SelectTrigger>
                                                <SelectContent>{NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">Bank</Label>
                                            <div className="neu-inset rounded-xl">
                                                <Select value={selectedBankId} onValueChange={(v) => { setSelectedBankId(v); resetCheck() }}>
                                                    <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="Choose your bank" /></SelectTrigger>
                                                    <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="branch" className="text-sm font-semibold">Branch <span className="font-normal text-muted-foreground">(optional)</span></Label>
                                            <div className="neu-inset rounded-xl">
                                                <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. Accra Main" className={FIELD} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="momo" className="text-sm font-semibold">{paymentType === 'momo' ? 'Mobile money number' : 'Account number'}</Label>
                                    <div className="neu-inset rounded-xl">
                                        <Input
                                            id="momo" value={momoNumber} inputMode={paymentType === 'momo' ? 'tel' : 'text'} autoComplete="off"
                                            onChange={(e) => { setMomoNumber(e.target.value); resetCheck() }}
                                            placeholder={paymentType === 'momo' ? '024 123 4567' : 'Account number'} className={cn(FIELD, 'font-mono')}
                                        />
                                    </div>
                                </div>

                                {/* Name result */}
                                <div aria-live="polite" className="space-y-2">
                                    {validating && (
                                        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking the account name…</p>
                                    )}
                                    {verifiedName && !validating && (
                                        <div className="neu-inset flex items-center gap-3 rounded-xl px-4 py-3">
                                            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">Account holder</p>
                                                <p className="truncate font-semibold">{verifiedName}</p>
                                            </div>
                                        </div>
                                    )}
                                    {validationError && !validating && !canUseManual && <Notice>{validationError}</Notice>}
                                    {canUseManual && (
                                        <div className="space-y-2">
                                            <Notice tone="info">
                                                We could not look this account up automatically. Type the exact name registered on it. An admin checks it before paying, and a wrong name will delay or cancel the payout.
                                            </Notice>
                                            <div className="neu-inset rounded-xl">
                                                <Input
                                                    value={manualName} maxLength={100} autoComplete="off" spellCheck={false} aria-label="Account holder name"
                                                    onChange={(e) => setManualName(e.target.value.replace(MANUAL_NAME_CHARS, '').slice(0, 100))}
                                                    placeholder="Name on the account" className={FIELD}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {!verifiedName && !validating && (paymentType === 'bank' || validationError) && (
                                        <button
                                            type="button" disabled={!network || !accountNumber || (paymentType === 'bank' && !selectedBankId)}
                                            onClick={() => { lastChecked.current = `${network}:${accountNumber}`; runCheck(accountNumber, String(network), selectedBankId || undefined) }}
                                            className={cn('rounded-full text-sm font-semibold text-brand-800 underline underline-offset-4 disabled:opacity-50 dark:text-brand-400', FOCUS)}
                                        >
                                            {validationError ? 'Check again' : 'Check the account name'}
                                        </button>
                                    )}
                                </div>

                                {paymentType === 'momo' && !!verifiedName && !validating && savedDetails.length < MAX_SAVED && (
                                    <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                                        <input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} className="h-5 w-5 cursor-pointer accent-black dark:accent-brand-500" />
                                        Remember this account for next time
                                    </label>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Summary */}
                <aside className="space-y-4 lg:sticky lg:top-24 lg:col-span-5">
                    <div className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                        <h2 className="font-display text-lg font-semibold">Your payout</h2>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between"><dt className="text-muted-foreground">Withdrawing</dt><dd className="font-semibold tabular-nums">{amountNum > 0 ? formatCurrency(amountNum) : '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted-foreground">Fee ({limits.withdrawal_fee_percent}%{limits.withdrawal_fee_flat > 0 ? ` + ${formatCurrency(limits.withdrawal_fee_flat)}` : ''})</dt><dd className="tabular-nums">{amountNum > 0 ? `− ${formatCurrency(totalFee)}` : '—'}</dd></div>
                        </dl>
                        <div className="neu-inset rounded-2xl px-4 py-4">
                            <p className="text-xs text-muted-foreground">You receive</p>
                            <p className="font-display text-3xl font-bold tabular-nums">{amountNum > 0 ? formatCurrency(Math.max(0, netAmount)) : formatCurrency(0)}</p>
                        </div>
                        <div className="space-y-1 text-sm">
                            <p className="text-xs text-muted-foreground">Sent to</p>
                            {receiverName ? (
                                <>
                                    <p className="font-semibold">{receiverName}</p>
                                    <p className="font-mono text-xs text-muted-foreground">{accountNumber} · {paymentType === 'bank' ? (bankName || 'Bank') : network}</p>
                                </>
                            ) : (
                                <p className="text-muted-foreground">Choose an account in step 2.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <ClayButton type="button" onClick={() => setConfirmOpen(true)} disabled={!canSubmit}>
                                Review withdrawal <ArrowRight className="h-4 w-4" />
                            </ClayButton>
                            {blocker && <p className="text-center text-xs text-muted-foreground" aria-live="polite">{blocker}</p>}
                        </div>
                    </div>
                    <p className="px-2 text-center text-xs text-muted-foreground">
                        Payouts are reviewed on business days. Requests made at weekends or on public holidays are handled the next working day.
                    </p>
                </aside>
            </div>

            {/* History */}
            <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold">Recent withdrawals</h2>
                    <Link href="/dashboard/shop/earnings" className={cn('rounded text-sm font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400', FOCUS)}>All earnings</Link>
                </div>
                {history.length === 0 ? (
                    <div className="well rounded-3xl p-8 text-center text-sm text-muted-foreground">Nothing here yet. Your withdrawals will appear once you make one.</div>
                ) : (
                    <ul className="space-y-2.5">
                        {history.map(row => {
                            const cfg = STATUS[row.status] ?? STATUS.pending
                            const Icon = cfg.icon
                            const number = row.momo_number || row.account_number
                            return (
                                <li key={row.id} className="surface rounded-2xl p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                        <div className="min-w-0">
                                            <p className="font-display text-xl font-bold tabular-nums">{formatCurrency(row.net_amount)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(row.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {' · '}requested {formatCurrency(row.amount)}, fee {formatCurrency(row.fee)}
                                            </p>
                                        </div>
                                        <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', cfg.tone)}>
                                            <Icon className={cn('h-4 w-4', cfg.spin && 'animate-spin')} /> {cfg.label}
                                        </span>
                                    </div>
                                    <p className="mt-2 truncate text-sm text-muted-foreground">
                                        {row.account_name}{number ? ` · ${number}` : ''}{row.network ? ` · ${row.network}` : ''}
                                    </p>
                                    {(row.status === 'reversed' || row.status === 'failed') && row.failure_reason && (
                                        <p className="well mt-2 rounded-xl px-3 py-2 text-xs">{row.failure_reason}</p>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>

            {/* Confirm */}
            <Dialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o) }}>
                <DialogContent className="max-w-sm rounded-3xl" aria-describedby={undefined}>
                    <DialogHeader><DialogTitle className="font-display">Send this payout?</DialogTitle></DialogHeader>
                    <div className="space-y-4 text-sm">
                        <div className="neu-inset rounded-2xl px-4 py-4 text-center">
                            <p className="text-xs text-muted-foreground">You receive</p>
                            <p className="font-display text-3xl font-bold tabular-nums">{formatCurrency(Math.max(0, netAmount))}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(amountNum)} withdrawn, {formatCurrency(totalFee)} fee</p>
                        </div>
                        <dl className="space-y-1.5">
                            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Name</dt><dd className="text-right font-semibold">{receiverName}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{paymentType === 'bank' ? 'Account' : 'Number'}</dt><dd className="font-mono">{accountNumber}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{paymentType === 'bank' ? 'Bank' : 'Network'}</dt><dd>{paymentType === 'bank' ? (bankName || 'Bank') : network}</dd></div>
                        </dl>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Your wallet is debited straight away. Check the number: a payout to the wrong account may not be recoverable.</p>
                    </div>
                    <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
                        <ClayButton type="button" onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
                            {submitting ? 'Submitting' : 'Confirm and withdraw'}
                        </ClayButton>
                        <ClayButton type="button" variant="black" onClick={() => setConfirmOpen(false)} disabled={submitting}>Go back</ClayButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
