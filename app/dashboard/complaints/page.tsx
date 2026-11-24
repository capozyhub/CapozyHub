'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { formatDate, normalizeWhatsAppNumber, cn } from '@/lib/utils'
import { getSupportContacts, SupportContacts } from '@/app/actions/support'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    MessageSquare, Loader2, Send, ArrowLeft, Plus, Phone, Mail,
    ChevronDown, CheckCircle2, XCircle, Headphones, Lock, Bell, X, ExternalLink,
} from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { ClayButton, Notice, TextField } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { toast } from '@/lib/toast'
import { Complaint } from '@/types/supabase'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface SupportThread {
    id: string
    user_id: string
    order_id: string | null
    subject: string
    category: 'order' | 'payment' | 'account' | 'other'
    status: 'open' | 'closed'
    last_message_at: string
    created_at: string
}

interface SupportMessage {
    id: string
    thread_id: string
    sender_role: 'user' | 'admin'
    body: string
    read_by_user_at: string | null
    created_at: string
}

const GH_PHONE_RE = /^(0|\+233)[2-9][0-9]{8}$/

const CATEGORY_LABELS: Record<SupportThread['category'], string> = {
    order: 'Order issue',
    payment: 'Payment',
    account: 'Account',
    other: 'Other',
}

const STATUS_LABEL: Record<SupportThread['status'], string> = { open: 'Open', closed: 'Closed' }

/** Keep a short, readable server message; otherwise use our own sentence. */
function plainError(message: unknown, fallback: string) {
    return typeof message === 'string' && message.length > 0 && message.length < 160 ? message : fallback
}

function StatusPill({ status }: { status: SupportThread['status'] }) {
    return (
        <span className="neu-inset inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
            <span className={cn('h-1.5 w-1.5 rounded-full', status === 'open' ? 'bg-brand-500' : 'bg-silver-400')} aria-hidden="true" />
            {STATUS_LABEL[status]}
        </span>
    )
}

function PresenceBadge({ active }: { active: boolean | null }) {
    if (active === null) return null
    return (
        <span className="neu-inset inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium">
            <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-silver-400')} aria-hidden="true" />
            {active ? 'Support is online' : 'Support is away'}
        </span>
    )
}

