'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AuthShell, FOCUS } from '@/components/auth/auth-shell'
import { ClayButton, Notice, PasswordField, PasswordRules, TextField } from '@/components/auth/fields'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/password-validation'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const linkClass = cn('rounded font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400', FOCUS)

const SIGNUP_STEPS = [
    { heading: 'First, what should we call you?', lead: 'Your name appears on receipts and, if you open one, on your shop.' },
    { heading: 'Where should we reach you?', lead: 'You will sign in with this email, and password resets are sent here.' },
    { heading: 'What is your mobile number?', lead: 'It is used for your orders and payouts. We never text you a code.' },
    { heading: 'Last step: choose a password.', lead: 'Keep it to yourself. Nobody at Capozy Hub will ever ask you for it.' },
] as const

type Form = { firstName: string; lastName: string; email: string; phoneNumber: string; password: string; confirmPassword: string }

function SignInPanel({ onSwitch }: { onSwitch: () => void }) {
    const { signIn } = useAuth()
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [lockout, setLockout] = useState(false)
    const [needsConfirm, setNeedsConfirm] = useState(false)
    const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

    const resendConfirmation = async () => {
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

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)
        try {
            const { error: signInError, code } = await signIn(email, password)
            if (signInError) {
                if (signInError.message.startsWith('TOO_MANY_ATTEMPTS:')) {
                    const minutes = parseInt(signInError.message.split(':')[1])
                    setLockout(true)
                    setNeedsConfirm(false)
                    setError(`Too many sign-in attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                } else {
                    setLockout(false)
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
        <div className="space-y-6">
            <form onSubmit={submit} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                {error && <Notice>{error}</Notice>}
                <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={setEmail} autoFocus />
                <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
                <ClayButton type="submit" loading={isLoading} disabled={lockout}>
                    {isLoading ? 'Signing in' : <>Sign in<ArrowRight className="h-4 w-4" /></>}
                </ClayButton>

                {needsConfirm && (
                    <button type="button" onClick={resendConfirmation} disabled={resendState !== 'idle'} className={cn('mx-auto flex items-center gap-1.5 text-sm', linkClass, 'disabled:opacity-60')}>
                        <RefreshCw className={cn('h-3.5 w-3.5', resendState === 'sending' && 'animate-spin')} />
                        {resendState === 'sent' ? 'Link sent. Check your inbox' : 'Resend the confirmation email'}
                    </button>
                )}
                <p className="text-center text-sm">
                    <Link href="/auth/reset-password" className={linkClass}>Forgot your password?</Link>
                </p>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                New to Capozy Hub?{' '}
                <button type="button" onClick={onSwitch} className={linkClass}>Create an account</button>
            </p>
        </div>
    )
}

function SignUpPanel({ step, setStep, sentTo, setSentTo, onSwitch }: {
    step: number
    setStep: (n: number) => void
    sentTo: string | null
    setSentTo: (v: string | null) => void
    onSwitch: () => void
}) {
    const { signUp } = useAuth()
    const router = useRouter()
    const [form, setForm] = useState<Form>({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' })
    const [agreed, setAgreed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [emailTaken, setEmailTaken] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [lockout, setLockout] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const timer = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

    const set = (name: keyof Form) => (value: string) => {
        setForm(prev => ({ ...prev, [name]: value }))
        setError('')
        setEmailTaken(false)
        if (fieldErrors[name]) setFieldErrors(prev => { const { [name]: _, ...rest } = prev; return rest })
    }

    const startCooldown = () => {
        setResendCooldown(60)
        if (timer.current) clearInterval(timer.current)
        timer.current = setInterval(() => setResendCooldown(c => {
            if (c <= 1) { if (timer.current) clearInterval(timer.current); return 0 }
            return c - 1
        }), 1000)
    }

    const createAccount = async () => {
        const phone = validateGhanaianPhone(form.phoneNumber)
        if (!phone.isValid) { setStep(3); setError(phone.error || 'Enter a valid Ghana mobile number.'); return }
        if (!isStrongPassword(form.password)) { setError(PASSWORD_REQUIREMENTS_MESSAGE); return }
        if (form.password !== form.confirmPassword) { setError('The two passwords do not match.'); return }

        setIsLoading(true)
        try {
            const email = form.email.trim().toLowerCase()
            const { error: signUpError, data } = await signUp({
                email,
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
                    // Jump back to the first step that has a problem.
                    setStep(errs.firstName || errs.lastName ? 1 : errs.email ? 2 : errs.phoneNumber ? 3 : 4)
                    setError('Check the highlighted field and try again.')
                } else if (signUpError.message?.startsWith('TOO_MANY_ATTEMPTS:')) {
                    const mins = parseInt(signUpError.message.split(':')[1])
                    setLockout(true)
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
                    email,
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
            // No session means this project requires email confirmation.
            setSentTo(email)
            startCooldown()
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const next = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (step === 1) {
            if (!form.firstName.trim() || !form.lastName.trim()) { setError('Enter your first and last name.'); return }
            setStep(2)
        } else if (step === 2) {
            if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Enter a valid email address.'); return }
            setIsLoading(true)
            try {
                const res = await fetch('/api/auth/check-availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
                })
                const body = await res.json().catch(() => ({}))
                if (res.ok && body.available === false) { setEmailTaken(true); return }
            } catch { /* The check is a courtesy; signup itself re-checks. */ } finally { setIsLoading(false) }
            setStep(3)
        } else if (step === 3) {
            const phone = validateGhanaianPhone(form.phoneNumber)
            if (!phone.isValid) { setError(phone.error || 'Enter a valid Ghana mobile number.'); return }
            setStep(4)
        } else {
            if (!agreed) { setError('Please agree to the Terms of Service and Privacy Policy to continue.'); return }
            await createAccount()
        }
    }

    const resend = async () => {
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
            <div className="neu-raised space-y-5 rounded-[2rem] p-6 text-center sm:p-7">
                <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full"><Check className="h-7 w-7" /></span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open it to activate your account, then sign in. It can take a minute, and spam is worth a look.
                </p>
                <ClayButton type="button" variant="black" onClick={resend} disabled={resendCooldown > 0}>
                    <RefreshCw className="h-4 w-4" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend the link'}
                </ClayButton>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <form onSubmit={next} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7" key={step}>
                {error && <Notice>{error}</Notice>}
                {emailTaken && (
                    <Notice>
                        An account with this email already exists.{' '}
                        <button type="button" onClick={onSwitch} className={linkClass}>Sign in instead</button>
                    </Notice>
                )}

                {step === 1 && (
                    <>
                        <TextField id="firstName" label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} error={fieldErrors.firstName} autoFocus />
                        <TextField id="lastName" label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} error={fieldErrors.lastName} />
                    </>
                )}
                {step === 2 && (
                    <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={fieldErrors.email} autoFocus />
                )}
                {step === 3 && (
                    <TextField id="phoneNumber" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" value={form.phoneNumber} onChange={set('phoneNumber')} error={fieldErrors.phoneNumber} hint="MTN, Telecel or AirtelTigo number." autoFocus />
                )}
                {step === 4 && (
                    <>
                        <PasswordField id="password" label="Password" value={form.password} onChange={set('password')} autoComplete="new-password" autoFocus />
                        <PasswordRules value={form.password} />
                        <PasswordField id="confirmPassword" label="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
                        <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                            <input id="terms" type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setError('') }} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-black dark:accent-brand-500" />
                            <span>
                                I agree to the <Link href="/terms" target="_blank" className={linkClass}>Terms of Service</Link> and{' '}
                                <Link href="/privacy" target="_blank" className={linkClass}>Privacy Policy</Link>.
                            </span>
                        </label>
                    </>
                )}

                <ClayButton type="submit" loading={isLoading} disabled={lockout}>
                    {step < 4 ? <>Continue<ArrowRight className="h-4 w-4" /></> : isLoading ? 'Creating your account' : <>Create account<ArrowRight className="h-4 w-4" /></>}
                </ClayButton>

                {step > 1 && (
                    <button type="button" onClick={() => { setError(''); setEmailTaken(false); setStep(step - 1) }} className={cn('mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground', FOCUS, 'rounded')}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                )}
            </form>

            <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button type="button" onClick={onSwitch} className={linkClass}>Sign in</button>
            </p>
        </div>
    )
}

function AuthScreen() {
    const params = useSearchParams()
    const [mode, setMode] = useState<'signin' | 'signup'>(params.get('tab') === 'signup' ? 'signup' : 'signin')
    const [step, setStep] = useState(1)
    const [sentTo, setSentTo] = useState<string | null>(null)

    useEffect(() => {
        setMode(params.get('tab') === 'signup' ? 'signup' : 'signin')
    }, [params])

    const switchMode = (next: 'signin' | 'signup') => {
        setMode(next)
        setStep(1)
        setSentTo(null)
        window.history.replaceState(null, '', next === 'signup' ? '/auth?tab=signup' : '/auth')
    }

    const error = params.get('error')
    const reason = params.get('reason')
    const notice =
        reason === 'session_expired'
            ? { tone: 'info' as const, text: 'You were signed out to keep your account safe. Sign in again to continue.' }
            : error === 'link_failed'
                ? { tone: 'error' as const, text: 'That link has expired or was already used. Request a new one and try again.' }
                : null

    const signup = SIGNUP_STEPS[Math.min(step, 4) - 1]
    const heading = mode === 'signin' ? 'Welcome back.' : sentTo ? 'Check your email.' : signup.heading
    const lead = mode === 'signin'
        ? 'Sign in to place orders, check your balance and run your shop.'
        : sentTo ? 'One click and your account is live.' : signup.lead
    const progress = mode === 'signin' ? 1 : sentTo ? 1 : step / 4

    return (
        <AuthShell
            heading={heading}
            lead={lead}
            progress={progress}
            stepLabel={mode === 'signup' && !sentTo ? `Step ${step} of 4` : undefined}
        >
            {notice && <div className="mb-5"><Notice tone={notice.tone}>{notice.text}</Notice></div>}
            {mode === 'signin'
                ? <SignInPanel onSwitch={() => switchMode('signup')} />
                : <SignUpPanel step={step} setStep={setStep} sentTo={sentTo} setSentTo={setSentTo} onSwitch={() => switchMode('signin')} />}
        </AuthShell>
    )
}

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="min-h-[100dvh] bg-black" />}>
            <AuthScreen />
        </Suspense>
    )
}
