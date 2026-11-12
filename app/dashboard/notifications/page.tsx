'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { Bell, Settings } from 'lucide-react'
import NotificationsInbox from '@/components/dashboard/notifications/NotificationsInbox'

const NotificationSettings = dynamic(() => import('@/components/dashboard/notifications/NotificationSettings'), { ssr: false })

type Tab = 'inbox' | 'settings'

export default function NotificationsPage() {
    const [tab, setTab] = useState<Tab>('inbox')
    const [highlightId, setHighlightId] = useState<string | null>(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('tab') === 'settings') setTab('settings')
        setHighlightId(params.get('highlight'))
    }, [])

    return (
        <div className="space-y-5">
            <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">What&apos;s new</h1>
                <p className="text-sm text-muted-foreground">Everything that happens on your account, in one place.</p>
            </div>

            <div className="neu-inset flex items-center gap-1 rounded-2xl p-1.5 w-fit">
                {([['inbox', 'Inbox', Bell], ['settings', 'Settings', Settings]] as const).map(([key, label, Icon]) => (
                    <button key={key} type="button" onClick={() => setTab(key)}
                        className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors',
                            tab === key ? 'neu-raised-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {tab === 'inbox' ? <NotificationsInbox highlightId={highlightId} /> : <NotificationSettings />}
        </div>
    )
}
