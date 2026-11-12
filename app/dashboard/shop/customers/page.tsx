'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BRAND } from '@/lib/brand'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
    Users, ArrowLeft, Search, Loader2, RefreshCcw, Copy, Check,
    MessageCircle, Share2, Crown, Clock, ShoppingCart, QrCode,
    TrendingUp, Lightbulb, Save, MessageSquare, ArrowRight, Inbox, AlertCircle
} from 'lucide-react'
import { toast } from '@/lib/toast'

interface ShopCustomer {
    id: string
    phone: string
    name: string | null
    tags: string[]
    notes: string | null
    total_orders: number
    total_spent: number
    first_order_at: string | null
    last_order_at: string | null
}

type SortKey = 'recent' | 'spend' | 'orders'

const SORTS: { id: SortKey; label: string }[] = [
    { id: 'recent', label: 'Latest' },
    { id: 'spend', label: 'Top spenders' },
    { id: 'orders', label: 'Most orders' },
]

const TIPS = [
    'Post your link on your WhatsApp status every day. Steady beats one big push.',
    'Print the QR code and put it where your community gathers.',
    'Give regulars a small discount on bulk orders.',
    'Use SMS to tell your customer list about promos.',
]

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

export default function ShopCustomersPage() {
    const { dbUser } = useAuth()
    const [customers, setCustomers] = useState<ShopCustomer[]>([])
    const [shopSlug, setShopSlug] = useState('')
    const [shopName, setShopName] = useState('')
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('recent')
    const [copied, setCopied] = useState(false)
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Edit modal
    const [editing, setEditing] = useState<ShopCustomer | null>(null)
    const [editTags, setEditTags] = useState('')
    const [editNotes, setEditNotes] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

    useEffect(() => {
        if (dbUser) fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser])

    useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

    // Returns whether the list loaded, so Refresh only claims success when it did.
    const fetchData = async (): Promise<boolean> => {
        setLoadFailed(false)
        try {
            const { data: shop } = await (supabase as any)
                .from('shop_profiles')
                .select('shop_slug, shop_name')
                .eq('owner_id', dbUser!.id)
                .maybeSingle()
            if (shop) { setShopSlug(shop.shop_slug); setShopName(shop.shop_name) }

            const res = await fetch('/api/shop/customers')
            const json = await res.json().catch(() => null)
            if (json?.success) {
                setCustomers(json.data.customers)
                return true
            }
            toast.error(json?.error || 'Could not load your customers')
            setLoadFailed(true)
            return false
        } catch (err) {
            console.error('[Customers]', err)
            toast.error('Could not load your customers. Check your connection and try again.')
            setLoadFailed(true)
            return false
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        const ok = await fetchData()
        setIsRefreshing(false)
        if (ok) toast.success('Customer list updated')
    }

    const shopUrl = shopSlug ? `https://${BRAND.shopHost}/${shopSlug}` : ''
    const shareText = `Buy data bundles, airtime and vouchers from ${shopName || 'my shop'}: ${shopUrl}`

    const copyLink = async () => {
        if (!shopUrl) return
        try {
            await navigator.clipboard.writeText(shopUrl)
        } catch {
            toast.error('Could not copy. Select the link and copy it by hand.')
            return
        }
        setCopied(true)
        toast.success('Shop link copied!')
        if (copyTimer.current) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => setCopied(false), 2000)
    }

    const filtered = useMemo(() => {
        let list = customers
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter(c =>
                c.phone.includes(q) ||
                (c.name || '').toLowerCase().includes(q) ||
                c.tags.some(t => t.toLowerCase().includes(q))
            )
        }
        return [...list].sort((a, b) => {
            if (sortKey === 'spend') return b.total_spent - a.total_spent
            if (sortKey === 'orders') return b.total_orders - a.total_orders
            return new Date(b.last_order_at || 0).getTime() - new Date(a.last_order_at || 0).getTime()
        })
    }, [customers, search, sortKey])

    const totals = useMemo(() => ({
        count: customers.length,
        revenue: customers.reduce((s, c) => s + c.total_spent, 0),
        orders: customers.reduce((s, c) => s + c.total_orders, 0),
        returning: customers.filter(c => c.total_orders > 1).length,
    }), [customers])

    // Only crown a top spender when they have actually spent something.
    const topSpenderId = useMemo(() => {
        const top = [...customers].sort((a, b) => b.total_spent - a.total_spent)[0]
        return top && top.total_spent > 0 ? top.id : null
    }, [customers])

    const openEdit = (c: ShopCustomer) => {
        setEditing(c)
        setEditTags(c.tags.join(', '))
        setEditNotes(c.notes || '')
    }

    const saveEdit = async () => {
        if (!editing) return
        setSavingEdit(true)
        try {
            const tags = editTags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10)
            const res = await fetch('/api/shop/customers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: editing.id, tags, notes: editNotes }),
            })
            const json = await res.json().catch(() => null)
            if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save your changes')
            setCustomers(prev => prev.map(c => c.id === editing.id ? { ...c, tags, notes: editNotes || null } : c))
            toast.success('Customer updated')
            setEditing(null)
        } catch (err: any) {
            toast.error(err.message || 'Could not save your changes')
        } finally {
            setSavingEdit(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-5" aria-busy="true" aria-label="Loading your customers">
                <div className="neu-raised-sm h-20 rounded-3xl" />
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                    {[0, 1, 2, 3].map(i => <div key={i} className="neu-raised-sm h-20 rounded-2xl" />)}
                </div>
                <div className="neu-night h-52 rounded-3xl" />
                <div className="neu-raised-sm h-80 rounded-3xl" />
            </div>
        )
    }

    const statTiles = [
        { label: 'Customers', value: String(totals.count), icon: Users, tone: 'text-brand-700 dark:text-brand-500' },
        { label: 'Came back', value: String(totals.returning), icon: Crown, tone: 'text-brand-700 dark:text-brand-500' },
        { label: 'Orders', value: String(totals.orders), icon: ShoppingCart, tone: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Total spent', value: formatCurrency(totals.revenue), icon: TrendingUp, tone: 'text-emerald-600 dark:text-emerald-400' },
    ]

    return (
        <div className="space-y-5 pb-20 md:pb-6">
            <header className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Link
                        href="/dashboard/shop"
                        aria-label="Back to your shop"
                        className={cn('neu-raised-sm neu-press flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-muted-foreground hover:text-foreground', FOCUS)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="font-display text-2xl font-bold leading-tight">Customers</h1>
                        <p className="truncate text-sm text-muted-foreground">Everyone who has bought from your shop. New buyers show up here on their own.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={cn('clay-silver inline-flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold disabled:opacity-60', FOCUS)}
                >
                    <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </header>

            {loadFailed && customers.length === 0 && (
                <div className="neu-raised-sm flex items-center gap-3 rounded-3xl p-4 text-sm">
                    <span className="neu-inset flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-red-500"><AlertCircle className="h-5 w-5" /></span>
                    <p className="flex-1">We could not load your customers. Your data is safe, so try refreshing.</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {statTiles.map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="neu-raised-sm rounded-2xl p-3.5">
                        <div className="mb-1 flex items-center gap-1.5">
                            <Icon className={cn('h-3.5 w-3.5', tone)} />
                            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                        </div>
                        <p className="truncate text-base font-bold tabular-nums">{value}</p>
                    </div>
                ))}
            </div>

            {/* Share your shop */}
            <section aria-label="Share your shop" className="neu-night relative overflow-hidden rounded-3xl p-5 text-white sm:p-6">
                <div className="flex items-center gap-2">
                    <span className="neu-night-in flex h-9 w-9 items-center justify-center rounded-xl text-brand-500"><Share2 className="h-4 w-4" /></span>
                    <h2 className="font-display text-base font-bold">Bring in more customers</h2>
                </div>
                <p className="mt-2 text-sm text-white/60">Share your link. Every order from it is yours.</p>

                {shopUrl ? (
                    <div className="neu-night-in mt-4 flex flex-col items-stretch gap-2 rounded-2xl p-2 sm:flex-row sm:items-center">
                        <span className="flex-1 truncate px-2 py-1.5 font-mono text-xs text-white/70">{shopUrl}</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={copyLink} className={cn('clay-silver inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold sm:flex-none', FOCUS)}>
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                                target="_blank" rel="noopener noreferrer"
                                className={cn('clay-gold inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold', FOCUS)}
                            >
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                            <a
                                href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shopUrl)}`}
                                target="_blank" rel="noopener noreferrer" aria-label="Get a QR code for your shop link"
                                className={cn('clay-black inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold', FOCUS)}
                            >
                                <QrCode className="h-3.5 w-3.5" /> QR
                            </a>
                        </div>
                    </div>
                ) : (
                    <p className="neu-night-in mt-4 rounded-2xl p-3 text-sm text-white/70">Your shop link will appear here once your shop is set up.</p>
                )}

                <ul className="mt-4 grid gap-2 text-xs text-white/65 sm:grid-cols-2">
                    {TIPS.map(tip => (
                        <li key={tip} className="flex items-start gap-2">
                            <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" /> {tip}
                        </li>
                    ))}
                </ul>
            </section>

            {/* Search + sort */}
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by phone, name or tag"
                        aria-label="Search customers"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="well h-11 rounded-xl border-0 bg-transparent pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-0"
                    />
                </div>
                <div role="group" aria-label="Sort customers" className="neu-inset flex w-fit rounded-xl p-1">
                    {SORTS.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            aria-pressed={sortKey === s.id}
                            onClick={() => setSortKey(s.id)}
                            className={cn(
                                'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                                FOCUS,
                                sortKey === s.id ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Customer list */}
            <section aria-label="Customer list" className="neu-raised-sm rounded-3xl p-4 sm:p-5">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl py-10 text-center">
                        <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><Inbox className="h-5 w-5" /></span>
                        <p className="text-sm font-medium">
                            {customers.length === 0 ? 'No customers yet' : 'Nobody matches that search'}
                        </p>
                        {customers.length === 0 && (
                            <p className="max-w-xs text-xs text-muted-foreground">Share your shop link above. Every buyer is added here automatically.</p>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {filtered.map(c => (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => openEdit(c)}
                                    aria-label={`Edit notes and tags for ${c.name || c.phone}`}
                                    className={cn('flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-3 text-left transition-colors hover:bg-foreground/5', FOCUS)}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className={cn(
                                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                            c.id === topSpenderId ? 'clay-gold' : 'neu-inset text-brand-700 dark:text-brand-500'
                                        )}>
                                            {c.id === topSpenderId ? <Crown className="h-4 w-4" /> : (c.name?.charAt(0)?.toUpperCase() || c.phone.slice(-2))}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{c.name || c.phone}</p>
                                            {c.name && <p className="font-mono text-xs text-muted-foreground">{c.phone}</p>}
                                            {c.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {c.tags.slice(0, 3).map(t => (
                                                        <span key={t} className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-500">{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.total_spent)}</p>
                                        <p className="text-[11px] text-muted-foreground">{c.total_orders} {c.total_orders === 1 ? 'order' : 'orders'}</p>
                                        {c.last_order_at && (
                                            <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-muted-foreground/80">
                                                <Clock className="h-2.5 w-2.5" />
                                                {new Date(c.last_order_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* SMS shortcut */}
            {customers.length > 0 && (
                <Link href="/dashboard/shop/sms" className={cn('neu-raised-sm neu-press group flex items-center justify-between gap-3 rounded-3xl p-4', FOCUS)}>
                    <div className="flex items-center gap-3">
                        <span className="neu-inset flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 dark:text-brand-500">
                            <MessageSquare className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-sm font-semibold">Message your customers</p>
                            <p className="text-xs text-muted-foreground">Send promos and updates by SMS to your whole list.</p>
                        </div>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
            )}

            {/* Edit modal */}
            <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !savingEdit) setEditing(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display">{editing?.name || editing?.phone}</DialogTitle>
                        <DialogDescription>Tags and notes are private. Your customer never sees them.</DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-4">
                            <div className="neu-inset grid grid-cols-3 gap-2 rounded-2xl p-3 text-center">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Orders</p>
                                    <p className="text-sm font-bold">{editing.total_orders}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Spent</p>
                                    <p className="text-sm font-bold">{formatCurrency(editing.total_spent)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Since</p>
                                    <p className="text-sm font-bold">{editing.first_order_at ? new Date(editing.first_order_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="customer-tags" className="text-xs font-semibold text-muted-foreground">Tags (separate with commas, up to 10)</label>
                                <Input
                                    id="customer-tags"
                                    value={editTags}
                                    onChange={e => setEditTags(e.target.value)}
                                    placeholder="vip, bulk-buyer, mtn"
                                    className="mt-1.5 h-11"
                                />
                            </div>
                            <div>
                                <label htmlFor="customer-notes" className="text-xs font-semibold text-muted-foreground">Notes</label>
                                <Textarea
                                    id="customer-notes"
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="e.g. Prefers MTN bundles, buys every Friday"
                                    rows={3}
                                    maxLength={500}
                                    className="mt-1.5"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</Button>
                        <Button onClick={saveEdit} disabled={savingEdit} className="clay-gold gap-1.5 font-bold">
                            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
