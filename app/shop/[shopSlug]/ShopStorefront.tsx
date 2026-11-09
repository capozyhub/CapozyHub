'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { downloadResultsCheckerVouchers } from '@/lib/results-checker-utils'
import {
    Phone, Mail, MessageCircle, ShoppingCart, Loader2,
    CheckCircle2, AlertCircle, X, Zap, Smartphone, Check, Menu, Bell, BellPlus,
    History, TrendingUp, Coins, Calendar, CalendarRange, RefreshCw, Info, Clock, Copy, ArrowRight, AlertTriangle, Users, FileText, Download, GraduationCap, Lock, ShieldCheck, Eye, EyeOff, Receipt, IdCard
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { isStorefrontHost } from '@/lib/storefront-host'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CopyrightFooter } from '@/components/CopyrightFooter'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import { StorefrontDataTab } from './components/StorefrontDataTab'
import { StorefrontUtilitiesTab } from './components/StorefrontUtilitiesTab'
import AfaRegistrationForm from './AfaRegistrationForm'
import { ServiceChargeSheet, type ChargeDescriptor } from './components/ServiceChargeSheet'
import type { UtilityBiller } from '@/lib/hubtel-utility/billers'
import { StorefrontTermsBoundary } from './components/StorefrontTermsBoundary'
import { NetworkIcon } from '@/components/network-icon'
import { AnnouncementCTAButtons } from '@/components/announcements/AnnouncementCTAButtons'
import { StorefrontShell, type StorefrontLink } from '@/components/storefront/shell'
import { ServiceTabs, type ServiceTab } from '@/components/storefront/service-tabs'
import { resolveAccent } from '@/components/storefront/accent'
import { FIELD, FOCUS, FieldLabel, Note, Pill, PrimaryButton, ServiceHeading, TotalPlate } from '@/components/storefront/ui'
import { BrandSwoosh } from '@/components/brand-swoosh'

// ─── Divider SVG paths (matching setup page) ──────────────────────────────────
const DIVIDER_PATHS: Record<string, string> = {
    'asymmetric-curve': 'M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C0,0,0,0,0,0c0,0,0,0,0,0Q160.69,78,321.39,56.44Z',
    'angled': 'M0,0 L1200,80 L1200,120 L0,120 Z',
    'zigzag': 'M0,60 L100,0 L200,60 L300,0 L400,60 L500,0 L600,60 L700,0 L800,60 L900,0 L1000,60 L1100,0 L1200,60 L1200,120 L0,120 Z',
    'concave': 'M0,0 Q600,120 1200,0 L1200,120 L0,120 Z',
    'animated-wave': 'M0,64 C150,100 350,0 600,60 C850,120 1050,20 1200,64 L1200,120 L0,120 Z',
    'layered-waves': 'M0,80 C200,20 400,100 600,60 C800,20 1000,100 1200,80 L1200,120 L0,120 Z',
    'tilt': 'M0,40 L1200,0 L1200,120 L0,120 Z',
    'organic-blob': 'M0,80 C100,20 300,100 500,70 C700,40 900,110 1100,60 C1150,45 1180,50 1200,60 L1200,120 L0,120 Z',
    'paper-cut': 'M0,80 L120,40 L240,80 L360,40 L480,80 L600,40 L720,80 L840,40 L960,80 L1080,40 L1200,80 L1200,120 L0,120 Z',
    'torn-edge': 'M0,90 L30,70 L60,95 L90,65 L130,85 L170,60 L210,90 L260,55 L310,80 L370,50 L430,85 L490,58 L560,90 L640,55 L720,85 L800,50 L880,80 L960,45 L1040,75 L1120,50 L1200,70 L1200,120 L0,120 Z',
    'convex': 'M0,120 Q600,0 1200,120 L1200,120 L0,120 Z',
    'slant': 'M0,80 L1200,0 L1200,120 L0,120 Z',
    'skewed': 'M0,0 L900,0 L1200,120 L0,120 Z',
    'glassmorphic': 'M0,100 Q600,60 1200,100 L1200,120 L0,120 Z',
    'multi-step-wave': 'M0,60 C100,40 200,80 300,60 C400,40 500,80 600,60 C700,40 800,80 900,60 C1000,40 1100,80 1200,60 L1200,120 L0,120 Z',
}

function DividerSVG({ style, fillClass }: { style?: string | null; fillClass: string }) {
    const path = DIVIDER_PATHS[style || 'asymmetric-curve'] || DIVIDER_PATHS['asymmetric-curve']
    const isAnimated = style === 'animated-wave'
    return (
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={cn('relative block w-full h-[40px]', fillClass, isAnimated && 'animate-pulse')} aria-hidden="true">
                <title>Section divider</title>
                <path d={path} />
            </svg>
        </div>
    )
}

interface ShopData {
    id: string
    shop_name: string
    shop_slug: string
    description: string
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    logo_url: string | null
    community_link?: string | null
    divider_style?: string | null
    brand_color: string
    brand_accent: string
    ownerRole: string
    airtime_fee_mtn?: number
    airtime_fee_telecel?: number
    airtime_fee_at?: number
    mashup_fee_percent?: number
    afa_selling_price?: number | null
    paystack_fee_percent?: number | null
}

interface Package {
    id: string
    network: string
    size: string
    description: string | null
    selling_price: number
}

interface Props {
    shop: ShopData
    packages: Package[]
    adminSettings: Record<string, string>
    initialAnnouncement?: { id: string; type: 'admin' | 'shop'; message: string; title?: string; cta_primary_label?: string | null; cta_primary_url?: string | null; cta_secondary_label?: string | null; cta_secondary_url?: string | null } | null
    rcTypes?: Array<{ id: string; name: string; customer_price: number; available_count?: number; bulk_pricing?: Array<{ min_qty: number; max_qty: number; unit_price: number }> }>
    rcMarkup?: number
    rcMarkups?: Record<string, number>
    oosNetworks?: string[]
    /**
     * Server-computed gate for the Utilities tab (global admin gates AND shop opt-in AND
     * ≥1 biller enabled AND NOT a sub-agent shop) — resolved once in
     * app/shop/[shopSlug]/page.tsx, mirroring the utility API routes' own gate chain. The
     * client never re-derives this; it only reads the prop. Optional/defaulted so pages that
     * haven't been updated yet (e.g. the white-label shop-domain route) keep compiling with
     * the tab simply hidden.
     */
    utilitiesEnabled?: boolean
    enabledUtilityBillers?: Partial<Record<UtilityBiller, boolean>>
    utilityMinAmount?: number
    utilityMaxAmount?: number
}

// Brand colors per network (used in Airtime tab)
const networkColors: Record<string, { bgClass: string; textClass: string; borderClass: string; gradient: string }> = {
    MTN: { bgClass: 'bg-brand-500', textClass: 'text-[#000000]', borderClass: 'border-brand-600', gradient: 'from-yellow-400 to-yellow-500' },
    Telecel: { bgClass: 'bg-[#E60000]', textClass: 'text-[#ffffff]', borderClass: 'border-[#cc0000]', gradient: 'from-red-500 to-red-600' },
    'AT-iShare': { bgClass: 'bg-primary', textClass: 'text-[#ffffff]', borderClass: 'border-brand-800', gradient: 'from-brand-600 to-brand-700' },
    'AT-BigTime': { bgClass: 'bg-[#6f42c1]', textClass: 'text-[#ffffff]', borderClass: 'border-[#5a32a3]', gradient: 'from-purple-600 to-purple-700' },
    AT: { bgClass: 'bg-[#F97316]', textClass: 'text-[#ffffff]', borderClass: 'border-[#ea580c]', gradient: 'from-orange-500 to-orange-600' },
}

const QUICK_AMOUNTS = [1, 2, 5, 10, 20, 50, 100]


type BundlePreference = 'balanced' | 'data'

function calcMashupBundle(amount: number, pref: BundlePreference): { data: string; voice: string; exact: boolean } {
    const round1 = (n: number) => Math.round(n * 10) / 10
    if (amount <= 0) return { data: '0', voice: '0', exact: false }

    // ≥ GHS 10 — stable zone: fixed multipliers
    if (amount >= 10) {
        const BASE_DATA = 18     // MB per GHS
        const BASE_VOICE = 17.3  // mins per GHS
        let dataMult = BASE_DATA, voiceMult = BASE_VOICE
        if (pref === 'data')  { dataMult = BASE_DATA * 1.25; voiceMult = BASE_VOICE * 0.6 }
        return {
            data: round1(amount * dataMult).toFixed(1) + ' MB',
            voice: round1(amount * voiceMult).toFixed(1) + ' Mins',
            exact: true
        }
    }

    // < GHS 10 — variable zone: tier estimates
    let dataLow: number, dataHigh: number, voiceLow: number, voiceHigh: number
    if (amount <= 2)      { dataLow = 15;   dataHigh = 16;   voiceLow = 15;   voiceHigh = 16 }
    else if (amount <= 5) { dataLow = 15;   dataHigh = 17.5; voiceLow = 15;   voiceHigh = 17 }
    else                  { dataLow = 17;   dataHigh = 18;   voiceLow = 16.5; voiceHigh = 17.5 }

    // Preference skew for range display
    if (pref === 'data')  { dataHigh *= 1.2; voiceLow *= 0.7; voiceHigh *= 0.8 }

    return {
        data: `${round1(amount * dataLow).toFixed(0)}–${round1(amount * dataHigh).toFixed(0)} MB`,
        voice: `${round1(amount * voiceLow).toFixed(0)}–${round1(amount * voiceHigh).toFixed(0)} Mins`,
        exact: false
    }
}

