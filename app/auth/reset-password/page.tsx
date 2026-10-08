'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { ClayButton, Notice, TextField } from '@/components/auth/fields'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const linkClass =
    'rounded font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [step, setStep] = useState<1 | 2>(1)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null)
    const [resendCooldown, setResendCooldown] = useState(0)

    // Count a rate-limit lockout down so the button re-enables without a page reload.
    useEffect(() => {
        if (lockoutMinutes === null) return
        if (lockoutMinutes <= 0) { setLockoutMinutes(null); setError(''); return }
        const t = setTimeout(() => setLockoutMinutes(m => (m === null ? null : m - 1)), 60_000)
        return () => clearTimeout(t)
    }, [lockoutMinutes])

    useEffect(() => {
        if (resendCooldown <= 0) return
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [resendCooldown])

    const requestCode = async (): Promise<boolean> => {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
        })
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 10
            setLockoutMinutes(minutes)
            setError(`Too many attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
            return false
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setLockoutMinutes(null)
            setError(data.error || 'Could not send the code. Please try again.')
            return false
        }
        return true
    }

    const sendCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)
        try {
            if (await requestCode()) {
                setStep(2)
                setResendCooldown(60)
                toast.success('Code sent. Check your email.')
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const resend = async () => {
        if (resendCooldown > 0) return
        try {
            if (await requestCode()) {
                toast.success('New code sent.')
                setResendCooldown(60)
            }
        } catch {
            toast.error('Could not resend. Please try again.')
        }
    }

    const verify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (code.length < 6) { setError('Enter the code from your email.'); return }
        setIsLoading(true)
        try {
            const { error: otpError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'recovery' })
            if (otpError) { setError(otpError.message); return }
            window.sessionStorage.setItem('kingflexy_password_recovery_active', 'true')
            toast.success('Code accepted. Choose a new password.')
            router.push('/auth/update-password')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AuthShell
            heading={step === 1 ? 'Forgot your password?' : 'Check your email.'}
            lead={step === 1 ? 'Tell us your email and we will send a code to reset it.' : 'Enter the code we sent to continue.'}
            progress={step === 1 ? 0.4 : 0.8}
            stepLabel={`Step ${step} of 3`}
            backHref="/auth"
            backLabel="Back to sign in"
        >
            {step === 1 ? (
                <form onSubmit={sendCode} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                    {error && <Notice>{error}</Notice>}
                    <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} autoFocus />
                    <ClayButton type="submit" loading={isLoading} disabled={lockoutMinutes !== null}>
                        {lockoutMinutes !== null ? `Try again in ${lockoutMinutes}m` : isLoading ? 'Sending' : <>Send the code<ArrowRight className="h-4 w-4" /></>}
                    </ClayButton>
                </form>
            ) : (
                <form onSubmit={verify} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        We sent a code to <strong className="text-foreground">{email}</strong>. It can take a minute, and spam is worth a look.
                    </p>
                    {error && <Notice>{error}</Notice>}
                    <div className="space-y-2">
                        <Label htmlFor="code" className="text-sm font-semibold text-foreground">Code</Label>
                        <div className="neu-inset rounded-xl">
                            <Input
                                id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} maxLength={8} required autoFocus
                                className="h-14 rounded-xl border-0 bg-transparent text-center font-display text-2xl font-bold tracking-[0.35em] text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500"
                            />
                        </div>
                    </div>
                    <ClayButton type="submit" loading={isLoading} disabled={code.length < 6}>
                        {isLoading ? 'Checking' : <>Continue<ArrowRight className="h-4 w-4" /></>}
                    </ClayButton>
                    <p className="text-center text-sm">
                        <button type="button" onClick={resend} disabled={resendCooldown > 0} className={cn(linkClass, 'disabled:opacity-60 disabled:no-underline')}>
                            {resendCooldown > 0 ? `Send a new code in ${resendCooldown}s` : 'Send a new code'}
                        </button>
                    </p>
                </form>
            )}
        </AuthShell>
    )
}
