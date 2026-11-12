// The payout wizard shell and its steps, shared by the shop and commission withdraw pages.
'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClayButton, Notice } from '@/components/auth/fields'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { FIELD, FOCUS, MANUAL_NAME_CHARS, SELECT_TRIGGER, type AccountNameCheck } from './payout-kit'

export type PayoutStep = 1 | 2 | 3 | 4

const PROGRESS: Record<PayoutStep, number> = { 1: 0.25, 2: 0.55, 3: 0.85, 4: 1 }

/** The black stage with the drawing swoosh on one side and the form panel on the other. */
export function PayoutStage({ step, heading, lead, balanceLabel, balance, footnote, children }: {
    step: PayoutStep
    heading: string
    lead: string
    balanceLabel: string
    balance: number
    footnote: string
    children: ReactNode
}) {
    return (
        <div className="overflow-hidden rounded-[2rem] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.35)] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <aside className="relative isolate overflow-hidden bg-black px-6 pb-28 pt-8 text-white sm:px-10 sm:pb-32 lg:flex lg:min-h-[36rem] lg:flex-col lg:justify-between lg:p-10 lg:pb-10">
                <BrandSwoosh
                    progress={PROGRESS[step]}
                    className="pointer-events-none absolute bottom-10 -right-[28%] -z-10 w-full sm:bottom-12 sm:-right-[8%] sm:w-[75%] lg:-bottom-8 lg:-right-[30%] lg:w-[135%]"
                />
                <div>
                    <p className="mb-3 text-sm font-semibold text-brand-400" aria-live="polite">{step === 4 ? 'All set' : `Step ${step} of 3`}</p>
                    <h1
                        key={step}
                        className="max-w-md font-display text-[1.9rem] font-bold leading-[1.05] tracking-tight text-white text-balance animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:text-4xl xl:text-5xl"
                    >
                        {heading}
                    </h1>
                    <p className="mt-4 hidden max-w-md text-lg leading-relaxed text-silver-200 sm:block">{lead}</p>
                </div>
                <div className="mt-8 lg:mt-0">
                    <p className="text-xs uppercase tracking-wider text-silver-200">{balanceLabel}</p>
                    <p className="font-display text-3xl font-bold tabular-nums text-brand-500">{formatCurrency(balance)}</p>
                    <p className="mt-1 text-xs text-silver-200">{footnote}</p>
                </div>
            </aside>

            <section className="relative -mt-8 rounded-t-[2rem] bg-neu px-5 pb-8 pt-7 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10 lg:mt-0 lg:rounded-none lg:px-10 lg:py-10 lg:shadow-none">
                <div key={step} className="mx-auto w-full max-w-[30rem] animate-in fade-in duration-300 motion-reduce:animate-none">
                    {children}
                </div>
            </section>
        </div>
    )
}

export function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className={cn('mx-auto flex items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground', FOCUS)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
    )
}

/** Step 1: how much. `chips` are quick-fill buttons (smallest, half, all of it). */
export function AmountStep({ amount, onAmountChange, chips, amountNum, fee, net, blocker, onContinue }: {
    amount: string
    onAmountChange: (next: string) => void
    chips: { label: string; value: number }[]
    amountNum: number
    fee: number
    net: number
    blocker: string | null
    onContinue: () => void
}) {
    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-semibold">Amount in cedis</Label>
                <div className="neu-inset flex items-center gap-2 rounded-2xl px-4">
                    <span className="font-display text-xl font-semibold text-muted-foreground">GHS</span>
                    <Input
                        id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} autoFocus
                        onChange={(e) => { if (/^\d*\.?\d{0,2}$/.test(e.target.value)) onAmountChange(e.target.value) }}
                        className="h-16 border-0 bg-transparent px-1 font-display text-3xl font-bold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                </div>
            </div>
            {chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {chips.map(c => (
                        <button key={c.label} type="button" onClick={() => onAmountChange(String(c.value))} className={cn('neu-press neu-raised-sm rounded-full px-4 py-1.5 text-sm font-semibold', FOCUS)}>
                            {c.label}
                        </button>
                    ))}
                </div>
            )}
            <div className="well space-y-1.5 rounded-2xl px-4 py-3.5 text-sm" aria-live="polite">
                <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="tabular-nums">{amountNum > 0 ? formatCurrency(fee) : '—'}</span></div>
                <div className="flex justify-between font-semibold"><span>You will receive</span><span className="tabular-nums">{amountNum > 0 ? formatCurrency(Math.max(0, net)) : '—'}</span></div>
            </div>
            <ClayButton type="button" onClick={onContinue} disabled={!!blocker}>
                Continue <ArrowRight className="h-4 w-4" />
            </ClayButton>
            {blocker && amountNum > 0 && <p className="text-center text-sm text-red-700 dark:text-red-400" role="alert">{blocker}</p>}
        </div>
    )
}

/** A labelled select inside the inset well (network, bank). */
export function SelectField({ label, value, placeholder, options, onChange }: {
    label: string
    value: string
    placeholder: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-semibold">{label}</Label>
            <div className="neu-inset rounded-xl">
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder={placeholder} /></SelectTrigger>
                    <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>
    )
}

