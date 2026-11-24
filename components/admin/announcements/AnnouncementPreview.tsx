'use client'

import { BRAND } from '@/lib/brand'
import { AnnouncementDialog, type AnnouncementContent } from '@/components/announcements/announcement-dialog'

export type AnnouncementDraft = AnnouncementContent

/**
 * The popup exactly as people will get it. It is the same component the dashboard and the shop
 * storefronts render, shown in place instead of over the page. An admin notice reads the same
 * on both, so there is one preview.
 */
export function AnnouncementPreview({ draft }: { draft: AnnouncementDraft }) {
    const content: AnnouncementContent = {
        ...draft,
        title: draft.title?.trim() || 'Your title appears here',
        message: draft.message.trim() || 'Your message appears here as you type. Line breaks are kept.',
    }
    return (
        <div className="mx-auto w-full max-w-sm">
            <AnnouncementDialog preview content={content} from={`From the ${BRAND.name} team`} />
        </div>
    )
}
