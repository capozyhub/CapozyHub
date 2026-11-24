'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useModalQueue } from '@/contexts/modal-queue-context'
import { useUI } from '@/contexts/ui-context'
import { SystemAnnouncement } from '@/types/supabase'
import { BRAND } from '@/lib/brand'
import { AnnouncementDialog } from '@/components/announcements/announcement-dialog'

const seenKey = (id: string) => `announcement_seen_${id}`

// Storage can be blocked (private windows, strict settings). Seen-state is a convenience only.
function wasSeen(id: string): boolean {
    try { return !!sessionStorage.getItem(seenKey(id)) } catch { return false }
}
function markSeen(id: string) {
    try { sessionStorage.setItem(seenKey(id), 'true') } catch { /* shown again next visit */ }
}

/** The notice an admin publishes for members. Shown once per browser session, after the terms gate. */
export function SystemAnnouncementModal() {
    const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null)
    const [hasSeen, setHasSeen] = useState(false)
    // Someone re-opening a notice they already read should not have to wait out the countdown again.
    const [rereading, setRereading] = useState(false)
    const { setActiveAnnouncement, announcementReopenTick } = useUI()

    useEffect(() => {
        let alive = true
        ;(async () => {
            try {
                const { data, error } = await supabase
                    .from('system_announcements')
                    .select('id, title, message, cta_primary_label, cta_primary_url, cta_secondary_label, cta_secondary_url')
                    .eq('is_active', true)
                    .in('visible_on', ['main_site', 'both'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                if (!alive) return
                if (error) { console.error('Error fetching announcement:', error); return }
                if (data) {
                    setAnnouncement(data as SystemAnnouncement)
                    setHasSeen(wasSeen((data as any).id))
                }
            } catch (err) {
                console.error('Failed to check announcements', err)
            }
        })()
        return () => { alive = false }
    }, [])

    // Let the dashboard carousel know an announcement exists, and clear it if this unmounts.
    useEffect(() => {
        setActiveAnnouncement(announcement ? { id: announcement.id, title: announcement.title ?? '' } : null)
        return () => setActiveAnnouncement(null)
    }, [announcement, setActiveAnnouncement])

    // Re-show on request (e.g. the carousel's "Read" button), even if already seen. The tick lives
    // in the root UIProvider and outlives this component, so compare against the value at mount:
    // otherwise coming back to the dashboard would re-open a notice that was already read.
    const handledReopenTick = useRef(announcementReopenTick)
    useEffect(() => {
        if (announcementReopenTick === handledReopenTick.current) return
        handledReopenTick.current = announcementReopenTick
        setRereading(true)
        setHasSeen(false)
    }, [announcementReopenTick])

    const { canShow, onDismiss: queueDismiss } = useModalQueue('ANNOUNCEMENT', !!announcement && !hasSeen)

    if (!canShow || !announcement) return null

    return (
        <AnnouncementDialog
            content={announcement}
            from={`From the ${BRAND.name} team`}
            readSeconds={rereading ? 0 : undefined}
            onDismiss={() => {
                markSeen(announcement.id)
                setHasSeen(true)
                queueDismiss()
            }}
        />
    )
}
