'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Check } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { ClayButton, Notice, PasswordField, PasswordRules } from '@/components/auth/fields'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/password-validation'
const RECOVERY_SESSION_KEY = 'kingflexy_password_recovery_active'

function getRecoveryContext() {
    if (typeof window === 'undefined') {
        return {
            accessToken: null,
            refreshToken: null,
            code: null,
            tokenHash: null,
            hasRecoveryAttempt: false,
            shouldCleanUrl: false,
        }
    }

    const currentUrl = new URL(window.location.href)
    const hashParams = new URLSearchParams(currentUrl.hash.startsWith('#') ? currentUrl.hash.slice(1) : currentUrl.hash)
    const searchParams = currentUrl.searchParams

    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const code = searchParams.get('code')
    const tokenHash = searchParams.get('token_hash')
    const isRecoveryFlow = searchParams.get('flow') === 'recovery'
    const hasHashSessionTokens = !!accessToken && !!refreshToken
    const hasExchangeableRecovery = isRecoveryFlow && (!!code || !!tokenHash)

    return {
        accessToken,
        refreshToken,
        code,
        tokenHash,
        hasRecoveryAttempt: hasHashSessionTokens || hasExchangeableRecovery,
        shouldCleanUrl: hasHashSessionTokens || hasExchangeableRecovery,
    }
}

function markRecoverySessionActive() {
    if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(RECOVERY_SESSION_KEY, 'true')
    }
}

function clearRecoverySession() {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(RECOVERY_SESSION_KEY)
    }
}

function isRecoverySessionActive() {
    if (typeof window === 'undefined') {
        return false
    }

    return window.sessionStorage.getItem(RECOVERY_SESSION_KEY) === 'true'
}

function cleanRecoveryUrl() {
    if (typeof window === 'undefined') {
        return
    }

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('flow')
    cleanUrl.searchParams.delete('code')
    cleanUrl.searchParams.delete('type')
    cleanUrl.searchParams.delete('token_hash')
    cleanUrl.hash = ''
    window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`)
}

export default function UpdatePasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

    useEffect(() => {
        let isMounted = true
        const { code, tokenHash, hasRecoveryAttempt, shouldCleanUrl } = getRecoveryContext()

        const checkRecoverySession = async () => {
            let recoveryConfirmed = false

            if (code && hasRecoveryAttempt) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
                recoveryConfirmed = !exchangeError
            } else if (tokenHash && hasRecoveryAttempt) {
                const { error: otpError } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: 'recovery',
                })
                recoveryConfirmed = !otpError
            }

            if (recoveryConfirmed) {
                markRecoverySessionActive()
            }

            const attempts = hasRecoveryAttempt ? 6 : 1

            for (let index = 0; index < attempts; index++) {
                const { data: { session } } = await supabase.auth.getSession()

                if (!isMounted) {
                    return
                }

                if (session?.user && isRecoverySessionActive()) {
                    if (shouldCleanUrl) {
                        cleanRecoveryUrl()
                    }
                    setIsValidSession(true)
                    return
                }

                if (index < attempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 250))
                }
            }

            if (isMounted) {
                setIsValidSession(false)
            }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) {
                return
            }

            if (event === 'PASSWORD_RECOVERY' && session?.user) {
                markRecoverySessionActive()
                cleanRecoveryUrl()
                setIsValidSession(true)
            }

            if (event === 'SIGNED_OUT') {
                clearRecoverySession()
            }
        })

        checkRecoverySession()

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!isStrongPassword(password)) {
            setError(PASSWORD_REQUIREMENTS_MESSAGE)
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setIsLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({ password })

            if (error) {
                setError(error.message)
                return
            }

            clearRecoverySession()
            setSuccess(true)
            toast.success('Password updated successfully!')

            try {
                await supabase.auth.signOut({ scope: 'global' })
            } catch (signOutError) {
                console.error('Recovery password sign-out error:', signOutError)
            }

            setTimeout(() => {
                router.push('/auth')
            }, 2000)
        } catch {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const stage = isValidSession === false
        ? { heading: 'That link has expired.', lead: 'Reset links only work once, for a short time. Request a fresh one.', progress: 0.2 }
        : success
            ? { heading: 'Password updated.', lead: 'You can sign in with your new password.', progress: 1 }
            : { heading: 'Choose a new password.', lead: 'Pick something you have not used on other sites.', progress: 0.95 }

    return (
        <AuthShell heading={stage.heading} lead={stage.lead} progress={stage.progress} stepLabel={isValidSession === true && !success ? 'Step 3 of 3' : undefined} backHref="/auth" backLabel="Back to sign in">
            {isValidSession === null && (
                <div className="neu-raised flex items-center justify-center rounded-[2rem] p-10" role="status" aria-label="Checking your reset link">
                    <span className="clay-gold h-10 w-10 animate-pulse rounded-full motion-reduce:animate-none" />
                </div>
            )}

            {isValidSession === false && (
                <div className="neu-raised space-y-5 rounded-[2rem] p-6 text-center sm:p-7">
                    <span className="neu-inset mx-auto flex h-14 w-14 items-center justify-center rounded-full text-red-600"><AlertTriangle className="h-6 w-6" /></span>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        This page only works from a valid reset link or code. Request a new one to carry on.
                    </p>
                    <Link href="/auth/reset-password" className="clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold">
                        Request a new link<ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            )}

            {success && (
                <div className="neu-raised space-y-4 rounded-[2rem] p-6 text-center sm:p-7" role="status">
                    <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full"><Check className="h-7 w-7" /></span>
                    <p className="text-sm leading-relaxed text-muted-foreground">Taking you to sign in.</p>
                </div>
            )}

            {isValidSession === true && !success && (
                <form onSubmit={handleSubmit} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                    {error && <Notice>{error}</Notice>}
                    <PasswordField id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
                    <PasswordRules value={password} />
                    <PasswordField id="confirmPassword" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                    <ClayButton type="submit" loading={isLoading}>
                        {isLoading ? 'Updating' : <>Update password<ArrowRight className="h-4 w-4" /></>}
                    </ClayButton>
                </form>
            )}
        </AuthShell>
    )
}