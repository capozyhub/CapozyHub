'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { AnnouncementCTAButtons } from '@/components/announcements/AnnouncementCTAButtons'
import { cn } from '@/lib/utils'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
const TABBABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type AnnouncementContent = {
    title?: string | null
    message: string
    cta_primary_label?: string | null
    cta_primary_url?: string | null
    cta_secondary_label?: string | null
    cta_secondary_url?: string | null
}

/**
 * The one announcement popup, used on the member dashboard, on every shop storefront and in the
 * admin preview, so what an admin previews is what people get.
 *
 * It opens on top of the page and cannot be dismissed by tapping outside: the notice has to be
 * read. The button unlocks after `readSeconds` (pass 0 for someone re-reading a notice they have
 * already seen), then Escape works too. Focus stays inside while it is open and returns to where
 * it was on close. Mount it only while it should be open; each mount starts a fresh countdown.
 * With `preview` it renders in place, with no overlay, countdown or focus handling.
 */
export function AnnouncementDialog({ content, from, onDismiss, readSeconds = 5, preview = false }: {
    content: AnnouncementContent
    /** Who the notice is from, e.g. "From the Capozy Hub team" or "From Kofi Data Hub". */
    from: string
    onDismiss?: () => void
    readSeconds?: number
    preview?: boolean
}) {
    const titleId = useId()
    const panelRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [left, setLeft] = useState(preview ? 0 : readSeconds)
    const locked = left > 0

    useEffect(() => {
        if (preview || left <= 0) return
        const t = setTimeout(() => setLeft(l => l - 1), 1000)
        return () => clearTimeout(t)
    }, [left, preview])

    // Lock the page behind, move focus in, and put it back where it was when the popup closes.
    useEffect(() => {
        if (preview) return
        const previous = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        panelRef.current?.focus()
        return () => {
            document.body.style.overflow = overflow
            previous?.focus?.()
        }
    }, [preview])

    // Once the button unlocks it is where focus belongs.
    useEffect(() => { if (!preview && !locked) buttonRef.current?.focus() }, [preview, locked])

    useEffect(() => {
        if (preview) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !locked) { onDismiss?.(); return }
            if (e.key !== 'Tab') return
            // Keep Tab inside the popup: wrap at both ends, and park on the panel while it is locked.
            const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])
            if (nodes.length === 0) { e.preventDefault(); panelRef.current?.focus(); return }
            const first = nodes[0]
            const last = nodes[nodes.length - 1]
            const active = document.activeElement
            if (e.shiftKey && (active === first || active === panelRef.current)) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
            else if (!panelRef.current?.contains(active)) { e.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [preview, locked, onDismiss])

    const panel = (
        <div
            ref={panelRef}
            {...(preview ? {} : { role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, tabIndex: -1 })}
            className={cn(
                'relative flex w-full flex-col overflow-hidden bg-neu outline-none',
                preview
                    ? 'neu-raised rounded-[2rem]'
                    : 'max-h-[100dvh] rounded-t-[2rem] shadow-[0_-18px_40px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom fade-in duration-300 motion-reduce:animate-none sm:mx-4 sm:max-h-[90dvh] sm:max-w-md sm:rounded-[2rem]',
            )}
        >
            <div className="relative isolate shrink-0 overflow-hidden bg-black px-6 pb-6 pt-7 text-white sm:px-7">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-1/2 -z-10 w-full opacity-35" />
                <span className="clay-gold flex h-11 w-11 items-center justify-center rounded-full">
                    <Megaphone className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-brand-400">{from}</p>
                {/* The global h2 rule sets a dark colour, so white has to be set here or the title vanishes on the black header. */}
                <h2 id={titleId} className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-balance !text-white">
                    {content.title?.trim() || 'A quick update'}
                </h2>
            </div>

            {/* Only the message scrolls, so the button is always on screen. It is focusable so a keyboard can scroll a long one. */}
            <div
                tabIndex={0}
                aria-label="Announcement message"
                className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7', preview ? 'max-h-80' : '', FOCUS)}
            >
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{content.message}</p>
                <AnnouncementCTAButtons row={content} className={cn('mt-5', preview && '[&_a]:pointer-events-none')} />
            </div>

            <div className="shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-2 sm:px-7 sm:pb-7">
                {preview ? (
                    <div aria-hidden="true" className="clay-gold flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-base font-semibold">Got it</div>
                ) : (
                    <>
                        <button
                            ref={buttonRef}
                            type="button"
                            onClick={onDismiss}
                            disabled={locked}
                            className={cn(
                                'flex min-h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-full text-base font-semibold',
                                FOCUS,
                                locked ? 'neu-inset text-muted-foreground' : 'clay-gold',
                            )}
                        >
                            {locked ? (
                                <>
                                    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current text-xs font-semibold tabular-nums">{left}</span>
                                    Please read first
                                </>
                            ) : 'Got it'}
                        </button>
                        <span role="status" className="sr-only">{locked ? '' : 'You can close this notice now.'}</span>
                    </>
                )}
            </div>
        </div>
    )

    if (preview) return panel

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            {/* No dismiss on a backdrop tap: the notice has to be read. */}
            <div aria-hidden="true" className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none" />
            {panel}
        </div>
    )
}