'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDate, normalizeWhatsAppNumber, formatCurrency, cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import {
    Loader2, RefreshCw, Search, X, MessageSquare, Send, Phone, Mail, Lock, LockOpen,
    Inbox, Check, CheckCheck, ArrowLeft, Copy, Store, Globe, Code2, CircleHelp, Clock,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { getMessageTickState } from '@/lib/support-ticks'
import { FOCUS } from '@/components/auth/auth-shell'
import { Notice } from '@/components/auth/fields'
import type { ComplaintOrigin } from '@/lib/support-origin'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderInfo {
    reference_code: string
    network: string
    size: string
    status: string | null
    price?: number
    phone_number?: string
    created_at?: string
    shop_name?: string | null
    shop_order_id?: string | null
    source?: string | null
    error_message?: string | null
}

interface Conversation {
    id: string
    /** `thread` is a chat. `report` is an older order complaint with no chat channel. */
    kind: 'thread' | 'report'
    user_id: string
    subject: string
    category: string
    phone_number: string
    whatsapp_number: string
    status: 'open' | 'closed'
    report_status?: string
    closed_at?: string | null
    last_message_at: string
    created_at: string
    origin: ComplaintOrigin
    assignee?: { admin_id: string; name: string } | null
    users?: { first_name: string | null; last_name: string | null; email: string; phone_number: string } | null
    orders?: OrderInfo | null
    last_message?: { body: string; sender_role: string; created_at: string } | null
    unread_count?: number
}

interface Message {
    id: string
    sender_role: 'user' | 'admin'
    body: string
    created_at: string
    delivered_at?: string | null
    read_at?: string | null
}

interface HistoryItem { id: string; subject: string; status: string; created_at: string }

type View = 'needs-reply' | 'open' | 'closed' | 'all'
type OriginFilter = 'all' | ComplaintOrigin
type AssignFilter = 'any' | 'mine' | 'unassigned'

const ORIGIN_META: Record<ComplaintOrigin, { label: string; icon: typeof Store }> = {
    shop: { label: 'Shop order', icon: Store },
    website: { label: 'Website order', icon: Globe },
    api: { label: 'API order', icon: Code2 },
    general: { label: 'General', icon: CircleHelp },
}

const CATEGORY_LABEL: Record<string, string> = { order: 'Order', payment: 'Payment', account: 'Account', other: 'Other' }

// One-click starters. They fill the box, they never send on their own.
const QUICK_REPLIES: { label: string; text: string }[] = [
    { label: 'Checking now', text: 'Hi {name}, thanks for reaching out. We are checking {ref} now and will update you here shortly.' },
    { label: 'Need details', text: 'Hi {name}, to look into {ref} we need a screenshot of your payment and the number that should receive the data. You can send them here or on WhatsApp.' },
    { label: 'Delivered', text: 'Hi {name}, {ref} shows as delivered{to}. Please check your bundle balance and tell us if the data is still missing.' },
    { label: 'Resolved', text: 'Hi {name}, this is sorted. Thanks for your patience. If anything else comes up, open a new complaint and we will help.' },
]

// ─── Small helpers ───────────────────────────────────────────────────────────

function customerName(c: Conversation) {
    const n = `${c.users?.first_name ?? ''} ${c.users?.last_name ?? ''}`.trim()
    return n || c.users?.email || 'Customer'
}

/** "12m", "3h", "2d": how long ago, for wait times. */
function ago(iso: string) {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 48) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
}

function waitingOnSupport(c: Conversation) {
    if (c.status !== 'open') return false
    if (c.kind === 'report') return true
    return !c.last_message || c.last_message.sender_role === 'user'
}

function OriginChip({ origin }: { origin: ComplaintOrigin }) {
    const { label, icon: Icon } = ORIGIN_META[origin]
    return (
        <span className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            origin === 'shop' ? 'bg-black text-white dark:bg-brand-500 dark:text-black' : 'neu-inset',
        )}>
            <Icon className="h-3 w-3" aria-hidden="true" /> {label}
        </span>
    )
}

function StatusDot({ open }: { open: boolean }) {
    return (
        <span className="neu-inset inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
            <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-brand-500' : 'bg-silver-400')} aria-hidden="true" />
            {open ? 'Open' : 'Closed'}
        </span>
    )
}

