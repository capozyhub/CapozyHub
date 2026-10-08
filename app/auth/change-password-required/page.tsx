'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { AuthShell } from '@/components/auth/auth-shell'
import { ClayButton, Notice, PasswordField, PasswordRules } from '@/components/auth/fields'
import { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/password-validation'
import { toast } from '@/lib/toast'

export default function ChangePasswordRequiredPage() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!isStrongPassword(newPassword)) { setError(PASSWORD_REQUIREMENTS_MESSAGE); return }
        if (newPassword !== confirmPassword) { setError('The two new passwords do not match.'); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) { setError(body.error || 'Could not change your password.'); return }
            toast.success('Password changed')
            window.location.assign('/dashboard')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AuthShell
            heading="Set your own password."
            lead="Replace the one you were given with a password only you know."
            progress={0.75}
            backHref="/dashboard"
            backLabel="Back to dashboard"
        >
            <form onSubmit={submit} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                {error && <Notice>{error}</Notice>}
                <PasswordField id="currentPassword" label="Current password or access key" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" autoFocus />
                <PasswordField id="newPassword" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                <PasswordRules value={newPassword} />
                <PasswordField id="confirmPassword" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                <ClayButton type="submit" loading={submitting}>
                    {submitting ? 'Saving' : <>Save password<ArrowRight className="h-4 w-4" /></>}
                </ClayButton>
            </form>
        </AuthShell>
    )
}