'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { collectSavedButtons } from '@/lib/announcement-cta'
import { ComposeTab, type EditingAnnouncement } from '@/components/admin/announcements/ComposeTab'
import { HistoryTab } from '@/components/admin/announcements/HistoryTab'
import type { SystemAnnouncement } from '@/types/supabase'

type Tab = 'compose' | 'history'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

export default function AdminAnnouncementsPage() {
    const [tab, setTab] = useState<Tab>('compose')
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [editing, setEditing] = useState<EditingAnnouncement>(null)
    // Only the newest request may write state: a slow reply from before a toggle or delete
    // must not overwrite the fresher list.
    const requestId = useRef(0)

    // Buttons used on earlier notices (newest first), offered for reuse in the form.
    const savedButtons = useMemo(() => collectSavedButtons(announcements), [announcements])

    const fetchAnnouncements = useCallback(async () => {
        const mine = ++requestId.current
        setLoading(true)
        setLoadError(false)
        try {
            // RLS lets admins read every row (drafts and scheduled too), so this stays on the cookie client.
            const { data, error } = await supabase
                .from('system_announcements')
                .select('*')
                .order('created_at', { ascending: false })
            if (mine !== requestId.current) return
            if (error) throw error
            setAnnouncements((data ?? []) as SystemAnnouncement[])
        } catch (e) {
            if (mine !== requestId.current) return
            console.error('[admin-announcements] fetch error', e)
            setLoadError(true)
        } finally {
            if (mine === requestId.current) setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

    function handleEdit(a: SystemAnnouncement) {
        setEditing(a)
        setTab('compose')
    }

    function handleDuplicate(a: SystemAnnouncement) {
        // No id: the form saves it as a brand-new row.
        setEditing({
            title: `${a.title} (copy)`.slice(0, 80),
            message: a.message,
            visible_on: a.visible_on,
            cta_primary_label: a.cta_primary_label,
            cta_primary_url: a.cta_primary_url,
            cta_secondary_label: a.cta_secondary_label,
            cta_secondary_url: a.cta_secondary_url,
        })
        setTab('compose')
    }

    function handleSaved() {
        setEditing(null)
        fetchAnnouncements()
        setTab('history')
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: 'compose', label: editing?.id ? 'Edit' : 'Write' },
        { id: 'history', label: `History${announcements.length ? ` (${announcements.length})` : ''}` },
    ]

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl">Announcements</h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Write a notice, choose who sees it, and publish it now or at a set time. People read it in a popup, and can get a push notification too.
                </p>
            </div>

            <div role="tablist" aria-label="Announcements" className="neu-inset inline-flex rounded-full p-1">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        id={`ann-tab-${t.id}`}
                        role="tab"
                        type="button"
                        aria-selected={tab === t.id}
                        aria-controls={`ann-panel-${t.id}`}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            'h-10 rounded-full px-5 text-sm font-semibold transition-colors motion-reduce:transition-none',
                            tab === t.id ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                            FOCUS,
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div id={`ann-panel-${tab}`} role="tabpanel" aria-labelledby={`ann-tab-${tab}`}>
                {tab === 'compose' ? (
                    <ComposeTab editing={editing} onSaved={handleSaved} onCancelEdit={() => setEditing(null)} savedButtons={savedButtons} />
                ) : (
                    <HistoryTab
                        announcements={announcements}
                        loading={loading}
                        loadError={loadError}
                        onEdit={handleEdit}
                        onDuplicate={handleDuplicate}
                        onRefresh={fetchAnnouncements}
                    />
                )}
            </div>
        </div>
    )
}