/** A labelled text input inside the inset well. */
export function TextField({ id, label, hint, value, onChange, placeholder, inputMode, mono }: {
    id: string
    label: string
    hint?: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    inputMode?: 'tel' | 'text'
    mono?: boolean
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-semibold">
                {label}{hint && <> <span className="font-normal text-muted-foreground">({hint})</span></>}
            </Label>
            <div className="neu-inset rounded-xl">
                <Input
                    id={id} value={value} inputMode={inputMode} autoComplete="off" placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)} className={cn(FIELD, mono && 'font-mono')}
                />
            </div>
        </div>
    )
}

/**
 * The live name-check read-out: checking, the verified holder, an error, and (only when the
 * provider could not resolve the account) a typed-name fallback. `recheck` renders the
 * "check again" link; pass null to hide it.
 */
export function NameCheckPanel({ nc, recheck }: {
    nc: AccountNameCheck
    recheck: { label: string; disabled: boolean; onClick: () => void } | null
}) {
    return (
        <div aria-live="polite" className="space-y-2">
            {nc.validating && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking the account name…</p>
            )}
            {nc.verifiedName && !nc.validating && (
                <div className="neu-inset flex items-center gap-3 rounded-xl px-4 py-3">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Account holder</p>
                        <p className="truncate font-semibold">{nc.verifiedName}</p>
                    </div>
                </div>
            )}
            {nc.validationError && !nc.validating && !nc.canUseManual && <Notice>{nc.validationError}</Notice>}
            {nc.canUseManual && (
                <div className="space-y-2">
                    <Notice tone="info">
                        We could not look this account up automatically. Type the exact name registered on it. An admin checks it before paying, and a wrong name will delay or cancel the payout.
                    </Notice>
                    <div className="neu-inset rounded-xl">
                        <Input
                            value={nc.manualName} maxLength={100} autoComplete="off" spellCheck={false} aria-label="Account holder name"
                            placeholder="Name on the account" className={FIELD}
                            onChange={(e) => nc.setManualName(e.target.value.replace(MANUAL_NAME_CHARS, '').slice(0, 100))}
                        />
                    </div>
                </div>
            )}
            {recheck && (
                <button
                    type="button" disabled={recheck.disabled} onClick={recheck.onClick}
                    className={cn('rounded-full text-sm font-semibold text-brand-800 underline underline-offset-4 disabled:opacity-50 dark:text-brand-400', FOCUS)}
                >
                    {recheck.label}
                </button>
            )}
        </div>
    )
}

/** Continue button for the destination step, with the plain-words reason when it is disabled. */
export function ContinueRow({ blocker, onContinue, onBack }: { blocker: string | null; onContinue: () => void; onBack: () => void }) {
    return (
        <>
            <ClayButton type="button" onClick={onContinue} disabled={!!blocker}>
                Continue <ArrowRight className="h-4 w-4" />
            </ClayButton>
            {blocker && <p className="text-center text-sm text-muted-foreground" aria-live="polite">{blocker}</p>}
            <BackButton onClick={onBack} />
        </>
    )
}

/** Step 3: the receipt-style summary and the confirm button. */
export function ReviewStep({ net, rows, submitting, canSubmit, onConfirm, onBack }: {
    net: number
    rows: { label: string; value: ReactNode; strong?: boolean; mono?: boolean }[]
    submitting: boolean
    canSubmit: boolean
    onConfirm: () => void
    onBack: () => void
}) {
    return (
        <div className="space-y-5">
            <div className="neu-inset space-y-4 rounded-2xl p-5">
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">You will receive</p>
                    <p className="font-display text-4xl font-bold tabular-nums">{formatCurrency(Math.max(0, net))}</p>
                </div>
                <dl className="space-y-2 border-t border-border/60 pt-4 text-sm">
                    {rows.map(r => (
                        <div key={r.label} className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">{r.label}</dt>
                            <dd className={cn('text-right', r.strong && 'font-semibold', r.mono && 'font-mono')}>{r.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <p className="text-center text-sm text-muted-foreground">Check the number once more. A payout to the wrong account may not be recoverable.</p>
            <ClayButton type="button" onClick={onConfirm} loading={submitting} disabled={!canSubmit}>
                {submitting ? 'Sending your request' : <>Confirm and withdraw<Check className="h-4 w-4" /></>}
            </ClayButton>
            {!submitting && <BackButton onClick={onBack} />}
        </div>
    )
}

/** Step 4: confirmation. `children` are the buttons underneath. */
export function DoneStep({ net, name, detail, note, children }: {
    net: number
    name: string
    detail: string
    note: string
    children: ReactNode
}) {
    return (
        <div className="space-y-5 text-center">
            <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full"><Check className="h-7 w-7" /></span>
            <div>
                <p className="font-display text-3xl font-bold tabular-nums">{formatCurrency(net)}</p>
                <p className="mt-1 text-sm text-muted-foreground">to {name}</p>
                <p className="font-mono text-xs text-muted-foreground">{detail}</p>
            </div>
            <p className="text-sm text-muted-foreground">{note}</p>
            {children}
        </div>
    )
}