export default function SupportComplaintsPage() {
    const { dbUser } = useAuth()

    const [contacts, setContacts] = useState<SupportContacts | null>(null)
    const [threads, setThreads] = useState<SupportThread[]>([])
    const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({})
    const [loadingThreads, setLoadingThreads] = useState(true)
    const [threadsFailed, setThreadsFailed] = useState(false)
    const [selectedThread, setSelectedThread] = useState<SupportThread | null>(null)
    const [messages, setMessages] = useState<SupportMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [messagesFailed, setMessagesFailed] = useState(false)
    const [composer, setComposer] = useState('')
    const [sending, setSending] = useState(false)

    // New-complaint dialog
    const [showNew, setShowNew] = useState(false)
    const [subject, setSubject] = useState('')
    const [category, setCategory] = useState<SupportThread['category']>('other')
    const [firstMessage, setFirstMessage] = useState('')
    const [phone, setPhone] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState('')

    // Legacy order complaints (read-only history)
    const [legacy, setLegacy] = useState<Complaint[]>([])
    const [showLegacy, setShowLegacy] = useState(false)

    // "Support is online" badge: heartbeat-based, not real presence (see lib/admin-presence.ts).
    const [supportActive, setSupportActive] = useState<boolean | null>(null)
    useEffect(() => {
        let cancelled = false
        const poll = async () => {
            try {
                const res = await fetch('/api/support/presence')
                const json = await res.json()
                if (!cancelled && res.ok && json.success) setSupportActive(json.data.active)
            } catch { /* transient: keep last known state */ }
        }
        poll()
        const interval = setInterval(poll, 45_000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [])

    // Admin replies arrive as web push, so nudge people who start a chat without notifications.
    const { permission, isSupported, isSubscribing, requestPermission } = usePushNotifications()
    const [pushPromptDismissed, setPushPromptDismissed] = useState(true)
    useEffect(() => {
        try {
            setPushPromptDismissed(sessionStorage.getItem('support-push-prompt-dismissed') === '1')
        } catch { setPushPromptDismissed(false) }
    }, [])
    const dismissPushPrompt = () => {
        setPushPromptDismissed(true)
        try { sessionStorage.setItem('support-push-prompt-dismissed', '1') } catch { /* private mode */ }
    }
    const showPushPrompt = isSupported && permission === 'default' && !pushPromptDismissed

    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        getSupportContacts().then(setContacts).catch(() => setContacts(null))
    }, [])

    useEffect(() => {
        if (dbUser?.phone_number) setPhone(prev => prev || (dbUser as any).phone_number)
    }, [dbUser])

    const fetchThreads = useCallback(async () => {
        if (!dbUser?.id) return
        setThreadsFailed(false)
        try {
            const [threadRes, unreadRes] = await Promise.all([
                fetchAllRows<SupportThread>(() => (supabase as any)
                    .from('support_threads').select('*')
                    .order('last_message_at', { ascending: false }).order('id', { ascending: false })),
                fetchAllRows<{ thread_id: string }>(() => (supabase as any)
                    .from('support_messages').select('thread_id')
                    .eq('sender_role', 'admin').is('read_by_user_at', null)
                    .order('id', { ascending: false })),
            ])
            if (threadRes.failed) { setThreadsFailed(true); return }
            setThreads(threadRes.rows)
            const unread: Record<string, number> = {}
            for (const row of unreadRes.rows) unread[row.thread_id] = (unread[row.thread_id] || 0) + 1
            setUnreadByThread(unread)
        } catch (error) {
            console.error('Error fetching support threads:', error)
            setThreadsFailed(true)
        } finally {
            setLoadingThreads(false)
        }
    }, [dbUser?.id])

    const fetchLegacy = useCallback(async () => {
        if (!dbUser?.id) return
        try {
            const res = await fetchAllRows<Complaint>(() => (supabase
                .from('complaints')
                .select('*, orders (reference_code, network, size)')
                .eq('user_id', dbUser.id)
                .order('created_at', { ascending: false }).order('id', { ascending: false }) as any))
            setLegacy(res.rows)
        } catch (error) {
            console.error('Error fetching legacy complaints:', error)
        }
    }, [dbUser?.id])

    useEffect(() => {
        fetchThreads()
        fetchLegacy()
    }, [fetchThreads, fetchLegacy])

    // Ref mirrors so the realtime callback sees current state without resubscribing.
    const selectedThreadIdRef = useRef<string | null>(null)
    useEffect(() => { selectedThreadIdRef.current = selectedThread?.id ?? null }, [selectedThread?.id])
    const threadIdsRef = useRef<Set<string>>(new Set())
    useEffect(() => { threadIdsRef.current = new Set(threads.map(t => t.id)) }, [threads])

    // Live updates: new messages in my threads and thread status changes. RLS scopes both to this user.
    useEffect(() => {
        if (!dbUser?.id) return
        const channel = supabase
            .channel(`support-${dbUser.id}`)
            .on('postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'support_messages' },
                (payload: any) => {
                    const msg = payload.new as SupportMessage
                    if (!msg?.thread_id) return
                    // Defence in depth on top of RLS.
                    if (!threadIdsRef.current.has(msg.thread_id)) return
                    setMessages(prev =>
                        msg.thread_id === selectedThreadIdRef.current && !prev.some(m => m.id === msg.id)
                            ? [...prev, msg]
                            : prev
                    )
                    if (msg.sender_role === 'admin' && msg.thread_id !== selectedThreadIdRef.current) {
                        setUnreadByThread(prev => ({ ...prev, [msg.thread_id]: (prev[msg.thread_id] || 0) + 1 }))
                    }
                    // Arriving at an open client counts as delivered (the grey tick support sees).
                    if (msg.sender_role === 'admin') {
                        (supabase as any)
                            .from('support_messages')
                            .update({ delivered_to_user_at: new Date().toISOString() })
                            .eq('id', msg.id)
                            .then(() => {})
                    }
                    setThreads(prev => {
                        const next = prev.map(t => t.id === msg.thread_id ? { ...t, last_message_at: msg.created_at } : t)
                        return next.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at))
                    })
                })
            .on('postgres_changes' as any,
                { event: 'UPDATE', schema: 'public', table: 'support_threads', filter: `user_id=eq.${dbUser.id}` },
                (payload: any) => {
                    const updated = payload.new as SupportThread
                    if (!updated?.id) return
                    setThreads(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
                    setSelectedThread(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
                })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [dbUser?.id])

    // Only the latest opened thread may fill the chat, so a slow earlier reply cannot overwrite it.
    const openSeq = useRef(0)
    const openThread = async (thread: SupportThread) => {
        const seq = ++openSeq.current
        setSelectedThread(thread)
        setLoadingMessages(true)
        setMessagesFailed(false)
        setMessages([])
        try {
            // Explicit column list: read_by_admin_at (admin read receipts) is not part of the member contract.
            const res = await fetchAllRows<SupportMessage>(() => (supabase as any)
                .from('support_messages')
                .select('id, thread_id, sender_role, body, read_by_user_at, created_at')
                .eq('thread_id', thread.id)
                .order('created_at', { ascending: true }).order('id', { ascending: true }))
            if (seq !== openSeq.current) return
            if (res.failed) { setMessagesFailed(true); return }
            setMessages(res.rows)
            // Mark admin messages delivered and read (a column-level grant allows only these two columns).
            const now = new Date().toISOString()
            await (supabase as any)
                .from('support_messages')
                .update({ read_by_user_at: now, delivered_to_user_at: now })
                .eq('thread_id', thread.id)
                .eq('sender_role', 'admin')
                .is('read_by_user_at', null)
            if (seq === openSeq.current) setUnreadByThread(prev => ({ ...prev, [thread.id]: 0 }))
        } catch (error) {
            console.error('Error loading messages:', error)
            if (seq === openSeq.current) setMessagesFailed(true)
        } finally {
            if (seq === openSeq.current) setLoadingMessages(false)
        }
    }

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages.length, selectedThread?.id])

    const handleSend = async () => {
        const text = composer.trim()
        if (!text || !selectedThread || sending) return
        setSending(true)
        try {
            const res = await fetch(`/api/support/threads/${selectedThread.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(plainError(json.error, 'We could not send your message. Try again.'))
            setComposer('')
            const sent = json.data.message as SupportMessage
            setMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent])
        } catch (error: any) {
            toast.error(plainError(error?.message, 'We could not send your message. Try again.'))
        } finally {
            setSending(false)
        }
    }

    const resetNewForm = () => {
        setSubject('')
        setCategory('other')
        setFirstMessage('')
        setWhatsapp('')
        setFormError('')
        setPhone((dbUser as any)?.phone_number || '')
    }

    const handleCreate = async () => {
        if (submitting) return
        if (subject.trim().length < 3) { setFormError('Give your complaint a short subject.'); return }
        if (firstMessage.trim().length < 5) { setFormError('Tell us what happened, in a sentence or two.'); return }
        if (!GH_PHONE_RE.test(phone.trim())) { setFormError('Enter a valid Ghana phone number, like 0241234567.'); return }
        if (!GH_PHONE_RE.test(whatsapp.trim())) { setFormError('Enter a valid WhatsApp number, like 0241234567.'); return }
        setFormError('')
        setSubmitting(true)
        try {
            const res = await fetch('/api/support/threads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject.trim(),
                    category,
                    message: firstMessage.trim(),
                    phone_number: phone.trim(),
                    whatsapp_number: whatsapp.trim(),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(plainError(json.error, 'We could not send your complaint. Try again.'))
            toast.success('Complaint sent. Our team will reply here.')
            setShowNew(false)
            resetNewForm()
            const thread = json.data.thread as SupportThread
            setThreads(prev => [thread, ...prev])
            openThread(thread)
        } catch (error: any) {
            setFormError(plainError(error?.message, 'We could not send your complaint. Try again.'))
        } finally {
            setSubmitting(false)
        }
    }

    const waLink = (num: string) => `https://wa.me/${normalizeWhatsAppNumber(num)}`

    const contactCards = useMemo(() => {
        if (!contacts) return []
        const cards: { label: string; hint: string; href: string; icon: any }[] = []
        if (contacts.phone) cards.push({ label: 'Call us', hint: contacts.phone, href: `tel:${contacts.phone}`, icon: Phone })
        if (contacts.email) cards.push({ label: 'Email us', hint: contacts.email, href: `mailto:${contacts.email}`, icon: Mail })
        return cards
    }, [contacts])

    const whatsappLinks = useMemo(() => {
        if (!contacts) return []
        const links: { label: string; sub: string; href: string }[] = []
        if (contacts.communityLink) links.push({ label: 'WhatsApp community', sub: 'Meet other members and resellers', href: contacts.communityLink })
        if (contacts.groupLink) links.push({ label: 'Official group', sub: 'Ask questions and get help from the group', href: contacts.groupLink })
        if (contacts.channelLink) links.push({ label: 'Updates channel', sub: 'Announcements, offers and new services', href: contacts.channelLink })
        return links
    }, [contacts])

    const openCount = threads.filter(t => t.status === 'open').length

    // Suspended members are allowed on this page (the layout gate exempts it) so they can appeal.
    const isSuspendedUser = (dbUser as any)?.status === 'suspended'

    if (loadingThreads) {
        return (
            <div className="flex items-center justify-center py-20" role="status" aria-label="Loading your complaints">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Help and complaints</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Reach our team directly, or open a complaint and chat with us here.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowNew(true)}
                    className={cn('clay-gold flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold', FOCUS)}
                >
                    <Plus className="h-4 w-4" aria-hidden="true" /> New complaint
                </button>
            </div>

            {isSuspendedUser && (
                <Notice tone="info">
                    <span className="block font-semibold">Your account is suspended.</span>
                    <span className="mt-0.5 block font-normal text-muted-foreground">
                        You can still use this page. Open a complaint below to appeal, or reach us on WhatsApp.
                    </span>
                </Notice>
            )}

            {(contacts?.whatsapp || contactCards.length > 0 || whatsappLinks.length > 0) && (
                <section aria-label="Contact us" className="space-y-3">
                    {contacts?.whatsapp && (
                        <a
                            href={waLink(contacts.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn('neu-raised neu-press flex items-center gap-4 rounded-[2rem] p-4 sm:p-5', FOCUS)}
                        >
                            <span className="clay-black flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                                <WhatsAppIcon className="h-6 w-6 text-white" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-display text-base font-bold tracking-tight">Chat on WhatsApp</span>
                                <span className="block text-sm text-muted-foreground">The fastest way to reach our support team.</span>
                            </span>
                            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                        </a>
                    )}

                    {contactCards.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {contactCards.map(card => (
                                <a key={card.label} href={card.href} className={cn('neu-raised-sm neu-press flex items-center gap-3 rounded-3xl p-4', FOCUS)}>
                                    <span className="neu-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                                        <card.icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold">{card.label}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{card.hint}</span>
                                    </span>
                                </a>
                            ))}
                        </div>
                    )}

                    {whatsappLinks.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {whatsappLinks.map(link => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn('neu-raised-sm neu-press flex items-start gap-3 rounded-3xl p-4', FOCUS)}
                                >
                                    <span className="neu-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                                        <WhatsAppIcon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold">{link.label}</span>
                                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{link.sub}</span>
                                        <span className="sr-only">(opens in a new tab)</span>
                                    </span>
                                </a>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,340px)_1fr]">
                {/* Thread list */}
                <section aria-labelledby="my-complaints" className={cn('space-y-3', selectedThread && 'hidden md:block')}>
                    <div className="flex items-center justify-between px-1">
                        <h2 id="my-complaints" className="font-display text-lg font-bold tracking-tight">My complaints</h2>
                        {openCount > 0 && <span className="text-xs text-muted-foreground">{openCount} open</span>}
                    </div>
                    {threadsFailed ? (
                        <div className="space-y-3">
                            <Notice>We could not load your complaints. Check your connection and try again.</Notice>
                            <button
                                type="button"
                                onClick={() => { setLoadingThreads(true); fetchThreads() }}
                                className={cn('clay-silver min-h-11 w-full rounded-full text-sm font-semibold', FOCUS)}
                            >
                                Try again
                            </button>
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="neu-inset rounded-3xl p-8 text-center">
                            <Headphones className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                            <p className="font-semibold">No complaints yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">Open one and our team will reply right here.</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {threads.map(thread => {
                                const unread = unreadByThread[thread.id] || 0
                                return (
                                    <li key={thread.id}>
                                        <button
                                            type="button"
                                            onClick={() => openThread(thread)}
                                            aria-current={selectedThread?.id === thread.id}
                                            className={cn(
                                                'w-full rounded-3xl p-4 text-left',
                                                selectedThread?.id === thread.id ? 'neu-inset' : 'neu-raised-sm neu-press',
                                                FOCUS,
                                            )}
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-semibold">{thread.subject}</span>
                                                {unread > 0 && (
                                                    <span className="clay-gold flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
                                                        {unread}
                                                        <span className="sr-only"> unread</span>
                                                    </span>
                                                )}
                                            </span>
                                            <span className="mt-2 flex items-center gap-2">
                                                <StatusPill status={thread.status} />
                                                <span className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[thread.category]}</span>
                                                <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(thread.last_message_at)}</span>
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </section>

                {/* Chat pane */}
                <section aria-label="Conversation" className={cn(!selectedThread && 'hidden md:block')}>
                    {!selectedThread ? (
                        <div className="neu-inset flex h-full min-h-[320px] items-center justify-center rounded-[2rem]">
                            <div className="px-6 text-center">
                                <MessageSquare className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                                <p className="text-sm text-muted-foreground">Pick a complaint to read the conversation.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="neu-raised flex h-[520px] max-h-[70vh] flex-col overflow-hidden rounded-[2rem]">
                            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedThread(null)}
                                    className={cn('-ml-1.5 flex h-10 w-10 items-center justify-center rounded-full md:hidden', FOCUS)}
                                    aria-label="Back to complaints"
                                >
                                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-display text-base font-bold tracking-tight">{selectedThread.subject}</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-[11px] text-muted-foreground">
                                            {CATEGORY_LABELS[selectedThread.category]} · opened {formatDate(selectedThread.created_at)}
                                        </p>
                                        {selectedThread.status === 'open' && <PresenceBadge active={supportActive} />}
                                    </div>
                                </div>
                                <StatusPill status={selectedThread.status} />
                            </div>

                            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10" role="status" aria-label="Loading messages">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                                    </div>
                                ) : messagesFailed ? (
                                    <div className="space-y-3 py-6">
                                        <Notice>We could not load this conversation.</Notice>
                                        <button
                                            type="button"
                                            onClick={() => openThread(selectedThread)}
                                            className={cn('clay-silver mx-auto flex min-h-11 items-center rounded-full px-6 text-sm font-semibold', FOCUS)}
                                        >
                                            Try again
                                        </button>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={cn('flex', msg.sender_role === 'user' ? 'justify-end' : 'justify-start')}>
                                            <div className={cn(
                                                'max-w-[85%] rounded-3xl px-4 py-2.5 text-sm sm:max-w-[70%]',
                                                msg.sender_role === 'user' ? 'clay-black rounded-br-lg' : 'neu-raised-sm rounded-bl-lg',
                                            )}>
                                                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                                <p className={cn('mt-1 text-right text-[10px]', msg.sender_role === 'user' ? 'text-silver-200' : 'text-muted-foreground')}>
                                                    {formatDate(msg.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedThread.status === 'open' && showPushPrompt && (
                                <div className="flex items-center gap-2.5 border-t border-border px-3 py-2.5">
                                    <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                                        Get a notification the moment support replies, even after you close this page.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => requestPermission()}
                                        disabled={isSubscribing}
                                        className={cn('clay-gold min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold disabled:opacity-60', FOCUS)}
                                    >
                                        {isSubscribing ? 'Turning on' : 'Turn on'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={dismissPushPrompt}
                                        aria-label="Dismiss the notification prompt"
                                        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', FOCUS)}
                                    >
                                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                            {selectedThread.status === 'open' && isSupported && permission === 'denied' && !pushPromptDismissed && (
                                <div className="border-t border-border px-3 py-1.5">
                                    <p className="text-[11px] text-muted-foreground">
                                        Notifications are blocked. Turn them on in your browser settings to hear back right away.
                                    </p>
                                </div>
                            )}

                            {selectedThread.status === 'open' ? (
                                <form
                                    onSubmit={e => { e.preventDefault(); handleSend() }}
                                    className="flex items-center gap-2 border-t border-border p-3"
                                >
                                    <Label htmlFor="support-composer" className="sr-only">Your message</Label>
                                    <div className="neu-inset min-w-0 flex-1 rounded-full">
                                        <input
                                            id="support-composer"
                                            value={composer}
                                            onChange={e => setComposer(e.target.value)}
                                            placeholder="Type a message"
                                            maxLength={1000}
                                            autoComplete="off"
                                            className="h-11 w-full rounded-full bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-brand-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!composer.trim() || sending}
                                        aria-label="Send message"
                                        className={cn('clay-gold flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60', FOCUS)}
                                    >
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                                    </button>
                                </form>
                            ) : (
                                <div className="flex items-center justify-between gap-3 border-t border-border p-3">
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> This complaint is closed.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowNew(true)}
                                        className={cn('clay-silver flex min-h-10 items-center gap-1 rounded-full px-4 text-xs font-semibold', FOCUS)}
                                    >
                                        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New complaint
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {legacy.length > 0 && (
                <section className="neu-raised-sm rounded-3xl">
                    <button
                        type="button"
                        onClick={() => setShowLegacy(v => !v)}
                        aria-expanded={showLegacy}
                        aria-controls="legacy-panel"
                        className={cn('flex w-full items-center justify-between gap-3 rounded-3xl px-5 py-4 text-left text-sm font-semibold', FOCUS)}
                    >
                        <span>Earlier order complaints ({legacy.length})</span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', showLegacy && 'rotate-180')} aria-hidden="true" />
                    </button>
                    {showLegacy && (
                        <div id="legacy-panel" className="space-y-3 border-t border-border px-5 pb-5 pt-4">
                            <p className="text-xs text-muted-foreground">
                                Order complaints filed before this chat existed. They are kept for 30 days.
                            </p>
                            {legacy.map(c => (
                                <div key={c.id} className="neu-inset rounded-2xl p-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{c.title}</p>
                                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            {c.status === 'resolved' ? (
                                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                            ) : c.status === 'rejected' ? (
                                                <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                                            ) : null}
                                            <span className="text-xs capitalize text-muted-foreground">{(c.status ?? 'pending').replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    {c.resolution_notes && (
                                        <p className="mt-2 rounded-xl bg-background/60 p-2 text-xs text-muted-foreground">{c.resolution_notes}</p>
                                    )}
                                    <p className="mt-2 text-[11px] text-muted-foreground">{formatDate(c.created_at ?? '')}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <Dialog open={showNew} onOpenChange={open => { setShowNew(open); if (!open) resetNewForm() }}>
                <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-[2rem] sm:w-full">
                    <DialogHeader>
                        <DialogTitle className="font-display">New complaint</DialogTitle>
                        <DialogDescription>
                            Our team replies here in the chat. For a problem with one order, you can also report it from My orders.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={e => { e.preventDefault(); handleCreate() }} noValidate className="space-y-4">
                        {formError && <Notice>{formError}</Notice>}
                        <TextField id="complaint-subject" label="Subject" value={subject} onChange={setSubject} placeholder="A short summary" />
                        <div className="space-y-2">
                            <Label htmlFor="complaint-category" className="text-sm font-semibold">Category</Label>
                            <div className="neu-inset rounded-xl">
                                <Select value={category} onValueChange={v => setCategory(v as SupportThread['category'])}>
                                    <SelectTrigger id="complaint-category" className="h-12 rounded-xl border-0 bg-transparent px-4 text-base shadow-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(CATEGORY_LABELS) as SupportThread['category'][]).map(k => (
                                            <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="complaint-body" className="text-sm font-semibold">What happened?</Label>
                            <div className="neu-inset rounded-xl">
                                <Textarea
                                    id="complaint-body"
                                    value={firstMessage}
                                    onChange={e => setFirstMessage(e.target.value)}
                                    placeholder="Tell us what went wrong"
                                    rows={4}
                                    maxLength={5000}
                                    className="rounded-xl border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <TextField id="complaint-phone" label="Phone number" value={phone} onChange={setPhone} inputMode="tel" autoComplete="tel" placeholder="0241234567" />
                            <TextField id="complaint-whatsapp" label="WhatsApp number" value={whatsapp} onChange={setWhatsapp} inputMode="tel" placeholder="0241234567" />
                        </div>
                        <p className="text-xs text-muted-foreground">We may call or message you on WhatsApp if we need more details.</p>
                        <DialogFooter className="gap-2 sm:gap-2">
                            <button
                                type="button"
                                onClick={() => setShowNew(false)}
                                disabled={submitting}
                                className={cn('clay-silver min-h-11 rounded-full px-5 text-sm font-semibold', FOCUS)}
                            >
                                Cancel
                            </button>
                            <ClayButton type="submit" loading={submitting} className="min-h-11 w-auto px-6 text-sm">
                                Send complaint
                            </ClayButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