export default function ShopStorefront({
    shop, packages, adminSettings, initialAnnouncement = null, rcTypes: rcTypesProp = [], rcMarkup: rcMarkupProp = 0, rcMarkups: rcMarkupsProp = {}, oosNetworks = [],
    utilitiesEnabled = false, enabledUtilityBillers = {}, utilityMinAmount = 1, utilityMaxAmount = 1000,
}: Props) {
    // RC pricing is SEEDED from the server-render snapshot, then re-pulled LIVE on the client
    // (mount + focus/visibility) so the browsed price always matches what the charge computes —
    // the snapshot alone goes stale when an admin/owner edits a price after the page rendered.
    const [rcTypes, setRcTypes] = useState(rcTypesProp)
    const [rcMarkups, setRcMarkups] = useState(rcMarkupsProp)
    const [rcMarkup, setRcMarkup] = useState(rcMarkupProp)

    // Per-exam markup wins; the legacy single markup is the fallback
    const markupFor = (typeId: string | undefined) =>
        (typeId && rcMarkups[typeId] !== undefined) ? rcMarkups[typeId] : rcMarkup

    const router = useRouter()
    const searchParams = useSearchParams()
    
    // Airtime State
    const [airtimePhone, setAirtimePhone] = useState('')
    const [airtimeEmail, setAirtimeEmail] = useState('')
    const [airtimeAmount, setAirtimeAmount] = useState('')
    const [detectedNetwork, setDetectedNetwork] = useState<'MTN' | 'Telecel' | 'AT' | null>(null)
    const [isManualSelection, setIsManualSelection] = useState(false)
    const [useExact, setUseExact] = useState(true)
    const airtimeRef = useRef<HTMLDivElement>(null)
    const heroRef = useRef<HTMLDivElement>(null)
    const productSectionRef = useRef<HTMLDivElement>(null)
    
    // Mashup State
    const [mashupPhone, setMashupPhone] = useState('')
    const [mashupEmail, setMashupEmail] = useState('')
    const [mashupAmount, setMashupAmount] = useState('')
    // Defaults to 'balanced' — matches the dashboard quick-buy and USSD mashup's default.
    const [mashupBundle, setMashupBundle] = useState<'balanced' | 'data' | null>('balanced')

    // Shared in-app MoMo charge sheet (airtime / mashup / results checker)
    const [chargeOpen, setChargeOpen] = useState(false)
    const [chargeDescriptor, setChargeDescriptor] = useState<ChargeDescriptor | null>(null)

    // Global State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'data' | 'airtime' | 'mashup' | 'vouchers' | 'utilities' | 'afa'>('data')
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [pageLoading, setPageLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [contactInfo, setContactInfo] = useState<{ phone?: string; whatsapp?: string; email?: string } | null>(null)
    const [announcement, setAnnouncement] = useState<{ id: string; type: 'admin' | 'shop'; message: string; title?: string; cta_primary_label?: string | null; cta_primary_url?: string | null; cta_secondary_label?: string | null; cta_secondary_url?: string | null } | null>(initialAnnouncement ?? null)
    // Dismissed state initialised from localStorage so guests only see each
    // unique announcement once. Resets automatically when admin posts/reposts.
    const [announcementDismissed, setAnnouncementDismissed] = useState(() => {
        if (!initialAnnouncement?.id || typeof window === 'undefined') return false
        return !!localStorage.getItem(`storefront_ann_${initialAnnouncement.id}`)
    })
    const [announcementCountdown, setAnnouncementCountdown] = useState(0)
    // Announcements must wait for the page-load terms gate: the boundary reports
    // when the agreement is out of the way (already accepted / not needed / accepted now).
    const [termsGateResolved, setTermsGateResolved] = useState(false)

    // ── Guest Push Notification ───────────────────────────────────────────────
    const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported')
    const [isGuestSubscribed, setIsGuestSubscribed] = useState(false)
    const [showPushOptIn, setShowPushOptIn] = useState(false)
    const [isSubscribing, setIsSubscribing] = useState(false)

    const [scrolled, setScrolled] = useState(false)
    const [isStorefront, setIsStorefront] = useState(false)
    const [isPwaPromptVisible, setIsPwaPromptVisible] = useState(false)

    useEffect(() => {
        const handlePwaVisibility = (e: Event) => {
            const customEvent = e as CustomEvent
            setIsPwaPromptVisible(customEvent.detail?.isVisible || false)
        }
        window.addEventListener('pwa-prompt-visibility', handlePwaVisibility)
        return () => window.removeEventListener('pwa-prompt-visibility', handlePwaVisibility)
    }, [])

    // Bug-2: the displayed prices are a server-render snapshot held in props. When the
    // installed PWA / a backgrounded tab is restored from bfcache, the old DOM (old price)
    // is shown without a network round-trip while the checkout recomputes the price live
    // → "sees old, pays new". Re-pull the live RSC payload on restore so what the guest
    // sees matches what they'll be charged.
    useEffect(() => {
        const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) router.refresh() }
        const onVisible = () => { if (document.visibilityState === 'visible') router.refresh() }
        window.addEventListener('pageshow', onPageShow)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.removeEventListener('pageshow', onPageShow)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [router])

    // Bug fix: pull LIVE results-checker pricing on the client (mount + focus/visibility) so the
    // displayed base price + markups always match what /api/shop/results-checker/charge computes.
    // The server-rendered snapshot goes stale the moment a price changes while a tab is open or a
    // cached shell is shown; this uncached /api fetch (NetworkOnly in the SW) corrects it.
    useEffect(() => {
        let cancelled = false
        const loadRcPricing = async () => {
            try {
                const res = await fetch(`/api/shop/results-checker/pricing?shopSlug=${encodeURIComponent(shop.shop_slug)}`, { cache: 'no-store' })
                if (!res.ok) return
                const data = await res.json()
                if (cancelled || !data?.success) return
                if (Array.isArray(data.types)) setRcTypes(data.types)
                if (data.markups && typeof data.markups === 'object') setRcMarkups(data.markups)
                if (typeof data.legacyMarkup === 'number') setRcMarkup(data.legacyMarkup)
            } catch { /* keep the snapshot on network error */ }
        }
        loadRcPricing()
        const onVisible = () => { if (document.visibilityState === 'visible') loadRcPricing() }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', loadRcPricing)
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', loadRcPricing)
        }
    }, [shop.shop_slug])

    // Auto-show announcement on load — only after the terms gate is resolved
    // (guest accepted / didn't need to) and only if the guest hasn't seen it yet.
    useEffect(() => {
        if (termsGateResolved && announcement && !announcementDismissed) {
            const timer = setTimeout(() => setShowAnnouncementModal(true), 100)
            return () => clearTimeout(timer)
        }
    }, [termsGateResolved, announcement, announcementDismissed])

    // 5-second countdown while announcement modal is open
    useEffect(() => {
        if (!showAnnouncementModal) { setAnnouncementCountdown(0); return }
        setAnnouncementCountdown(5)
    }, [showAnnouncementModal])
    useEffect(() => {
        if (announcementCountdown <= 0) return
        const t = setTimeout(() => setAnnouncementCountdown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [announcementCountdown])

    // Detect push support and check if already subscribed to this shop
    useEffect(() => {
        if (typeof window === 'undefined') return
        const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
        if (!supported) return
        setPushPermission(Notification.permission as 'default' | 'granted' | 'denied')
        if (Notification.permission === 'granted' && localStorage.getItem(`guest_push_${shop.id}`)) {
            setIsGuestSubscribed(true)
        }
    }, [shop.id])

    const handleGuestSubscribe = async () => {
        if (isSubscribing) return
        setIsSubscribing(true)
        try {
            const result = await Notification.requestPermission()
            setPushPermission(result as 'default' | 'granted' | 'denied')
            if (result !== 'granted') {
                toast.error('Notifications blocked. Enable them in your browser settings.')
                setShowPushOptIn(false)
                return
            }

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) throw new Error('Push not configured')

            // serviceWorker.ready can hang if SW never activates — cap at 10s
            const registration = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 10000)),
            ]) as ServiceWorkerRegistration

            const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
            const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
            const raw = window.atob(base64)
            const buf = new ArrayBuffer(raw.length)
            const arr = new Uint8Array(buf)
            for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)

            const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr })
            const subJson = sub.toJSON()

            const res = await fetch('/api/push/guest-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopId: shop.id,
                    endpoint: subJson.endpoint,
                    p256dh: subJson.keys?.p256dh,
                    auth: subJson.keys?.auth,
                }),
            })
            if (!res.ok) throw new Error('Server error saving subscription')

            localStorage.setItem(`guest_push_${shop.id}`, '1')
            setIsGuestSubscribed(true)
            setShowPushOptIn(false)
            toast.success("You're subscribed! We'll notify you of new announcements.")
        } catch (err: any) {
            console.error('[StorefrontPush] Subscribe error:', err)
            if (err?.message === 'SW timeout') {
                toast.error('Service worker not ready. Try refreshing the page.')
            } else {
                toast.error('Failed to enable notifications. Please try again.')
            }
        } finally {
            setIsSubscribing(false)
        }
    }

    const handleDismissAnnouncement = () => {
        if (announcementCountdown > 0) return
        setShowAnnouncementModal(false)
        setAnnouncementDismissed(true)
        if (announcement?.id) {
            localStorage.setItem(`storefront_ann_${announcement.id}`, '1')
        }
    }

    useEffect(() => {
        // Detect if we are on the subdomain storefront or the main domain
        const hostname = window.location.hostname
        // Only shop.* / store.* serve the storefront at the root; every other host
        // (apex, preview.*, *.vercel.app, localhost) serves it under /shop/<slug>.
        setIsStorefront(isStorefrontHost(hostname))
    }, [])

    // White-label toast notifications: show the shop's own name (not the platform brand)
    // on every error/success toast while a guest is on this storefront. Reset on unmount.
    useEffect(() => {
        toast.setBrand(shop.shop_name)
        return () => toast.setBrand(null)
    }, [shop.shop_name])

    // Derived base path for links
    const baseLinkPath = isStorefront ? '' : '/shop'
    const rcRetrieveHref = `${baseLinkPath}/${shop.shop_slug}/results-checker/retrieve`

    // Derived flags for Airtime
    const isGlobalAirtimeEnabled = adminSettings['storefront_airtime_enabled'] === 'true'
    
    const airtimeNetworks = [
        { id: 'MTN', fee: shop.airtime_fee_mtn || 0, enabled: adminSettings['airtime_enabled_mtn'] !== 'false' },
        { id: 'Telecel', fee: shop.airtime_fee_telecel || 0, enabled: adminSettings['airtime_enabled_telecel'] !== 'false' },
        { id: 'AT', fee: shop.airtime_fee_at || 0, enabled: adminSettings['airtime_enabled_at'] !== 'false' }
    ].filter(n => n.enabled)

    const isShopAirtimeEnabled = isGlobalAirtimeEnabled && airtimeNetworks.length > 0

    const isGlobalMashupEnabled = adminSettings['storefront_mashup_enabled'] === 'true'
    const isShopMashupEnabled = isGlobalMashupEnabled && adminSettings['airtime_enabled_mtn'] !== 'false'

    // Global RC enabled flag — no per-shop override possible
    const isRCEnabled = adminSettings['results_checker_storefront_enabled'] === 'true' && rcTypes.length > 0

    // AFA is offered when the platform toggle is on AND this shop has saved a selling
    // price greater than 0. Under the flat-amount model (Task 1) 0/null both mean
    // "not configured" — unlike the old percentage model, 0 is not a valid live value.
    const isShopAfaEnabled =
        String(adminSettings['storefront_afa_enabled']) === 'true' &&
        shop.afa_selling_price !== null && shop.afa_selling_price !== undefined &&
        parseFloat(String(shop.afa_selling_price)) > 0

    // Display-only price so the guest sees the total before paying. Mirrors
    // computeShopAfaCheckout exactly: the shop's saved flat selling price plus the
    // Paystack fee (per-shop override -> shop_global_settings role key -> legacy key
    // -> 1.95% default). computeShopAfaCheckout on the server remains the sole
    // authority on what is actually charged — if the two ever disagree the server wins.
    const afaDisplayPrice = (() => {
        if (!isShopAfaEnabled) return null
        const sellingPrice = Math.round(parseFloat(String(shop.afa_selling_price)) * 100) / 100
        if (sellingPrice <= 0) return null

        let paystackFeePercent = 1.95
        if (shop.paystack_fee_percent !== null && shop.paystack_fee_percent !== undefined) {
            paystackFeePercent = parseFloat(String(shop.paystack_fee_percent))
        } else if (adminSettings[`shop_paystack_fee_percent_${shop.ownerRole}`] != null) {
            paystackFeePercent = parseFloat(String(adminSettings[`shop_paystack_fee_percent_${shop.ownerRole}`]))
        } else if (adminSettings['shop_paystack_fee_percent'] != null) {
            paystackFeePercent = parseFloat(String(adminSettings['shop_paystack_fee_percent']))
        }
        const paystackFee = Math.round(sellingPrice * (paystackFeePercent / 100) * 100) / 100
        return Math.round((sellingPrice + paystackFee) * 100) / 100
    })()

    // RC state
    const [selectedRCTypeId, setSelectedRCTypeId] = useState(rcTypes[0]?.id || '')
    const [rcQuantity, setRCQuantity] = useState(1)
    const [rcPhone, setRCPhone] = useState('')
    const [rcEmail, setRCEmail] = useState('')
    const [rcBreakdown, setRCBreakdown] = useState<{unit_price:number;quantity:number;subtotal:number;paystack_fee:number;total:number} | null>(null)
    const [showRCSuccess, setShowRCSuccess] = useState(false)
    const [rcSuccessData, setRcSuccessData] = useState<{order: any, vouchers: any[]} | null>(null)

    // UI refinement states
    const [showRCConfirmModal, setShowRCConfirmModal] = useState(false)
    const [revealedRCPins, setRevealedRCPins] = useState<Set<string>>(new Set())

    const toggleRCPinReveal = (pin: string) => {
        const next = new Set(revealedRCPins)
        if (next.has(pin)) next.delete(pin)
        else next.add(pin)
        setRevealedRCPins(next)
    }

    useEffect(() => {
        try { sessionStorage.setItem('shop_sticky_slug', shop.shop_slug) } catch (_) { }
    }, [shop.shop_slug])

    // Sticky header scroll listener
    useEffect(() => {
        const handleScroll = () => {
            const heroHeight = heroRef.current?.offsetHeight || 200
            setScrolled(window.scrollY > heroHeight - 60)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Reveal a paid voucher order on screen by reference (shared by the in-app charge
    // success path AND the legacy ?rc_ref= redirect callback). Looks the order up with the
    // delivery phone saved at purchase time; falls back to the retrieve page if we can't.
    const revealVouchersByRef = useCallback(async (rcRef: string) => {
        const isSubdomain = isStorefrontHost(window.location.hostname)
        const retrieveHref = `${isSubdomain ? '' : '/shop'}/${shop.shop_slug}/results-checker/retrieve`
        setActiveTab('vouchers')
        try {
            const savedPhone = localStorage.getItem('shop_last_phone')
            if (!savedPhone) {
                router.replace(`${retrieveHref}?reference=${encodeURIComponent(rcRef)}`)
                return
            }
            setPageLoading(true)
            const res = await fetch('/api/results-checker/retrieve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: rcRef, phone: savedPhone })
            })
            const data = await res.json()
            if (res.ok && data.order) {
                setRcSuccessData(data)
                setShowRCSuccess(true)
            } else {
                router.replace(`${retrieveHref}?reference=${encodeURIComponent(rcRef)}`)
            }
        } catch (err) {
            toast.error('Network error checking order status')
        } finally {
            setPageLoading(false)
        }
    }, [router, shop.shop_slug])

    useEffect(() => {
        const error = searchParams.get('error')
        if (error) {
            const messages: Record<string, string> = {
                payment_failed: 'Payment was not completed. Please try again.',
                order_not_found: 'Order not found. Please try again.',
                server_error: 'Something went wrong. Please try again.',
                invalid_ref: 'Invalid payment reference.',
            }
            setErrorMsg(messages[error] || 'An error occurred. Please try again.')
        }

        const rcRef = searchParams.get('rc_ref')
        if (rcRef && /^RC-[A-Za-z0-9-]{1,90}$/.test(rcRef)) revealVouchersByRef(rcRef)
    }, [searchParams, revealVouchersByRef])

    // Clamp the RC quantity to on-hand stock when the selected exam type changes, mirroring
    // the server's pre-charge stock check (skip when the admin allows backorders) so the
    // displayed total can't be for more vouchers than exist.
    useEffect(() => {
        if (adminSettings['results_checker_allow_backorders'] === 'true') return
        const t = rcTypes.find(x => x.id === selectedRCTypeId)
        if (t && typeof t.available_count === 'number' && t.available_count > 0) {
            setRCQuantity(q => Math.min(q, t.available_count as number))
        }
    }, [selectedRCTypeId, rcTypes, adminSettings])

    // Auto-detect network for airtime
    useEffect(() => {
        const clean = airtimePhone.replace(/\s+/g, '')
        
        // Reset network selection and manual flag if phone is deleted or < 3 chars
        if (clean.length < 3) {
            setDetectedNetwork(null)
            setIsManualSelection(false)
            return
        }

        if (isManualSelection) return
        
        const prefix = clean.substring(0, 3)
        let detected: 'MTN' | 'Telecel' | 'AT' | null = null
        
        const prefixes = {
            MTN: ['024', '054', '055', '059', '025', '053', '098'],
            Telecel: ['020', '050'],
            AT: ['026', '027', '056', '028', '058', '057'] // Includes 057 and 028 from main site
        }

        for (const [net, prfxs] of Object.entries(prefixes)) {
            if (prfxs.includes(prefix)) {
                detected = net as 'MTN' | 'Telecel' | 'AT'
                break
            }
        }
        
        if (detected && airtimeNetworks.some(n => n.id === detected)) {
            setDetectedNetwork(detected)
        } else {
            setDetectedNetwork(null)
        }
    }, [airtimePhone, airtimeNetworks, isManualSelection])

    // Generate Network Soft Warning
    const airtimeNetworkWarning = useMemo(() => {
        const clean = airtimePhone.replace(/\s+/g, '')
        if (clean.length < 3) return null

        const prefix = clean.substring(0, 3)
        const prefixes = {
            MTN: ['024', '054', '055', '059', '025', '053', '098'],
            Telecel: ['020', '050'],
            AT: ['026', '027', '056', '028', '058', '057']
        }
        
        let actualNet = null
        for (const [net, prfxs] of Object.entries(prefixes)) {
            if (prfxs.includes(prefix)) {
                actualNet = net
                break
            }
        }

        if (!actualNet) return 'Unrecognized prefix — please confirm your network.'
        if (detectedNetwork && actualNet !== detectedNetwork) {
            return `This number looks like it belongs to ${actualNet}. Please verify before proceeding.`
        }
        return null
    }, [airtimePhone, detectedNetwork])

    const calculateAirtimeFees = () => {
        if (!detectedNetwork || !airtimeAmount) return { feeAmount: 0, totalPay: 0, airtimeToReceive: 0 }
        const numAmount = parseFloat(airtimeAmount)
        if (isNaN(numAmount) || numAmount <= 0) return { feeAmount: 0, totalPay: 0, airtimeToReceive: 0 }

        const shopFeeConfig = airtimeNetworks.find(n => n.id === detectedNetwork)
        const shopFeeMultiplier = shopFeeConfig ? shopFeeConfig.fee : 0
        const adminFeeMultiplier = parseFloat(adminSettings[`airtime_fee_${detectedNetwork.toLowerCase()}_${shop.ownerRole}`] || '0')
        
        const totalMultiplier = (adminFeeMultiplier + shopFeeMultiplier) / 100
        const round2 = (n: number) => Math.round(n * 100) / 100

        if (useExact) {
            const feeAmount = round2(numAmount * totalMultiplier)
            return { feeAmount, totalPay: round2(numAmount + feeAmount), airtimeToReceive: numAmount }
        } else {
            const feeAmount = round2(numAmount * totalMultiplier)
            return { feeAmount, totalPay: numAmount, airtimeToReceive: round2(numAmount - feeAmount) }
        }
    }

    const calculateMashupFees = () => {
        if (!mashupAmount) return { feeAmount: 0, totalPay: 0 }
        const numAmount = parseFloat(mashupAmount)
        if (isNaN(numAmount) || numAmount <= 0) return { feeAmount: 0, totalPay: 0 }

        const shopFeeMultiplier = shop.mashup_fee_percent || 1
        const adminFeeMultiplier = parseFloat(adminSettings[`airtime_fee_mtn_${shop.ownerRole}`] || '0')
        
        const totalMultiplier = (adminFeeMultiplier + shopFeeMultiplier) / 100
        const round2 = (n: number) => Math.round(n * 100) / 100

        const feeAmount = round2(numAmount * totalMultiplier)
        return { feeAmount, totalPay: round2(numAmount + feeAmount) }
    }

    const handleBuyAirtime = async () => {
        if (!detectedNetwork) { toast.error('Enter a valid registered network number'); return }
        if (!airtimeAmount) { toast.error('Enter airtime amount'); return }
        
        const numAmount = parseFloat(airtimeAmount)
        const minAmount = parseFloat(adminSettings['airtime_min_amount_customer'] || '1')
        const maxAmount = parseFloat(adminSettings['airtime_max_amount_customer'] || '500')

        if (numAmount < minAmount) { toast.error(`Minimum airtime purchase is GHS ${minAmount.toFixed(2)}`); return }
        if (numAmount > maxAmount) { toast.error(`Maximum airtime purchase is GHS ${maxAmount.toFixed(2)}`); return }

        const cleanPhone = airtimePhone.replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) { toast.error('Enter a valid recipient phone number'); return }
        try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }

        // Open the in-app MoMo charge sheet (no redirect). The recipient, amount and email
        // are already collected on the airtime tab, so the sheet only collects the MoMo wallet.
        const net = detectedNetwork
        const recipientEmail = airtimeEmail.trim()
        const { totalPay } = calculateAirtimeFees()
        setChargeDescriptor({
            title: `${net} · GHS ${numAmount.toFixed(2)} Airtime`,
            network: net,
            amountLabel: formatCurrency(totalPay),
            chargeUrl: '/api/shop/charge',
            statusUrl: '/api/shop/charge/status',
            beneficiary: null,
            email: null,
            successText: () => `GHS ${numAmount.toFixed(2)} airtime is being sent to ${cleanPhone}.`,
            buildBody: ({ momoPhone, provider }) => ({
                shopSlug: shop.shop_slug, orderType: 'airtime', network: net,
                amount: numAmount, useExactAmount: useExact,
                guestPhone: cleanPhone, guestEmail: recipientEmail || undefined,
                momoPhone, momoProvider: provider,
            }),
        })
        setChargeOpen(true)
    }

    const handleBuyMashup = async () => {
        if (!mashupAmount) { toast.error('Enter mashup amount'); return }
        if (!mashupBundle) { toast.error('Select bundle preference (Balanced or Data)'); return }

        const numAmount = parseFloat(mashupAmount)
        // Mashup has its own admin-configured limits, independent of plain airtime's —
        // never fall back to airtime's min/max for a mashup order.
        const minAmount = parseFloat(adminSettings['mashup_min_amount_customer'] || '5')
        const maxAmount = parseFloat(adminSettings['mashup_max_amount_customer'] || '500')

        if (numAmount < minAmount) { toast.error(`Minimum purchase is GHS ${minAmount.toFixed(2)}`); return }
        if (numAmount > maxAmount) { toast.error(`Maximum purchase is GHS ${maxAmount.toFixed(2)}`); return }

        const cleanPhone = mashupPhone.replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) { toast.error('Enter a valid recipient phone number'); return }
        try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }

        // Open the in-app MoMo charge sheet (no redirect). Recipient/amount/bundle/email are
        // already collected on the mashup tab, so the sheet only collects the MoMo wallet.
        const bundle = mashupBundle
        const recipientEmail = mashupEmail.trim()
        const { totalPay } = calculateMashupFees()
        setChargeDescriptor({
            title: `MTN · GHS ${numAmount.toFixed(2)} Mashup`,
            network: 'MTN',
            amountLabel: formatCurrency(totalPay),
            chargeUrl: '/api/shop/charge',
            statusUrl: '/api/shop/charge/status',
            beneficiary: null,
            // Guess the recipient also pays — pre-fills the MoMo field but stays editable there.
            initialMomoPhone: cleanPhone,
            email: null,
            successText: () => `Your MTN Mashup is being processed for ${cleanPhone}.`,
            buildBody: ({ momoPhone, provider }) => ({
                shopSlug: shop.shop_slug, orderType: 'mashup', network: 'MTN',
                amount: numAmount, useExactAmount: true, bundlePreference: bundle,
                guestPhone: cleanPhone, guestEmail: recipientEmail || undefined,
                momoPhone, momoProvider: provider,
            }),
        })
        setChargeOpen(true)
    }

    // AFA KYC form collects details first; this opens the shared in-app MoMo charge
    // sheet for payment (native charge via /api/shop/afa/charge — no redirect). The
    // sheet's own email field stays hidden (email is already collected on the KYC form).
    const handleAfaSubmit = (formData: Record<string, any>, guestEmail: string) => {
        const cleanPhone = String(formData.phone || '').replace(/\s+/g, '')
        setChargeDescriptor({
            title: 'AFA Registration',
            amountLabel: afaDisplayPrice != null ? formatCurrency(afaDisplayPrice) : '',
            chargeUrl: '/api/shop/afa/charge',
            statusUrl: '/api/shop/afa/charge/status',
            beneficiary: null,
            // Guess the registrant also pays — pre-fills the MoMo field but stays editable.
            initialMomoPhone: cleanPhone,
            email: null,
            successText: () => `Your AFA registration has been received and is being processed. We'll notify you once it's completed.`,
            buildBody: ({ momoPhone, provider }) => ({
                shopSlug: shop.shop_slug, guestPhone: cleanPhone, guestEmail: guestEmail || undefined,
                formData, momoPhone, momoProvider: provider,
            }),
        })
        setChargeOpen(true)
    }

    // Contrast utility
    const isLightColor = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
        return yiq >= 128
    }

    const brandColor = shop.brand_color || '#2563eb'
    const isValidHex = (color: string) => /^#([A-Fa-f0-9]{3}){1,4}$/.test(color)
    const safeBrandColor = isValidHex(brandColor) ? brandColor : '#2563eb'
    
    const brandContrastText = isLightColor(safeBrandColor) ? '#111827' : '#ffffff'
    const isBrandColorLight = isLightColor(safeBrandColor)
    const { feeAmount: airFee, totalPay: airTotal, airtimeToReceive } = calculateAirtimeFees()
    const { feeAmount: mashFee, totalPay: mashTotal } = calculateMashupFees()
    // Mashup's own admin-configured limits — shown to the guest and used to bound the input,
    // never airtime's (see handleBuyMashup for the matching validation).
    const mashupMinAmount = parseFloat(adminSettings['mashup_min_amount_customer'] || '5')
    const mashupMaxAmount = parseFloat(adminSettings['mashup_max_amount_customer'] || '500')

    const mashupBreakdown = useMemo(() => {
        if (!mashupAmount || !mashupBundle) return null
        const amt = parseFloat(mashupAmount)
        if (isNaN(amt) || amt <= 0) return null
        return calcMashupBundle(amt, mashupBundle.toLowerCase() as BundlePreference)
    }, [mashupAmount, mashupBundle])

    // ── Select product + scroll to section ───────────────────
    const selectProduct = (tab: 'data' | 'airtime' | 'mashup' | 'vouchers' | 'utilities' | 'afa') => {
        setActiveTab(tab)
        setIsSidebarOpen(false)
        setTimeout(() => {
            productSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
    }

    const accent = resolveAccent(shop.brand_color)

    if (pageLoading) {
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-black">
                <BrandSwoosh className="pointer-events-none absolute bottom-0 right-[-20%] w-[90%] opacity-60" />
                <span className="relative h-16 w-16 overflow-hidden rounded-full bg-white/10 ring-2 ring-offset-2 ring-offset-black" style={{ ['--tw-ring-color' as string]: accent }}>
                    {shop.logo_url
                        ? <Image src={shop.logo_url} alt="" fill sizes="64px" className="object-cover" />
                        : <ShoppingCart className="absolute inset-0 m-auto h-7 w-7 text-brand-400" aria-hidden="true" />}
                </span>
                <p className="relative font-display text-lg font-bold text-white">One moment…</p>
            </div>
        )
    }

    const serviceTabs: ServiceTab<typeof activeTab>[] = [
        { key: 'data', label: 'Data', icon: Zap },
        ...(isShopAirtimeEnabled ? [{ key: 'airtime' as const, label: 'Airtime', icon: Smartphone }] : []),
        ...(isShopMashupEnabled ? [{ key: 'mashup' as const, label: 'Mashup', icon: Zap }] : []),
        ...(isRCEnabled ? [{ key: 'vouchers' as const, label: 'Results checker', icon: GraduationCap }] : []),
        ...(utilitiesEnabled ? [{ key: 'utilities' as const, label: 'Bills', icon: Receipt }] : []),
        ...(isShopAfaEnabled ? [{ key: 'afa' as const, label: 'AFA', icon: IdCard }] : []),
    ]

    const shopLinks: StorefrontLink[] = [
        { href: `${baseLinkPath}/status?shop=${shop.shop_slug}&name=${encodeURIComponent(shop.shop_name)}`, label: 'Track an order', icon: History },
        ...(isRCEnabled ? [{ href: rcRetrieveHref, label: 'Get my voucher', icon: GraduationCap }] : []),
        { href: `${baseLinkPath}/${shop.shop_slug}/about`, label: 'About this shop', icon: Info },
    ]

    return (
        <div className="theme-shop">
            <PWAInstallPrompt />
            {/* Page-load terms gate — blocks the storefront for a guest until they accept (like the main site).
                Announcements are held until it reports resolved, so terms always render first. */}
            <StorefrontTermsBoundary brandName={shop.shop_name} onGateResolved={() => setTermsGateResolved(true)} />
            {/* Shared in-app MoMo charge sheet for airtime / mashup / results checker */}
            <ServiceChargeSheet open={chargeOpen} onClose={() => setChargeOpen(false)} descriptor={chargeDescriptor} brandName={shop.shop_name} />

            <StorefrontShell
                name={shop.shop_name}
                description={shop.description}
                logoUrl={shop.logo_url}
                accent={accent}
                links={shopLinks}
                phone={shop.owner_phone}
                email={shop.owner_email}
                whatsapp={shop.whatsapp_number}
                community={shop.community_link}
                notify={pushPermission === 'unsupported' ? 'hidden' : isGuestSubscribed ? 'on' : 'idle'}
                onNotify={() => setShowPushOptIn(true)}
                announcement={announcement ? { unread: !announcementDismissed, onOpen: () => setShowAnnouncementModal(true) } : null}
                headerAction={<ThemeToggle brandName={shop.shop_name} />}
            >
                <div ref={productSectionRef} className="mb-6 scroll-mt-4">
                    <ServiceTabs tabs={serviceTabs} active={activeTab} onChange={selectProduct} />
                </div>

                {/* Error banner */}
                {errorMsg && (
                    <div role="alert" className="neu-inset mb-6 space-y-3 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{errorMsg}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {contactInfo
                                        ? 'This shop cannot take orders right now. Reach the owner directly to finish your purchase:'
                                        : 'Please try again. If it keeps happening, contact the shop.'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setErrorMsg(null); setContactInfo(null) }}
                                title="Dismiss"
                                aria-label="Dismiss error"
                                className="neu-raised-sm flex h-8 w-8 items-center justify-center rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {contactInfo && (
                            <div className="flex flex-wrap gap-2">
                                {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="clay-black inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold"><Phone className="h-4 w-4" /> Call {contactInfo.phone}</a>}
                                {contactInfo.whatsapp && <a href={`https://wa.me/${contactInfo.whatsapp}`} target="_blank" rel="noopener noreferrer" className="clay-gold inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
                            </div>
                        )}
                    </div>
                )}


                {/* ── Airtime ── */}
                {isShopAirtimeEnabled && activeTab === 'airtime' && (
                    <section ref={airtimeRef} className="animate-in fade-in duration-300 motion-reduce:animate-none">
                        <ServiceHeading icon={Smartphone} title="Top up airtime" blurb="Credit lands on any Ghana network in seconds." />

                        <div className="space-y-6">
                            <div>
                                <FieldLabel>Which network?</FieldLabel>
                                <div role="radiogroup" aria-label="Network" className="grid grid-cols-3 gap-2.5">
                                    {['MTN', 'Telecel', 'AT'].map(netId => {
                                        const isEnabled = airtimeNetworks.some(n => n.id === netId)
                                        return (
                                            <Pill
                                                key={netId}
                                                on={detectedNetwork === netId}
                                                disabled={!isEnabled}
                                                role="radio"
                                                aria-checked={detectedNetwork === netId}
                                                onClick={() => { setDetectedNetwork(netId as any); setIsManualSelection(true) }}
                                                className="flex-col gap-1 py-2.5"
                                            >
                                                <NetworkIcon network={netId} size={28} />
                                                <span className="text-xs">{isEnabled ? netId : `${netId} paused`}</span>
                                            </Pill>
                                        )
                                    })}
                                </div>
                            </div>

                            <div>
                                <FieldLabel htmlFor="air-phone" hint="(who gets the credit)">Phone number</FieldLabel>
                                <input id="air-phone" type="tel" inputMode="tel" value={airtimePhone} onChange={(e) => setAirtimePhone(e.target.value)} placeholder="024 123 4567" className={FIELD} />
                            </div>

                            {airtimeNetworkWarning && <Note tone="warn">{airtimeNetworkWarning}</Note>}

                            <div>
                                <FieldLabel htmlFor="air-amount">How much?</FieldLabel>
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {QUICK_AMOUNTS.map(q => (
                                        <Pill key={q} on={airtimeAmount === String(q)} onClick={() => setAirtimeAmount(String(q))} className="min-w-[3.5rem]">{q}</Pill>
                                    ))}
                                </div>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">GHS</span>
                                    <input id="air-amount" type="number" inputMode="decimal" min="1" step="0.5" value={airtimeAmount} onChange={(e) => setAirtimeAmount(e.target.value)} placeholder="Or type an amount" className={cn(FIELD, 'pl-16')} />
                                </div>
                            </div>

                            <div>
                                <FieldLabel htmlFor="air-email" hint="(receipt, optional)">Email</FieldLabel>
                                <input id="air-email" type="email" inputMode="email" value={airtimeEmail} onChange={(e) => setAirtimeEmail(e.target.value)} placeholder="you@example.com" className={FIELD} />
                            </div>

                            <button type="button" role="switch" aria-checked={useExact} onClick={() => setUseExact(!useExact)} className={cn('flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left', FOCUS, useExact ? 'neu-inset' : 'neu-raised-sm neu-press')}>
                                <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', useExact ? 'clay-gold' : 'neu-inset')}>
                                    {useExact && <Check className="h-3 w-3" strokeWidth={3} />}
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-foreground">Send the full amount</span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {useExact ? 'You pay the fee on top, so they get exactly what you typed.' : 'Off: the fee comes out of the amount, so they get a little less.'}
                                    </span>
                                </span>
                            </button>

                            {detectedNetwork && airtimeAmount !== '' && parseFloat(airtimeAmount) > 0 && (
                                <TotalPlate
                                    rows={[
                                        { label: 'Airtime value', value: formatCurrency(parseFloat(airtimeAmount)) },
                                        { label: `Fee (${(((airFee) / (useExact ? parseFloat(airtimeAmount) : parseFloat(airtimeAmount) - airFee)) * 100).toFixed(0)}%)`, value: `${useExact ? '+' : '–'} ${formatCurrency(airFee)}` },
                                        { label: 'They receive', value: formatCurrency(airtimeToReceive), strong: true },
                                    ]}
                                    totalLabel="You pay"
                                    total={formatCurrency(airTotal)}
                                />
                            )}

                            <PrimaryButton onClick={handleBuyAirtime} disabled={loading || !detectedNetwork || parseFloat(airtimeAmount || '0') <= 0}>
                                {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> One moment…</> : <><Smartphone className="h-5 w-5" /> Continue to payment</>}
                            </PrimaryButton>
                        </div>
                    </section>
                )}

                {/* ── Mashup ── */}
                {isShopMashupEnabled && activeTab === 'mashup' && (
                    <section className="animate-in fade-in duration-300 motion-reduce:animate-none">
                        <ServiceHeading icon={Zap} title="MTN Mashup" blurb="Data and talk time in one bundle, sent to any MTN number." />

                        <div className="space-y-6">
                            <div>
                                <FieldLabel htmlFor="mash-phone" hint="(MTN only)">Phone number</FieldLabel>
                                <input id="mash-phone" type="tel" inputMode="tel" value={mashupPhone} onChange={(e) => setMashupPhone(e.target.value)} placeholder="024 123 4567" className={FIELD} />
                            </div>

                            <div>
                                <FieldLabel>What should lean bigger?</FieldLabel>
                                <div role="radiogroup" aria-label="Bundle mix" className="grid grid-cols-2 gap-2.5">
                                    <Pill on={mashupBundle === 'data'} role="radio" aria-checked={mashupBundle === 'data'} onClick={() => setMashupBundle('data')}><Zap className="h-4 w-4" /> More data</Pill>
                                    <Pill on={mashupBundle === 'balanced'} role="radio" aria-checked={mashupBundle === 'balanced'} onClick={() => setMashupBundle('balanced')}><RefreshCw className="h-4 w-4" /> An even split</Pill>
                                </div>
                            </div>

                            <div>
                                <FieldLabel htmlFor="mash-amount">How much?</FieldLabel>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">GHS</span>
                                    <input id="mash-amount" type="number" inputMode="decimal" step="0.01" min={mashupMinAmount} max={mashupMaxAmount} value={mashupAmount} onChange={(e) => setMashupAmount(e.target.value)} placeholder="Amount" className={cn(FIELD, 'pl-16')} />
                                </div>
                                <p className="mt-2 px-1 text-xs text-muted-foreground">Between GHS {mashupMinAmount.toFixed(2)} and GHS {mashupMaxAmount.toFixed(2)}.</p>
                                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    {QUICK_AMOUNTS.filter(a => a <= 50).map(amt => (
                                        <Pill key={amt} on={mashupAmount === String(amt)} onClick={() => setMashupAmount(amt.toString())} className="shrink-0">GHS {amt}</Pill>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <FieldLabel htmlFor="mash-email" hint="(receipt, optional)">Email</FieldLabel>
                                <input id="mash-email" type="email" inputMode="email" value={mashupEmail} onChange={(e) => setMashupEmail(e.target.value)} placeholder="you@example.com" className={FIELD} />
                            </div>

                            {mashupAmount !== '' && parseFloat(mashupAmount) > 0 && (
                                <div className="space-y-3">
                                    {mashupBreakdown && (
                                        <div className="neu-inset grid grid-cols-2 divide-x divide-foreground/10 rounded-2xl py-3 text-center">
                                            <div className="px-3">
                                                <p className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"><Zap className="h-3 w-3" /> Data</p>
                                                <p className="mt-1 font-display text-lg font-bold text-foreground">{mashupBreakdown.data}</p>
                                            </div>
                                            <div className="px-3">
                                                <p className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"><Phone className="h-3 w-3" /> Talk time</p>
                                                <p className="mt-1 font-display text-lg font-bold text-foreground">{mashupBreakdown.voice}</p>
                                            </div>
                                            {!mashupBreakdown.exact && <p className="col-span-2 mt-2 text-xs text-muted-foreground">These are estimates. The final split may shift slightly.</p>}
                                        </div>
                                    )}
                                    <TotalPlate
                                        rows={[
                                            { label: 'Bundle value', value: formatCurrency(parseFloat(mashupAmount)) },
                                            { label: `Fee (${(((mashFee) / parseFloat(mashupAmount)) * 100).toFixed(0)}%)`, value: `+ ${formatCurrency(mashFee)}` },
                                        ]}
                                        totalLabel="You pay"
                                        total={formatCurrency(mashTotal)}
                                    />
                                </div>
                            )}

                            <PrimaryButton
                                onClick={handleBuyMashup}
                                disabled={loading || !mashupBundle || !mashupAmount || parseFloat(mashupAmount) < mashupMinAmount || parseFloat(mashupAmount) > mashupMaxAmount}
                            >
                                {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> One moment…</> : <><Zap className="h-5 w-5" /> Continue to payment</>}
                            </PrimaryButton>
                        </div>
                    </section>
                )}

                {/* ── Results Checker / Vouchers Tab Content ── */}
                {isRCEnabled && activeTab === 'vouchers' && (() => {
                    const selectedRCType = rcTypes.find(t => t.id === selectedRCTypeId)
                    let basePrice = selectedRCType ? selectedRCType.customer_price : 0
                    if (selectedRCType && Array.isArray(selectedRCType.bulk_pricing) && selectedRCType.bulk_pricing.length > 0) {
                        const tier = selectedRCType.bulk_pricing.find(t => rcQuantity >= t.min_qty && rcQuantity <= t.max_qty)
                        if (tier) basePrice = tier.unit_price
                    }
                    const unitPrice = selectedRCType ? basePrice + markupFor(selectedRCType.id) : 0
                    const adminMaxQty = parseInt(adminSettings['results_checker_max_quantity'] || '50', 10)
                    const allowBackorders = adminSettings['results_checker_allow_backorders'] === 'true'
                    const stockAvail = selectedRCType?.available_count
                    // Cap selectable quantity at on-hand stock so a guest can't pick more than exists
                    // and get declined AFTER paying — unless the admin allows backorders.
                    const maxQty = (!allowBackorders && typeof stockAvail === 'number' && stockAvail > 0)
                        ? Math.min(adminMaxQty, stockAvail)
                        : adminMaxQty
                    const feePercent = parseFloat(adminSettings['results_checker_paystack_fee_percent'] || '1.95')
                    const subtotal = parseFloat((unitPrice * rcQuantity).toFixed(2))
                    const paystackFee = parseFloat((subtotal * (feePercent / 100)).toFixed(2))
                    const total = parseFloat((subtotal + paystackFee).toFixed(2))

                    const handleBuyVouchers = async () => {
                        if (!selectedRCTypeId) { toast.error('Select a voucher type'); return }
                        const cleanPhone = rcPhone.replace(/\s+/g, '')
                        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) { toast.error('Enter a valid phone number'); return }
                        // Email is OPTIONAL — the voucher shows on screen and is texted. Only reject a
                        // non-empty value that is malformed.
                        const emailTrim = rcEmail.trim()
                        if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
                            toast.error('Enter a valid email or leave it blank — your voucher is shown on screen and texted.')
                            return
                        }
                        // Stock guard (mirrors the server's pre-charge check): block out-of-stock and
                        // over-ordering before charging, unless the admin allows backorders. Catches a
                        // stale quantity left over from a previously-selected, better-stocked type.
                        if (!allowBackorders && typeof stockAvail === 'number') {
                            if (stockAvail <= 0) { toast.error('This voucher is currently out of stock. Please check back soon.'); return }
                            if (rcQuantity > stockAvail) {
                                setRCQuantity(stockAvail)
                                toast.error(`Only ${stockAvail} in stock — quantity set to ${stockAvail}. Review the total and tap buy again.`)
                                return
                            }
                        }
                        setShowRCConfirmModal(false)
                        try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }

                        // Open the in-app MoMo charge sheet (no redirect). Exam type, quantity,
                        // delivery phone and email are already collected on the vouchers tab, so the
                        // sheet only collects the MoMo wallet. On success, reveal the PINs on screen.
                        const recipientEmail = rcEmail.trim()
                        const qty = rcQuantity
                        const typeName = selectedRCType?.name || 'Voucher'

                        // Server-authoritative total: the browser can't reproduce the cost-price
                        // floor / per-role markup cap, so ask the server for the exact amount it
                        // will charge and display THAT. Falls back to the local estimate on error.
                        let authoritativeTotal = total
                        try {
                            const bRes = await fetch('/api/shop/results-checker/breakdown', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ shopSlug: shop.shop_slug, typeId: selectedRCTypeId, quantity: qty }),
                            })
                            const bData = await bRes.json().catch(() => null)
                            if (bRes.ok && bData && typeof bData.total === 'number') authoritativeTotal = bData.total
                        } catch { /* keep local estimate */ }

                        setChargeDescriptor({
                            title: `${qty}× ${typeName}`,
                            amountLabel: formatCurrency(authoritativeTotal),
                            chargeUrl: '/api/shop/results-checker/charge',
                            statusUrl: '/api/shop/results-checker/charge/status',
                            beneficiary: null,
                            email: null,
                            successText: () => `Your voucher${qty > 1 ? 's are' : ' is'} ready — opening your PIN${qty > 1 ? 's' : ''}…`,
                            receivedText: () => `Payment received. Your PIN${qty > 1 ? 's are' : ' is'} being prepared and will be texted to ${cleanPhone}. You can also retrieve ${qty > 1 ? 'them' : 'it'} later using your reference.`,
                            buildBody: ({ momoPhone, provider }) => ({
                                shopSlug: shop.shop_slug, typeId: selectedRCTypeId, quantity: qty,
                                guestPhone: cleanPhone, guestEmail: recipientEmail || undefined,
                                momoPhone, momoProvider: provider,
                            }),
                            onPaid: (reference) => { setChargeOpen(false); revealVouchersByRef(reference) },
                        })
                        setChargeOpen(true)
                    }

                    return (
                        <section className="animate-in fade-in duration-300 motion-reduce:animate-none">
                            <ServiceHeading icon={GraduationCap} title="Exam results checker" blurb="Official WAEC checker PINs. Yours appears on screen and by SMS the moment you pay." />

                            <div className="space-y-6">
                                <Link href={rcRetrieveHref} className={cn('neu-raised-sm neu-press flex items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-sm', FOCUS)}>
                                    <span>
                                        <span className="block font-semibold text-foreground">Already bought one?</span>
                                        <span className="block text-xs text-muted-foreground">Get your PIN back with your reference.</span>
                                    </span>
                                    <span className="clay-black flex h-9 shrink-0 items-center rounded-full px-4 text-xs font-semibold">Find it</span>
                                </Link>

                                <div>
                                    <FieldLabel>Which exam?</FieldLabel>
                                    <div role="radiogroup" aria-label="Exam type" className="space-y-2.5">
                                        {rcTypes.map(t => {
                                            const isSelected = selectedRCTypeId === t.id
                                            const hasBulk = Array.isArray(t.bulk_pricing) && t.bulk_pricing.length > 0
                                            const waecUrl = t.name.includes('BECE') ? 'eresults.waecgh.org' : 'ghana.waecdirect.org'
                                            return (
                                                // Tap a selected type again to deselect it.
                                                <button key={t.id} type="button" role="radio" aria-checked={isSelected} onClick={() => setSelectedRCTypeId(prev => prev === t.id ? '' : t.id)}
                                                    className={cn('flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left', FOCUS, isSelected ? 'neu-inset ring-2 ring-[var(--shop-accent,#F6C30F)]' : 'neu-raised-sm neu-press')}>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block break-words text-sm font-semibold leading-snug text-foreground">{t.name}</span>
                                                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{waecUrl}{hasBulk ? ' · cheaper in bulk' : ''}</span>
                                                    </span>
                                                    <span className="font-display text-base font-bold tabular-nums text-foreground">{formatCurrency(t.customer_price + markupFor(t.id))}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <FieldLabel>How many?</FieldLabel>
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="px-1 text-xs text-muted-foreground">Up to {maxQty} per order</p>
                                        <div className="neu-inset flex items-center rounded-full p-1">
                                            <button type="button" aria-label="One fewer" onClick={() => setRCQuantity(q => Math.max(1, q - 1))} className={cn('neu-raised-sm neu-press flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold', FOCUS)}>–</button>
                                            <input type="number" aria-label="Quantity" placeholder="1" min={1} max={maxQty} value={rcQuantity}
                                                onChange={e => setRCQuantity(Math.max(1, Math.min(maxQty, parseInt(e.target.value) || 1)))}
                                                className="h-10 w-14 bg-transparent text-center text-base font-bold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                                            <button type="button" aria-label="One more" onClick={() => setRCQuantity(q => Math.min(maxQty, q + 1))} className={cn('neu-raised-sm neu-press flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold', FOCUS)}>+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <FieldLabel htmlFor="rc-phone" hint="(we text the PIN here)">Phone number</FieldLabel>
                                        <input id="rc-phone" type="tel" inputMode="tel" value={rcPhone} onChange={e => setRCPhone(e.target.value)} placeholder="024 123 4567" className={FIELD} />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="rc-email" hint="(a copy, optional)">Email</FieldLabel>
                                        <input id="rc-email" type="email" inputMode="email" value={rcEmail} onChange={e => setRCEmail(e.target.value)} placeholder="you@example.com" className={FIELD} />
                                    </div>
                                </div>

                                {selectedRCType && (() => {
                                    const bulkTiers = Array.isArray(selectedRCType.bulk_pricing) ? selectedRCType.bulk_pricing : []
                                    const sortedTiers = [...bulkTiers].sort((a, b) => a.min_qty - b.min_qty)
                                    const activeTier = bulkTiers.find(t => rcQuantity >= t.min_qty && rcQuantity <= t.max_qty)
                                    return (
                                        <div className="space-y-4">
                                            {sortedTiers.length > 0 && (
                                                <div className="neu-inset rounded-2xl p-4">
                                                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><TrendingUp className="h-4 w-4" aria-hidden="true" /> Buy more, pay less each</p>
                                                    <ul className="mt-3 space-y-1.5">
                                                        {sortedTiers.map((tier, i) => {
                                                            const isActive = !!activeTier && tier.min_qty === activeTier.min_qty && tier.max_qty === activeTier.max_qty
                                                            return (
                                                                <li key={i} className={cn('flex items-center justify-between gap-2 rounded-full px-3 py-1.5 text-sm', isActive ? 'clay-gold font-semibold' : 'text-muted-foreground')}>
                                                                    <span>{tier.min_qty}–{tier.max_qty} vouchers</span>
                                                                    <span className="tabular-nums">{formatCurrency(tier.unit_price + markupFor(selectedRCType.id))} each</span>
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                            <TotalPlate
                                                rows={[
                                                    { label: selectedRCType.name, value: `× ${rcQuantity}`, strong: true },
                                                    { label: 'Subtotal', value: formatCurrency(subtotal) },
                                                    { label: `Card fee (${feePercent}%)`, value: formatCurrency(paystackFee) },
                                                ]}
                                                totalLabel="You pay"
                                                total={formatCurrency(total)}
                                            />
                                        </div>
                                    )
                                })()}

                                <PrimaryButton onClick={() => setShowRCConfirmModal(true)} disabled={loading || !selectedRCTypeId}>
                                    <Lock className="h-4 w-4" /> Review my order
                                </PrimaryButton>
                                <p className="-mt-3 text-center text-xs text-muted-foreground">No account needed.</p>
                            </div>

                            <Dialog open={showRCConfirmModal} onOpenChange={setShowRCConfirmModal}>
                                <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-[2rem] border-none bg-neu p-0 shadow-2xl">
                                    <DialogHeader className="sr-only">
                                        <DialogTitle>Confirm storefront results checker order</DialogTitle>
                                        <DialogDescription>
                                            Review the exam type, quantity, delivery phone number, email address, and payment total before continuing.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="bg-black px-7 pb-6 pt-8 text-white">
                                        <h3 className="font-display text-2xl font-bold tracking-tight">Look right?</h3>
                                        <p className="mt-2 text-sm leading-relaxed text-silver-200">
                                            Your PIN{rcQuantity > 1 ? 's go' : ' goes'} to <span className="font-semibold text-white">{rcPhone}</span>{rcEmail.trim() ? <> and <span className="font-semibold text-white">{rcEmail.trim()}</span></> : null}.
                                        </p>
                                    </div>
                                    <div className="space-y-5 p-7">
                                        <dl className="space-y-3 text-sm">
                                            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Exam</dt><dd className="text-right font-semibold text-foreground">{selectedRCType?.name}</dd></div>
                                            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Quantity</dt><dd className="font-semibold text-foreground">{rcQuantity}</dd></div>
                                            <div className="flex items-baseline justify-between gap-4 border-t border-foreground/10 pt-3"><dt className="font-semibold text-foreground">Total</dt><dd className="font-display text-2xl font-bold tabular-nums text-foreground">{formatCurrency(total)}</dd></div>
                                        </dl>
                                        <div className="flex gap-3">
                                            <button type="button" className={cn('neu-raised-sm neu-press h-12 flex-1 rounded-full text-sm font-semibold text-foreground', FOCUS)} onClick={() => setShowRCConfirmModal(false)}>Go back</button>
                                            <button type="button" className={cn('clay-gold flex h-12 flex-1 items-center justify-center rounded-full text-sm font-semibold disabled:opacity-60', FOCUS)} onClick={handleBuyVouchers} disabled={loading}>
                                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay now'}
                                            </button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </section>
                    )
                })()}

                {/* ── Data Packages Tab Content ── */}
                {activeTab === 'data' && (
                    <StorefrontDataTab shopSlug={shop.shop_slug} packages={packages} oosNetworks={oosNetworks} brandName={shop.shop_name} />
                )}

                {/* ── Utility Bills Tab Content ── */}
                {utilitiesEnabled && activeTab === 'utilities' && (
                    <StorefrontUtilitiesTab
                        shopSlug={shop.shop_slug}
                        enabledBillers={enabledUtilityBillers}
                        minAmount={utilityMinAmount}
                        maxAmount={utilityMaxAmount}
                        onProceedToPayment={(descriptor) => { setChargeDescriptor(descriptor); setChargeOpen(true) }}
                    />
                )}

                {/* ── AFA ── */}
                {isShopAfaEnabled && activeTab === 'afa' && (
                    <section className="animate-in fade-in duration-300 motion-reduce:animate-none">
                        <ServiceHeading icon={IdCard} title="Register your AFA SIM" blurb="Link your SIM to your Ghana Card details. It takes a couple of minutes." />
                        <AfaRegistrationForm shopSlug={shop.shop_slug} displayPrice={afaDisplayPrice} onSubmitDetails={handleAfaSubmit} />
                    </section>
                )}
            </StorefrontShell>

            {/* ── Notice from the shop ── */}
            {announcement && showAnnouncementModal && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={announcement.title || 'A notice from this shop'}>
                    {/* No dismiss on backdrop click: the notice has to be read */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none" />
                    <div className="relative w-full overflow-hidden rounded-t-[2rem] bg-neu shadow-[0_-18px_40px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom fade-in duration-300 motion-reduce:animate-none sm:mx-4 sm:max-w-md sm:rounded-[2rem]">
                        <div className="relative bg-black px-7 pb-6 pt-7 text-white">
                            <BrandSwoosh className="pointer-events-none absolute -bottom-4 -right-1/3 w-full opacity-70" />
                            <span className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-400">
                                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                                {announcement.type === 'admin' ? 'From the Capozy team' : `From ${shop.shop_name}`}
                            </span>
                            <h3 className="relative mt-3 font-display text-2xl font-bold leading-tight tracking-tight">
                                {announcement.title || 'A quick update'}
                            </h3>
                        </div>

                        <div className="max-h-[38vh] overflow-y-auto px-7 py-5 sm:max-h-[45vh]">
                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{announcement.message}</p>
                            <AnnouncementCTAButtons row={announcement} variant="modal" className="mt-5" />
                        </div>

                        <div className="px-7 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-2 sm:pb-7">
                            <button
                                type="button"
                                onClick={handleDismissAnnouncement}
                                disabled={announcementCountdown > 0}
                                className={cn('flex min-h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-full text-base font-semibold', FOCUS, announcementCountdown > 0 ? 'neu-inset text-muted-foreground' : 'clay-gold')}
                            >
                                {announcementCountdown > 0 ? (
                                    <>
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current text-xs font-semibold tabular-nums">{announcementCountdown}</span>
                                        Have a read first
                                    </>
                                ) : 'Got it'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Voucher delivered ── */}
            {showRCSuccess && rcSuccessData && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Your voucher">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in motion-reduce:animate-none" onClick={() => setShowRCSuccess(false)} />
                    <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-neu animate-in slide-in-from-bottom fade-in duration-300 motion-reduce:animate-none sm:max-w-sm sm:rounded-[2rem]">
                        <div className="flex flex-col items-center bg-black px-7 pb-6 pt-8 text-center text-white">
                            <span className="clay-gold flex h-14 w-14 items-center justify-center rounded-full">
                                {rcSuccessData.order.status === 'completed' ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
                            </span>
                            <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight">
                                {rcSuccessData.order.status === 'completed' ? 'Your voucher is ready' : 'We have your payment'}
                            </h3>
                            <p className="mt-1 text-sm text-silver-200">{rcSuccessData.order.quantity} × {rcSuccessData.order.type_name}</p>
                            <p className="mt-3 text-xs text-silver-200">Reference <span className="font-mono text-white">{rcSuccessData.order.reference_code}</span></p>
                        </div>

                        <div className="space-y-4 p-6">
                            {rcSuccessData.order.status === 'completed' ? (
                                <>
                                    <ul className="space-y-3">
                                        {rcSuccessData.vouchers.map((v: any, i: number) => {
                                            const isRevealed = revealedRCPins.has(v.pin)
                                            return (
                                                <li key={i} className="neu-inset space-y-3 rounded-2xl p-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-foreground">Voucher {i + 1}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(`Serial: ${v.serial_number}\nPIN: ${v.pin}`)
                                                                toast.success('Copied')
                                                            }}
                                                            className={cn('neu-raised-sm neu-press h-8 rounded-full px-3 text-xs font-semibold text-foreground', FOCUS)}
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Serial <span className="ml-1 font-mono text-sm text-foreground">{v.serial_number}</span></p>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRCPinReveal(v.pin)}
                                                        aria-label={isRevealed ? 'Hide PIN' : 'Show PIN'}
                                                        className={cn('neu-raised-sm flex min-h-[2.75rem] w-full items-center justify-between rounded-full px-4', FOCUS)}
                                                    >
                                                        <span className={cn('font-mono text-base font-bold tracking-wider', isRevealed ? 'text-foreground' : 'select-none text-muted-foreground blur-[3px]')}>
                                                            {isRevealed ? v.pin : '••••••••••'}
                                                        </span>
                                                        {isRevealed ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                    <p className="text-center text-xs leading-relaxed text-muted-foreground">Tap a PIN to show it. Save the receipt before you close this.</p>
                                </>
                            ) : (
                                <p className="text-center text-sm leading-relaxed text-muted-foreground">Your payment is in. We are preparing the voucher and will text it to you shortly.</p>
                            )}

                            {rcSuccessData.order.status === 'completed' && rcSuccessData.vouchers.length > 0 && (
                                <div className="space-y-2.5">
                                    <PrimaryButton
                                        onClick={() => downloadResultsCheckerVouchers(
                                            rcSuccessData.order,
                                            rcSuccessData.vouchers,
                                            localStorage.getItem('shop_last_phone') || rcSuccessData.order.customer_phone || '',
                                            rcSuccessData.order.customer_email || '',
                                            shop.shop_name
                                        )}
                                    >
                                        <Download className="h-4 w-4" /> Save receipt
                                    </PrimaryButton>
                                    <Link
                                        href={`${rcRetrieveHref}?reference=${encodeURIComponent(rcSuccessData.order.reference_code)}`}
                                        className={cn('neu-raised-sm neu-press flex min-h-[3rem] w-full items-center justify-center rounded-full text-sm font-semibold text-foreground', FOCUS)}
                                    >
                                        Open the retrieve page
                                    </Link>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => { setShowRCSuccess(false); router.replace(window.location.pathname) }}
                                className={cn('w-full rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground', FOCUS)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Order alerts opt-in ── */}
            {showPushOptIn && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Order alerts">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none" onClick={() => setShowPushOptIn(false)} />
                    <div className="relative w-full overflow-hidden rounded-t-[2rem] bg-neu shadow-[0_-18px_40px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom fade-in duration-300 motion-reduce:animate-none sm:mx-4 sm:max-w-md sm:rounded-[2rem]">
                        <div className="relative bg-black px-7 pb-6 pt-7 text-white">
                            <BrandSwoosh className="pointer-events-none absolute -bottom-4 -right-1/3 w-full opacity-70" />
                            <span className="clay-gold relative flex h-12 w-12 items-center justify-center rounded-full"><BellPlus className="h-5 w-5" aria-hidden="true" /></span>
                            <h3 className="relative mt-4 font-display text-2xl font-bold leading-tight tracking-tight">Want a ping when something happens?</h3>
                            <p className="relative mt-2 text-sm leading-relaxed text-silver-200">
                                We will alert this device when <span className="font-semibold text-white">{shop.shop_name}</span> posts a notice or an offer.
                            </p>
                        </div>

                        <div className="space-y-2.5 px-7 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-6 sm:pb-7">
                            <PrimaryButton onClick={handleGuestSubscribe} disabled={isSubscribing}>
                                {isSubscribing ? <><Loader2 className="h-4 w-4 animate-spin" /> Turning on…</> : <><BellPlus className="h-4 w-4" /> Turn on alerts</>}
                            </PrimaryButton>
                            <button type="button" onClick={() => setShowPushOptIn(false)} className={cn('w-full rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground', FOCUS)}>
                                Not now
                            </button>
                            <p className="pt-1 text-center text-xs text-muted-foreground">You can switch them off any time in your browser settings.</p>
                        </div>
                    </div>
                </div>
            )}

            <CopyrightFooter
                variant="shop"
                shopName={shop.shop_name}
                adminSettings={adminSettings}
                className="pb-20 pt-10" // Extra padding to stay clear of floating buttons
            />
        </div>
    )
}
