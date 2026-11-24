'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { ClayButton, Notice } from '@/components/auth/fields'
import { JoinFrame } from '@/components/join/join-frame'

// Neutral partner portal: the white-label front door of the store domain. A guest types (or
// pastes) their shop owner's invite code and is routed into the owner-branded onboarding at
// /join/[code]. It deliberately carries no platform branding (see app/join/layout.tsx).

// Accept a bare code OR a pasted full invite link: extract the trailing segment.
function extractCode(raw: string): string {
    const v = raw.trim()
    if (!v) return ''
    const m = v.match(/\/join\/([^/?#\s]+)/i)
    if (m) return m[1]
    try {
        const u = new URL(v)
        const seg = u.pathname.split('/').filter(Boolean).pop()
        if (seg) return seg
    } catch { /* not a URL: treat as a raw code */ }
    return v
}

export default function PartnerPortalPage() {
    const router = useRouter()
    const [value, setValue] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        const code = extractCode(value)
        if (code.length < 4) { setError('Enter your invite code.'); return }
        setBusy(true)
        try {
            const r = await fetch(`/api/join?code=${encodeURIComponent(code)}`)
            const j = await r.json()
            if (j?.data?.valid) {
                router.push(`/join/${encodeURIComponent(code)}`)
                return
            }
            setError('That invite code is not valid. It may have expired or been turned off.')
        } catch {
            setError('We could not check that code. Try again.')
        }
        setBusy(false)
    }

    return (
        <JoinFrame title="Join a storefront" lead="Enter the invite code from your shop owner.">
            <form onSubmit={submit} className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7">
                {error && <Notice>{error}</Notice>}
                <div className="space-y-2">
                    <label htmlFor="invite-code" className="text-sm font-semibold">Invite code or link</label>
                    <div className="neu-inset rounded-xl">
                        <input
                            id="invite-code"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoFocus
                            className="h-12 w-full rounded-xl bg-transparent px-4 text-base placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-brand-500"
                            placeholder="Paste your code or invite link"
                        />
                    </div>
                </div>
                <ClayButton type="submit" loading={busy}>
                    Continue {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </ClayButton>
                <p className="text-center text-xs text-muted-foreground">Invitation only.</p>
            </form>
        </JoinFrame>
    )
}
