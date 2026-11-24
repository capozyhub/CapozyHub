'use client'

import { useEffect, useMemo, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Copy, Link2, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn, formatDate } from '@/lib/utils'
import { Notice } from '@/components/auth/fields'
import { resolveCtas } from '@/lib/announcement-cta'
import { computeShowingIds } from '@/lib/announcement-visibility'
import type { SystemAnnouncement } from '@/types/supabase'

type Filter = 'all' | 'published' | 'scheduled' | 'drafts' | 'off'

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Live' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'off', label: 'Switched off' },
]

const AUDIENCE_LABEL: Record<string, string> = {
    main_site: 'Members',
    storefronts: 'Shop visitors',
    both: 'Everyone',
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
const ACTION = cn('neu-raised-sm neu-press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-foreground disabled:opacity-60', FOCUS)

function matchesFilter(a: SystemAnnouncement, f: Filter): boolean {
    const status = a.status ?? 'published'
    if (f === 'all') return true
    if (f === 'drafts') return status === 'draft'
    if (f === 'scheduled') return status === 'scheduled'
    if (f === 'published') return status === 'published' && a.is_active === true
    if (f === 'off') return status === 'published' && a.is_active !== true
    return true
}

function Pill({ tone = 'plain', children }: { tone?: 'gold' | 'plain' | 'warn'; children: React.ReactNode }) {
    return (
        <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
            tone === 'gold' && 'clay-gold',
            tone === 'plain' && 'neu-inset text-muted-foreground',
            tone === 'warn' && 'neu-inset text-amber-700 dark:text-amber-400',
        )}>
            {children}
        </span>
    )
}

function StatusPill({ a, showing }: { a: SystemAnnouncement; showing: boolean }) {
    const status = a.status ?? 'published'
    if (status === 'draft') return <Pill>Draft</Pill>
    if (status === 'scheduled') return <Pill>Scheduled{a.scheduled_at ? ` for ${formatDate(a.scheduled_at)}` : ''}</Pill>
    if (a.is_active) {
        // "Live" means people are seeing it. An active row that a newer one covers on the same
        // audience is flagged, so nobody thinks it is reaching anyone.
        return showing ? <Pill tone="gold">Live</Pill> : <Pill tone="warn">Covered by a newer notice</Pill>
    }
    return <Pill>Switched off</Pill>
}

