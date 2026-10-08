'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/ui/brand'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/password-validation'
import { toast } from '@/lib/toast'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

type Tab = 'signin' | 'signup'

const FIELD = 'h-12 rounded-xl border-0 bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground/70 shadow-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500'
const WELL = 'neu-inset rounded-xl'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

function Notice({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn(
                'neu-inset rounded-xl px-4 py-3 text-sm font-medium',
                tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-foreground'
            )}
        >
            {children}
        </div>
    )
}

function PasswordInput({
    id, label, value, onChange, autoComplete, placeholder, show, onToggle, hint,
}: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
    autoComplete: string
    placeholder?: string
    show: boolean
    onToggle: () => void
    hint?: string
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
            <div className={cn(WELL, 'relative')}>
                <Input
                    id={id}
                    name={id}
                    type={show ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    className={cn(FIELD, 'pr-12')}
                />
                <button
                    type="button"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={onToggle}
                    className={cn('absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground', FOCUS)}
                >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}

function SignInForm() {
    const { signIn } = useAuth()
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null)
    const [needsConfirm, setNeedsConfirm] = useState(false)
    const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

    const handleResendConfirmation = async () => {
        if (resendState === 'sending' || !email.includes('@')) return
        setResendState('sending')
        try {
            await fetch('/api/auth/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            })
            setResendState('sent')
            toast.success('If that account needs confirming, a new link is on its way. Check your inbox and spam folder.')
        } catch {
            setResendState('idle')
            toast.error('Could not resend right now. Please try again.')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)
        try {
            const { error: signInError, code } = await signIn(email, password)
            if (signInError) {
                if (signInError.message.startsWith('TOO_MANY_ATTEMPTS:')) {
                    const minutes = parseInt(signInError.message.split(':')[1])
                    setLockoutMinutes(minutes)
                    setNeedsConfirm(false)
                    setError(`Too many sign-in attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                } else {
                    setLockoutMinutes(null)
                    setNeedsConfirm(code === 'email_not_confirmed')
                    setResendState('idle')
                    setError(signInError.message)
                }
                return
            }
            toast.success('Welcome back')
            router.push('/dashboard')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
                {error && <Notice tone="error">{error}</Notice>}

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email</Label>
                    <div className={WELL}>
                        <Input
                            id="email" name="email" type="email" inputMode="email" autoComplete="username"
                            placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                            required className={FIELD}
                        />
                    </div>
                </div>

                <PasswordInput
                    id="password" label="Password" value={password} onChange={setPassword}
                    autoComplete="current-password" show={showPw} onToggle={() => setShowPw(s => !s)}
                />

                <button
                    type="submit"
                    disabled={isLoading || lockoutMinutes !== null}
                    className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-60', FOCUS)}
                >
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in</> : <>Sign in<ArrowRight className="h-4 w-4" /></>}
                </button>
            </form>

            {needsConfirm && (
                <button
                    type="button" onClick={handleResendConfirmation} disabled={resendState !== 'idle'}
                    className={cn('mx-auto flex items-center gap-1.5 rounded text-sm font-semibold text-brand-800 underline underline-offset-4 disabled:opacity-60 dark:text-brand-400', FOCUS)}
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', resendState === 'sending' && 'animate-spin')} />
                    {resendState === 'sent' ? 'Link sent. Check your inbox' : 'Resend the confirmation email'}
                </button>
            )}

            <p className="text-center text-sm">
                <Link href="/auth/reset-password" className={cn('rounded font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400', FOCUS)}>
                    Forgot your password?
                </Link>
            </p>
        </div>
    )
}

function SignUpForm() {
    const { signUp } = useAuth()
    const router = useRouter()
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' })
    const [showPw, setShowPw] = useState(false)
    const [agreed, setAgreed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null)
    const [sentTo, setSentTo] = useState<string | null>(null)
    const [resendCooldown, setResendCooldown] = useState(0)

    const set = (name: keyof typeof form) => (value: string) => {
        setForm(prev => ({ ...prev, [name]: value }))
        if (fieldErrors[name]) setFieldErrors(prev => { const { [name]: _, ...rest } = prev; return rest })
    }

    const startCooldown = () => {
        setResendCooldown(60)
        const t = setInterval(() => setResendCooldown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 }), 1000)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setFieldErrors({})

        const phone = validateGhanaianPhone(form.phoneNumber)
        if (!phone.isValid) { setError(phone.error || 'Enter a valid Ghana mobile number.'); return }
        if (!isStrongPassword(form.password)) { setError(PASSWORD_REQUIREMENTS_MESSAGE); return }
        if (form.password !== form.confirmPassword) { setError('The two passwords do not match.'); return }

        setIsLoading(true)
        try {
            const { error: signUpError, data } = await signUp({
                email: form.email.trim().toLowerCase(),
                password: form.password,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                phoneNumber: phone.normalizedNumber!,
            })

            if (signUpError) {
                if (signUpError.details) {
                    const errs: Record<string, string> = {}
                    signUpError.details.forEach((d: string) => {
                        const [field, ...msg] = d.split(': ')
                        if (field) errs[field] = msg.join(': ')
                    })
                    setFieldErrors(errs)
                    setError('Check the highlighted fields and try again.')
                } else if (signUpError.message?.startsWith('TOO_MANY_ATTEMPTS:')) {
                    const mins = parseInt(signUpError.message.split(':')[1])
                    setLockoutMinutes(mins)
                    setError(`Too many attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`)
                } else {
                    setError(signUpError.message)
                }
                return
            }

            fetch('/api/emails/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email.trim().toLowerCase(),
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    phoneNumber: phone.normalizedNumber,
                    userId: data?.user?.id,
                }),
            }).catch(() => {})

            if (data?.session) {
                toast.success('Your account is ready')
                router.push('/dashboard')
                return
            }
            // No session means the project requires email confirmation.
            setSentTo(form.email.trim().toLowerCase())
            startCooldown()
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleResend = async () => {
        if (resendCooldown > 0 || !sentTo) return
        try {
            await fetch('/api/auth/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sentTo }),
            })
            toast.success('Link sent again. Check your inbox and spam folder.')
            startCooldown()
        } catch {
            toast.error('Could not resend right now. Please try again.')
        }
    }

    if (sentTo) {
        return (
            <div className="space-y-5 py-2 text-center">
                <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full"><Check className="h-7 w-7" /></span>
                <div className="space-y-2">
                    <h2 className="font-display text-2xl font-bold text-foreground">Check your email</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open it to activate your account, then sign in. It can take a minute; check spam too.
                    </p>
                </div>
                <button
                    type="button" onClick={handleResend} disabled={resendCooldown > 0}
                    className={cn('clay-black flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-60', FOCUS)}
                >
                    <RefreshCw className="h-4 w-4" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend the link'}
                </button>
            </div>
        )
    }

    const text = (id: keyof typeof form, label: string, opts: { type?: string; autoComplete: string; placeholder?: string; inputMode?: 'tel' | 'email'; hint?: string }) => (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
            <div className={cn(WELL, fieldErrors[id] && 'ring-2 ring-red-500')}>
                <Input
                    id={id} name={id} type={opts.type ?? 'text'} inputMode={opts.inputMode} autoComplete={opts.autoComplete}
                    placeholder={opts.placeholder} value={form[id]} onChange={(e) => set(id)(e.target.value)} required className={FIELD}
                />
            </div>
            {fieldErrors[id] ? <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors[id]}</p> : opts.hint && <p className="text-xs text-muted-foreground">{opts.hint}</p>}
        </div>
    )

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Notice tone="error">{error}</Notice>}

            <div className="grid gap-5 sm:grid-cols-2">
                {text('firstName', 'First name', { autoComplete: 'given-name' })}
                {text('lastName', 'Last name', { autoComplete: 'family-name' })}
            </div>
            {text('email', 'Email', { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
            {text('phoneNumber', 'Mobile number', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '024 123 4567', hint: 'For your orders and payouts. We do not text you a code.' })}

            <PasswordInput
                id="password" label="Password" value={form.password} onChange={set('password')}
                autoComplete="new-password" show={showPw} onToggle={() => setShowPw(s => !s)}
                hint="Use a mix of letters, numbers and symbols."
            />
            <PasswordInput
                id="confirmPassword" label="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')}
                autoComplete="new-password" show={showPw} onToggle={() => setShowPw(s => !s)}
            />

            <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <input
                    id="terms" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-black dark:accent-brand-500"
                />
                <span>
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" target="_blank" className="font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400">Privacy Policy</Link>.
                </span>
            </label>

            <button
                type="submit"
                disabled={isLoading || !agreed || lockoutMinutes !== null}
                className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-60', FOCUS)}
            >
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating your account</> : <>Create account<ArrowRight className="h-4 w-4" /></>}
            </button>
        </form>
    )
}

function AuthScreen() {
    const searchParams = useSearchParams()
    const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'signup' ? 'signup' : 'signin')

    const error = searchParams.get('error')
    const reason = searchParams.get('reason')
    const notice: { tone: 'error' | 'info'; text: string } | null =
        reason === 'session_expired'
            ? { tone: 'info', text: 'You were signed out to keep your account safe. Sign in again to continue.' }
            : error === 'link_failed'
                ? { tone: 'error', text: 'That link has expired or was already used. Request a new one and try again.' }
                : null

    useEffect(() => {
        setTab(searchParams.get('tab') === 'signup' ? 'signup' : 'signin')
    }, [searchParams])

    const switchTab = (next: Tab) => {
        setTab(next)
        window.history.replaceState(null, '', next === 'signup' ? '/auth?tab=signup' : '/auth')
    }

    return (
        <div className="min-h-screen bg-neu lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Brand panel */}
            <aside className="relative isolate hidden overflow-hidden bg-black text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
                <svg viewBox="0 0 600 700" className="pointer-events-none absolute -bottom-8 -right-24 -z-10 w-[130%] opacity-90" aria-hidden="true" focusable="false">
                    <defs>
                        <linearGradient id="auth-swoosh" x1="0" y1="1" x2="1" y2="0">
                            <stop offset="0" stopColor="#F6A900" />
                            <stop offset="0.6" stopColor="#F6C30F" />
                            <stop offset="1" stopColor="#FEE21C" />
                        </linearGradient>
                    </defs>
                    <path fill="url(#auth-swoosh)" d="M-20 640 C 150 650 330 520 430 330 C 480 235 540 160 640 140 C 560 200 520 270 470 360 C 360 570 190 700 -20 700 Z" />
                </svg>
                <Link href="/" className={cn('flex w-fit items-center gap-2.5 rounded-full', 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500')}>
                    <BrandLogo width={40} height={40} className="h-10 w-10" />
                    <span className="font-display text-2xl font-bold tracking-tight">{BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span></span>
                </Link>
                <div className="max-w-md">
                    <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white xl:text-5xl text-balance">
                        {tab === 'signin' ? 'Welcome back. Your wallet is where you left it.' : 'One account for buying and selling data in Ghana.'}
                    </h1>
                    <p className="mt-5 text-lg leading-relaxed text-silver-200">
                        {tab === 'signin'
                            ? 'Sign in to place orders, check your balance and manage your shop.'
                            : 'Sign up with your email. No codes to wait for, and your wallet is ready as soon as you are in.'}
                    </p>
                </div>
                <p className="text-sm text-silver-200/80">{BRAND.domain}</p>
            </aside>

            {/* Form */}
            <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0">
                <div className="w-full max-w-[28rem]">
                    <div className="mb-8 flex items-center justify-between">
                        <Link href="/" className={cn('inline-flex items-center gap-1.5 rounded text-sm font-semibold text-muted-foreground hover:text-foreground', FOCUS)}>
                            <ArrowLeft className="h-4 w-4" /> Home
                        </Link>
                        <Link href="/" className={cn('flex items-center gap-2 rounded-full lg:hidden', FOCUS)} aria-label={BRAND.name}>
                            <BrandLogo width={32} height={32} className="h-8 w-8" />
                        </Link>
                    </div>

                    <div role="tablist" aria-label="Account" className="neu-inset grid grid-cols-2 gap-1.5 rounded-2xl p-1.5">
                        {([['signin', 'Sign in'], ['signup', 'Create account']] as const).map(([key, label]) => (
                            <button
                                key={key} role="tab" type="button" aria-selected={tab === key}
                                onClick={() => switchTab(key)}
                                className={cn(
                                    'min-h-[2.75rem] rounded-xl text-sm font-semibold',
                                    tab === key ? 'clay-gold' : 'text-muted-foreground transition-colors hover:text-foreground',
                                    FOCUS
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {notice && <div className="mt-5"><Notice tone={notice.tone}>{notice.text}</Notice></div>}

                    <section className="neu-raised mt-5 rounded-[2rem] p-6 sm:p-8" aria-label={tab === 'signin' ? 'Sign in' : 'Create account'}>
                        <h2 className="mb-6 font-display text-2xl font-bold text-foreground">
                            {tab === 'signin' ? 'Sign in to your account' : 'Create your account'}
                        </h2>
                        {tab === 'signin' ? <SignInForm /> : <SignUpForm />}
                    </section>
                </div>
            </main>
        </div>
    )
}

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neu" />}>
            <AuthScreen />
        </Suspense>
    )
}
