'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { ClayButton, Notice, PasswordField, TextField } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { JoinFrame } from '@/components/join/join-frame'
import { cn } from '@/lib/utils'

// White-label sub-agent onboarding. It carries the UPLINE shop's name, logo and colour and no
// platform branding. It reuses the platform auth backend (/api/auth/login, /api/auth/signup),
// then redeems the invite (/api/join).

interface Preview { valid: boolean; shopName?: string; logoUrl?: string | null; brandColor?: string | null }

export default function JoinPage() {
    const { code } = useParams<{ code: string }>()
    const router = useRouter()
    const { user, loading: authLoading } = useAuth() as any

    const [preview, setPreview] = useState<Preview | null>(null)
    const [mode, setMode] = useState<'signin' | 'register'>('register')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState<null | 'pending' | 'member'>(null)
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '' })
    const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

    useEffect(() => {
        let cancelled = false
        fetch(`/api/join?code=${encodeURIComponent(String(code))}`)
            .then(r => r.json())
            .then(j => { if (!cancelled) setPreview(j?.data ?? { valid: false }) })
            .catch(() => { if (!cancelled) setPreview({ valid: false }) })
        return () => { cancelled = true }
    }, [code])

    const redeem = async () => {
        setBusy(true)
        setError('')
        try {
            const r = await fetch('/api/join', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })
            const j = await r.json()
            if (j?.success) setDone(j.data.alreadyMember ? 'member' : 'pending')
            else setError('We could not add you to this storefront. The invite may have expired or reached its limit.')
        } catch { setError('We could not add you to this storefront. Try again.') }
        finally { setBusy(false) }
    }

    const submitAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
            const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/signup'
            const payload = mode === 'signin' ? { email: form.email, password: form.password } : form
            const r = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const j = await r.json().catch(() => ({}))
            if (r.ok && (j?.user || j?.session || j?.success)) {
                // The session cookie is set by this response, so the invite can be redeemed straight away.
                await redeem()
            } else {
                setError(mode === 'signin'
                    ? 'Wrong email or password.'
                    : (typeof j?.error === 'string' && j.error.length < 120 ? j.error : 'We could not create your account. Check your details and try again.'))
                setBusy(false)
            }
        } catch { setError('Something went wrong. Please try again.'); setBusy(false) }
    }

    if (preview === null || authLoading) {
        return <div className="flex min-h-[100dvh] items-center justify-center bg-neu"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
    }

    if (!preview.valid) {
        return (
            <JoinFrame title="Invite unavailable">
                <div className="neu-raised space-y-2 rounded-[2rem] p-6 text-center">
                    <p className="text-sm text-muted-foreground">This invite link is not valid. It may have expired or reached its limit. Ask your shop owner for a new one.</p>
                </div>
            </JoinFrame>
        )
    }

    const shopName = preview.shopName || 'this storefront'

    if (done) {
        return (
            <JoinFrame title={done === 'member' ? 'You are already in' : 'You are in'} logoUrl={preview.logoUrl} brandColor={preview.brandColor}>
                <div className="neu-raised space-y-5 rounded-[2rem] p-6 text-center sm:p-7">
                    <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full"><CheckCircle2 className="h-7 w-7" aria-hidden="true" /></span>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {done === 'pending'
                            ? `${shopName} will approve your account shortly. After that you can set up your storefront and start selling.`
                            : 'Continue to your dashboard to manage your storefront.'}
                    </p>
                    <ClayButton type="button" onClick={() => router.push('/dashboard')}>Go to dashboard</ClayButton>
                </div>
            </JoinFrame>
        )
    }

    return (
        <JoinFrame
            title={`Join ${shopName}`}
            lead="Become a sub-agent: get wholesale prices, run your own storefront and keep the profit on your sales."
            logoUrl={preview.logoUrl}
            brandColor={preview.brandColor}
        >
            <div className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                {error && <Notice>{error}</Notice>}

                {user ? (
                    <ClayButton type="button" onClick={redeem} loading={busy}>Join as sub-agent</ClayButton>
                ) : (
                    <form onSubmit={submitAuth} className="space-y-4">
                        {mode === 'register' && (
                            <>
                                <TextField id="firstName" label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
                                <TextField id="lastName" label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
                            </>
                        )}
                        <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} />
                        {mode === 'register' && (
                            <TextField id="phoneNumber" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" value={form.phoneNumber} onChange={set('phoneNumber')} />
                        )}
                        <PasswordField id="password" label="Password" value={form.password} onChange={set('password')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
                        <ClayButton type="submit" loading={busy}>
                            {mode === 'register' ? 'Create account and join' : 'Sign in and join'}
                        </ClayButton>
                        <button
                            type="button"
                            className={cn('mx-auto block rounded text-sm text-muted-foreground hover:text-foreground', FOCUS)}
                            onClick={() => { setError(''); setMode(mode === 'register' ? 'signin' : 'register') }}
                        >
                            {mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
                        </button>
                    </form>
                )}
            </div>
        </JoinFrame>
    )
}
