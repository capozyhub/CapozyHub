'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { Notification } from '@/types/supabase'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import {
    Bell,
    X,
    Check,
    Trash2,
    Trash,
    Loader2,
    CheckCircle2,
    Download,
    Settings,
    ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { NotifIcon, iconBg } from '@/components/dashboard/notification-visuals'
import { NotificationMessage } from '@/components/dashboard/notification-message'

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotificationModalProps {
    isOpen: boolean
    onClose: () => void
    highlightedId: string | null
    onClearHighlight: () => void
}

// Notification icon + background are shared with the full notifications page
// via components/dashboard/notification-visuals (single source of truth).

// EGRESS: this query used to be unbounded. `notifications` grows without limit
// per account, so a long-lived user re-downloaded their ENTIRE history on every
// open. The list is newest-first and the footer links to the full page, so 50
// rows is more than the modal ever shows.
const NOTIFICATION_FETCH_LIMIT = 50

// EGRESS: re-opens within this window reuse the rows already in state instead of
// re-querying. The realtime INSERT subscription below keeps the list current
// while mounted, so a re-open has nothing new to fetch. This also makes the
// fetch effect idempotent if `fetchNotifications` changes identity on a
// re-render (it depends on `dbUser`), which previously caused a full re-query.
const REFETCH_STALE_MS = 60_000

