'use client'

import { useEffect, useState } from 'react'
import { BRAND } from '@/lib/brand'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { resolveAfaPrice } from '@/lib/afa-pricing'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    Tag, Save, Loader2, TrendingUp, AlertCircle, CheckCircle2,
    Clock, XCircle, Send, ArrowLeft, Sparkles, PhoneCall, Zap,
    Copy, Check, ExternalLink, PartyPopper, Lightbulb, MessageCircle,
    IdCard, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { filterPackagesForSubAgent, SubAgentPricingMap } from '@/lib/sub-agent-package-filter'

interface Package {
    id: string
    network: string
    size: string
    /** The public customer price. */
    price: number
    /** What THIS member pays for the bundle, resolved on the server from their role and expiry. */
    your_price: number
    is_available: boolean
    sort_order: number
}

interface ExamType {
    id: string
    name: string
    customer_price: number
    agent_price: number
    bulk_pricing?: { min_qty: number; max_qty: number; unit_price: number }[]
}

interface ShopProfile {
    id: string
    shop_name: string
    shop_slug: string
    owner_role: string
    approval_status: string
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
    pricing_note: string | null
    pricing_rejection_acknowledged: boolean
    airtime_fee_mtn?: number
    airtime_fee_telecel?: number
    airtime_fee_at?: number
    results_checker_markup_customer?: number
    results_checker_markup_agent?: number
    mashup_fee_percent?: number
    afa_selling_price?: number
    oos_networks?: string[]
}

// Telco brand colours are kept on purpose: people recognise their network at a glance.
const NETWORK_DOT: Record<string, string> = {
    MTN: 'bg-yellow-400',
    Telecel: 'bg-red-500',
    'AT-iShare': 'bg-blue-600',
    'AT-BigTime': 'bg-blue-800',
    AT: 'bg-blue-600',
}

const round2 = (n: number) => Math.round(n * 100) / 100

const FIELD = 'h-11 border-0 bg-transparent px-3 text-base font-semibold shadow-none placeholder:font-normal placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-0'
const CLAY_GOLD = 'clay-gold inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold disabled:opacity-60'
const CLAY_BLACK = 'clay-black inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold disabled:opacity-60'

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div className="neu-inset flex items-start gap-3 rounded-2xl p-4 text-xs leading-relaxed text-muted-foreground">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" />
            <p>{children}</p>
        </div>
    )
}