function Tick({ state }: { state: 'sent' | 'delivered' | 'read' }) {
    if (state === 'sent') return <Check className="h-3.5 w-3.5 shrink-0" aria-label="Sent" />
    return <CheckCheck className={cn('h-3.5 w-3.5 shrink-0', state === 'read' && 'text-brand-300')} aria-label={state === 'read' ? 'Read' : 'Delivered'} />
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminComplaintsPage() {
    const [items, setItems] = useState<Conversation[]>([])
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [view, setView] = useState<View>('needs-reply')
    const [originFilter, setOriginFilter] = useState<OriginFilter>('all')
    const [days, setDays] = useState('30')
    const [search, setSearch] = useState('')
    const [assignFilter, setAssignFilter] = useState<AssignFilter>('any')
    const [viewerId, setViewerId] = useState<string | null>(null)

    const [active, setActive] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loadingChat, setLoadingChat] = useState(false)
    const [reply, setReply] = useState('')
    const [busy, setBusy] = useState<'reply' | 'close' | 'reopen' | 'resolve' | 'reject' | 'assign' | null>(null)
    const [closing, setClosing] = useState(false)
    const [note, setNote] = useState('')

    const scrollRef = useRef<HTMLDivElement>(null)
    const activeRef = useRef<Conversation | null>(null)
    const openSeq = useRef(0)
    const messagesRef = useRef<Message[]>([])
    useEffect(() => { activeRef.current = active }, [active])
    useEffect(() => { messagesRef.current = messages }, [messages])

    const fetchItems = useCallback(async (manual = false) => {
        if (manual) setRefreshing(true)
        try {
            const res = await fetch(`/api/admin/support/threads?status=all&days=${days}`)
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error || 'load failed')
            setItems(json.data || [])
            setViewerId(json.viewer_id ?? null)
            setLoadFailed(false)
            if (manual) toast.success('Up to date')
        } catch {
            setLoadFailed(true)
            if (manual) toast.error('We could not refresh the inbox. Try again.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [days])

    useEffect(() => { fetchItems() }, [fetchItems])

    // The inbox list polls slowly: every tick is a full middleware round trip.
    // The open conversation polls faster, and both pause while the tab is hidden.
    useEffect(() => {
        const id = setInterval(() => { if (!document.hidden) fetchItems() }, 120_000)
        return () => clearInterval(id)
    }, [fetchItems])

    const loadConversation = useCallback(async (c: Conversation, quiet = false) => {
        const seq = quiet ? openSeq.current : ++openSeq.current
        const suffix = c.kind === 'report' ? '?kind=report' : ''
        const res = await fetch(`/api/admin/support/threads/${c.id}${suffix}`)
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'load failed')
        if (seq !== openSeq.current) return null
        return json.data as { thread: Conversation; messages: Message[]; history: HistoryItem[] }
    }, [])

    const markRead = (id: string) => {
        fetch(`/api/admin/support/threads/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read' }),
        }).catch(() => { })
        setItems(prev => prev.map(t => t.id === id ? { ...t, unread_count: 0 } : t))
    }

    const openConversation = async (c: Conversation) => {
        setActive(c)
        setMessages([])
        setHistory([])
        setReply('')
        setClosing(false)
        setNote('')
        setLoadingChat(true)
        try {
            const data = await loadConversation(c)
            if (!data) return
            setActive(prev => prev && prev.id === c.id ? { ...c, ...data.thread, last_message: c.last_message, unread_count: 0 } : prev)
            setMessages(data.messages)
            setHistory(data.history)
            if (c.kind === 'thread') markRead(c.id)
        } catch {
            toast.error('We could not open that conversation. Try again.')
            setActive(null)
        } finally {
            setLoadingChat(false)
        }
    }

    // Keep the open chat fresh, and mark new customer messages read as they land.
    useEffect(() => {
        if (!active?.id || active.kind !== 'thread') return
        const id = setInterval(async () => {
            const current = activeRef.current
            if (!current || document.hidden) return
            try {
                const data = await loadConversation(current, true)
                if (!data || activeRef.current?.id !== current.id) return
                const known = new Set(messagesRef.current.map(m => m.id))
                if (data.messages.some(m => m.sender_role === 'user' && !known.has(m.id))) markRead(current.id)
                setMessages(data.messages)
            } catch { /* transient */ }
        }, 15_000)
        return () => clearInterval(id)
    }, [active?.id, active?.kind, loadConversation])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages.length, active?.id])

    // Patches one specific complaint. The admin may have opened another one while the request
    // was in flight, so the open pane is only touched if it is still the same complaint.
    const patchActive = (id: string, patch: Partial<Conversation>) => {
        setActive(prev => prev && prev.id === id ? { ...prev, ...patch } : prev)
        setItems(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    }
    const addLocalMessage = (id: string, m: Message) => {
        if (activeRef.current?.id !== id) return
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
    }

    const post = async (id: string, body: Record<string, unknown>) => {
        const res = await fetch(`/api/admin/support/threads/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) throw new Error(typeof json.error === 'string' && json.error.length < 160 ? json.error : 'That did not go through. Try again.')
        return json
    }

    const sendReply = async () => {
        const text = reply.trim()
        if (!text || !active || busy) return
        setBusy('reply')
        const id = active.id
        try {
            const json = await post(id, { action: 'reply', message: text })
            const sent = json.data.message as Message
            if (activeRef.current?.id === id) setReply('')
            addLocalMessage(id, sent)
            patchActive(id, { last_message: { body: sent.body, sender_role: 'admin', created_at: sent.created_at }, last_message_at: sent.created_at, unread_count: 0 })
        } catch (e: any) {
            toast.error(e?.message || 'We could not send that reply. Try again.')
        } finally { setBusy(null) }
    }

    const closeThread = async () => {
        if (!active || busy) return
        setBusy('close')
        const id = active.id
        try {
            await post(id, { action: 'close', closing_note: note.trim() || undefined })
            if (note.trim()) {
                const sentAt = new Date().toISOString()
                addLocalMessage(id, { id: `local-${sentAt}`, sender_role: 'admin', body: note.trim(), created_at: sentAt })
            }
            toast.success('Complaint closed. The customer has been told.')
            if (activeRef.current?.id === id) { setClosing(false); setNote('') }
            patchActive(id, { status: 'closed', closed_at: new Date().toISOString() })
        } catch (e: any) {
            toast.error(e?.message || 'We could not close this complaint. Try again.')
        } finally { setBusy(null) }
    }

    const reopenThread = async () => {
        if (!active || busy) return
        setBusy('reopen')
        const id = active.id
        try {
            await post(id, { action: 'reopen' })
            toast.success('Complaint reopened. The customer has been told.')
            patchActive(id, { status: 'open', closed_at: null })
        } catch (e: any) {
            toast.error(e?.message || 'We could not reopen this complaint. Try again.')
        } finally { setBusy(null) }
    }

    const assign = async (to: 'me' | 'none') => {
        if (!active || busy) return
        setBusy('assign')
        const id = active.id
        try {
            await post(id, { action: 'assign', to })
            patchActive(id, { assignee: to === 'me' && viewerId ? { admin_id: viewerId, name: 'You' } : null })
            toast.success(to === 'me' ? 'This one is yours now.' : 'Released. Anyone on the team can pick it up.')
        } catch (e: any) {
            toast.error(e?.message || 'We could not update the handler. Try again.')
            // A teammate may have taken it first: reload so the list shows who has it.
            fetchItems()
        } finally { setBusy(null) }
    }

    const resolveReport = async (status: 'resolved' | 'rejected') => {
        if (!active || busy) return
        setBusy(status === 'resolved' ? 'resolve' : 'reject')
        const id = active.id
        try {
            const res = await fetch('/api/admin/complaints/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, resolution_notes: note }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof json.error === 'string' && json.error.length < 160 ? json.error : 'That did not go through. Try again.')
            toast.success(status === 'resolved' ? 'Marked resolved. The customer has been told.' : 'Rejected. The customer has been told.')
            if (note.trim()) {
                const sentAt = new Date().toISOString()
                addLocalMessage(id, { id: `local-${sentAt}`, sender_role: 'admin', body: note.trim(), created_at: sentAt })
            }
            if (activeRef.current?.id === id) setNote('')
            patchActive(id, { status: 'closed', report_status: status, closed_at: new Date().toISOString() })
        } catch (e: any) {
            toast.error(e?.message || 'We could not update this complaint. Try again.')
        } finally { setBusy(null) }
    }

    const copy = (text: string, what: string) => {
        navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copied`)).catch(() => toast.error('Could not copy'))
    }

    const fillQuickReply = (text: string) => {
        if (!active) return
        const first = (active.users?.first_name || '').trim() || 'there'
        const ref = active.orders?.reference_code ? `order ${active.orders.reference_code}` : 'your order'
        const to = active.orders?.phone_number ? ` to ${active.orders.phone_number}` : ''
        setReply(text.replaceAll('{name}', first).replaceAll('{ref}', ref).replaceAll('{to}', to))
    }

    // ── Derived lists ────────────────────────────────────────────────────────

    const counts = useMemo(() => {
        const needs = items.filter(waitingOnSupport)
        return {
            needs: needs.length,
            open: items.filter(i => i.status === 'open').length,
            closed: items.filter(i => i.status === 'closed').length,
            oldest: needs.length ? needs.reduce((a, b) => (new Date(a.last_message_at) < new Date(b.last_message_at) ? a : b)) : null,
            byOrigin: {
                shop: items.filter(i => i.status === 'open' && i.origin === 'shop').length,
                website: items.filter(i => i.status === 'open' && i.origin === 'website').length,
            },
        }
    }, [items])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        let rows = items.filter(i => {
            if (view === 'needs-reply' && !waitingOnSupport(i)) return false
            if (view === 'open' && i.status !== 'open') return false
            if (view === 'closed' && i.status !== 'closed') return false
            if (originFilter !== 'all' && i.origin !== originFilter) return false
            if (assignFilter === 'mine' && i.assignee?.admin_id !== viewerId) return false
            if (assignFilter === 'unassigned' && (i.assignee || i.kind === 'report')) return false
            if (!q) return true
            return customerName(i).toLowerCase().includes(q)
                || (i.users?.email ?? '').toLowerCase().includes(q)
                || i.subject.toLowerCase().includes(q)
                || (i.orders?.reference_code ?? '').toLowerCase().includes(q)
                || (i.orders?.phone_number ?? '').includes(q)
                || (i.orders?.shop_name ?? '').toLowerCase().includes(q)
                || i.phone_number.includes(q)
        })
        // Longest-waiting first where a reply is owed; otherwise newest activity first.
        rows = [...rows].sort((a, b) => view === 'needs-reply'
            ? +new Date(a.last_message_at) - +new Date(b.last_message_at)
            : +new Date(b.last_message_at) - +new Date(a.last_message_at))
        return rows
    }, [items, view, originFilter, assignFilter, viewerId, search])

    const VIEWS: { id: View; label: string; n?: number }[] = [
        { id: 'needs-reply', label: 'Needs a reply', n: counts.needs },
        { id: 'open', label: 'Open', n: counts.open },
        { id: 'closed', label: 'Closed', n: counts.closed },
        { id: 'all', label: 'All' },
    ]
    const ORIGINS: { id: OriginFilter; label: string }[] = [
        { id: 'all', label: 'Everything' },
        { id: 'shop', label: 'Shop orders' },
        { id: 'website', label: 'Website orders' },
        { id: 'general', label: 'General' },
    ]

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24" role="status" aria-label="Loading complaints">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
        )
    }

    const isReport = active?.kind === 'report'
    const order = active?.orders ?? null
    const canReply = !!active && active.kind === 'thread' && active.status === 'open'

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Complaints</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Every customer complaint, from website and shop orders, in one inbox. Reply, resolve and close from here.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fetchItems(true)}
                    disabled={refreshing}
                    className={cn('clay-silver flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60', FOCUS)}
                >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" /> Refresh
                </button>
            </div>

            {loadFailed && <Notice>We could not load the inbox. Check your connection, then press Refresh.</Notice>}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="neu-raised-sm rounded-3xl p-4">
                    <p className="font-display text-2xl font-bold">{counts.needs}</p>
                    <p className="text-xs text-muted-foreground">Waiting on us</p>
                </div>
                <div className="neu-raised-sm rounded-3xl p-4">
                    <p className="font-display text-2xl font-bold">{counts.oldest ? ago(counts.oldest.last_message_at) : '0m'}</p>
                    <p className="text-xs text-muted-foreground">Longest wait</p>
                </div>
                <div className="neu-raised-sm rounded-3xl p-4">
                    <p className="font-display text-2xl font-bold">{counts.byOrigin.shop}</p>
                    <p className="text-xs text-muted-foreground">Open, shop orders</p>
                </div>
                <div className="neu-raised-sm rounded-3xl p-4">
                    <p className="font-display text-2xl font-bold">{counts.byOrigin.website}</p>
                    <p className="text-xs text-muted-foreground">Open, website orders</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
                {/* ── Inbox ─────────────────────────────────────────────── */}
                <section aria-label="Inbox" className={cn('space-y-3', active && 'hidden lg:block')}>
                    <div className="neu-inset flex items-center gap-2 rounded-full px-4">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <label htmlFor="complaint-search" className="sr-only">Search complaints</label>
                        <input
                            id="complaint-search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Name, email, order ref, number or shop"
                            className="h-11 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground/70 focus-visible:outline-none"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className={cn('flex h-8 w-8 items-center justify-center rounded-full', FOCUS)}>
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Show">
                        {VIEWS.map(v => (
                            <button
                                key={v.id}
                                type="button"
                                role="tab"
                                aria-selected={view === v.id}
                                onClick={() => setView(v.id)}
                                className={cn('min-h-10 rounded-full px-3.5 text-sm font-semibold', view === v.id ? 'neu-inset' : 'neu-raised-sm neu-press', FOCUS)}
                            >
                                {v.label}{v.n !== undefined && <span className="ml-1.5 text-muted-foreground">{v.n}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {ORIGINS.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                aria-pressed={originFilter === o.id}
                                onClick={() => setOriginFilter(o.id)}
                                className={cn('min-h-9 rounded-full px-3 text-xs font-semibold', originFilter === o.id ? 'clay-black' : 'neu-raised-sm neu-press', FOCUS)}
                            >
                                {o.label}
                            </button>
                        ))}
                        {([['any', 'Anyone'], ['mine', 'Mine'], ['unassigned', 'Unassigned']] as const).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={assignFilter === id}
                                onClick={() => setAssignFilter(id)}
                                className={cn('min-h-9 rounded-full px-3 text-xs font-semibold', assignFilter === id ? 'clay-black' : 'neu-raised-sm neu-press', FOCUS)}
                            >
                                {label}
                            </button>
                        ))}
                        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="sr-only">Closed complaints from the last</span>
                            <select
                                value={days}
                                onChange={e => setDays(e.target.value)}
                                className="neu-inset h-9 rounded-full bg-transparent px-3 text-xs font-semibold text-foreground"
                            >
                                <option value="7">Last 7 days</option>
                                <option value="30">Last 30 days</option>
                                <option value="90">Last 90 days</option>
                            </select>
                        </label>
                    </div>

                    {visible.length === 0 ? (
                        <div className="neu-inset rounded-3xl p-8 text-center">
                            <Inbox className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                            <p className="font-semibold">
                                {search || originFilter !== 'all' ? 'Nothing matches that' : view === 'needs-reply' ? 'You are all caught up' : 'No complaints here'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {search || originFilter !== 'all'
                                    ? 'Try a different search or filter.'
                                    : view === 'needs-reply' ? 'Every open complaint has had a reply.' : 'New complaints will show up here.'}
                            </p>
                            {(search || originFilter !== 'all') && (
                                <button type="button" onClick={() => { setSearch(''); setOriginFilter('all') }} className={cn('clay-silver mt-4 min-h-10 rounded-full px-5 text-sm font-semibold', FOCUS)}>
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {visible.map(c => {
                                const waiting = waitingOnSupport(c)
                                const stale = waiting && Date.now() - new Date(c.last_message_at).getTime() > 24 * 3_600_000
                                return (
                                    <li key={`${c.kind}-${c.id}`}>
                                        <button
                                            type="button"
                                            onClick={() => openConversation(c)}
                                            aria-current={active?.id === c.id}
                                            className={cn('w-full rounded-3xl p-4 text-left', active?.id === c.id ? 'neu-inset' : 'neu-raised-sm neu-press', FOCUS)}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-semibold">{customerName(c)}</span>
                                                <span className="flex shrink-0 items-center gap-1.5">
                                                    {(c.unread_count || 0) > 0 && (
                                                        <span className="clay-gold flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
                                                            {c.unread_count}<span className="sr-only"> unread</span>
                                                        </span>
                                                    )}
                                                    <span className={cn('flex items-center gap-1 text-[11px]', stale ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted-foreground')}>
                                                        <Clock className="h-3 w-3" aria-hidden="true" />{ago(c.last_message_at)}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-sm">{c.subject}</span>
                                            {c.last_message && (
                                                <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
                                                    {c.last_message.sender_role === 'admin' ? 'You: ' : ''}{c.last_message.body}
                                                </span>
                                            )}
                                            <span className="mt-2 flex flex-wrap items-center gap-1.5">
                                                <OriginChip origin={c.origin} />
                                                {c.orders?.shop_name && <span className="truncate text-[11px] text-muted-foreground">{c.orders.shop_name}</span>}
                                                {c.orders?.reference_code && <span className="font-mono text-[11px] text-muted-foreground">{c.orders.reference_code}</span>}
                                                {c.assignee && c.status === 'open' && (
                                                    <span className="ml-auto text-[11px] text-muted-foreground">
                                                        {c.assignee.admin_id === viewerId ? 'Yours' : c.assignee.name}
                                                    </span>
                                                )}
                                                {c.status === 'closed' && <span className="ml-auto text-[11px] text-muted-foreground">Closed</span>}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>

                {/* ── Conversation ──────────────────────────────────────── */}
                <section aria-label="Conversation" className={cn(!active && 'hidden lg:block')}>
                    {!active ? (
                        <div className="neu-inset flex min-h-[360px] items-center justify-center rounded-[2rem]">
                            <div className="px-6 text-center">
                                <MessageSquare className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                                <p className="font-semibold">Pick a complaint</p>
                                <p className="mt-1 text-sm text-muted-foreground">The chat, the order and the customer&apos;s history show up here.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="neu-raised flex max-h-[80vh] min-h-[480px] flex-col overflow-hidden rounded-[2rem] lg:h-[calc(100vh-15rem)]">
                            {/* Header */}
                            <div className="space-y-3 border-b border-border p-4">
                                <div className="flex items-start gap-3">
                                    <button type="button" onClick={() => setActive(null)} aria-label="Back to the inbox" className={cn('-ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full lg:hidden', FOCUS)}>
                                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-display text-lg font-bold tracking-tight">{active.subject}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {customerName(active)}{active.users?.email && customerName(active) !== active.users.email ? ` · ${active.users.email}` : ''}
                                        </p>
                                    </div>
                                    <StatusDot open={active.status === 'open'} />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <OriginChip origin={active.origin} />
                                    <span className="text-[11px] text-muted-foreground">{CATEGORY_LABEL[active.category] ?? 'Other'} · opened {formatDate(active.created_at)}</span>
                                    {isReport && <span className="neu-inset rounded-full px-2 py-0.5 text-[11px] font-semibold">Older report, no chat</span>}
                                    {canReply && (
                                        active.assignee ? (
                                            <>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Handled by {active.assignee.admin_id === viewerId ? 'you' : active.assignee.name}
                                                </span>
                                                {(active.assignee.admin_id === viewerId) && (
                                                    <button type="button" onClick={() => assign('none')} disabled={!!busy} className={cn('neu-raised-sm neu-press min-h-8 rounded-full px-3 text-[11px] font-semibold disabled:opacity-60', FOCUS)}>Release</button>
                                                )}
                                                {(active.assignee.admin_id !== viewerId) && (
                                                    <button type="button" onClick={() => assign('me')} disabled={!!busy} className={cn('neu-raised-sm neu-press min-h-8 rounded-full px-3 text-[11px] font-semibold disabled:opacity-60', FOCUS)}>Take over</button>
                                                )}
                                            </>
                                        ) : (
                                            <button type="button" onClick={() => assign('me')} disabled={!!busy} className={cn('clay-gold min-h-8 rounded-full px-3 text-[11px] font-semibold disabled:opacity-60', FOCUS)}>Take this one</button>
                                        )
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {active.phone_number && (
                                        <a href={`tel:${active.phone_number}`} className={cn('clay-silver flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold', FOCUS)}>
                                            <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call {active.phone_number}
                                        </a>
                                    )}
                                    {active.whatsapp_number && (
                                        <a href={`https://wa.me/${normalizeWhatsAppNumber(active.whatsapp_number)}`} target="_blank" rel="noopener noreferrer" className={cn('clay-silver flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold', FOCUS)}>
                                            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                                        </a>
                                    )}
                                    {active.users?.email && (
                                        <a href={`mailto:${active.users.email}`} className={cn('clay-silver flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold', FOCUS)}>
                                            <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
                                        </a>
                                    )}
                                </div>

                                {order ? (
                                    <div className="neu-inset rounded-2xl p-3 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="min-w-0 truncate">
                                                <span className="font-mono font-semibold">{order.reference_code}</span>
                                                <span className="text-muted-foreground"> · {order.network} {order.size}</span>
                                            </p>
                                            <button type="button" onClick={() => copy(order.reference_code, 'Order reference')} aria-label="Copy order reference" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', FOCUS)}>
                                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                            </button>
                                        </div>
                                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                            <div><dt className="text-muted-foreground">Status</dt><dd className="font-semibold capitalize">{order.status ?? 'unknown'}</dd></div>
                                            <div><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">{order.price != null ? formatCurrency(order.price) : '—'}</dd></div>
                                            <div>
                                                <dt className="text-muted-foreground">Data goes to</dt>
                                                <dd className="flex items-center gap-1 font-mono font-semibold">
                                                    {order.phone_number ?? '—'}
                                                    {order.phone_number && (
                                                        <button type="button" onClick={() => copy(order.phone_number!, 'Number')} aria-label="Copy number" className={cn('flex h-6 w-6 items-center justify-center rounded-full', FOCUS)}>
                                                            <Copy className="h-3 w-3" aria-hidden="true" />
                                                        </button>
                                                    )}
                                                </dd>
                                            </div>
                                            <div><dt className="text-muted-foreground">Placed</dt><dd className="font-semibold">{order.created_at ? formatDate(order.created_at) : '—'}</dd></div>
                                            {order.shop_name && <div className="col-span-2"><dt className="text-muted-foreground">Sold by shop</dt><dd className="font-semibold">{order.shop_name}</dd></div>}
                                            {order.error_message && <div className="col-span-2"><dt className="text-muted-foreground">Last error on the order</dt><dd className="font-semibold">{order.error_message}</dd></div>}
                                        </dl>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No order is linked to this complaint.</p>
                                )}

                                {history.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">Earlier complaints from this customer:</span>{' '}
                                        {history.map((h, i) => (
                                            <span key={h.id}>{i > 0 && ' · '}{h.subject} ({h.status})</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div ref={scrollRef} className="min-h-[180px] flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                                {loadingChat ? (
                                    <div className="flex justify-center py-10" role="status" aria-label="Loading messages">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                                    </div>
                                ) : messages.map(msg => (
                                    <div key={msg.id} className={cn('flex', msg.sender_role === 'admin' ? 'justify-end' : 'justify-start')}>
                                        <div className={cn(
                                            'max-w-[85%] rounded-3xl px-4 py-2.5 text-sm sm:max-w-[75%]',
                                            msg.sender_role === 'admin' ? 'clay-black rounded-br-lg' : 'neu-raised-sm rounded-bl-lg',
                                        )}>
                                            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                            <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', msg.sender_role === 'admin' ? 'text-silver-200' : 'text-muted-foreground')}>
                                                {formatDate(msg.created_at)}
                                                {msg.sender_role === 'admin' && !isReport && !String(msg.id).startsWith('local-') && (
                                                    <Tick state={getMessageTickState({ delivered_at: msg.delivered_at ?? null, read_at: msg.read_at ?? null })} />
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer: reply / close / reopen / resolve */}
                            {isReport && active.status === 'open' ? (
                                <div className="space-y-3 border-t border-border p-4">
                                    <p className="text-xs text-muted-foreground">This was filed before chat existed, so the customer can&apos;t reply. Your note below is sent to them with the decision.</p>
                                    <div className="neu-inset rounded-xl">
                                        <label htmlFor="resolution-note" className="sr-only">Note to the customer</label>
                                        <Textarea
                                            id="resolution-note"
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="What was done, or why it was rejected"
                                            rows={2}
                                            maxLength={2000}
                                            className="rounded-xl border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => resolveReport('rejected')} disabled={!!busy} className={cn('clay-silver flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60', FOCUS)}>
                                            {busy === 'reject' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Reject
                                        </button>
                                        <button type="button" onClick={() => resolveReport('resolved')} disabled={!!busy} className={cn('clay-gold flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60', FOCUS)}>
                                            {busy === 'resolve' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Mark resolved
                                        </button>
                                    </div>
                                </div>
                            ) : canReply ? (
                                closing ? (
                                    <div className="space-y-3 border-t border-border p-4">
                                        <p className="text-sm font-semibold">Close this complaint?</p>
                                        <div className="neu-inset rounded-xl">
                                            <label htmlFor="closing-note" className="sr-only">Closing note</label>
                                            <Textarea
                                                id="closing-note"
                                                value={note}
                                                onChange={e => setNote(e.target.value)}
                                                placeholder="Optional last message to the customer"
                                                rows={2}
                                                maxLength={1000}
                                                className="rounded-xl border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setClosing(false)} disabled={!!busy} className={cn('clay-silver min-h-11 rounded-full px-5 text-sm font-semibold', FOCUS)}>Keep open</button>
                                            <button type="button" onClick={closeThread} disabled={!!busy} className={cn('clay-gold flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60', FOCUS)}>
                                                {busy === 'close' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} Close complaint
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 border-t border-border p-3">
                                        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Quick replies">
                                            {QUICK_REPLIES.map(q => (
                                                <button key={q.label} type="button" onClick={() => fillQuickReply(q.text)} className={cn('neu-raised-sm neu-press min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold', FOCUS)}>
                                                    {q.label}
                                                </button>
                                            ))}
                                        </div>
                                        <form onSubmit={e => { e.preventDefault(); sendReply() }} className="flex items-end gap-2">
                                            <button type="button" onClick={() => { setNote(''); setClosing(true) }} aria-label="Close complaint" className={cn('clay-silver flex h-11 w-11 shrink-0 items-center justify-center rounded-full', FOCUS)}>
                                                <Lock className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                            <div className="neu-inset min-w-0 flex-1 rounded-3xl">
                                                <label htmlFor="admin-reply" className="sr-only">Reply to the customer</label>
                                                <textarea
                                                    id="admin-reply"
                                                    value={reply}
                                                    onChange={e => setReply(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                                                    placeholder="Reply to the customer. Enter sends, Shift+Enter adds a line."
                                                    rows={reply.includes('\n') || reply.length > 70 ? 3 : 1}
                                                    maxLength={1000}
                                                    className="w-full resize-none rounded-3xl bg-transparent px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-brand-500"
                                                />
                                            </div>
                                            <button type="submit" disabled={!reply.trim() || !!busy} aria-label="Send reply" className={cn('clay-gold flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60', FOCUS)}>
                                                {busy === 'reply' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                                            </button>
                                        </form>
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center justify-between gap-3 border-t border-border p-3">
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                        {isReport ? `${(active.report_status ?? 'closed').replace('_', ' ')}` : 'Closed'}{active.closed_at ? ` ${formatDate(active.closed_at)}` : ''}
                                    </p>
                                    {!isReport && (
                                        <button type="button" onClick={reopenThread} disabled={!!busy} className={cn('clay-silver flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60', FOCUS)}>
                                            {busy === 'reopen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />} Reopen
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
