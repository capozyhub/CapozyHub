'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FOCUS } from './auth-shell'

const FIELD =
    'h-12 rounded-xl border-0 bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground/70 shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500'
const WELL = 'neu-inset rounded-xl'

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info'; children: React.ReactNode }) {
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn('neu-inset rounded-xl px-4 py-3 text-sm font-medium', tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-foreground')}
        >
            {children}
        </div>
    )
}

export function TextField({
    id, label, value, onChange, type = 'text', autoComplete, inputMode, placeholder, hint, error, autoFocus, required = true,
}: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
    type?: string
    autoComplete?: string
    inputMode?: 'tel' | 'email' | 'text'
    placeholder?: string
    hint?: string
    error?: string
    autoFocus?: boolean
    required?: boolean
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
            <div className={cn(WELL, error && 'ring-2 ring-red-500')}>
                <Input
                    id={id} name={id} type={type} inputMode={inputMode} autoComplete={autoComplete} placeholder={placeholder}
                    value={value} onChange={(e) => onChange(e.target.value)} required={required} autoFocus={autoFocus}
                    aria-invalid={!!error} aria-describedby={error || hint ? `${id}-note` : undefined}
                    className={FIELD}
                />
            </div>
            {error
                ? <p id={`${id}-note`} className="text-xs text-red-600 dark:text-red-400">{error}</p>
                : hint && <p id={`${id}-note`} className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}

export function PasswordField({
    id, label, value, onChange, autoComplete, placeholder, autoFocus,
}: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
    autoComplete: string
    placeholder?: string
    autoFocus?: boolean
}) {
    const [show, setShow] = useState(false)
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
            <div className={cn(WELL, 'relative')}>
                <Input
                    id={id} name={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder}
                    value={value} onChange={(e) => onChange(e.target.value)} required autoFocus={autoFocus}
                    className={cn(FIELD, 'pr-12')}
                />
                <button
                    type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(s => !s)}
                    className={cn('absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground', FOCUS)}
                >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
        </div>
    )
}

const COMMON = ['password', 'passw0rd', '12345678', '123456789', 'qwertyui', 'qwerty123', 'iloveyou', 'abc12345', 'letmein1']

/** 0 (empty) to 4 (strong). Anything that fails the sign-up rules can never score above "Fair". */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
    if (!pw) return { score: 0, label: '' }
    const meetsRules = pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)
    let pts = 0
    if (pw.length >= 8) pts++
    if (pw.length >= 12) pts++
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) pts++
    if (/\d/.test(pw)) pts++
    if (/[^A-Za-z0-9]/.test(pw)) pts++
    const weakPattern = COMMON.some(c => pw.toLowerCase().includes(c)) || /^(.)\1+$/.test(pw)
    let score: 1 | 2 | 3 | 4 = pts <= 1 ? 1 : pts === 2 ? 2 : pts === 3 ? 3 : 4
    if (!meetsRules) score = Math.min(score, 2) as 1 | 2
    if (weakPattern) score = 1
    return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] }
}

const BAR_TONE = ['', 'bg-red-500', 'bg-amber-500', 'bg-brand-500', 'bg-emerald-500']
const LABEL_TONE = ['', 'text-red-700 dark:text-red-400', 'text-amber-700 dark:text-amber-400', 'text-brand-800 dark:text-brand-400', 'text-emerald-700 dark:text-emerald-400']

/** Strength bar plus a live checklist of the sign-up rules (8-128 characters, upper, lower, number). */
export function PasswordRules({ value }: { value: string }) {
    const { score, label } = passwordStrength(value)
    const rules = [
        { ok: value.length >= 8, text: 'At least 8 characters' },
        { ok: /[a-z]/.test(value) && /[A-Z]/.test(value), text: 'Upper and lower case' },
        { ok: /\d/.test(value), text: 'A number' },
    ]
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength</span>
                    <span aria-live="polite" className={cn('font-semibold', LABEL_TONE[score])}>{label || 'Not set'}</span>
                </div>
                <div className="neu-inset flex gap-1.5 rounded-full p-1" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={label || 'Not set'}>
                    {[1, 2, 3, 4].map(seg => (
                        <span
                            key={seg}
                            className={cn(
                                'h-2 flex-1 rounded-full transition-all duration-300 motion-reduce:transition-none',
                                seg <= score ? cn(BAR_TONE[score], 'shadow-[inset_0_1.5px_0_rgba(255,255,255,0.45),inset_0_-1.5px_0_rgba(0,0,0,0.2)]') : 'bg-muted-foreground/15'
                            )}
                        />
                    ))}
                </div>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Password rules">
                {rules.map((r) => (
                    <li key={r.text} className={cn('flex items-center gap-1.5', r.ok ? 'text-foreground' : 'text-muted-foreground')}>
                        <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', r.ok ? 'clay-gold' : 'neu-inset')}>
                            {r.ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </span>
                        {r.text}
                        <span className="sr-only">{r.ok ? ' (done)' : ' (not yet)'}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

type Variant = 'gold' | 'black'

export function ClayButton({
    children, loading, variant = 'gold', className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: Variant }) {
    return (
        <button
            {...rest}
            disabled={rest.disabled || loading}
            className={cn(
                'flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-60',
                variant === 'gold' ? 'clay-gold' : 'clay-black',
                variant === 'gold' ? FOCUS : 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                className
            )}
        >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </button>
    )
}
