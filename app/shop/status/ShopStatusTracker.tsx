'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, Loader2, CheckCircle2, XCircle, Clock, Hourglass,
    Package, CalendarDays, History, Info, ShoppingCart, Phone,
    Mail, MessageCircle
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { StorefrontPageFrame } from '@/components/storefront/page-frame'
import { isStorefrontHost } from '@/lib/storefront-host'

// Contrast utility for sticky header text color
const isLightColor = (hex: string) => {
    if (!/^#([A-Fa-f0-9]{3}){1,4}$/.test(hex)) return false
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return yiq >= 128
}

interface Order {
    id: string
    network: string
    package_size: string
    selling_price: number
    status: 'pending' | 'processing' | 'queued' | 'completed' | 'failed' | 'refunded' | 'cancelled'
    created_at: string
    shop_name: string // Flattened from RPC
    shop_slug: string // Flattened from RPC
    guest_phone: string
}

const statusConfig = {
    pending: { label: 'Waiting', tone: 'wait', icon: Clock },
    processing: { label: 'On its way', tone: 'wait', icon: Loader2 },
    queued: { label: 'Queued', tone: 'wait', icon: Hourglass },
    completed: { label: 'Delivered', tone: 'good', icon: CheckCircle2 },
    failed: { label: 'Failed', tone: 'bad', icon: XCircle },
    refunded: { label: 'Refunded', tone: 'bad', icon: XCircle },
    cancelled: { label: 'Cancelled', tone: 'bad', icon: XCircle },
} as const

function OrderCard({ order, baseLinkPath }: { order: Order; baseLinkPath: string }) {
    const cfg = statusConfig[order.status] || statusConfig.pending
    const Icon = cfg.icon

    return (
        <li className="neu-raised-sm flex items-center gap-4 rounded-2xl px-4 py-3.5">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', cfg.tone === 'good' ? 'clay-gold' : 'neu-inset', cfg.tone === 'bad' && 'text-red-600 dark:text-red-400')}>
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-display text-lg font-bold leading-tight text-foreground">
                        {order.network === 'AFA' ? order.package_size : `${order.network} ${order.package_size}`}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(order.selling_price)}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {cfg.label} · {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{order.guest_phone || 'N/A'}</span>
                    <span aria-hidden="true">·</span>
                    <Link href={`${baseLinkPath}/${order.shop_slug}`} className="truncate font-semibold text-foreground underline-offset-4 hover:underline">{order.shop_name}</Link>
                </p>
            </div>
        </li>
    )
}
interface ShopProfile {
    shop_name: string
    logo_url: string | null
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    brand_color: string
}

export default function ShopStatusTracker() {
    const searchParams = useSearchParams()
    const shopParam = searchParams.get('shop')
    const nameParam = searchParams.get('name')

    const [phone, setPhone] = useState('')
    const [searchOrders, setSearchOrders] = useState<Order[]>([])
    const [lastShopSlug, setLastShopSlug] = useState<string | null>(null)
    
    // Shop details state
    const [shopData, setShopData] = useState<ShopProfile | null>(null)

    // Loading states
    const [searchLoading, setSearchLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [isStorefront, setIsStorefront] = useState(false)

    useEffect(() => {
        // Detect if we are on the subdomain storefront or the main domain
        const isSub = isStorefrontHost(window.location.hostname)
        setIsStorefront(isSub)
    }, [])

    const baseLinkPath = isStorefront ? '' : '/shop'

    // ─── 1. Load Phone & Slug from Storage & Fetch Shop ───
    useEffect(() => {
        try {
            const savedPhone = localStorage.getItem('shop_last_phone')
            if (savedPhone) setPhone(savedPhone)
            const slugFromStorage = sessionStorage.getItem('shop_sticky_slug')
            setLastShopSlug(slugFromStorage)
            
            const activeSlug = shopParam || slugFromStorage
            if (activeSlug) {
                fetchShopData(activeSlug)
            }
        } catch (_) { }
    }, [shopParam])

    const fetchShopData = async (slug: string) => {
        try {
            const res = await fetch(`/api/shop/details?slug=${encodeURIComponent(slug)}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            if (data) {
                setShopData(data as ShopProfile)
            }
        } catch (err) {
            console.error('Failed to fetch shop details', err)
        }
    }

    const brandColor = shopData?.brand_color || '#2563eb'
    const safeBrandColor = /^#([A-Fa-f0-9]{3}){1,4}$/.test(brandColor) ? brandColor : '#2563eb'
    const brandContrastText = isLightColor(safeBrandColor) ? '#030712' : '#ffffff'

    // ─── 2. Handle Manual Search with 20min Cache ───
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phone.trim()) { toast.error('Enter a phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')
        const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
        if (!ghanaPhoneRegex.test(cleanPhone)) {
            toast.error('Enter a valid Ghana phone number (e.g. 0244123456)')
            return
        }

        setSearchLoading(true)
        setHasSearched(true)
        
        // Caching Logic: Check cache and TTL
        const cacheKey = `shop_tracker_cache_${cleanPhone}`
        try {
            const cachedData = localStorage.getItem(cacheKey)
            if (cachedData) {
                const parsed = JSON.parse(cachedData)
                if (parsed.timestamp && Date.now() - parsed.timestamp <= 1 * 60 * 1000) {
                    setSearchOrders(parsed.orders || [])
                    setSearchLoading(false)
                    return
                }
            }
        } catch (err) { }

        try {
            const activeSlug = shopParam || lastShopSlug
            if (!activeSlug) {
                toast.error('No shop context found. Please visit a shop page first.')
                setSearchLoading(false)
                return
            }

            const url = `/api/shop/lookup-orders?phone=${encodeURIComponent(cleanPhone)}&shopSlug=${encodeURIComponent(activeSlug)}&limit=50`
            const res = await fetch(url)
            if (!res.ok) throw new Error('Failed to fetch')
            const json = await res.json()

            const fetchedOrders = (json.orders as Order[] || [])

            // Save to cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    orders: fetchedOrders
                }))
                localStorage.setItem('shop_last_phone', cleanPhone)
            } catch (_) {}

            setSearchOrders(fetchedOrders)
        } catch (err) {
            console.error(err)
            toast.error('Failed to fetch orders. Please try again.')
        } finally {
            setSearchLoading(false)
        }
    }

    const FIELD = 'neu-inset h-[3.25rem] w-full rounded-full border-0 bg-transparent pl-12 pr-5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500'
    const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
    const shopHref = `${baseLinkPath}/${shopParam || searchOrders[0]?.shop_slug || lastShopSlug || ''}`
    const hasShop = !!(shopParam || searchOrders[0]?.shop_slug || lastShopSlug)
    const shopTitle = nameParam || shopData?.shop_name || null

    return (
        <StorefrontPageFrame
            name={shopTitle || 'Order tracker'}
            logoUrl={shopData?.logo_url}
            brandColor={shopData?.brand_color}
            backHref={hasShop ? shopHref : '/'}
            backLabel={hasShop ? 'Back to shop' : 'Home'}
            headerAction={<ThemeToggle brandName={shopTitle || 'Capozy'} />}
        >
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground">Where is my order?</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Type the number you bought with. We show the last 48 hours{shopTitle ? ` of orders at ${shopTitle}` : ''}.
            </p>

            <form onSubmit={handleSearch} className="mt-6 space-y-5">
                <div>
                    <label htmlFor="track-phone" className="mb-2 block px-1 text-sm font-semibold text-foreground">Phone number</label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input id="track-phone" type="tel" inputMode="tel" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
                    </div>
                </div>
                <button type="submit" disabled={searchLoading || !phone.trim()} className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-50', FOCUS)}>
                    {searchLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Looking…</> : 'Find my orders'}
                </button>
                <p className="px-1 text-xs leading-relaxed text-muted-foreground">To keep things fast, results for a number refresh once a minute.</p>
            </form>

            {hasSearched && (
                <section className="mt-8 animate-in fade-in duration-300 motion-reduce:animate-none" aria-live="polite">
                    {searchOrders.length > 0 ? (
                        <>
                            <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-foreground">
                                {searchOrders.length} order{searchOrders.length === 1 ? '' : 's'} found
                            </h2>
                            <ul className="space-y-3">
                                {searchOrders.map(order => <OrderCard key={order.id} order={order} baseLinkPath={baseLinkPath} />)}
                            </ul>
                            {hasShop && (
                                <Link href={shopHref} className={cn('neu-raised-sm neu-press mt-5 flex min-h-[3rem] items-center justify-center gap-2 rounded-full text-sm font-semibold text-foreground', FOCUS)}>
                                    <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Buy something else
                                </Link>
                            )}
                        </>
                    ) : (
                        <div className="neu-inset rounded-2xl px-5 py-8 text-center">
                            <h2 className="font-display text-lg font-bold text-foreground">Nothing in the last 48 hours</h2>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                We found no recent orders for <span className="font-mono font-semibold text-foreground">{phone}</span>. Older ones are archived, so ask the shop if you need one of those.
                            </p>
                            {shopData && (
                                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                                    {shopData.whatsapp_number && (
                                        <a href={`https://wa.me/${shopData.whatsapp_number}`} target="_blank" rel="noreferrer" className={cn('clay-gold inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-semibold', FOCUS)}>
                                            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                                        </a>
                                    )}
                                    {shopData.owner_phone && (
                                        <a href={`tel:${shopData.owner_phone}`} className={cn('neu-raised-sm neu-press inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-semibold text-foreground', FOCUS)}>
                                            <Phone className="h-4 w-4" aria-hidden="true" /> Call
                                        </a>
                                    )}
                                    {shopData.owner_email && (
                                        <a href={`mailto:${shopData.owner_email}`} className={cn('neu-raised-sm neu-press inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-semibold text-foreground', FOCUS)}>
                                            <Mail className="h-4 w-4" aria-hidden="true" /> Email
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </StorefrontPageFrame>
    )
}