export function HistoryTab({ announcements, loading, loadError, onEdit, onDuplicate, onRefresh }: {
    announcements: SystemAnnouncement[]
    loading: boolean
    loadError: boolean
    onEdit: (a: SystemAnnouncement) => void
    onDuplicate: (a: SystemAnnouncement) => void
    onRefresh: () => void
}) {
    const [filter, setFilter] = useState<Filter>('all')
    const [busyId, setBusyId] = useState<string | null>(null)
    // In-page confirm. Native confirm() is unreliable inside an installed iOS app (it returns
    // false without showing), which once swallowed every delete.
    const [confirmDelete, setConfirmDelete] = useState<SystemAnnouncement | null>(null)

    useEffect(() => {
        if (!confirmDelete) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmDelete(null) }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [confirmDelete])

    const filtered = useMemo(() => announcements.filter(a => matchesFilter(a, filter)), [announcements, filter])

    // Which rows people actually see (newest active per audience) vs. active rows a newer one covers.
    const showingIds = useMemo(() => computeShowingIds(announcements as any), [announcements])
    const coveredCount = useMemo(
        () => announcements.filter(a => a.is_active && !showingIds.has(a.id)).length,
        [announcements, showingIds],
    )

    async function toggle(a: SystemAnnouncement) {
        setBusyId(a.id)
        try {
            const res = await fetch(`/api/admin/announcements/${a.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle' }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || 'Could not change it')
            onRefresh()
        } catch (e: any) {
            toast.error(e.message || 'Could not change it. Try again.')
        } finally {
            setBusyId(null)
        }
    }

    async function doDelete(a: SystemAnnouncement) {
        setConfirmDelete(null)
        setBusyId(a.id)
        try {
            const res = await fetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE' })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || 'Could not delete it')
            toast.success('Announcement deleted')
            onRefresh()
        } catch (e: any) {
            toast.error(e.message || 'Could not delete it. Try again.')
        } finally {
            setBusyId(null)
        }
    }

    if (loadError) {
        return (
            <div className="neu-raised space-y-4 rounded-[2rem] p-6 text-center">
                <Notice>We could not load your announcements.</Notice>
                <button type="button" onClick={onRefresh} className={cn('clay-black mx-auto flex min-h-[3rem] items-center rounded-full px-6 text-sm font-semibold', FOCUS)}>
                    Try again
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter announcements">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        type="button"
                        aria-pressed={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            'h-9 rounded-full px-4 text-sm font-semibold',
                            filter === f.value ? 'clay-gold' : 'neu-raised-sm neu-press text-foreground',
                            FOCUS,
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {coveredCount > 0 && (
                <Notice tone="info">
                    {coveredCount === 1 ? '1 live notice is' : `${coveredCount} live notices are`} covered by a newer one on the same audience.
                    Only the newest reaches people. Switch the newer one off to bring the older one back.
                </Notice>
            )}

            {loading ? (
                <div role="status" className="flex justify-center py-14">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">Loading announcements</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="neu-inset rounded-3xl px-6 py-12 text-center">
                    <p className="font-display text-lg font-bold text-foreground">
                        {announcements.length === 0 ? 'Nothing here yet' : 'Nothing matches that filter'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {announcements.length === 0 ? 'Notices you write will be listed here.' : 'Try another filter.'}
                    </p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map(a => {
                        const ctas = resolveCtas(a)
                        const hasCta = !!(ctas.primary || ctas.secondary)
                        const busy = busyId === a.id
                        return (
                            <li key={a.id} className="neu-raised-sm space-y-4 rounded-3xl p-4 sm:p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                                            <span className="truncate">{a.title}</span>
                                            {hasCta && <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Has a button" />}
                                        </h3>
                                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{a.message}</p>
                                        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                                            {AUDIENCE_LABEL[a.visible_on ?? 'main_site'] ?? 'Members'} · written {formatDate(a.created_at)}
                                        </p>
                                    </div>
                                    <StatusPill a={a} showing={showingIds.has(a.id)} />
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                                    <div className="flex items-center gap-2.5">
                                        <Switch
                                            id={`ann-on-${a.id}`}
                                            checked={a.is_active ?? false}
                                            disabled={busy || (a.status ?? 'published') !== 'published'}
                                            onCheckedChange={() => toggle(a)}
                                            aria-label={`Show "${a.title}" to people`}
                                        />
                                        <label htmlFor={`ann-on-${a.id}`} className="text-sm font-medium text-muted-foreground">
                                            {(a.status ?? 'published') !== 'published' ? 'Not published yet' : a.is_active ? 'Showing' : 'Switched off'}
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" onClick={() => onEdit(a)} className={ACTION}>
                                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                                        </button>
                                        <button type="button" onClick={() => onDuplicate(a)} className={ACTION}>
                                            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Duplicate
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => setConfirmDelete(a)}
                                            className={cn(ACTION, 'text-red-700 dark:text-red-400')}
                                        >
                                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />} Delete
                                        </button>
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} aria-hidden="true" />
                    <div role="alertdialog" aria-modal="true" aria-labelledby="ann-del-title" aria-describedby="ann-del-body" className="neu-raised relative w-full max-w-sm space-y-5 rounded-[2rem] bg-neu p-6">
                        <div>
                            <h3 id="ann-del-title" className="font-display text-xl font-bold text-foreground">Delete this announcement?</h3>
                            <p id="ann-del-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                &ldquo;{confirmDelete.title}&rdquo; will be removed for good. This cannot be undone.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <button type="button" onClick={() => doDelete(confirmDelete)} className={cn('clay-red flex min-h-[3rem] items-center justify-center rounded-full text-sm font-semibold', FOCUS)}>
                                Delete it
                            </button>
                            <button type="button" autoFocus onClick={() => setConfirmDelete(null)} className={cn('neu-raised-sm neu-press flex min-h-[3rem] items-center justify-center rounded-full text-sm font-semibold text-foreground', FOCUS)}>
                                Keep it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
