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
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
                <p className="text-sm text-muted-foreground">Your alerts and notification preferences</p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted w-fit">
                {([['inbox', 'Inbox', Bell], ['settings', 'Settings', Settings]] as const).map(([key, label, Icon]) => (
                    <button key={key} type="button" onClick={() => setTab(key)}
                        className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {tab === 'inbox' ? <NotificationsInbox highlightId={highlightId} /> : <NotificationSettings />}
        </div>
    )
}
