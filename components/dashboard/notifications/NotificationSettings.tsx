'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import {
    CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_DESCRIPTION, type NotificationCategory,
} from '@/lib/notification-categories'

export default function NotificationSettings() {
    const { permission, isSupported, isSubscribing, isUnsubscribing, requestPermission, unsubscribe } = usePushNotifications()
    const [muted, setMuted] = useState<Record<NotificationCategory, boolean>>({
        orders: false, payments: false, support: false, announcements: false, system: false,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<NotificationCategory | null>(null)

    useEffect(() => {
        ;(async () => {
            try {
                const res = await fetch('/api/user/notification-prefs')
                const data = await res.json()
                const m = data?.notification_prefs?.muted ?? {}
                setMuted({
                    orders: !!m.orders, payments: !!m.payments, support: !!m.support,
                    announcements: !!m.announcements, system: !!m.system,
                })
            } catch { /* keep defaults */ } finally { setLoading(false) }
        })()
    }, [])

    const persist = async (next: Record<NotificationCategory, boolean>) => {
        const mutedCategories = CATEGORY_ORDER.filter(c => next[c])
        const res = await fetch('/api/user/notification-prefs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mutedCategories }),
        })
        if (!res.ok) throw new Error('save failed')
    }

    const toggleCategory = async (cat: NotificationCategory, value: boolean) => {
        const prev = muted
        const next = { ...muted, [cat]: value }
        setMuted(next); setSaving(cat)
        try { await persist(next) }
        catch { setMuted(prev); toast.error('Failed to save preference') }
        finally { setSaving(null) }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Master push */}
            <section className="neu-raised-sm rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <div className="clay-green w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Push alerts</h3>
                        {!isSupported ? (
                            <p className="text-xs text-muted-foreground mt-1">This browser can&apos;t receive push alerts.</p>
                        ) : permission === 'denied' ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Notifications are blocked for this site. Re-allow them in your browser settings to turn alerts back on.</p>
                        ) : permission === 'granted' ? (
                            <>
                                <p className="text-xs text-muted-foreground mt-1">This device is wired in — alerts land the moment something happens.</p>
                                <button type="button" disabled={isUnsubscribing} onClick={async () => { await unsubscribe(); toast.success('Push disabled on this device') }}
                                    className="neu-raised-sm neu-press mt-3 flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold text-foreground disabled:opacity-60">
                                    {isUnsubscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />} Turn off on this device
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-muted-foreground mt-1">Turn this on and you&apos;ll know the moment an order, payment or message changes.</p>
                                <button type="button" disabled={isSubscribing} onClick={async () => { await requestPermission() }}
                                    className="clay-gold mt-3 flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold disabled:opacity-60">
                                    {isSubscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />} Turn on push alerts
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Per-category mutes */}
            <section className="neu-raised-sm rounded-2xl p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-foreground">What you hear about</h3>
                <p className="text-xs text-muted-foreground mt-1">Muting a category only stops the push ping — it still lands in your inbox.</p>
                <div className="mt-4 divide-y divide-border/60">
                    {loading ? (
                        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : CATEGORY_ORDER.map(cat => (
                        <div key={cat} className="flex items-center justify-between py-3">
                            <div className="min-w-0 pr-4">
                                <p className="text-sm font-medium text-foreground">{CATEGORY_LABEL[cat]}</p>
                                <p className="text-[11px] text-muted-foreground">{CATEGORY_DESCRIPTION[cat]}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {saving === cat && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                                {/* Switch ON = receiving (not muted) */}
                                <Switch checked={!muted[cat]} onCheckedChange={(on) => toggleCategory(cat, !on)} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
