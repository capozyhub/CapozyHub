'use client'

import { MessageCircle, Send, Globe, Phone } from 'lucide-react'
import { TextField } from '@/components/auth/fields'
import { sanitizeCtaUrl, getCtaMeta } from '@/lib/announcement-cta'
import { cn } from '@/lib/utils'

type Preset = {
    key: string
    label: string
    starterLabel: string
    starterUrl: string
    icon: typeof MessageCircle
}

const PRESETS: Preset[] = [
    { key: 'whatsapp', label: 'WhatsApp', starterLabel: 'Join our WhatsApp group', starterUrl: 'https://chat.whatsapp.com/', icon: MessageCircle },
    { key: 'telegram', label: 'Telegram', starterLabel: 'Join us on Telegram', starterUrl: 'https://t.me/', icon: Send },
    { key: 'website', label: 'Website', starterLabel: 'Visit the website', starterUrl: 'https://', icon: Globe },
    { key: 'call', label: 'Call', starterLabel: 'Call us', starterUrl: 'tel:+233', icon: Phone },
]

const LABEL_MAX = 40
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

/**
 * One optional action button: quick starters, the label and the link. The link is checked with
 * the same sanitizeCtaUrl the server and the popup use, so what turns green here is what works.
 */
export function CtaFieldGroup({ index, label, url, onLabel, onUrl, savedButtons = [] }: {
    index: 1 | 2
    label: string
    url: string
    onLabel: (v: string) => void
    onUrl: (v: string) => void
    savedButtons?: { label: string; url: string }[]
}) {
    const trimmedUrl = url.trim()
    const safe = sanitizeCtaUrl(trimmedUrl)
    const meta = safe ? getCtaMeta(safe) : null
    const linkError = trimmedUrl.length > 0 && !safe ? 'Use a link that starts with https://, tel: or mailto:.' : undefined
    const labelError = trimmedUrl.length > 0 && !label.trim() ? 'Give the button a label, or clear the link.' : undefined

    function applyPreset(p: Preset) {
        if (!label.trim()) onLabel(p.starterLabel)
        onUrl(p.starterUrl)
    }

    return (
        <div className="neu-inset space-y-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                    {index === 1 ? 'Button' : 'Second button'}
                </p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Start from">
                    {PRESETS.map(p => {
                        const Icon = p.icon
                        return (
                            <button
                                key={p.key}
                                type="button"
                                onClick={() => applyPreset(p)}
                                className={cn('neu-raised-sm neu-press flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground', FOCUS)}
                            >
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                {p.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {savedButtons.length > 0 && (
                <div className="space-y-2">
                    <label htmlFor={`saved-cta-${index}`} className="text-sm font-semibold text-foreground">Reuse a button from an earlier notice</label>
                    <div className="neu-inset rounded-xl">
                        <select
                            id={`saved-cta-${index}`}
                            value=""
                            onChange={e => {
                                const b = savedButtons[Number(e.target.value)]
                                if (b) { onLabel(b.label); onUrl(b.url) }
                            }}
                            className="h-12 w-full rounded-xl border-0 bg-transparent px-4 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500"
                        >
                            <option value="" disabled>Pick one…</option>
                            {savedButtons.map((b, i) => (
                                <option key={`${b.label}-${i}`} value={i}>
                                    {b.label} ({getCtaMeta(b.url).domain})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    id={`cta-${index}-label`}
                    label="Label"
                    value={label}
                    onChange={v => onLabel(v.slice(0, LABEL_MAX))}
                    placeholder="Join our WhatsApp group"
                    hint={`${label.length} of ${LABEL_MAX}`}
                    error={labelError}
                    required={false}
                />
                <TextField
                    id={`cta-${index}-url`}
                    label="Link"
                    value={url}
                    onChange={onUrl}
                    placeholder="https://"
                    hint={meta ? `Opens ${meta.domain}` : undefined}
                    error={linkError}
                    required={false}
                />
            </div>
        </div>
    )
}
