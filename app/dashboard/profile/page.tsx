'use client'

import { useEffect, useState } from 'react'
import { Calendar, Crown, Loader2, LogOut, Mail, MonitorX, Phone, Shield, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { cn, formatDate } from '@/lib/utils'
import { roleConfig, resolveRoleKey } from '@/lib/roles'
import { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/password-validation'
import { RoleAvatar } from '@/components/dashboard/role-avatar'
import { ClayButton, Notice, PasswordField, PasswordRules, TextField } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const daysUntil = (iso?: string | null) => {
    if (!iso) return null
    const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
    return d > 0 ? d : 0
}

const secondaryBtn = cn('neu-raised-sm neu-press flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60', FOCUS)

export default function ProfilePage() {
    const { dbUser, signOut, isSigningOut, refreshUser } = useAuth()

    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({ first_name: '', last_name: '', phone_number: '' })
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
    const [passwordSaving, setPasswordSaving] = useState(false)

    const [isTerminatingSessions, setIsTerminatingSessions] = useState(false)
    const [confirmSessions, setConfirmSessions] = useState(false)

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const role = dbUser?.role
    const planExpiry = role === 'agent' ? dbUser?.agent_expires_at : role === 'dealer' ? (dbUser as any)?.dealer_expires_at : null
    const planDays = daysUntil(planExpiry)
    const roleKey = resolveRoleKey({ role })
    const roleLabel = roleConfig[roleKey]?.label ?? 'Member'

    useEffect(() => {
        if (dbUser) {
            setFormData({
                first_name: dbUser.first_name || '',
                last_name: dbUser.last_name || '',
                phone_number: dbUser.phone_number || '',
            })
        }
    }, [dbUser])

    const setField = (name: keyof typeof formData) => (value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }))
        if (fieldErrors[name]) setFieldErrors(prev => { const { [name]: _, ...rest } = prev; return rest })
    }

    const handleSave = async () => {
        setIsSaving(true)
        setFieldErrors({})
        try {
            const res = await fetch('/api/users/update-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone_number: formData.phone_number,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (data.details) {
                    const newErrors: Record<string, string> = {}
                    data.details.forEach((err: string) => {
                        const [field, ...msgParts] = err.split(': ')
                        if (field) newErrors[field] = msgParts.join(': ')
                    })
                    setFieldErrors(newErrors)
                    return
                }
                throw new Error('save failed')
            }
            await refreshUser()
            setIsEditing(false)
            toast.success('Profile saved')
        } catch (error) {
            console.error('Profile update error:', error)
            toast.error('We could not save your profile. Try again.')
        } finally {
            setIsSaving(false)
        }
    }

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('The new passwords do not match.'); return }
        if (!isStrongPassword(passwordData.newPassword)) { toast.error(PASSWORD_REQUIREMENTS_MESSAGE); return }
        if (passwordData.currentPassword === passwordData.newPassword) { toast.error('Choose a password different from your current one.'); return }

        setPasswordSaving(true)
        try {
            const response = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                    confirmPassword: passwordData.confirmPassword,
                }),
            })
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After')
                const minutes = retryAfter ? Math.max(1, Math.ceil(parseInt(retryAfter, 10) / 60)) : 10
                toast.error(`Too many attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                return
            }
            const result = await response.json().catch(() => ({}))
            if (!response.ok) {
                toast.error(typeof result.error === 'string' && result.error.length < 140 ? result.error : 'We could not change your password.')
                return
            }
            setIsChangingPassword(false)
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
            toast.success('Password changed. Sign in again with the new one.')
            // signOut navigates to /api/auth/signout, which clears cookies and redirects to /auth.
            signOut()
        } catch {
            toast.error('Something went wrong. Try again.')
        } finally {
            setPasswordSaving(false)
        }
    }

    const handleTerminateSessions = async () => {
        setConfirmSessions(false)
        setIsTerminatingSessions(true)
        try {
            const { error } = await supabase.auth.signOut({ scope: 'others' })
            if (error) throw error
            toast.success('Every other device has been signed out.')
            toast.warning('Change your password now if you think someone else had access.', { duration: 10000 })
            setIsChangingPassword(true)
        } catch (error) {
            console.error('Error terminating sessions:', error)
            toast.error('We could not sign out your other devices. Try signing out completely.')
        } finally {
            setIsTerminatingSessions(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!deletePassword) { toast.error('Enter your password to confirm.'); return }
        setIsDeleting(true)
        try {
            const response = await fetch('/api/users/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: deletePassword }),
            })
            // A 429 is the middleware limiter, which runs before the password check.
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After')
                const minutes = retryAfter ? Math.max(1, Math.ceil(parseInt(retryAfter, 10) / 60)) : 15
                toast.error(`Too many attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                return
            }
            const result = await response.json().catch(() => ({}))
            if (!response.ok) {
                toast.error(typeof result.error === 'string' && result.error.length < 140 ? result.error : 'We could not delete your account.')
                return
            }
            toast.success('Your account has been deleted.')
            setTimeout(() => { window.location.href = '/auth' }, 1500)
        } catch (error) {
            console.error('Delete account error:', error)
            toast.error('We could not delete your account. Try again.')
        } finally {
            setIsDeleting(false)
        }
    }

    const details = [
        { icon: Mail, label: 'Email', value: dbUser?.email },
        { icon: Phone, label: 'Mobile number', value: dbUser?.phone_number },
        { icon: Calendar, label: 'Member since', value: dbUser?.created_at ? formatDate(dbUser.created_at) : null },
    ]

    return (
        <div className="space-y-5">
            <header className="neu-night flex flex-col gap-5 rounded-[2rem] p-6 text-white sm:flex-row sm:items-center sm:p-7">
                <RoleAvatar role={roleKey} first={dbUser?.first_name} last={dbUser?.last_name} size="lg" />
                <div className="min-w-0 flex-1">
                    <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
                        {dbUser?.first_name} {dbUser?.last_name}
                    </h1>
                    <p className="mt-0.5 truncate text-sm text-silver-200">{dbUser?.email}</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
                        {(role === 'agent' || role === 'dealer') && <Crown className="h-3.5 w-3.5" aria-hidden="true" />}
                        {roleLabel}
                        {dbUser?.status && dbUser.status !== 'active' && <span className="text-silver-200"> · {dbUser.status}</span>}
                    </p>
                </div>
                {planDays !== null && (
                    <div className="w-full sm:w-52">
                        <div className="flex items-baseline justify-between text-sm">
                            <span className="text-silver-200">{role === 'dealer' ? 'Dealer plan' : 'Agent plan'}</span>
                            <span className={cn('font-semibold', planDays <= 3 && 'text-red-400')}>{planDays} {planDays === 1 ? 'day' : 'days'} left</span>
                        </div>
                        <div className="neu-night-in mt-2 h-2.5 overflow-hidden rounded-full" role="progressbar" aria-label="Plan time left" aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.min(30, planDays)}>
                            <div className={cn('h-full rounded-full', planDays <= 3 ? 'bg-red-500' : 'bg-brand-500')} style={{ width: `${Math.max(6, Math.min(100, (planDays / 30) * 100))}%` }} />
                        </div>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                <section id="personal-info" className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7" aria-labelledby="personal-title">
                    <h2 id="personal-title" className="font-display text-xl font-bold tracking-tight">Your details</h2>
                    {isEditing ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="space-y-4">
                            <TextField id="first_name" label="First name" autoComplete="given-name" value={formData.first_name} onChange={setField('first_name')} error={fieldErrors.first_name} />
                            <TextField id="last_name" label="Last name" autoComplete="family-name" value={formData.last_name} onChange={setField('last_name')} error={fieldErrors.last_name} />
                            <TextField id="phone_number" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={formData.phone_number} onChange={setField('phone_number')} error={fieldErrors.phone_number} hint="Used for your orders and payouts. We do not verify it with a code." />
                            <ClayButton type="submit" loading={isSaving}>Save changes</ClayButton>
                            <button type="button" onClick={() => { setIsEditing(false); setFieldErrors({}) }} className={cn('mx-auto block rounded text-sm text-muted-foreground hover:text-foreground', FOCUS)}>Cancel</button>
                        </form>
                    ) : (
                        <>
                            <dl className="space-y-3">
                                {details.map(d => (
                                    <div key={d.label} className="neu-inset flex items-center gap-3 rounded-2xl p-3.5">
                                        <d.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <dt className="text-sm text-muted-foreground">{d.label}</dt>
                                            <dd className="break-words font-semibold">{d.value || 'Not set'}</dd>
                                        </div>
                                    </div>
                                ))}
                            </dl>
                            <ClayButton type="button" onClick={() => setIsEditing(true)}>Edit details</ClayButton>
                        </>
                    )}
                </section>

                <section id="security-section" className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7" aria-labelledby="security-title">
                    <h2 id="security-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
                        <Shield className="h-5 w-5" aria-hidden="true" /> Security
                    </h2>
                    {isChangingPassword ? (
                        <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange() }} className="space-y-4">
                            <PasswordField id="currentPassword" label="Current password" autoComplete="current-password" value={passwordData.currentPassword} onChange={v => setPasswordData(p => ({ ...p, currentPassword: v }))} />
                            <button
                                type="button"
                                onClick={() => { window.location.href = '/api/auth/signout?next=/auth/reset-password' }}
                                className={cn('rounded text-sm font-semibold text-brand-800 underline underline-offset-2 dark:text-brand-400', FOCUS)}
                            >
                                I forgot my current password
                            </button>
                            <PasswordField id="newPassword" label="New password" autoComplete="new-password" value={passwordData.newPassword} onChange={v => setPasswordData(p => ({ ...p, newPassword: v }))} />
                            <PasswordRules value={passwordData.newPassword} />
                            <PasswordField id="confirmPassword" label="Confirm new password" autoComplete="new-password" value={passwordData.confirmPassword} onChange={v => setPasswordData(p => ({ ...p, confirmPassword: v }))} />
                            <ClayButton type="submit" loading={passwordSaving}>Change password</ClayButton>
                            <button type="button" onClick={() => setIsChangingPassword(false)} className={cn('mx-auto block rounded text-sm text-muted-foreground hover:text-foreground', FOCUS)}>Cancel</button>
                        </form>
                    ) : (
                        <div className="space-y-3">
                            <ClayButton type="button" onClick={() => setIsChangingPassword(true)}>Change password</ClayButton>
                            <button type="button" onClick={() => setConfirmSessions(true)} disabled={isTerminatingSessions} className={cn(secondaryBtn, 'w-full')}>
                                {isTerminatingSessions ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MonitorX className="h-4 w-4" aria-hidden="true" />}
                                Sign out other devices
                            </button>
                        </div>
                    )}
                </section>
            </div>

            <section className="neu-raised-sm space-y-4 rounded-3xl p-6" aria-labelledby="account-title">
                <h2 id="account-title" className="font-display text-xl font-bold tracking-tight">Account</h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={isSigningOut ? undefined : signOut} disabled={isSigningOut} className={cn(secondaryBtn, 'flex-1')}>
                        {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
                        {isSigningOut ? 'Signing out' : 'Sign out'}
                    </button>
                    <button type="button" onClick={() => setIsDeleteDialogOpen(true)} className={cn('clay-red flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold', FOCUS)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete my account
                    </button>
                </div>
            </section>

            <Dialog open={confirmSessions} onOpenChange={setConfirmSessions}>
                <DialogContent className="max-w-sm rounded-[2rem]" aria-describedby={undefined}>
                    <DialogHeader><DialogTitle className="font-display">Sign out other devices?</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Every other phone and browser signed in to your account will be signed out. This device stays signed in.</p>
                    <DialogFooter className="gap-2">
                        <button type="button" onClick={() => setConfirmSessions(false)} className="clay-silver min-h-11 rounded-full px-5 text-sm font-semibold">Cancel</button>
                        <button type="button" onClick={handleTerminateSessions} className="clay-black min-h-11 rounded-full px-5 text-sm font-semibold">Sign them out</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={(o) => { setIsDeleteDialogOpen(o); if (!o) setDeletePassword('') }}>
                <DialogContent className="max-w-md rounded-[2rem]" aria-describedby="delete-desc">
                    <DialogHeader><DialogTitle className="font-display">Delete your account for good?</DialogTitle></DialogHeader>
                    <div id="delete-desc" className="space-y-3 text-sm text-muted-foreground">
                        <p>This cannot be undone. It permanently removes:</p>
                        <ul className="list-inside list-disc space-y-1">
                            <li>Your profile and order history</li>
                            <li>Your transaction records</li>
                            <li>Your wallet balance</li>
                        </ul>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleDeleteAccount() }} className="space-y-4">
                        <Notice>Withdraw or spend your wallet balance first. It cannot be recovered after deletion.</Notice>
                        <PasswordField id="deletePassword" label="Enter your password to confirm" autoComplete="current-password" value={deletePassword} onChange={setDeletePassword} />
                        <DialogFooter className="gap-2">
                            <button type="button" onClick={() => { setIsDeleteDialogOpen(false); setDeletePassword('') }} disabled={isDeleting} className="clay-silver min-h-11 rounded-full px-5 text-sm font-semibold">Keep my account</button>
                            <button type="submit" disabled={isDeleting || !deletePassword} className="clay-red flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
                                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Delete my account
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