function Prefixed({ prefix, suffix, invalid, valid, children }: { prefix?: string; suffix?: string; invalid?: boolean; valid?: boolean; children: React.ReactNode }) {
    return (
        <div className={cn('well relative flex items-center rounded-xl', invalid && 'ring-2 ring-red-500/70', valid && 'ring-2 ring-emerald-500/50')}>
            {prefix && <span className="pointer-events-none pl-3 text-[11px] font-semibold text-muted-foreground">{prefix}</span>}
            {children}
            {suffix && <span className="pointer-events-none pr-3 text-xs font-semibold text-muted-foreground">{suffix}</span>}
        </div>
    )
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const AIRTIME_NETWORKS = ['MTN', 'Telecel', 'AT']

type Section = 'data' | 'airtime' | 'rc' | 'mashup' | 'afa'
type BulkMode = 'flat' | 'percent'

const SECTIONS: { id: Section; label: string; icon: any }[] = [
    { id: 'data', label: 'Data Bundles', icon: Tag },
    { id: 'airtime', label: 'Airtime', icon: PhoneCall },
    { id: 'rc', label: 'Results Checker', icon: Sparkles },
    { id: 'mashup', label: 'Mashup', icon: Zap },
    { id: 'afa', label: 'AFA Registration', icon: IdCard },
]

export default function ShopPricingPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const [shop, setShop] = useState<ShopProfile | null>(null)
    const [packages, setPackages] = useState<Package[]>([])
    const [examTypes, setExamTypes] = useState<ExamType[]>([])
    const [pricing, setPricing] = useState<Record<string, string>>({})
    const [airtimeFees, setAirtimeFees] = useState({ mtn: '', telecel: '', at: '' })
    const [rcMarkups, setRcMarkups] = useState<Record<string, string>>({})
    const [mashupFee, setMashupFee] = useState('')
    const [mashupMaxProfit, setMashupMaxProfit] = useState<number>(0) // 0 = no limit
    const [afaSellingPrice, setAfaSellingPrice] = useState('')
    const [afaCost, setAfaCost] = useState<number>(0) // resolveAfaPrice(role) — what we charge the shop owner
    const [afaMaxProfit, setAfaMaxProfit] = useState<number>(0) // 0 = no limit, GHS profit ceiling
    const [adminAirtimeFees, setAdminAirtimeFees] = useState<Record<string, number>>({})
    const [dataMaxProfit, setDataMaxProfit] = useState<number>(Infinity) // no limit until settings load

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [saving, setSaving] = useState(false)
    const [savingSection, setSavingSection] = useState<Section | null>(null)
    const [savingPkg, setSavingPkg] = useState<string | null>(null)
    const [acknowledging, setAcknowledging] = useState(false)
    const [activeSection, setActiveSection] = useState<Section>('data')
    const [activeNetwork, setActiveNetwork] = useState<string>('MTN')
    // Data-bundle pricing has two ways in: the per-package Manual grid (default)
    // and the Bulk rule builder.
    const [pricingMode, setPricingMode] = useState<'manual' | 'bulk'>('manual')

    // Per-network out-of-stock state
    const [shopOOS, setShopOOS] = useState<string[]>([])
    const [adminOOS, setAdminOOS] = useState<Record<string, boolean>>({})
    const [oosSaving, setOosSaving] = useState<string | null>(null)

    // Bulk apply state
    const [bulkMode, setBulkMode] = useState<BulkMode>('flat')
    const [bulkValue, setBulkValue] = useState<string>('5')
    const [bulkApplyTarget, setBulkApplyTarget] = useState<string>('MTN')
    // Packages the owner has explicitly unticked in the bulk preview. Rows that
    // fail a policy check (below cost / over the profit cap) are excluded
    // automatically and are NOT tracked here — they can't be ticked back on.
    const [bulkExcludedIds, setBulkExcludedIds] = useState<Set<string>>(new Set())

    // Completion / go-live celebration modal
    const [showLiveModal, setShowLiveModal] = useState(false)
    const [copied, setCopied] = useState(false)
    const [fromSetup, setFromSetup] = useState(false)

    useEffect(() => {
        // Read ?from=setup without useSearchParams (avoids Suspense bailout)
        if (typeof window !== 'undefined') {
            setFromSetup(new URLSearchParams(window.location.search).get('from') === 'setup')
        }
    }, [])

    useEffect(() => {
        if (dbUser?.id) fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser?.id])

    // Exclusions are per-network/per-mode — a package unticked for MTN must not
    // stay unticked when the owner switches to Telecel.
    useEffect(() => {
        setBulkExcludedIds(new Set())
    }, [bulkApplyTarget, bulkMode])

    const fetchData = async () => {
        setLoadError(false)
        try {
            const { data: shopData, error: shopError } = await ((supabase as any)
                .from('shop_profiles')
                .select('id, shop_name, shop_slug, owner_id, approval_status, pricing_status, pricing_note, pricing_rejection_acknowledged, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at, results_checker_markup_customer, results_checker_markup_agent, mashup_fee_percent, afa_selling_price, oos_networks')
                .eq('owner_id', dbUser!.id)
                .maybeSingle())

            if (shopError) throw shopError

            if (shopData && shopData.owner_id) {
                const { data: uData } = await (supabase as any).from('users').select('role').eq('id', shopData.owner_id).single()
                shopData.owner_role = uData?.role || 'customer'
            }

            if (!shopData) {
                toast.error('Please create your shop first')
                router.push('/dashboard/shop/setup')
                return
            }
            setShop(shopData)
            setShopOOS(shopData.oos_networks || [])

            setAirtimeFees({
                mtn: shopData.airtime_fee_mtn?.toString() || '',
                telecel: shopData.airtime_fee_telecel?.toString() || '',
                at: shopData.airtime_fee_at?.toString() || ''
            })

            setMashupFee(shopData.mashup_fee_percent?.toString() || '')
            // afa_selling_price null/absent means AFA is off for this shop — '' clears
            // the input, matching how a cleared save writes NULL server-side.
            setAfaSellingPrice(shopData.afa_selling_price?.toString() ?? '')

            const [pkgRes, priceRes, adminRes, examRes, markupRes] = await Promise.all([
                // Tier prices and supplier cost are server-only; this returns just the member's own price.
                fetch('/api/dashboard/packages', { cache: 'no-store' })
                    .then(res => (res.ok ? res.json() : { packages: [] }))
                    .then(j => ({ data: (j?.packages ?? []).map((p: any) => ({ ...p, is_available: true })) }))
                    .catch(() => ({ data: [] })),
                // Explicit column list (not '*'): sub_price SELECT is revoked from the
                // authenticated role (migration 20260706g), so '*' would 500 here.
                ((supabase as any).from('shop_pricing').select('id, shop_id, package_id, selling_price, profit_margin, last_auto_updated_at').eq('shop_id', shopData.id)),
                fetch('/api/shop/pricing').then(res => res.json()),
                (supabase.from('results_checker_types').select('*').eq('is_active', true).order('display_order') as any),
                ((supabase as any).from('shop_rc_markups').select('exam_type_id, markup').eq('shop_id', shopData.id)),
            ])

            setPackages(pkgRes.data || [])
            setExamTypes(examRes.data || [])

            const adminFlags: Record<string, number> = {}
            for (const [key, value] of Object.entries(adminRes || {})) {
                adminFlags[key] = parseFloat(value as string) || 0
            }
            setAdminAirtimeFees(adminFlags)

            // AFA cost for this owner's role, resolved via the shared tiering helper —
            // never re-implement the customer/agent/dealer fallback logic here.
            // Sub-agents are excluded: the dedicated /api/user/afa-price effect below
            // is the sole source of truth for their real (markup-adjusted) cost, and
            // this fetchData() Promise.all is reliably the slower of the two async
            // calls — letting this tiered fallback run for sub-agents would race it
            // and overwrite the correct value with the plain customer-tier price.
            if (shopData.owner_role !== 'subagent') {
                setAfaCost(resolveAfaPrice(adminRes || {}, shopData.owner_role) || 0)
            }

            // Per-exam markups; fall back to legacy single markup for unset exams
            const markupMap: Record<string, string> = {}
            const legacy = shopData.results_checker_markup_customer
            for (const exam of (examRes.data || [])) {
                markupMap[exam.id] = legacy != null && legacy > 0 ? String(legacy) : ''
            }
            for (const row of (markupRes.data || [])) {
                markupMap[row.exam_type_id] = String(row.markup)
            }
            setRcMarkups(markupMap)

            // Fetch configurable profit caps from global settings
            const { data: globalRows } = await (supabase as any)
                .from('shop_global_settings')
                .select('key, value')
                .in('key', [
                    'data_profit_max_customer', 'data_profit_max_agent', 'data_profit_max_dealer',
                    'mashup_shop_fee_max_customer', 'mashup_shop_fee_max_agent', 'mashup_shop_fee_max_dealer',
                    'afa_shop_fee_max_customer', 'afa_shop_fee_max_agent', 'afa_shop_fee_max_dealer'
                ])
            if (globalRows) {
                const role = shopData.owner_role || 'customer'

                const dataRow = (globalRows as any[]).find((r: any) => r.key === `data_profit_max_${role}`)
                if (dataRow) {
                    const parsed = parseFloat(dataRow.value)
                    setDataMaxProfit(parsed > 0 ? parsed : Infinity)
                } else {
                    setDataMaxProfit(Infinity)
                }

                const mashupRow = (globalRows as any[]).find((r: any) => r.key === `mashup_shop_fee_max_${role}`)
                if (mashupRow) {
                    setMashupMaxProfit(parseFloat(mashupRow.value) || 0)
                } else {
                    setMashupMaxProfit(0)
                }

                const afaRow = (globalRows as any[]).find((r: any) => r.key === `afa_shop_fee_max_${role}`)
                setAfaMaxProfit(afaRow ? (parseFloat(afaRow.value) || 0) : 0)
            }

            const priceMap: Record<string, string> = {}
            for (const row of (priceRes.data || [])) {
                priceMap[row.package_id] = String(row.selling_price)
            }
            setPricing(priceMap)
        } catch (err) {
            // Without this the page used to render as "awaiting approval" on a plain network failure.
            console.error(err)
            setLoadError(true)
        } finally {
            setLoading(false)
        }
    }

    // ─── Admin OOS loader ─────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/admin-settings?keys=data_network_stock', { cache: 'no-store' })
            .then(r => r.json())
            .then(j => setAdminOOS((j?.data_network_stock as Record<string, boolean>) || {}))
            .catch(() => {})
    }, [])

    // ─── Sub-agent's own resolved cost, per network ────────────────────────────
    // A sub-agent's real "your cost" floor is the recruiter-marked-up
    // resolveSubAgentDataCost() value, not plain customer/agent/dealer pricing.
    // Mirrors the exact fetch pattern in app/dashboard/data-packages/page.tsx:
    // fail-closed to {} on any fetch error (never assume a package is
    // configured), re-fetched whenever the active network changes. Completely
    // inert for every other role: isSubAgentOwner is false, the fetch never
    // runs, and subAgentCostMap stays {} (harmless no-op below).
    const isSubAgentOwner = dbUser?.role === 'subagent'
    const [subAgentCostMap, setSubAgentCostMap] = useState<SubAgentPricingMap>({})

    useEffect(() => {
        if (!isSubAgentOwner) return
        let cancelled = false
        fetch(`/api/dashboard/subagents/my-pricing?network=${encodeURIComponent(activeNetwork)}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(j => {
                if (cancelled) return
                setSubAgentCostMap(j?.success && j.data ? j.data : {})
            })
            .catch(() => { if (!cancelled) setSubAgentCostMap({}) }) // fail closed — never a fabricated cost
        return () => { cancelled = true }
    }, [isSubAgentOwner, activeNetwork])

    // ─── Sub-agent's own resolved RC cost, per exam type ───────────────────────
    // Mirrors the data-package pattern above exactly: GET /api/results-checker/types
    // is already sub-agent-aware (Plan 4 Task 9) and returns the caller's own real
    // cost per type via `price`, with `configured` telling us whether that cost is
    // even usable. Absent-from-map or `configured !== true` both mean "not
    // purchasable for this sub" and must never fall back to a fabricated 0 or the
    // plain customer/agent tier price. Inert for every other role.
    const [rcSubAgentPricing, setRcSubAgentPricing] = useState<Record<string, { price: number; configured: boolean }>>({})

    useEffect(() => {
        if (!isSubAgentOwner) return
        let cancelled = false
        fetch('/api/results-checker/types', { cache: 'no-store' })
            .then(r => r.json())
            .then(j => {
                if (cancelled) return
                const map: Record<string, { price: number; configured: boolean }> = {}
                for (const t of (j?.types || [])) {
                    map[t.id] = { price: typeof t.price === 'number' ? t.price : 0, configured: t.configured === true }
                }
                setRcSubAgentPricing(map)
            })
            .catch(() => { if (!cancelled) setRcSubAgentPricing({}) }) // fail closed — empty map means nothing configured
        return () => { cancelled = true }
    }, [isSubAgentOwner])

    // ─── Sub-agent's own resolved AFA cost ─────────────────────────────────────
    // Mirrors the same pattern: GET /api/user/afa-price is already sub-agent-aware
    // (Plan 4 Task 8) and returns the caller's own real AFA cost via `price` when
    // `configured === true`. On any fetch failure or `configured === false`, AFA
    // must render as unavailable for this owner — never a fabricated 0 used as a
    // real cost floor. Inert for every other role (afaCost keeps its
    // resolveAfaPrice(role)-derived value from fetchData above).
    const [afaConfigured, setAfaConfigured] = useState(true)

    useEffect(() => {
        if (!isSubAgentOwner) return
        let cancelled = false
        fetch('/api/user/afa-price', { cache: 'no-store' })
            .then(r => r.json())
            .then(j => {
                if (cancelled) return
                if (j?.configured === true && typeof j.price === 'number') {
                    setAfaCost(j.price)
                    setAfaConfigured(true)
                } else {
                    setAfaConfigured(false)
                }
            })
            .catch(() => { if (!cancelled) setAfaConfigured(false) }) // fail closed — never assume priceable
        return () => { cancelled = true }
    }, [isSubAgentOwner])

    // ─── Network stock toggle ─────────────────────────────────────────────────
    const toggleShopNetworkStock = async (network: string, outOfStock: boolean) => {
        if (adminOOS[network]) return // locked: admin disabled it platform-wide
        setOosSaving(network)
        // Optimistic update
        setShopOOS(prev => outOfStock ? [...new Set([...prev, network])] : prev.filter(n => n !== network))
        try {
            const res = await fetch('/api/shop/network-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ network, outOfStock }),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error || 'Failed')
            setShopOOS(json.oosNetworks || [])
            toast.success(`${network} ${outOfStock ? 'marked Out of Stock' : 'back In Stock'} on your store`)
        } catch (e: any) {
            // Revert on failure
            setShopOOS(prev => outOfStock ? prev.filter(n => n !== network) : [...new Set([...prev, network])])
            toast.error(e.message || 'Failed to update')
        } finally {
            setOosSaving(null)
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const getCostPrice = (pkg: Package) => {
        if (dbUser?.role === 'subagent') {
            const resolved = subAgentCostMap[pkg.id]
            return resolved?.configured ? resolved.subPrice : pkg.price // fail closed to the plain customer price, never a fabricated 0
                                                                          // (note: the price ceiling is temporarily disabled -- see the
                                                                          // marker in lib/pricing/sub-agent-cost.ts -- so this is no
                                                                          // longer guaranteed to be the highest possible reference)
        }
        return pkg.your_price
    }

    const getProfit = (pkg: Package, sellingStr: string) => {
        const selling = parseFloat(sellingStr)
        if (isNaN(selling)) return null
        // Rounded to the pesewa: 12.30 - 10.10 is 2.2000000000000006 in floating point,
        // which wrongly failed a "max profit 2.20" check for a perfectly valid price.
        return round2(selling - getCostPrice(pkg))
    }

    const isValidPrice = (pkg: Package, sellingStr: string) => {
        const profit = getProfit(pkg, sellingStr)
        if (profit === null) return null
        const maxProfit = isFinite(dataMaxProfit) ? dataMaxProfit : 999
        return profit > 0 && profit <= maxProfit
    }

    const getMaxAirtimeProfit = (networkStr: string) => {
        const role = shop?.owner_role || 'customer'
        const key = `airtime_fee_${networkStr.toLowerCase()}_${role}`
        const adminFee = adminAirtimeFees[key] || 0
        return Math.max(0, 10 - adminFee)
    }

    const rcMaxMarkup = parseFloat(String(adminAirtimeFees['results_checker_max_markup_customer'] || '0'))

    // Parse data volume from size string (e.g. "1GB" → 1, "500MB" → 0.5, "1.5GB" → 1.5)
    const parseVolumeGB = (size: string): number | null => {
        const mb = size.match(/^([\d.]+)\s*MB$/i)
        if (mb) return parseFloat(mb[1]) / 1000
        const gb = size.match(/^([\d.]+)\s*GB$/i)
        if (gb) return parseFloat(gb[1])
        return null
    }

    const shopUrl = shop ? `https://${BRAND.shopHost}/${shop.shop_slug}` : ''

    const copyLink = async () => {
        await navigator.clipboard.writeText(shopUrl)
        setCopied(true)
        toast.success('Shop link copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    // ─── Validation helpers ───────────────────────────────────────────────────
    const validateAirtime = (): boolean => {
        for (const net of ['mtn', 'telecel', 'at']) {
            const max = getMaxAirtimeProfit(net)
            const val = parseFloat(airtimeFees[net as keyof typeof airtimeFees] || '0')
            if (val < 0) {
                toast.error(`${net.toUpperCase()} airtime profit cannot be negative`)
                return false
            }
            if (val > max) {
                toast.error(`${net.toUpperCase()} airtime profit exceeds maximum of ${max.toFixed(2)}%`)
                return false
            }
        }
        return true
    }

    const validateData = (): boolean => {
        const maxDataProfitCap = isFinite(dataMaxProfit) ? dataMaxProfit : null
        let invalidReason = ''
        const invalid = packages.filter(pkg => {
            const val = pricing[pkg.id]
            if (!val || parseFloat(val) <= 0) return false
            const profit = getProfit(pkg, val)
            if (profit === null) return false
            if (profit <= 0) { invalidReason = 'Profit must be more than 0'; return true }
            if (maxDataProfitCap !== null && profit > maxDataProfitCap) {
                invalidReason = `Profit cannot exceed GHS ${maxDataProfitCap.toFixed(2)}`
                return true
            }
            return false
        })
        if (invalid.length > 0) {
            toast.error(`${invalidReason} for: ${invalid.map(p => `${p.network} ${p.size}`).join(', ')}`)
            return false
        }
        return true
    }

    const buildDataRows = () => packages
        .filter(pkg => pricing[pkg.id] && parseFloat(pricing[pkg.id]) > 0)
        .map(pkg => ({
            shop_id: shop!.id,
            package_id: pkg.id,
            profit_margin: getProfit(pkg, pricing[pkg.id]),
            selling_price: parseFloat(pricing[pkg.id])
        }))

    const buildRcMarkupRows = () => examTypes
        .filter(e => rcMarkups[e.id] !== undefined && rcMarkups[e.id] !== '')
        .map(e => ({ exam_type_id: e.id, markup: parseFloat(rcMarkups[e.id]) || 0 }))

    const postPricing = async (payload: Record<string, any>) => {
        const res = await fetch('/api/shop/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopId: shop!.id, ...payload })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to save pricing')
        return data
    }

    const markLive = () => {
        const wasLive = shop?.pricing_status === 'approved'
        setShop(prev => prev ? { ...prev, pricing_status: 'approved', approval_status: 'approved' } : null)
        if (!wasLive || fromSetup) {
            setShowLiveModal(true)
            setFromSetup(false)
        }
    }

    // ─── Per-section saves ────────────────────────────────────────────────────
    const handleSaveSection = async (section: Section) => {
        if (!shop) return
        setSavingSection(section)
        try {
            if (section === 'data') {
                if (!validateData()) return
                const rows = buildDataRows()
                if (rows.length === 0) { toast.error('Set at least one bundle price first'); return }
                await postPricing({ items: rows })
                toast.success('Data bundle prices saved!')
                markLive()
            } else if (section === 'airtime') {
                if (!validateAirtime()) return
                await postPricing({ airtimeFees })
                toast.success('Airtime profit settings live!')
            } else if (section === 'rc') {
                const rcRows = buildRcMarkupRows()
                if (rcRows.some(r => r.markup < 0)) { toast.error('Voucher profit cannot be negative'); return }
                await postPricing({ rcMarkups: rcRows })
                toast.success('Exam markups saved!')
            } else if (section === 'mashup') {
                if (parseFloat(mashupFee) < 0) { toast.error('Mashup profit cannot be negative'); return }
                await postPricing({ mashupFee: mashupFee || '0' })
                toast.success('Mashup profit saved!')
            } else if (section === 'afa') {
                if (afaSellingPrice !== '') {
                    const profit = parseFloat(afaSellingPrice) - afaCost
                    if (isNaN(profit) || profit <= 0) {
                        toast.error(`Selling price must be more than your cost of GHS ${afaCost.toFixed(2)}`)
                        return
                    }
                }
                // Send '' through untouched (never coerced to '0') so clearing the
                // field actually turns AFA off instead of leaving the old price live.
                await postPricing({ afaSellingPrice })
                toast.success(afaSellingPrice === ''
                    ? 'AFA registration turned off for your shop.'
                    : 'AFA settings saved — now live on your storefront!')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to save')
        } finally {
            setSavingSection(null)
        }
    }

    // ─── Global save ──────────────────────────────────────────────────────────
    const handleSubmitAll = async () => {
        if (!shop) return
        if (!validateData() || !validateAirtime()) return
        if (afaSellingPrice !== '') {
            const profit = parseFloat(afaSellingPrice) - afaCost
            if (isNaN(profit) || profit <= 0) {
                toast.error(`AFA selling price must be more than your cost of GHS ${afaCost.toFixed(2)}`)
                return
            }
        }

        const rows = buildDataRows()
        if (rows.length === 0 && !airtimeFees.mtn && !airtimeFees.telecel && !airtimeFees.at) {
            toast.error('Please configure a price to save changes')
            return
        }

        setSaving(true)
        try {
            await postPricing({
                items: rows,
                airtimeFees,
                rcMarkups: buildRcMarkupRows(),
                mashupFee: mashupFee || undefined,
                // Raw string (including '') — NOT `afaSellingPrice || undefined`. An
                // empty string must mean "turn AFA off" (the API route maps '' ->
                // null), not "leave unchanged". Coercing to undefined here would
                // silently discard whatever the owner typed in the AFA tab on a bulk save.
                afaSellingPrice,
            })
            toast.success('Your shop is now live! Customers can start buying.')
            markLive()
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit pricing')
        } finally {
            setSaving(false)
        }
    }

    const handleSavePkg = async (pkgId: string) => {
        if (!shop || savingPkg) return
        const valStr = pricing[pkgId]
        const pkg = packages.find(p => p.id === pkgId)
        if (!pkg) return
        if (!valStr || parseFloat(valStr) <= 0) { toast.error('Enter a selling price first'); return }
        const valid = isValidPrice(pkg, valStr)
        if (!valid) {
            const profit = getProfit(pkg, valStr)
            toast.error(profit !== null && profit <= 0 ? 'Price must be above your cost' : `Max profit GHS ${isFinite(dataMaxProfit) ? dataMaxProfit.toFixed(2) : '∞'}`)
            return
        }
        setSavingPkg(pkgId)
        try {
            const rows = buildDataRows()
            if (rows.length === 0) { toast.error('No valid prices to save'); return }
            await postPricing({ items: rows })
            toast.success(`${pkg.network} ${pkg.size} saved!`)
            markLive()
        } catch (err: any) {
            toast.error(err.message || 'Failed to save')
        } finally {
            setSavingPkg(null)
        }
    }

    const handleAcknowledge = async () => {
        if (!shop) return
        setAcknowledging(true)
        try {
            const { error } = await (supabase as any).from('shop_profiles').update({
                pricing_rejection_acknowledged: true,
                updated_at: new Date().toISOString(),
            }).eq('id', shop.id)
            if (error) throw error
            setShop(prev => prev ? { ...prev, pricing_rejection_acknowledged: true } : null)
        } catch (err: any) {
            toast.error(err.message || 'Failed to acknowledge')
        } finally {
            setAcknowledging(false)
        }
    }

    // ─── Bulk apply with live preview ─────────────────────────────────────────
    // NOTE: subAgentCostMap is fetched keyed by activeNetwork (the Manual-grid
    // network), not bulkApplyTarget, so it cannot be safely used to gate this
    // list without risking a stale/wrong-network filter — the manual grid
    // (filteredPackages above) is the one place Step 3 requires the gate, and a
    // sub-agent's cost floor is still enforced by getCostPrice()/isValidPrice()
    // wherever bulk-computed prices get applied.
    const bulkTargets = packages.filter(pkg => pkg.is_available && pkg.network === bulkApplyTarget)

    const bulkComputeSelling = (pkg: Package): number | null => {
        const v = parseFloat(bulkValue)
        if (isNaN(v) || v <= 0) return null
        if (bulkMode === 'flat') {
            // flat rate = GHS per GB; selling price = rate × volume
            const vol = parseVolumeGB(pkg.size)
            if (vol === null || vol <= 0) return null
            return parseFloat((v * vol).toFixed(2))
        }
        // percent = cost × (1 + v/100)
        const cost = getCostPrice(pkg)
        return parseFloat((cost * (1 + v / 100)).toFixed(2))
    }

    // One row per candidate package, carrying its own policy verdict. A row with a
    // `warning` is never applied — mirroring the admin BulkPricingTab, a policy
    // violation skips just that package instead of blocking the whole batch.
    interface BulkPreviewRow {
        pkg: Package
        cost: number
        selling: number | null
        profit: number | null
        warning: string | null
    }

    const bulkPreviewRows: BulkPreviewRow[] = bulkTargets.map(pkg => {
        const cost = getCostPrice(pkg)
        const selling = bulkComputeSelling(pkg)
        if (selling === null) {
            return { pkg, cost, selling: null, profit: null, warning: null }
        }
        const profit = round2(selling - cost)
        const maxProfit = isFinite(dataMaxProfit) ? dataMaxProfit : 999
        let warning: string | null = null
        if (profit <= 0) warning = 'Below cost price'
        else if (profit > maxProfit) warning = `Exceeds max profit (GHS ${maxProfit.toFixed(2)})`
        return { pkg, cost, selling, profit, warning }
    })

    const bulkSelectableRows = bulkPreviewRows.filter(r => r.warning === null && r.selling !== null)
    const bulkExcludedCount = bulkSelectableRows.filter(r => bulkExcludedIds.has(r.pkg.id)).length
    const bulkApplicableRows = bulkSelectableRows.filter(r => !bulkExcludedIds.has(r.pkg.id))
    const bulkWarningRows = bulkPreviewRows.filter(r => r.warning !== null)
    const bulkAllSelected = bulkSelectableRows.length > 0 && bulkExcludedCount === 0
    const bulkSomeSelected = bulkExcludedCount < bulkSelectableRows.length

    const toggleBulkRow = (id: string) => {
        setBulkExcludedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const toggleBulkAll = () => {
        setBulkExcludedIds(bulkAllSelected ? new Set(bulkSelectableRows.map(r => r.pkg.id)) : new Set())
    }

    const handleApplyBulk = () => {
        const v = parseFloat(bulkValue)
        if (isNaN(v) || v <= 0) { toast.error('Enter a value greater than 0'); return }
        if (bulkApplicableRows.length === 0) { toast.error('No packages to apply to — check your selections above'); return }
        const newPricing: Record<string, string> = { ...pricing }
        bulkApplicableRows.forEach(({ pkg, selling }) => {
            if (selling !== null) newPricing[pkg.id] = selling.toFixed(2)
        })
        setPricing(newPricing)
        setBulkExcludedIds(new Set())
        toast.success(`Applied to ${bulkApplicableRows.length} package(s) — review and save when ready`)
    }

    // ─── Render guards ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-5" aria-busy="true" aria-label="Loading your pricing">
                <div className="neu-raised-sm h-24 rounded-3xl" />
                <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
                    <div className="neu-raised-sm h-64 rounded-3xl" />
                    <div className="neu-raised-sm h-96 rounded-3xl" />
                </div>
            </div>
        )
    }

    if (loadError) {
        return (
            <div className="neu-raised-sm mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-3xl p-8 text-center">
                <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-red-500"><AlertCircle className="h-6 w-6" /></span>
                <h1 className="font-display text-lg font-semibold">We couldn&apos;t load your pricing</h1>
                <p className="text-sm text-muted-foreground">Check your connection and try again. Your saved prices are safe.</p>
                <button type="button" onClick={() => { setLoading(true); fetchData() }} className={cn(CLAY_GOLD, 'mt-1 h-10')}>
                    <RefreshCw className="h-4 w-4" /> Try again
                </button>
            </div>
        )
    }

    if (shop?.approval_status !== 'approved') {
        return (
            <div className="neu-raised-sm mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-3xl p-8 text-center">
                <span className="neu-inset flex h-14 w-14 items-center justify-center rounded-2xl text-brand-700 dark:text-brand-500"><Clock className="h-7 w-7" /></span>
                <h1 className="font-display text-xl font-bold">Your shop is being reviewed</h1>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                    We check every new shop before it opens. Once it is approved you can set your prices here.
                </p>
                <Link href="/dashboard/shop" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-500">Back to my shop</Link>
            </div>
        )
    }

    if (shop?.pricing_status === 'rejected' && !shop?.pricing_rejection_acknowledged) {
        return (
            <div className="neu-raised-sm mx-auto mt-6 max-w-lg space-y-5 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3">
                    <span className="neu-inset flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-red-500"><XCircle className="h-6 w-6" /></span>
                    <div>
                        <h1 className="font-display text-lg font-bold">Your prices need a change</h1>
                        <p className="text-sm text-muted-foreground">An admin looked at your prices and asked for a revision.</p>
                    </div>
                </div>

                {shop.pricing_note && (
                    <div className="neu-inset rounded-2xl p-4">
                        <p className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">What the admin said</p>
                        <p className="text-sm leading-relaxed">{shop.pricing_note}</p>
                    </div>
                )}

                <button type="button" onClick={handleAcknowledge} disabled={acknowledging} className={cn(CLAY_GOLD, 'w-full')}>
                    {acknowledging ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Got it, let me update my prices
                </button>
            </div>
        )
    }

    const filteredPackages = isSubAgentOwner
        ? filterPackagesForSubAgent(packages.filter(p => p.network === activeNetwork), subAgentCostMap)
        : packages.filter(p => p.network === activeNetwork)
    const isResubmission = shop?.pricing_status === 'approved'
    const ownerIsReseller = shop?.owner_role === 'agent' || shop?.owner_role === 'dealer'

    const panel = 'neu-raised-sm rounded-3xl p-5 sm:p-6'

    return (
        <div className="space-y-5 pb-32">
            {/* ── Header ── */}
            <header className="neu-raised-sm flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                    <Link href="/dashboard/shop" className="mb-2 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <ArrowLeft className="h-3.5 w-3.5" /> My shop
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Your prices</h1>
                        <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            shop.pricing_status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-brand-500/15 text-brand-700 dark:text-brand-500'
                        )}>
                            {shop.pricing_status === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {shop.pricing_status === 'approved' ? 'Live on your storefront' : 'Not live yet'}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Decide how much you earn on each sale. Save one section at a time, or everything at once.
                    </p>
                </div>
                <button type="button" onClick={handleSubmitAll} disabled={saving} className={cn(CLAY_GOLD, 'hidden flex-shrink-0 sm:inline-flex')}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {saving ? 'Saving' : 'Save everything'}
                </button>
            </header>

            {isResubmission && (
                <div className="neu-inset flex items-start gap-3 rounded-2xl p-4 text-xs leading-relaxed text-muted-foreground">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" />
                    <p>
                        <span className="font-semibold text-foreground">New prices go live right away.</span> An admin can still review them later and ask you to change them.
                    </p>
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
                {/* ── Section rail ── */}
                <nav aria-label="Pricing sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
                    {SECTIONS.map(({ id, label, icon: Icon }) => {
                        const active = activeSection === id
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActiveSection(id)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex flex-shrink-0 items-center gap-2.5 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                                    active ? 'neu-inset text-brand-700 dark:text-brand-500' : 'neu-raised-sm neu-press text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        )
                    })}
                </nav>

                <div className="min-w-0 space-y-5">
                    {/* ════════════ DATA BUNDLES ════════════ */}
                    {activeSection === 'data' && (
                        <section aria-label="Data bundle prices" className={cn(panel, 'space-y-5')}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h2 className="font-display text-lg font-semibold">Data bundles</h2>
                                <div role="tablist" aria-label="Pricing method" className="neu-inset flex rounded-xl p-1">
                                    {(['manual', 'bulk'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            role="tab"
                                            aria-selected={pricingMode === mode}
                                            onClick={() => setPricingMode(mode)}
                                            className={cn(
                                                'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                                                pricingMode === mode ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {mode === 'manual' ? 'One by one' : 'Price in bulk'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {pricingMode === 'bulk' && (
                                <div className="space-y-4">
                                    <Tip>
                                        {bulkMode === 'flat'
                                            ? 'Type a rate per GB and every bundle is priced for you. A rate of 5 means 1GB sells for GHS 5.00, 2GB for GHS 10.00 and 500MB for GHS 2.50.'
                                            : 'Adds a percentage of your cost as profit, so bigger bundles earn you more. A margin of 5 means cost plus 5%.'}
                                    </Tip>

                                    <div role="tablist" aria-label="Bulk pricing mode" className="neu-inset flex w-fit rounded-xl p-1">
                                        {([
                                            { id: 'flat', label: 'Rate per GB' },
                                            { id: 'percent', label: 'Margin %' },
                                        ] as const).map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                role="tab"
                                                aria-selected={bulkMode === m.id}
                                                onClick={() => { setBulkMode(m.id); setBulkValue('') }}
                                                className={cn(
                                                    'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                                                    bulkMode === m.id ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <div className="well rounded-xl sm:w-48">
                                            <Select value={bulkApplyTarget} onValueChange={setBulkApplyTarget}>
                                                <SelectTrigger aria-label="Network to price" className="h-11 border-0 bg-transparent px-3 text-sm font-semibold shadow-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-0">
                                                    <SelectValue placeholder="Network" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {NETWORKS.map(net => (
                                                        <SelectItem key={net} value={net}>{net}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <Prefixed prefix={bulkMode === 'flat' ? 'GHS per GB' : '%'}>
                                                <Input
                                                    type="number" inputMode="decimal" min="0.01" step={bulkMode === 'flat' ? '0.5' : '0.1'} value={bulkValue}
                                                    onChange={(e) => setBulkValue(e.target.value)}
                                                    aria-label={bulkMode === 'flat' ? 'Rate per GB in cedis' : 'Margin percentage'}
                                                    className={FIELD}
                                                />
                                            </Prefixed>
                                        </div>
                                    </div>

                                    {bulkTargets.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No bundles found for {bulkApplyTarget}.</p>
                                    ) : (
                                        <div className="neu-inset overflow-x-auto rounded-2xl">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-10">
                                                            <Checkbox
                                                                checked={bulkAllSelected ? true : bulkSomeSelected ? 'indeterminate' : false}
                                                                onCheckedChange={toggleBulkAll}
                                                                aria-label="Select all bundles"
                                                            />
                                                        </TableHead>
                                                        <TableHead>Size</TableHead>
                                                        <TableHead>Your cost</TableHead>
                                                        <TableHead>Now</TableHead>
                                                        <TableHead>New price</TableHead>
                                                        <TableHead>Your profit</TableHead>
                                                        <TableHead>Result</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {bulkPreviewRows.map(({ pkg, cost, selling, profit, warning }) => {
                                                        const isExcluded = !warning && bulkExcludedIds.has(pkg.id)
                                                        const currentSelling = parseFloat(pricing[pkg.id] || '0') || null
                                                        return (
                                                            <TableRow key={pkg.id} className={warning || isExcluded ? 'opacity-60' : ''}>
                                                                <TableCell>
                                                                    {!warning && selling !== null && (
                                                                        <Checkbox
                                                                            checked={!isExcluded}
                                                                            onCheckedChange={() => toggleBulkRow(pkg.id)}
                                                                            aria-label={`Include ${pkg.size} in bulk pricing`}
                                                                        />
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="font-semibold">{pkg.size}</TableCell>
                                                                <TableCell className="tabular-nums">{formatCurrency(cost)}</TableCell>
                                                                <TableCell className="tabular-nums">{currentSelling !== null ? formatCurrency(currentSelling) : <span className="text-xs text-muted-foreground">not set</span>}</TableCell>
                                                                <TableCell className="tabular-nums">{selling !== null ? formatCurrency(selling) : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                                                                <TableCell className={cn('font-semibold tabular-nums', warning ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                                                    {profit !== null ? formatCurrency(profit) : '-'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {warning ? (
                                                                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                                                            <AlertCircle className="h-3 w-3" /> {warning}
                                                                        </span>
                                                                    ) : isExcluded ? (
                                                                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Skipped</span>
                                                                    ) : selling !== null ? (
                                                                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                            <CheckCircle2 className="h-3 w-3" /> Will change
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">Enter a value</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {parseFloat(bulkValue) > 0 && bulkPreviewRows.length > 0 && (
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="space-y-0.5 text-xs text-muted-foreground" aria-live="polite">
                                                <p><span className="font-semibold text-foreground">{bulkApplicableRows.length}</span> bundle(s) will change</p>
                                                {bulkExcludedCount > 0 && <p>{bulkExcludedCount} skipped by you</p>}
                                                {bulkWarningRows.length > 0 && (
                                                    <p className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                        <AlertCircle className="h-3 w-3" /> {bulkWarningRows.length} left out (see the table)
                                                    </p>
                                                )}
                                            </div>
                                            <button type="button" onClick={handleApplyBulk} disabled={bulkApplicableRows.length === 0} className={cn(CLAY_BLACK, 'h-10')}>
                                                Fill in {bulkApplicableRows.length}
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">This only fills in the prices. Switch to &ldquo;One by one&rdquo; to review them, then save.</p>
                                </div>
                            )}

                            {pricingMode === 'manual' && (
                                <div className="space-y-5">
                                    <Tip>
                                        Your cost is what you pay us and your profit is what you add on top. For example, a bundle that costs GHS 10 with GHS {ownerIsReseller ? '3' : '2'} profit sells for GHS {ownerIsReseller ? '13' : '12'}.
                                        {' '}The most you can earn on one bundle is <strong className="text-foreground">{isFinite(dataMaxProfit) ? `GHS ${dataMaxProfit.toFixed(2)}` : 'unlimited'}</strong>, and you cannot sell below cost.
                                    </Tip>

                                    {/* Network picker (telco colours kept on purpose) */}
                                    <div role="group" aria-label="Network" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                        {NETWORKS.map(network => {
                                            const count = packages.filter(p => p.network === network).length
                                            if (count === 0) return null
                                            const isActiveTab = activeNetwork === network
                                            return (
                                                <button
                                                    key={network}
                                                    type="button"
                                                    onClick={() => setActiveNetwork(network)}
                                                    aria-pressed={isActiveTab}
                                                    className={cn(
                                                        'flex h-11 w-full items-center justify-between gap-2 rounded-2xl px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                                                        isActiveTab ? 'neu-inset text-foreground' : 'neu-raised-sm neu-press text-muted-foreground hover:text-foreground'
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className={cn('h-2.5 w-2.5 rounded-full', NETWORK_DOT[network] ?? 'bg-foreground/40')} />
                                                        {network}
                                                    </span>
                                                    <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Stock control for the active network */}
                                    {(() => {
                                        const lockedByAdmin = !!adminOOS[activeNetwork]
                                        const isOut = lockedByAdmin || shopOOS.includes(activeNetwork)
                                        return (
                                            <div className="neu-inset flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold">
                                                        {activeNetwork} is {isOut ? 'out of stock on your shop' : 'in stock'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {lockedByAdmin
                                                            ? 'Capozy Hub has paused this network for everyone for now.'
                                                            : 'Switch on to stop customers ordering it while you restock.'}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={isOut}
                                                    disabled={lockedByAdmin || oosSaving === activeNetwork}
                                                    onCheckedChange={(v) => toggleShopNetworkStock(activeNetwork, v)}
                                                    aria-label={`Mark ${activeNetwork} out of stock on your shop`}
                                                />
                                            </div>
                                        )
                                    })()}

                                    {/* Bundle cards */}
                                    {filteredPackages.length === 0 ? (
                                        <p className="py-6 text-center text-sm text-muted-foreground">No {activeNetwork} bundles are available to price right now.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
                                            {filteredPackages.map((pkg) => {
                                                const valStr = pricing[pkg.id] || ''
                                                const cost = getCostPrice(pkg)
                                                const profit = getProfit(pkg, valStr) ?? 0
                                                const valid = isValidPrice(pkg, valStr)
                                                const isSavingThis = savingPkg === pkg.id

                                                return (
                                                    <div key={pkg.id} className="neu-raised-sm flex flex-col gap-3 rounded-2xl p-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h3 className="font-display text-base font-bold leading-tight">{pkg.size}</h3>
                                                            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Cost {formatCurrency(cost)}</span>
                                                        </div>

                                                        <Prefixed prefix="GHS" invalid={!!valStr && valid === false} valid={!!valStr && valid === true}>
                                                            <Input
                                                                type="number" inputMode="decimal" value={valStr}
                                                                onChange={(e) => setPricing(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                                placeholder={cost.toFixed(2)}
                                                                aria-label={`Selling price for ${pkg.network} ${pkg.size}`}
                                                                className={cn(FIELD, 'h-10 text-sm')}
                                                            />
                                                        </Prefixed>

                                                        <div className="flex items-center justify-between text-xs" aria-live="polite">
                                                            <span className="font-medium text-muted-foreground">You earn</span>
                                                            <span className={cn('font-semibold tabular-nums', valid === true ? 'text-emerald-600 dark:text-emerald-400' : valid === false ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                                                                {valStr && valid !== null ? `+${formatCurrency(profit)}` : '-'}
                                                            </span>
                                                        </div>
                                                        {valStr && valid === false && (
                                                            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                                                                {profit <= 0 ? 'Price has to be above your cost' : `Most you can earn is GHS ${isFinite(dataMaxProfit) ? dataMaxProfit.toFixed(2) : '-'}`}
                                                            </p>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleSavePkg(pkg.id)}
                                                            disabled={!!savingPkg || !valStr || valid !== true}
                                                            className={cn(
                                                                'mt-auto flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold',
                                                                valid === true ? 'clay-gold disabled:opacity-60' : 'neu-inset cursor-not-allowed text-muted-foreground'
                                                            )}
                                                        >
                                                            {isSavingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                            {isSavingThis ? 'Saving' : 'Save'}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    <button type="button" onClick={() => handleSaveSection('data')} disabled={savingSection === 'data'} className={cn(CLAY_BLACK, 'w-full sm:w-auto')}>
                                        {savingSection === 'data' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        Save all data prices
                                    </button>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ════════════ AIRTIME ════════════ */}
                    {activeSection === 'airtime' && (
                        <section aria-label="Airtime profit" className={cn(panel, 'space-y-5')}>
                            <h2 className="font-display text-lg font-semibold">Airtime</h2>
                            <Tip>
                                You earn nothing on airtime until you set a markup below. The network&apos;s own fee and your markup together are capped at 10%.
                            </Tip>

                            <div className="neu-inset divide-y divide-border rounded-2xl">
                                {AIRTIME_NETWORKS.map(net => {
                                    const key = net.toLowerCase() as keyof typeof airtimeFees
                                    const maxAllowed = getMaxAirtimeProfit(net)
                                    const val = parseFloat(airtimeFees[key] || '0')
                                    const isOverLimit = val > maxAllowed || val < 0

                                    return (
                                        <div key={net} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                                            <div className="flex items-center justify-between sm:w-40 sm:shrink-0">
                                                <span className="flex items-center gap-2 text-sm font-semibold">
                                                    <span className={cn('h-2.5 w-2.5 rounded-full', NETWORK_DOT[net] ?? 'bg-foreground/40')} />
                                                    {net === 'AT' ? 'AirtelTigo' : net}
                                                </span>
                                                <span className="text-xs text-muted-foreground sm:hidden">Up to {maxAllowed.toFixed(2)}%</span>
                                            </div>

                                            <div className="hidden flex-1 items-center justify-center gap-8 text-center sm:flex">
                                                <div>
                                                    <p className="text-[11px] font-medium text-muted-foreground">Network fee</p>
                                                    <p className="text-sm font-semibold tabular-nums">{(10 - maxAllowed).toFixed(2)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-medium text-muted-foreground">You can add up to</p>
                                                    <p className="text-sm font-semibold tabular-nums">{maxAllowed.toFixed(2)}%</p>
                                                </div>
                                            </div>

                                            <div className="w-full sm:w-36 sm:shrink-0">
                                                <Prefixed suffix="%" invalid={isOverLimit}>
                                                    <Input
                                                        type="number" inputMode="decimal"
                                                        value={airtimeFees[key]}
                                                        onChange={e => setAirtimeFees(s => ({ ...s, [key]: e.target.value }))}
                                                        aria-label={`${net} airtime markup in percent`}
                                                        className={cn(FIELD, 'text-center')}
                                                        min="0" max={maxAllowed} step="0.1" placeholder="0.0"
                                                    />
                                                </Prefixed>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <button type="button" onClick={() => handleSaveSection('airtime')} disabled={savingSection === 'airtime'} className={cn(CLAY_GOLD, 'w-full sm:w-auto')}>
                                {savingSection === 'airtime' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save airtime profit
                            </button>
                        </section>
                    )}

                    {/* ════════════ RESULTS CHECKER ════════════ */}
                    {activeSection === 'rc' && (
                        <section aria-label="Results checker profit" className={cn(panel, 'space-y-5')}>
                            <h2 className="font-display text-lg font-semibold">Results checker</h2>
                            <Tip>
                                Set your profit for <strong className="text-foreground">each exam</strong>. It is added on top of the voucher price.
                                {rcMaxMarkup > 0 && <> You can add up to <strong className="text-foreground">GHS {rcMaxMarkup.toFixed(2)}</strong> per voucher.</>}
                            </Tip>

                            {examTypes.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">No exams are on offer right now.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {examTypes.map(exam => {
                                        const subInfo = isSubAgentOwner ? rcSubAgentPricing[exam.id] : undefined
                                        const notConfigured = isSubAgentOwner && !subInfo?.configured
                                        const cost = isSubAgentOwner
                                            ? (subInfo?.configured ? subInfo.price : 0)
                                            : (ownerIsReseller ? exam.agent_price : exam.customer_price)
                                        const markupStr = rcMarkups[exam.id] ?? ''
                                        const markup = parseFloat(markupStr) || 0
                                        const negative = markup < 0
                                        const over = rcMaxMarkup > 0 && markup > rcMaxMarkup
                                        const sellPrice = cost + (over ? rcMaxMarkup : markup)

                                        return (
                                            <div key={exam.id} className={cn('neu-raised-sm relative space-y-3 rounded-2xl p-4', notConfigured && 'opacity-60')}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="font-display text-base font-bold">{exam.name}</h3>
                                                    {!notConfigured && <span className="text-[11px] font-medium text-muted-foreground">Cost {formatCurrency(cost)}</span>}
                                                </div>

                                                <Prefixed prefix="GHS" invalid={over || negative}>
                                                    <Input
                                                        type="number" inputMode="decimal" step="0.5" min="0" placeholder="0.00"
                                                        value={markupStr}
                                                        disabled={notConfigured}
                                                        onChange={e => setRcMarkups(prev => ({ ...prev, [exam.id]: e.target.value }))}
                                                        aria-label={`Your profit on one ${exam.name} voucher`}
                                                        className={cn(FIELD, 'h-10 text-sm')}
                                                    />
                                                </Prefixed>
                                                {notConfigured && (
                                                    <p className="text-[11px] font-semibold text-muted-foreground">Not available to you yet.</p>
                                                )}
                                                {over && (
                                                    <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                                        <AlertCircle className="h-3 w-3" /> Will be lowered to GHS {rcMaxMarkup.toFixed(2)} when you save
                                                    </p>
                                                )}
                                                {negative && (
                                                    <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                                        <AlertCircle className="h-3 w-3" /> Profit cannot be negative
                                                    </p>
                                                )}

                                                <div className="neu-inset space-y-1.5 rounded-xl p-3 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-muted-foreground">Customer pays</span>
                                                        <span className="font-bold tabular-nums">{formatCurrency(sellPrice)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-muted-foreground">You earn</span>
                                                        <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{formatCurrency(over ? rcMaxMarkup : Math.max(markup, 0))}</span>
                                                    </div>
                                                </div>

                                                {exam.bulk_pricing && exam.bulk_pricing.length > 0 && (
                                                    <div className="space-y-1 border-t border-border pt-2">
                                                        <p className="text-[11px] font-semibold text-muted-foreground">Bulk tiers (your profit is added to each voucher)</p>
                                                        {exam.bulk_pricing.map((tier, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-[11px]">
                                                                <span className="text-muted-foreground">{tier.min_qty}{tier.max_qty >= 99999 ? '+' : `-${tier.max_qty}`} pcs</span>
                                                                <span className="font-semibold tabular-nums">{formatCurrency(tier.unit_price + (over ? rcMaxMarkup : Math.max(markup, 0)))} each</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            <button type="button" onClick={() => handleSaveSection('rc')} disabled={savingSection === 'rc'} className={cn(CLAY_GOLD, 'w-full sm:w-auto')}>
                                {savingSection === 'rc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save exam profits
                            </button>
                        </section>
                    )}

                    {/* ════════════ MASHUP ════════════ */}
                    {activeSection === 'mashup' && (
                        <section aria-label="Mashup profit" className={cn(panel, 'max-w-xl space-y-5')}>
                            <h2 className="font-display text-lg font-semibold">MTN Mashup</h2>
                            <Tip>
                                The percentage you earn on MTN Mashup orders placed through your storefront.
                                {mashupMaxProfit > 0 && <> You can go up to <strong className="text-foreground">{mashupMaxProfit.toFixed(2)}%</strong>.</>}
                            </Tip>

                            {(() => {
                                const feeNum = parseFloat(mashupFee)
                                const over = mashupMaxProfit > 0 && feeNum > mashupMaxProfit
                                const negative = feeNum < 0
                                return (
                                    <div className="space-y-3">
                                        <label htmlFor="mashup-fee" className="text-sm font-semibold">Your profit margin</label>
                                        <Prefixed suffix="%" invalid={over || negative}>
                                            <Input
                                                id="mashup-fee"
                                                type="number" inputMode="decimal" step="0.1" min="0"
                                                max={mashupMaxProfit > 0 ? mashupMaxProfit : undefined}
                                                placeholder="0.0"
                                                value={mashupFee}
                                                onChange={e => setMashupFee(e.target.value)}
                                                className={FIELD}
                                            />
                                        </Prefixed>

                                        {over && (
                                            <p className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                                <AlertCircle className="h-3.5 w-3.5" /> Too high. It will be lowered to {mashupMaxProfit.toFixed(2)}% when you save.
                                            </p>
                                        )}
                                        {negative && (
                                            <p className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                                <AlertCircle className="h-3.5 w-3.5" /> Profit cannot be negative.
                                            </p>
                                        )}
                                        {mashupFee && feeNum >= 0 && !over && (
                                            <div className="neu-inset rounded-2xl p-4 text-sm" aria-live="polite">
                                                On a GHS 100 Mashup order you earn <span className="font-bold text-brand-700 dark:text-brand-500">GHS {(feeNum || 0).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            <button type="button" onClick={() => handleSaveSection('mashup')} disabled={savingSection === 'mashup'} className={cn(CLAY_GOLD, 'w-full sm:w-auto')}>
                                {savingSection === 'mashup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Mashup profit
                            </button>
                        </section>
                    )}

                    {/* ════════════ AFA REGISTRATION ════════════ */}
                    {activeSection === 'afa' && (() => {
                        const valStr = afaSellingPrice
                        const finalSelling = parseFloat(valStr) || 0
                        const profit = valStr !== '' ? round2(finalSelling - afaCost) : null
                        const maxProfit = afaMaxProfit > 0 ? afaMaxProfit : Infinity
                        const valid = valStr === '' ? null : (profit !== null && profit > 0 && profit <= maxProfit)
                        // A sub-agent owner with no AFA pricing configured has no real cost to
                        // validate against, so they can never save against a made-up 0 floor.
                        const notAvailable = isSubAgentOwner && !afaConfigured
                        const saveDisabled = savingSection === 'afa' || notAvailable || (valStr !== '' && valid !== true)

                        return (
                            <section aria-label="AFA registration price" className={cn(panel, 'max-w-xl space-y-5')}>
                                <h2 className="font-display text-lg font-semibold">AFA registration</h2>
                                <Tip>
                                    Type the full price you want to charge. Your profit is whatever is left after your cost. Saving a price turns AFA on for your storefront, and clearing the box turns it off.
                                    {afaMaxProfit > 0 && <> You can earn up to <strong className="text-foreground">GHS {afaMaxProfit.toFixed(2)}</strong> per registration.</>}
                                </Tip>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <label htmlFor="afa-price" className="text-sm font-semibold">Price you charge</label>
                                        {!notAvailable && <span className="text-[11px] font-medium text-muted-foreground">Your cost {formatCurrency(afaCost)}</span>}
                                    </div>
                                    <Prefixed prefix="GHS" invalid={!!valStr && valid === false} valid={!!valStr && valid === true}>
                                        <Input
                                            id="afa-price"
                                            type="number" inputMode="decimal" step="0.5" min="0"
                                            placeholder={`e.g. ${(afaCost + 2).toFixed(2)}`}
                                            value={afaSellingPrice}
                                            disabled={notAvailable}
                                            onChange={e => setAfaSellingPrice(e.target.value)}
                                            className={FIELD}
                                        />
                                    </Prefixed>

                                    {!notAvailable && (
                                        <div className="flex items-center justify-between text-xs" aria-live="polite">
                                            <span className="font-medium text-muted-foreground">You earn</span>
                                            <span className={cn('font-semibold tabular-nums', valid === true ? 'text-emerald-600 dark:text-emerald-400' : valid === false ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                                                {valStr && profit !== null ? `+${formatCurrency(profit)}` : '-'}
                                            </span>
                                        </div>
                                    )}

                                    {!notAvailable && valStr && valid === false && (
                                        <p className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {profit !== null && profit <= 0
                                                ? `Has to be more than your cost of GHS ${afaCost.toFixed(2)}`
                                                : `The most you can earn is GHS ${afaMaxProfit.toFixed(2)}`}
                                        </p>
                                    )}

                                    {(notAvailable || valStr === '') && (
                                        <p className="text-xs text-muted-foreground">
                                            {notAvailable ? 'AFA registration is not available on your account yet.' : 'AFA registration is off for your shop right now.'}
                                        </p>
                                    )}
                                </div>

                                <button type="button" onClick={() => handleSaveSection('afa')} disabled={saveDisabled} className={cn(CLAY_GOLD, 'w-full sm:w-auto')}>
                                    {savingSection === 'afa' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save AFA price
                                </button>
                            </section>
                        )
                    })()}
                </div>
            </div>

            {/* ── Mobile save-everything bar ── */}
            <div className="fixed bottom-4 left-4 right-4 z-40 max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] sm:hidden">
                <button type="button" onClick={handleSubmitAll} disabled={saving} className={cn(CLAY_GOLD, 'h-12 w-full shadow-xl')}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {saving ? 'Saving' : 'Save everything'}
                </button>
            </div>

            {/* ── "Your shop is live" dialog ── */}
            <Dialog open={showLiveModal} onOpenChange={setShowLiveModal}>
                <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto rounded-3xl border-0 bg-neu">
                    <DialogHeader className="items-center text-center">
                        <span className="neu-inset flex h-14 w-14 items-center justify-center rounded-2xl text-brand-700 dark:text-brand-500">
                            <PartyPopper className="h-7 w-7" />
                        </span>
                        <DialogTitle className="font-display text-xl">Your shop is open</DialogTitle>
                        <DialogDescription>
                            Customers can buy from your storefront now. Share your link to find your first buyers.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="neu-inset flex flex-col gap-2 rounded-2xl p-2">
                        <span className="truncate px-2 py-1.5 font-mono text-xs text-muted-foreground">{shopUrl}</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={copyLink} className="clay-silver inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold">
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
                            </button>
                            <a
                                className="clay-black inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold"
                                href={`https://wa.me/?text=${encodeURIComponent(`Buy affordable data bundles, airtime and vouchers from my shop: ${shopUrl}`)}`}
                                target="_blank" rel="noopener noreferrer"
                            >
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold">Ways to get your first sales</p>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                            {[
                                'Post your link in WhatsApp groups and on your status every day.',
                                'Keep your prices a little below the shops around you.',
                                'Use your storefront notice to announce promos.',
                                'Reply fast on WhatsApp. Speed brings people back.',
                            ].map(t => (
                                <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-700 dark:text-brand-500" /> {t}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex gap-2">
                        <a href={shopUrl} target="_blank" rel="noopener noreferrer" className="clay-silver inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold">
                            <ExternalLink className="h-4 w-4" /> View shop
                        </a>
                        <button type="button" className="clay-gold inline-flex h-11 flex-1 items-center justify-center rounded-2xl text-sm font-bold" onClick={() => setShowLiveModal(false)}>
                            Done
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