// ── Main component ────────────────────────────────────────────────────────────
export function NotificationModal({
    isOpen,
    onClose,
    highlightedId,
    onClearHighlight,
}: NotificationModalProps) {
    const { dbUser } = useAuth()
    const router = useRouter()
    const { permission, isSupported, isSubscribing, requestPermission } = usePushNotifications()

    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [markingAllRead, setMarkingAllRead] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)
    const [mounted, setMounted] = useState(false)

    // PWA install prompt
    const [installPrompt, setInstallPrompt] = useState<any>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isInstalling, setIsInstalling] = useState(false)

    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasFetchedRef = useRef(false)
    const lastFetchedAtRef = useRef(0)

    // ── Swipe-down-to-close (mobile bottom sheet) ─────────────────────────────
    // Direct DOM manipulation avoids per-frame React re-renders during the gesture
    const panelRef = useRef<HTMLDivElement>(null)
    const dragStartY = useRef(0)
    const dragDelta = useRef(0)
    const [isDragging, setIsDragging] = useState(false)

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY
        dragDelta.current = 0
        setIsDragging(true)
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const delta = e.touches[0].clientY - dragStartY.current
        if (delta > 0 && panelRef.current) {
            dragDelta.current = delta
            panelRef.current.style.transform = `translateY(${delta}px)`
            panelRef.current.style.opacity = String(Math.max(0, 1 - delta / 300))
        }
    }, [])

    const handleTouchEnd = useCallback(() => {
        const delta = dragDelta.current
        if (panelRef.current) {
            panelRef.current.style.transform = ''
            panelRef.current.style.opacity = ''
        }
        dragDelta.current = 0
        setIsDragging(false)
        if (delta > 90) onClose()
    }, [onClose])

    useEffect(() => { setMounted(true) }, [])

    // Detect PWA install state
    useEffect(() => {
        if (typeof window === 'undefined') return
        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true
        setIsInstalled(standalone)

        const handler = (e: Event) => {
            e.preventDefault()
            setInstallPrompt(e)
        }
        window.addEventListener('beforeinstallprompt', handler)
        window.addEventListener('appinstalled', () => setIsInstalled(true))
        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    // Lock body scroll while modal is open (avoid touching html — it breaks position:fixed)
    useEffect(() => {
        if (!isOpen) return
        const scrollY = window.scrollY
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.width = '100%'
        return () => {
            document.body.style.position = ''
            document.body.style.top = ''
            document.body.style.width = ''
            window.scrollTo(0, scrollY)
        }
    }, [isOpen])

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async (showLoading = true) => {
        if (!dbUser) return
        if (showLoading) setIsLoading(true)
        try {
            const { data, error } = await (supabase
                .from('notifications') as any)
                .select('*')
                .eq('user_id', dbUser.id)
                .order('created_at', { ascending: false })
                .limit(NOTIFICATION_FETCH_LIMIT)

            if (error) throw error
            const rows: Notification[] = data || []
            lastFetchedAtRef.current = Date.now()
            setNotifications(rows)
        } catch {
            toast.error('Failed to load notifications')
        } finally {
            setIsLoading(false)
        }
    }, [dbUser])

    // First open: show skeleton. Re-opens: show cached rows instantly, and only
    // hit the network again if they have actually gone stale (see REFETCH_STALE_MS).
    useEffect(() => {
        if (!isOpen || !dbUser) return

        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true
            fetchNotifications(true)
            return
        }

        if (Date.now() - lastFetchedAtRef.current >= REFETCH_STALE_MS) {
            fetchNotifications(false)
        }
    }, [isOpen, dbUser, fetchNotifications])

    // ── Realtime subscription ────────────────────────────────────────────────
    useEffect(() => {
        if (!dbUser || !isOpen) return

        const channel = supabase
            .channel(`notifications:${dbUser.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${dbUser.id}`,
            }, (payload) => {
                setNotifications(prev => [payload.new as Notification, ...prev])
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [dbUser, isOpen])

    // ── Highlight scroll ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!highlightedId || isLoading) return

        const tryScroll = () => {
            const el = document.getElementById(`notif-${highlightedId}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
                highlightTimerRef.current = setTimeout(() => onClearHighlight(), 3000)
            }
        }

        const t = setTimeout(tryScroll, 150)
        return () => {
            clearTimeout(t)
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
        }
    }, [highlightedId, isLoading, onClearHighlight])

    // ── Actions ───────────────────────────────────────────────────────────────
    const markAsRead = async (id: string) => {
        const { error } = await (supabase.from('notifications') as any).update({ is_read: true }).eq('id', id)
        if (error) { toast.error('Failed to mark as read'); return }
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    }

    const handleNotifClick = async (notif: Notification) => {
        if (!notif.is_read) await markAsRead(notif.id)
        if (notif.action_url) {
            onClose()
            router.push(notif.action_url)
        }
    }

    const markAllAsRead = async () => {
        setMarkingAllRead(true)
        try {
            await (supabase.from('notifications') as any)
                .update({ is_read: true })
                .eq('user_id', dbUser?.id)
                .eq('is_read', false)
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            toast.success('All notifications marked as read')
        } catch {
            toast.error('Failed to mark all as read')
        } finally {
            setMarkingAllRead(false)
        }
    }

    const deleteNotif = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        const { error } = await (supabase.from('notifications') as any).delete().eq('id', id)
        if (error) { toast.error('Failed to delete notification'); return }
        setNotifications(prev => prev.filter(n => n.id !== id))
        toast.success('Notification deleted')
    }

    const deleteAll = async () => {
        setDeletingAll(true)
        try {
            await (supabase.from('notifications') as any).delete().eq('user_id', dbUser?.id)
            setNotifications([])
            toast.success('All notifications cleared')
        } catch {
            toast.error('Failed to clear notifications')
        } finally {
            setDeletingAll(false)
        }
    }

    const handleInstall = async () => {
        if (!installPrompt) return
        setIsInstalling(true)
        try {
            await installPrompt.prompt()
            const { outcome } = await installPrompt.userChoice
            if (outcome === 'accepted') {
                setIsInstalled(true)
                setInstallPrompt(null)
            }
        } catch {
            // user dismissed
        } finally {
            setIsInstalling(false)
        }
    }

    // ── Derived ───────────────────────────────────────────────────────────────
    const unreadCount = notifications.filter(n => !n.is_read).length
    const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications

    const showPushPrompt = isSupported && permission === 'default'
    const showInstallPrompt = !isInstalled && !!installPrompt

    if (!mounted) return null

    const modal = (
        <>
            {/* Backdrop — subtle dim, transparent enough to see page */}
            <div
                className={cn(
                    'fixed inset-0 z-50 bg-black/20 transition-opacity duration-200',
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel — neu-raised card, same material as the rest of the dashboard */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="What's new"
                className={cn(
                    'fixed z-[51]',
                    isDragging ? '' : 'transition-[transform,opacity] duration-200 ease-out',
                    // Mobile: full-width bottom sheet
                    'bottom-0 left-0 right-0 rounded-t-[1.75rem]',
                    // Desktop: top-right drawer
                    'sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:w-[420px] sm:rounded-[1.75rem]',
                    isOpen
                        ? 'translate-y-0 opacity-100 sm:translate-y-0 pointer-events-auto'
                        : 'translate-y-full opacity-0 pointer-events-none sm:translate-y-[-12px]',
                    'neu-raised',
                    'max-h-[85dvh] sm:max-h-[80vh] flex flex-col',
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag handle — mobile bottom sheet only */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="neu-inset w-8 h-8 rounded-full flex items-center justify-center">
                            <Bell className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-display text-sm font-semibold text-foreground leading-tight">What&apos;s new</h2>
                            {unreadCount > 0 && (
                                <span className="clay-gold flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => { onClose(); router.push('/dashboard/notifications?tab=settings') }}
                            title="Notification settings"
                            className="neu-raised-sm neu-press w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="neu-raised-sm neu-press w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Filter tabs + quick actions ─────────────────────────── */}
                <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pb-2.5 flex-shrink-0">
                    <div className="neu-inset flex items-center gap-1 rounded-xl p-1 w-fit">
                        {(['all', 'unread'] as const).map(tab => (
                            <button
                                type="button"
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                                    filter === tab
                                        ? 'neu-raised-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {tab === 'all' ? `Everything (${notifications.length})` : `Unread (${unreadCount})`}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {unreadCount > 0 && (
                            <button type="button" onClick={markAllAsRead} disabled={markingAllRead}
                                title="Mark everything read"
                                className="text-muted-foreground hover:text-foreground disabled:opacity-60">
                                {markingAllRead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button type="button" onClick={deleteAll} disabled={deletingAll}
                                title="Clear everything"
                                className="text-red-400 hover:text-red-600 disabled:opacity-60">
                                {deletingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Action prompts (push + install) — only when needed ────── */}
                {(showPushPrompt || showInstallPrompt) && (
                    <div className="flex flex-col gap-2 px-3 sm:px-4 pt-1 pb-1 flex-shrink-0">
                        {showPushPrompt && (
                            <div className="neu-inset flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="clay-blue w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Bell className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-foreground leading-tight truncate">Never miss an update</p>
                                        <p className="text-[10px] text-muted-foreground leading-tight">Instant pings the moment your order moves</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => { await requestPermission() }}
                                    disabled={isSubscribing}
                                    className="clay-gold flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-60"
                                >
                                    {isSubscribing ? 'Turning on…' : 'Turn on'}
                                </button>
                            </div>
                        )}

                        {showInstallPrompt && (
                            <div className="neu-inset flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="clay-green w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Download className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-foreground leading-tight truncate">Add Capozy Hub to your home screen</p>
                                        <p className="text-[10px] text-muted-foreground leading-tight">Quicker alerts, even offline</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleInstall}
                                    disabled={isInstalling}
                                    className="clay-green flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-60"
                                >
                                    {isInstalling ? 'Adding…' : 'Add'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── List ─────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-3 sm:px-4 py-2 space-y-2 notif-list-scroll">
                    {isLoading ? (
                        <div className="space-y-2 py-1">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="neu-raised-sm flex items-start gap-3 p-3 rounded-2xl">
                                    <div className="neu-inset w-9 h-9 rounded-full flex-shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="neu-inset h-3 w-3/4 rounded-full" />
                                        <div className="neu-inset h-3 w-full rounded-full" />
                                        <div className="neu-inset h-2.5 w-1/3 rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                            <div className="neu-inset w-14 h-14 rounded-full flex items-center justify-center">
                                <Bell className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {filter === 'unread' ? "You've read everything" : 'Nothing here yet'}
                            </p>
                        </div>
                    ) : (
                        filtered.map(notif => {
                            const isHighlighted = notif.id === highlightedId
                            return (
                                <div
                                    key={notif.id}
                                    id={`notif-${notif.id}`}
                                    onClick={() => handleNotifClick(notif)}
                                    className={cn(
                                        'group relative flex items-start gap-3 p-3 rounded-2xl cursor-pointer neu-raised-sm neu-press transition-shadow',
                                        isHighlighted && 'ring-2 ring-brand-400'
                                    )}
                                >
                                    {/* Icon bubble */}
                                    <div className={cn(
                                        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                                        iconBg(notif.type)
                                    )}>
                                        <NotifIcon type={notif.type} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className={cn(
                                            'text-sm font-semibold leading-snug truncate',
                                            notif.is_read ? 'text-muted-foreground ' : 'text-foreground'
                                        )}>
                                            {notif.title}
                                        </p>
                                        <NotificationMessage
                                            message={notif.message}
                                            className="text-xs text-muted-foreground mt-0.5 leading-relaxed"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1.5">
                                            {formatDate(notif.created_at ?? '')}
                                        </p>
                                    </div>

                                    {/* Unread dot */}
                                    {!notif.is_read && (
                                        <span className="absolute top-3.5 right-3 w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                                    )}

                                    {/* Actions — revealed on hover */}
                                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 neu-raised-sm rounded-xl p-0.5">
                                        {!notif.is_read && (
                                            <button
                                                type="button"
                                                onClick={async (e) => { e.stopPropagation(); await markAsRead(notif.id) }}
                                                title="Mark as read"
                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-brand-700 hover:text-brand-800 transition-colors"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => deleteNotif(e, notif.id)}
                                            title="Delete"
                                            className="w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* ── Footer: view-full-inbox button + mobile drag handle ───── */}
                <div className="flex-shrink-0 px-3 sm:px-4 pb-3 pt-1">
                    <button
                        type="button"
                        onClick={() => { onClose(); router.push('/dashboard/notifications') }}
                        className="clay-silver w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold"
                    >
                        View full inbox <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex justify-center pt-2.5 sm:hidden">
                        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </div>
                </div>
            </div>
        </>
    )

    return createPortal(modal, document.body)
}
