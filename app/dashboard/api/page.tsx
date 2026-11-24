'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    Key,
    Copy,
    Check,
    RefreshCw,
    AlertTriangle,
    Clock,
    CheckCircle2,
    XCircle,
    Eye,
    EyeOff,
    Code2,
    Shield,
    Zap,
    ExternalLink,
    Terminal,
    BookOpen,
    ArrowRight,
    Wifi,
    Wallet,
    ShoppingCart,
    TrendingUp,
    AlertOctagon,
    Activity,
    Database,
    Percent,
    MessageCircle,
    ShieldAlert,
    Sparkles,
    X,
    ChevronDown,
    ChevronRight,
    Globe,
    List,
    AlertCircle,
    Package,
    Loader2,
    Webhook,
    Menu,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import { ApiKeyCard, type ApiKeyMeta } from '@/components/api/ApiKeyCard'
import { ApiCopyBtn } from '@/components/api/ApiCodeBlock'
import { ApiEndpointBlock, type ApiLangTab } from '@/components/api/ApiEndpointBlock'
import { WebhookConfigCard } from '@/components/api/WebhookConfigCard'

interface ApiKeyData {
    feature_enabled: boolean
    is_eligible: boolean
    allowed_roles: string[]
    user_role: string
    api_keys: {
        standard: ApiKeyMeta | null
    }
}

interface ApiStats {
    total_spent: number
    total_orders: number
    success_orders: number
    failed_orders: number
    pending_orders: number
    success_rate: number
    total_gb: number
    requests_24h: number
    requests_7d: number
    week_spent: number
    week_orders: number
}

const QUICK_START_TABS = ['cURL', 'Node.js', 'PHP', 'Python'] as const
type QuickStartTab = (typeof QUICK_START_TABS)[number]

const QUICK_START_CODE: Record<QuickStartTab, string> = {
    'cURL': `curl -X POST https://api.capozygh.com/api/data/purchase \\
  -H "Authorization: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "volume_gb": 5,
    "recipient": "0551617309",
    "reference": "order_001"
  }'`,
    'Node.js': `const res = await fetch('https://api.capozygh.com/api/data/purchase', {
  method: 'POST',
  headers: {
    'Authorization': 'YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    network: 'MTN',
    volume_gb: 5,
    recipient: '0551617309',
    reference: 'order_001',
  }),
});
const data = await res.json();
console.log(data);`,
    'PHP': `<?php
$ch = curl_init('https://api.capozygh.com/api/data/purchase');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: YOUR_API_KEY',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'network' => 'MTN', 'volume_gb' => 5,
    'recipient' => '0551617309', 'reference' => 'order_001',
  ]),
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.post(
  'https://api.capozygh.com/api/data/purchase',
  headers={
    'Authorization': 'YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  json={
    'network': 'MTN', 'volume_gb': 5,
    'recipient': '0551617309', 'reference': 'order_001',
  }
)
print(r.json())`,
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
    icon: Icon, label, value, sub, accent, pulse,
}: {
    icon: any
    label: string
    value: string | number
    sub?: string
    accent: 'violet' | 'emerald' | 'red' | 'amber' | 'sky' | 'slate'
    pulse?: boolean
}) {
    const accents = { iconBg: 'bg-muted', iconText: 'text-muted-foreground', text: 'text-foreground' }

    return (
        <div className="neu-raised-sm rounded-2xl p-3 sm:p-4 min-w-0">
            <div className="flex items-start gap-2 sm:gap-2.5">
                <div className={cn('w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0', accents.iconBg)}>
                    <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', accents.iconText)} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse motion-reduce:animate-none flex-shrink-0" />}
                        <p className="text-xs font-semibold text-muted-foreground truncate">{label}</p>
                    </div>
                    <p className={cn('text-sm sm:text-base lg:text-lg font-semibold mt-0.5 tabular-nums whitespace-nowrap', accents.text)}>{value}</p>
                    {sub && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
                </div>
            </div>
        </div>
    )
}

// ── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text, className }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try { await navigator.clipboard.writeText(text) }
        catch {
            const el = document.createElement('textarea')
            el.value = text; document.body.appendChild(el); el.select()
            document.execCommand('copy'); document.body.removeChild(el)
        }
        setCopied(true)
        toast.success('Copied to clipboard')
        setTimeout(() => setCopied(false), 2500)
    }
    return (
        <button
            onClick={copy}
            className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                'bg-card/10 hover:bg-card/20 text-muted-foreground/70 hover:text-white',
                className
            )}
        >
            {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    )
}

// ── Code Block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, label }: { code: string; label?: string }) {
    return (
        <div className="neu-night rounded-xl overflow-hidden">
            {label && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                    <CopyButton text={code} />
                </div>
            )}
            <div className="neu-night-in m-2 rounded-lg p-4 overflow-x-auto">
                <pre className="text-[13px] font-mono text-silver-100 leading-relaxed whitespace-pre">{code}</pre>
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApiDashboardPage() {
    const { dbUser } = useAuth()
    const [data, setData] = useState<ApiKeyData | null>(null)
    const [stats, setStats] = useState<ApiStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [activeTab, setActiveTab] = useState<QuickStartTab>('cURL')

    const fetchKeyData = useCallback(async () => {
        try {
            const [keyRes, statsRes] = await Promise.all([
                fetch('/api/user/api-keys'),
                fetch('/api/user/api-keys/stats'),
            ])
            if (keyRes.ok) { setData(await keyRes.json()); setLoadFailed(false) } else setLoadFailed(true)
            if (statsRes.ok) setStats(await statsRes.json())
        } catch (err) {
            console.error('Error fetching API key data:', err)
            setLoadFailed(true)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { if (dbUser) fetchKeyData() }, [dbUser, fetchKeyData])

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // ── Feature disabled ─────────────────────────────────────────────────────
    // A failed load is not the same as the feature being switched off.
    if (loadFailed && !data) {
        return (
            <div className="w-full">
                <PageHeader />
                <div className="neu-raised mx-auto mt-6 max-w-xl space-y-4 rounded-[2rem] p-8 text-center" role="alert">
                    <h2 className="font-display text-xl font-bold tracking-tight">We could not load your API settings</h2>
                    <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
                    <button type="button" onClick={() => { setIsLoading(true); fetchKeyData() }} className="clay-gold min-h-11 rounded-full px-6 text-sm font-semibold">Try again</button>
                </div>
            </div>
        )
    }

    if (!data?.feature_enabled) {
        return (
            <div className="w-full">
                <PageHeader />
                <div className="mt-6 neu-raised-sm rounded-3xl p-10 text-center max-w-xl mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h2 className="font-display text-xl font-bold tracking-tight mb-2">The API is switched off</h2>
                    <p className="text-sm text-muted-foreground">An administrator has turned the Developer API off for now. Check back soon.</p>
                </div>
            </div>
        )
    }

    // ── Not eligible ──────────────────────────────────────────────────────────
    if (!data?.is_eligible) {
        const upgradeableRoles = (data.allowed_roles || ['agent']).filter(r => r !== 'admin' && r !== 'sub-admin')
        const roleLabels = upgradeableRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1))
        const rolesText = roleLabels.length > 0
            ? roleLabels.join(' or ')
            : (data.allowed_roles || []).map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' or ')
        const showUpgrade = upgradeableRoles.some(r => r === 'agent' || r === 'dealer')
        return (
            <div className="w-full">
                <PageHeader />
                <div className="neu-raised rounded-[2rem] p-8 text-center max-w-xl mx-auto space-y-3">
                    <div className="clay-gold w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-2">{rolesText} Account Required</h2>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                        The Developer API is available to {rolesText.toLowerCase()} accounts only. Upgrade your account to unlock API access.
                    </p>
                    {showUpgrade && (
                        <Link href="/dashboard/upgrade">
                            <Button className="clay-gold min-h-11 rounded-full px-6 font-semibold gap-2">
                                Upgrade Account <ArrowRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    const standardKey = data.api_keys.standard
    const userName = `${(dbUser as any)?.first_name || ''} ${(dbUser as any)?.last_name || ''}`.trim() || 'User'
    const userEmail = (dbUser as any)?.email || ''
    const userPhone = (dbUser as any)?.phone_number || ''

    return (
        <div className="space-y-6 w-full">

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl clay-gold flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
                        <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Developer API</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">Integrate data purchases into your applications</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <a href="/developers" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 neu-raised-sm rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">API Docs</span>
                        <span className="xs:hidden">Docs</span>
                    </a>
                    <a href="/openapi.yaml" target="_blank" rel="noopener noreferrer"
                        className="neu-raised-sm neu-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    >
                        <Package className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">OpenAPI</span>
                        <span className="xs:hidden">Spec</span>
                    </a>
                </div>
            </div>

            {/* ── Usage Stats Grid ─────────────────────────────────────────── */}
            {/* Scoped to the standard key: /api/user/api-keys/stats aggregates the orders table (source='api'). */}
            {standardKey && stats && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <h2 className="text-sm font-semibold text-foreground">Your API Usage</h2>
                        </div>
                        {stats.week_orders > 0 && (
                            <p className="text-[11px] sm:text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground/80 ">{stats.week_orders}</span> orders ·{' '}
                                <span className="font-semibold text-foreground/80 ">GH₵ {stats.week_spent.toFixed(2)}</span> spent this week
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        <StatCard
                            icon={Wallet}
                            label="Total Spent"
                            value={`GH₵ ${stats.total_spent.toFixed(2)}`}
                            accent="violet"
                        />
                        <StatCard
                            icon={ShoppingCart}
                            label="Total Orders"
                            value={stats.total_orders.toLocaleString()}
                            accent="slate"
                        />
                        <StatCard
                            icon={CheckCircle2}
                            label="Successful"
                            value={stats.success_orders.toLocaleString()}
                            accent="emerald"
                        />
                        <StatCard
                            icon={AlertOctagon}
                            label="Failed"
                            value={stats.failed_orders.toLocaleString()}
                            accent="red"
                        />
                        <StatCard
                            icon={Clock}
                            label="Pending"
                            value={stats.pending_orders.toLocaleString()}
                            accent="amber"
                            pulse={stats.pending_orders > 0}
                        />
                        <StatCard
                            icon={Percent}
                            label="Success Rate"
                            value={`${stats.success_rate}%`}
                            accent={stats.success_rate >= 90 ? 'emerald' : stats.success_rate >= 70 ? 'amber' : 'red'}
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Requests (24h)"
                            value={stats.requests_24h.toLocaleString()}
                            sub={`${stats.requests_7d.toLocaleString()} this week`}
                            accent="sky"
                        />
                        <StatCard
                            icon={Database}
                            label="Data Delivered"
                            value={`${stats.total_gb.toFixed(1)} GB`}
                            accent="slate"
                        />
                    </div>
                </div>
            )}

            {/* ── API key ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-5">
                <ApiKeyCard
                    keyType="standard"
                    apiKey={standardKey}
                    userName={userName}
                    userEmail={userEmail}
                    userPhone={userPhone}
                    onGenerated={fetchKeyData}
                />
            </div>

            {/* ── Connection Details + Quick Start — side-by-side on lg ────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Connection Details */}
                <div className="neu-raised-sm rounded-3xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                        <Wifi className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Connection Details</h2>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Base URL</p>
                            <CodeBlock code="https://api.capozygh.com/api" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Authentication Header</p>
                            <CodeBlock code="Authorization: YOUR_API_KEY" />
                        </div>
                    </div>
                </div>

                {/* Quick Start */}
                <div className="neu-raised-sm rounded-3xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                        <Terminal className="w-5 h-5 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Quick Start — Purchase Data</h2>
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Language tabs */}
                        <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-xl w-fit">
                            {QUICK_START_TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                                        activeTab === tab
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-muted-foreground/70'
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <CodeBlock code={QUICK_START_CODE[activeTab]} label={activeTab} />
                        <p className="text-xs text-muted-foreground pt-1">
                            Replace <code className="font-mono text-brand-800 dark:text-brand-400">YOUR_API_KEY</code> with your actual key. See the full reference below.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── API Reference ───────────────────────────────────────────── */}
            <ApiReferenceSection standardKey={standardKey} />
        </div>
    )
}

// ── API Reference Section ─────────────────────────────────────────────────────
// v1 has been fully ported and eliminated (owner decision, 2026-08-31) — this
// is now the only live base URL. Every sample below interpolates ${API_BASE}
// rather than a hardcoded version, so the flip propagates automatically.
const API_BASE = 'https://api.capozygh.com/api'
const API_KEY_PLACEHOLDER = 'cz_live_your_api_key_here'

function ApiRefTable({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
    return (
        <div className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/50">
                            {head.map(h => <th key={h} className="text-left px-5 py-3 text-sm font-semibold text-muted-foreground">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/60 dark:hover:bg-muted/30 transition-colors">
                                {row.map((cell, j) => <td key={j} className="px-5 py-3 text-foreground/80 ">{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ── Endpoint samples ──────────────────────────────────────────────────────────
const PKG_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `# All packages\ncurl -X GET ${API_BASE}/packages \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"\n\n# Filter by network\ncurl -X GET "${API_BASE}/packages?network=MTN" \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"`,
    'Node.js': `const res = await fetch('${API_BASE}/packages', {\n  headers: { 'Authorization': '${API_KEY_PLACEHOLDER}' },\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ch = curl_init('${API_BASE}/packages?network=MTN');\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}'],\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nr = requests.get('${API_BASE}/packages',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'})\nprint(r.json())`,
}

const PURCHASE_API_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `curl -X POST ${API_BASE}/data/purchase \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "network": "MTN",\n    "volume_gb": 5,\n    "recipient": "0551617309",\n    "reference": "order_001"\n  }'`,
    'Node.js': `const res = await fetch('${API_BASE}/data/purchase', {\n  method: 'POST',\n  headers: {\n    'Authorization': '${API_KEY_PLACEHOLDER}',\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify({\n    network: 'MTN', volume_gb: 5,\n    recipient: '0551617309', reference: 'order_001',\n  }),\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ch = curl_init('${API_BASE}/data/purchase');\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}', 'Content-Type: application/json'],\n  CURLOPT_POSTFIELDS => json_encode([\n    'network' => 'MTN', 'volume_gb' => 5,\n    'recipient' => '0551617309', 'reference' => 'order_001',\n  ]),\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nr = requests.post('${API_BASE}/data/purchase',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'},\n  json={'network':'MTN','volume_gb':5,'recipient':'0551617309','reference':'order_001'}\n)\nprint(r.json())`,
}

const BULK_API_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `curl -X POST ${API_BASE}/data/bulk \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "orders": [\n      {"network":"MTN","volume_gb":5,"recipient":"0551617309","reference":"b_001"},\n      {"network":"Telecel","volume_gb":2,"recipient":"0201234567","reference":"b_002"}\n    ]\n  }'`,
    'Node.js': `const res = await fetch('${API_BASE}/data/bulk', {\n  method: 'POST',\n  headers: { 'Authorization': '${API_KEY_PLACEHOLDER}', 'Content-Type': 'application/json' },\n  body: JSON.stringify({ orders: [\n    { network: 'MTN', volume_gb: 5, recipient: '0551617309', reference: 'b_001' },\n    { network: 'Telecel', volume_gb: 2, recipient: '0201234567', reference: 'b_002' },\n  ]}),\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ch = curl_init('${API_BASE}/data/bulk');\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}','Content-Type: application/json'],\n  CURLOPT_POSTFIELDS => json_encode(['orders' => [\n    ['network'=>'MTN','volume_gb'=>5,'recipient'=>'0551617309','reference'=>'b_001'],\n    ['network'=>'Telecel','volume_gb'=>2,'recipient'=>'0201234567','reference'=>'b_002'],\n  ]]),\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nr = requests.post('${API_BASE}/data/bulk',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'},\n  json={'orders': [\n    {'network':'MTN','volume_gb':5,'recipient':'0551617309','reference':'b_001'},\n    {'network':'Telecel','volume_gb':2,'recipient':'0201234567','reference':'b_002'},\n  ]}\n)\nprint(r.json())`,
}

const BALANCE_API_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/wallet/balance \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"`,
    'Node.js': `const res = await fetch('${API_BASE}/wallet/balance', {\n  headers: { 'Authorization': '${API_KEY_PLACEHOLDER}' },\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ch = curl_init('${API_BASE}/wallet/balance');\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}'],\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nr = requests.get('${API_BASE}/wallet/balance',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'})\nprint(r.json())`,
}

const STATUS_API_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/orders/your_reference_here \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"`,
    'Node.js': `const ref = 'your_reference_here';\nconst res = await fetch(\`${API_BASE}/orders/\${ref}\`, {\n  headers: { 'Authorization': '${API_KEY_PLACEHOLDER}' },\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ref = 'your_reference_here';\n$ch = curl_init("${API_BASE}/orders/$ref");\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}'],\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nref = 'your_reference_here'\nr = requests.get(f'${API_BASE}/orders/{ref}',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'})\nprint(r.json())`,
}

// ── Airtime samples ──────────────────────────────────────────────
const AIRTIME_PURCHASE_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `curl -X POST ${API_BASE}/airtime/purchase \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "network": "MTN",\n    "beneficiary_phone": "0551617309",\n    "amount": 20.00,\n    "reference": "airtime_001"\n  }'`,
    'Node.js': `const res = await fetch('${API_BASE}/airtime/purchase', {\n  method: 'POST',\n  headers: {\n    'Authorization': '${API_KEY_PLACEHOLDER}',\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify({\n    network: 'MTN',\n    beneficiary_phone: '0551617309',\n    amount: 20.00,\n    reference: 'airtime_001',\n  }),\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ch = curl_init('${API_BASE}/airtime/purchase');\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}', 'Content-Type: application/json'],\n  CURLOPT_POSTFIELDS => json_encode([\n    'network' => 'MTN', 'beneficiary_phone' => '0551617309',\n    'amount' => 20.00, 'reference' => 'airtime_001',\n  ]),\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nr = requests.post('${API_BASE}/airtime/purchase',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'},\n  json={\n    'network': 'MTN', 'beneficiary_phone': '0551617309',\n    'amount': 20.00, 'reference': 'airtime_001',\n  }\n)\nprint(r.json())`,
}

const AIRTIME_ORDERS_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `# All recent orders\ncurl -X GET ${API_BASE}/airtime/orders \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"\n\n# Filter by status\ncurl -X GET "${API_BASE}/airtime/orders?status=completed" \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"`,
    'Node.js': `const res = await fetch('${API_BASE}/airtime/orders?status=completed', {\n  headers: { 'Authorization': '${API_KEY_PLACEHOLDER}' },\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ch = curl_init('${API_BASE}/airtime/orders?status=completed');\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}'],\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nr = requests.get('${API_BASE}/airtime/orders',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'},\n  params={'status': 'completed'})\nprint(r.json())`,
}

const AIRTIME_STATUS_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/airtime/orders/airtime_001 \\\n  -H "Authorization: ${API_KEY_PLACEHOLDER}"`,
    'Node.js': `const ref = 'airtime_001';\nconst res = await fetch(\`${API_BASE}/airtime/orders/\${ref}\`, {\n  headers: { 'Authorization': '${API_KEY_PLACEHOLDER}' },\n});\nconsole.log(await res.json());`,
    'PHP': `<?php\n$ref = 'airtime_001';\n$ch = curl_init("${API_BASE}/airtime/orders/$ref");\ncurl_setopt_array($ch, [\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY_PLACEHOLDER}'],\n]);\necho curl_exec($ch); curl_close($ch);`,
    'Python': `import requests\nref = 'airtime_001'\nr = requests.get(f'${API_BASE}/airtime/orders/{ref}',\n  headers={'Authorization': '${API_KEY_PLACEHOLDER}'})\nprint(r.json())`,
}

// ── Reference tabs (Data API, Airtime, Webhooks) ───────────────────────────
// Each tab carries its own table of contents as an internal sidebar: pinned
// beside the content on desktop (lg+), collapsed behind a toggle button on
// mobile. Rebuilt this way (rather than one long scroll) because the page
// had grown to cover 9 endpoints across two products plus webhook config —
// exactly the point where a flat list stops being navigable.
type RefTabKey = 'standard' | 'airtime' | 'webhooks'

const REF_TABS: { key: RefTabKey; label: string; icon: any }[] = [
    { key: 'standard', label: 'Standard API', icon: Key },
    { key: 'airtime', label: 'Airtime API', icon: Wifi },
    { key: 'webhooks', label: 'Webhooks', icon: Webhook },
]

const REF_TOC: Record<RefTabKey, { id: string; label: string }[]> = {
    standard: [
        { id: 'ref-std-baseurl', label: 'Base URL' },
        { id: 'ref-std-packages', label: 'GET /packages' },
        { id: 'ref-std-purchase', label: 'POST /data/purchase' },
        { id: 'ref-std-bulk', label: 'POST /data/bulk' },
        { id: 'ref-std-balance', label: 'GET /wallet/balance' },
        { id: 'ref-std-status', label: 'GET /orders/:reference' },
        { id: 'ref-std-meta', label: 'Networks & Errors' },
    ],
    airtime: [
        { id: 'ref-com-intro', label: 'Overview' },
        { id: 'ref-com-airtime-purchase', label: 'POST /airtime/purchase' },
        { id: 'ref-com-airtime-orders', label: 'GET /airtime/orders' },
        { id: 'ref-com-airtime-status', label: 'GET /airtime/orders/:reference' },
        { id: 'ref-com-meta', label: 'Rate Limits & Errors' },
    ],
    webhooks: [
        { id: 'ref-wh-intro', label: 'How webhooks work' },
        { id: 'ref-wh-config', label: 'Configure your endpoint' },
        { id: 'ref-wh-events', label: 'Event types' },
        { id: 'ref-wh-payload', label: 'Payload shape' },
        { id: 'ref-wh-verify', label: 'Verifying signatures' },
    ],
}

function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const SIGNATURE_VERIFY_SAMPLES: Record<ApiLangTab, string> = {
    'cURL': `# Signature verification isn't a curl operation — see the Node.js /\n# PHP / Python tabs. Your endpoint receives:\n#   X-Capozy-Signature: <hex hmac-sha256>\n# computed over the exact raw request body using your webhook secret.`,
    'Node.js': `const crypto = require('crypto');\n\nfunction isValidSignature(rawBody, signatureHeader, secret) {\n  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));\n}\n\n// Express example — use a raw-body parser, NOT the parsed JSON, since the\n// signature is computed over the exact bytes we sent.\napp.post('/webhooks/capozy', express.raw({ type: 'application/json' }), (req, res) => {\n  const signature = req.headers['x-capozy-signature'];\n  if (!isValidSignature(req.body, signature, process.env.CAPOZY_WEBHOOK_SECRET)) {\n    return res.status(401).send('invalid signature');\n  }\n  const event = JSON.parse(req.body);\n  // ... handle event.event / event.product / event.reference / event.status\n  res.sendStatus(200);\n});`,
    'PHP': `<?php\n$rawBody = file_get_contents('php://input');\n$signature = $_SERVER['HTTP_X_CAPOZY_SIGNATURE'] ?? '';\n$expected = hash_hmac('sha256', $rawBody, getenv('CAPOZY_WEBHOOK_SECRET'));\n\nif (!hash_equals($expected, $signature)) {\n    http_response_code(401);\n    exit('invalid signature');\n}\n\n$event = json_decode($rawBody, true);\n// ... handle $event['event'] / $event['product'] / $event['reference'] / $event['status']\nhttp_response_code(200);`,
    'Python': `import hmac, hashlib\n\ndef is_valid_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:\n    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, signature_header)\n\n# Flask example\n@app.route('/webhooks/capozy', methods=['POST'])\ndef webhook():\n    raw_body = request.get_data()\n    signature = request.headers.get('X-Capozy-Signature', '')\n    if not is_valid_signature(raw_body, signature, os.environ['CAPOZY_WEBHOOK_SECRET']):\n        return 'invalid signature', 401\n    event = request.get_json()\n    # ... handle event['event'] / event['product'] / event['reference'] / event['status']\n    return '', 200`,
}

function ApiReferenceSection({ standardKey }: { standardKey: ApiKeyMeta | null }) {
    const [activeTab, setActiveTab] = useState<RefTabKey>('standard')
    const [mobileTocOpen, setMobileTocOpen] = useState(false)

    return (
        <div className="space-y-6 w-full">
            {/* Section header */}
            <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-muted" />
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border">
                    <BookOpen className="w-4 h-4 text-brand-700 dark:text-brand-500" />
                    <span className="text-sm font-bold text-foreground/80 ">API Reference</span>
                </div>
                <div className="flex-1 h-px bg-muted" />
            </div>

            {/* Tab bar */}
            <div className="flex flex-wrap items-center justify-center gap-1 p-1 bg-muted rounded-2xl w-fit mx-auto">
                {REF_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setMobileTocOpen(false) }}
                        className={cn(
                            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150',
                            activeTab === tab.key
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-muted-foreground/70'
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Mobile TOC toggle */}
            <button
                onClick={() => setMobileTocOpen(o => !o)}
                className="lg:hidden flex items-center justify-between w-full px-4 py-2.5 neu-raised-sm rounded-2xl text-sm font-semibold text-foreground/80 "
            >
                <span className="flex items-center gap-2"><Menu className="w-4 h-4" /> On this page</span>
                {mobileTocOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {mobileTocOpen && (
                <nav className="lg:hidden neu-raised-sm rounded-2xl p-2">
                    {REF_TOC[activeTab].map(item => (
                        <button
                            key={item.id}
                            onClick={() => { scrollToSection(item.id); setMobileTocOpen(false) }}
                            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted dark:hover:bg-muted"
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
            )}

            {/* Sidebar (desktop, always open) + content */}
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 items-start">
                <nav className="hidden lg:block sticky top-6 neu-raised-sm rounded-3xl p-2">
                    <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">On this page</p>
                    {REF_TOC[activeTab].map(item => (
                        <button
                            key={item.id}
                            onClick={() => scrollToSection(item.id)}
                            className="block w-full text-left px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted dark:hover:bg-muted hover:text-foreground dark:hover:text-white transition-colors"
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="space-y-6 min-w-0">
                    {activeTab === 'standard' && <StandardApiTab />}
                    {activeTab === 'airtime' && <AirtimeApiTab />}
                    {activeTab === 'webhooks' && <WebhooksTab standardKey={standardKey} />}
                </div>
            </div>
        </div>
    )
}

function StandardApiTab() {
    return (
        <>
            <p className="text-sm text-muted-foreground">
                5 endpoints for buying data bundles. Replace <code className="font-mono text-brand-800 dark:text-brand-400 text-xs">cz_live_your_api_key_here</code> with your actual standard key.
            </p>

            {/* Base URL strip */}
            <div id="ref-std-baseurl" className="flex items-center gap-3 neu-raised-sm rounded-3xl px-5 py-3.5 flex-wrap scroll-mt-6">
                <span className="text-sm font-semibold text-muted-foreground">Base URL</span>
                <code className="text-sm font-mono text-foreground flex-1">{API_BASE}</code>
                <ApiCopyBtn text={API_BASE} />
            </div>

            {/* Endpoints */}
            <div id="ref-std-packages" className="scroll-mt-6">
            <ApiEndpointBlock
                method="GET" path="/api/packages"
                description="List available data packages with pricing for your account role. Use this to discover valid network/size combinations before placing orders."
                queryParams={[
                    { name: 'network', type: 'string', required: false, desc: 'Filter: MTN | Telecel | AT-iShare | AT-BigTime' },
                    { name: 'size_gb', type: 'number', required: false, desc: 'Filter by exact size e.g. 5' },
                ]}
                responseBody={`{\n  "success": true,\n  "data": {\n    "packages": [\n      {\n        "id": "uuid-...",\n        "network": "MTN",\n        "size": "5GB",\n        "volume_gb": 5,\n        "price": 4.50,\n        "currency": "GHS"\n      }\n    ],\n    "total": 12\n  }\n}`}
                notes={['Price shown is your role-specific price (agent, dealer, or standard).', 'Only available packages are returned.', 'Call this first to avoid 404 errors on purchase.']}
                samples={PKG_SAMPLES}
            />
            </div>

            <div id="ref-std-purchase" className="scroll-mt-6">
            <ApiEndpointBlock
                method="POST" path="/api/data/purchase"
                description="Purchase a single data bundle. Deducts from your wallet atomically."
                requestBody={`{\n  "network": "MTN",\n  "volume_gb": 5,\n  "recipient": "0551617309",\n  "reference": "order_001"\n}`}
                responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "order_001",\n    "status": "pending",\n    "network": "MTN",\n    "size": "5GB",\n    "recipient": "0551617309",\n    "price": 4.50,\n    "new_balance": 120.50\n  }\n}`}
                notes={[
                    'reference is your idempotency key — sending the same reference twice returns the existing order without charging.',
                    'network is case-sensitive: MTN, Telecel, AT-iShare, AT-BigTime.',
                    'recipient is a Ghana mobile number: 0XXXXXXXXX (10 digits) or 233XXXXXXXXX.',
                    'reference: 3-100 characters, letters, numbers and . _ : - only.',
                ]}
                samples={PURCHASE_API_SAMPLES}
            />
            </div>

            <div id="ref-std-bulk" className="scroll-mt-6">
            <ApiEndpointBlock
                method="POST" path="/api/data/bulk"
                description="Purchase up to 100 data bundles in one atomic batch. All orders succeed or none are charged."
                requestBody={`{\n  "orders": [\n    { "network": "MTN", "volume_gb": 5, "recipient": "0551617309", "reference": "b_001" },\n    { "network": "Telecel", "volume_gb": 2, "recipient": "0201234567", "reference": "b_002" }\n  ]\n}`}
                responseBody={`{\n  "success": true,\n  "data": {\n    "orders_placed": 2,\n    "total_cost": 7.00,\n    "new_balance": 113.50,\n    "orders": [{ "order_id": "...", "status": "pending", "reference": "b_001" }]\n  }\n}`}
                notes={['Max 100 orders per request.', 'Atomic: if any order fails validation, none are placed and nothing is charged.', 'A reference is optional per order; if you send one it must be unique in the batch (3-100 characters: letters, numbers and . _ : - only).', 'Sending the same references again returns the existing orders without charging (is_duplicate: true).']}
                samples={BULK_API_SAMPLES}
            />
            </div>

            <div id="ref-std-balance" className="scroll-mt-6">
            <ApiEndpointBlock
                method="GET" path="/api/wallet/balance"
                description="Retrieve your current wallet balance in GHS. Top up via the dashboard wallet page."
                responseBody={`{\n  "success": true,\n  "data": {\n    "balance": 124.50,\n    "currency": "GHS"\n  }\n}`}
                notes={['Top up at capozygh.com/dashboard/wallet.', 'Check before bulk orders to avoid insufficient balance failures.']}
                samples={BALANCE_API_SAMPLES}
            />
            </div>

            <div id="ref-std-status" className="scroll-mt-6">
            <ApiEndpointBlock
                method="GET" path="/api/orders/{reference}"
                description="Check the fulfillment status of an order by its reference code."
                responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "order_001",\n    "status": "completed",\n    "network": "MTN",\n    "size": "5GB",\n    "recipient": "0551617309",\n    "price": 4.50,\n    "source": "api",\n    "created_at": "2026-..."\n  }\n}`}
                notes={['Status flow: pending → processing → completed | failed.', 'Poll this after placing an order to confirm delivery.']}
                samples={STATUS_API_SAMPLES}
            />
            </div>

            {/* Networks + Errors in 2 columns */}
            <div id="ref-std-meta" className="grid grid-cols-1 lg:grid-cols-2 gap-5 scroll-mt-6">
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" /> Supported Networks
                    </h3>
                    <ApiRefTable
                        head={['Value', 'Provider']}
                        rows={[
                            [<code key="mtn" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"MTN"</code>, 'MTN Ghana'],
                            [<code key="tel" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"Telecel"</code>, 'Telecel Ghana'],
                            [<code key="at1" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"AT-iShare"</code>, 'AirtelTigo iShare'],
                            [<code key="at2" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"AT-BigTime"</code>, 'AirtelTigo BigTime'],
                        ]}
                    />
                    <p className="text-sm font-bold text-foreground flex items-center gap-2 pt-1">Number → Network Prefixes</p>
                    <ApiRefTable
                        head={['Network', 'Prefixes']}
                        rows={[
                            ['MTN', '024, 025, 053, 054, 055, 059'],
                            ['Telecel', '020, 050'],
                            ['AirtelTigo', '026, 027, 056, 057'],
                        ]}
                    />
                    <p className="text-xs text-foreground leading-relaxed">
                        Not guaranteed to stay fixed — operators occasionally get reassigned or new ranges opened. Don&apos;t
                        hardcode this list permanently; treat our API&apos;s response as the final word and re-check here
                        periodically.
                    </p>
                </div>
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" /> Error Codes
                    </h3>
                    <ApiRefTable
                        head={['Code', 'Meaning']}
                        rows={[
                            [<span key="400" className="font-mono font-bold text-red-500 text-xs">400</span>, 'Invalid request body or parameters'],
                            [<span key="401" className="font-mono font-bold text-red-500 text-xs">401</span>, 'Missing or invalid API key'],
                            [<span key="403" className="font-mono font-bold text-red-500 text-xs">403</span>, 'Key pending / revoked / role not allowed'],
                            [<span key="404" className="font-mono font-bold text-red-500 text-xs">404</span>, 'Package or order not found'],
                            [<span key="409" className="font-mono font-bold text-foreground text-xs">409</span>, 'Duplicate reference'],
                            [<span key="429" className="font-mono font-bold text-foreground text-xs">429</span>, 'Rate limit exceeded'],
                            [<span key="500" className="font-mono font-bold text-muted-foreground text-xs">500</span>, 'Server error'],
                            [<span key="503" className="font-mono font-bold text-muted-foreground text-xs">503</span>, 'API disabled by admin'],
                        ]}
                    />
                </div>
            </div>
        </>
    )
}

function AirtimeApiTab() {
    return (
        <>
            <div id="ref-com-intro" className="scroll-mt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Send MTN, Telecel or AT airtime to a beneficiary from your wallet. These endpoints use the same API key as the
                    Data API. Orders start as <code className="font-mono text-xs">pending</code> and are fulfilled by our team: poll the
                    status endpoint or configure a webhook to hear when an order reaches a final state.
                </p>
            </div>

            <div id="ref-com-airtime-purchase" className="scroll-mt-6">
            <ApiEndpointBlock
                method="POST" path="/api/airtime/purchase"
                description="Send airtime to a beneficiary at face value from your wallet. Auto-dispatches in the background — poll GET /airtime/orders/{reference} for the final status."
                requestBody={`{\n  "network": "MTN",\n  "beneficiary_phone": "0551617309",\n  "amount": 20.00,\n  "reference": "airtime_001"\n}`}
                responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "airtime_001",\n    "status": "pending",\n    "network": "MTN",\n    "beneficiary_phone": "0551617309",\n    "airtime_amount": 20.00,\n    "fee_amount": 0,\n    "total_paid": 20.00,\n    "new_balance": 415.00\n  }\n}`}
                notes={[
                    'reference is your idempotency key — sending the same reference twice returns the existing order without charging (is_duplicate: true).',
                    'network is one of MTN, Telecel, AT — a different value set from the Data API\'s network codes (which distinguish AT-iShare / AT-BigTime); airtime has no such distinction.',
                    'beneficiary_phone must be 0XXXXXXXXX (10 digits, starts with 0).',
                    'fee_amount is the platform fee added on top: the beneficiary receives exactly amount, and total_paid = amount + fee_amount.',
                    'amount must fall within the live per-role min/max limits configured by an admin.',
                ]}
                samples={AIRTIME_PURCHASE_SAMPLES}
            />
            </div>

            <div id="ref-com-airtime-orders" className="scroll-mt-6">
            <ApiEndpointBlock
                method="GET" path="/api/airtime/orders"
                description="Your most recent airtime orders, newest first, capped at 30 records."
                queryParams={[
                    { name: 'status', type: 'string', required: false, desc: 'Filter: pending | processing | completed | failed | refunded' },
                ]}
                responseBody={`{\n  "success": true,\n  "data": {\n    "orders": [\n      {\n        "order_id": "uuid-...",\n        "reference": "airtime_001",\n        "status": "completed",\n        "network": "MTN",\n        "beneficiary_phone": "0551617309",\n        "airtime_amount": 20.00,\n        "total_paid": 20.00,\n        "created_at": "2026-...",\n        "updated_at": "2026-..."\n      }\n    ],\n    "count": 1\n  }\n}`}
                notes={['Capped at 30 records — poll GET /airtime/orders/{reference} for a specific order beyond that window.', 'reference here is the value you originally sent, not our internal reference_code.']}
                samples={AIRTIME_ORDERS_SAMPLES}
            />
            </div>

            <div id="ref-com-airtime-status" className="scroll-mt-6">
            <ApiEndpointBlock
                method="GET" path="/api/airtime/orders/{reference}"
                description="Poll the fulfillment status of an airtime order using the reference from the /purchase response. Only returns orders that belong to your own account."
                responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "airtime_001",\n    "status": "refunded",\n    "network": "MTN",\n    "beneficiary_phone": "0551617309",\n    "airtime_amount": 20.00,\n    "fee_amount": 0,\n    "total_paid": 20.00,\n    "reason": "The transaction could not be completed by the payment provider.",\n    "created_at": "2026-...",\n    "updated_at": "2026-..."\n  }\n}`}
                notes={['Status flow: pending → processing → completed | failed | refunded.', 'reason is present only on an auto-refunded order (status "refunded") — a short human-readable sentence explaining why the provider\'s failure was treated as definitive.', 'Poll this after placing an order to confirm delivery.']}
                samples={AIRTIME_STATUS_SAMPLES}
            />
            </div>

            {/* Rate limits + Errors in 2 columns */}
            <div id="ref-com-meta" className="grid grid-cols-1 lg:grid-cols-2 gap-5 scroll-mt-6">
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Zap className="w-4 h-4 text-muted-foreground" /> Rate Limits (per key)
                    </h3>
                    <ApiRefTable
                        head={['Endpoint', 'Limit']}
                        rows={[
                            [<code key="rl5" className="font-mono text-brand-800 dark:text-brand-400 text-xs">POST /airtime/purchase</code>, '10 / min'],
                            [<code key="rl6" className="font-mono text-brand-800 dark:text-brand-400 text-xs">GET /airtime/orders</code>, '30 / min'],
                            [<code key="rl7" className="font-mono text-brand-800 dark:text-brand-400 text-xs">GET /airtime/orders/{'{reference}'}</code>, '30 / min'],
                        ]}
                    />
                </div>
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" /> Error Codes
                    </h3>
                    <ApiRefTable
                        head={['Code', 'Meaning']}
                        rows={[
                            [<span key="a400" className="font-mono font-bold text-red-500 text-xs">400</span>, 'Invalid network, phone, amount or reference, or insufficient wallet balance'],
                            [<span key="a401" className="font-mono font-bold text-red-500 text-xs">401</span>, 'Missing or invalid API key'],
                            [<span key="a403" className="font-mono font-bold text-red-500 text-xs">403</span>, 'Key pending / revoked, role not allowed, or this number cannot receive orders'],
                            [<span key="a404" className="font-mono font-bold text-red-500 text-xs">404</span>, 'Order or wallet not found'],
                            [<span key="a409" className="font-mono font-bold text-foreground text-xs">409</span>, 'Duplicate order or reference already in use'],
                            [<span key="a429" className="font-mono font-bold text-foreground text-xs">429</span>, 'Rate limit exceeded — see limits above'],
                            [<span key="a503" className="font-mono font-bold text-muted-foreground text-xs">503</span>, 'Airtime or this network is currently unavailable'],
                        ]}
                    />
                </div>
            </div>
        </>
    )
}

// ── Webhooks tab ─────────────────────────────────────────────────────────────
const WEBHOOK_PRODUCTS: { key: string; label: string }[] = [
    { key: 'data', label: 'Data bundle orders' },
    { key: 'resultschecker', label: 'Result checker vouchers' },
    { key: 'afa', label: 'AFA (MTN Authorized Field Agent) registrations' },
    { key: 'airtime', label: 'Airtime purchases' },
]

function WebhooksTab({ standardKey }: { standardKey: ApiKeyMeta | null }) {
    return (
        <>
            <div id="ref-wh-intro" className="scroll-mt-6 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    A webhook is a single HTTPS POST we send to your own server the instant an order you placed reaches a
                    final state — <code className="font-mono text-xs">completed</code> or <code className="font-mono text-xs">failed</code>.
                    It replaces polling <code className="font-mono text-xs">GET /orders/{'{reference}'}</code> in a loop:
                    configure a URL once below, and every relevant order notifies you as it resolves.
                </p>
                <div className="flex items-start gap-3 rounded-xl bg-muted/50 border border-border p-4">
                    <Webhook className="w-4 h-4 text-brand-700 dark:text-brand-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Webhooks are configured <strong>per key</strong>, not per product — your key's webhook covers data,
                        result checker, AFA and airtime orders together.
                        Delivery is fire-and-forget with one automatic retry; if both attempts fail, keep polling the status endpoint
                        as a fallback — we do not queue or replay missed deliveries.
                    </p>
                </div>
            </div>

            <div id="ref-wh-config" className="scroll-mt-6 space-y-4">
                <h3 className="text-sm font-bold text-foreground">Configure your endpoint</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {standardKey ? (
                        <WebhookConfigCard keyType="standard" />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border p-5 text-xs text-muted-foreground flex items-center justify-center text-center">
                            Generate a Standard API key above to configure its webhook.
                        </div>
                    )}
                </div>
            </div>

            <div id="ref-wh-events" className="scroll-mt-6 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Event types</h3>
                <ApiRefTable
                    head={['product', 'Fires for']}
                    rows={WEBHOOK_PRODUCTS.map(p => [
                        <code key={p.key} className="font-mono text-brand-800 dark:text-brand-400 text-xs">"{p.key}"</code>,
                        p.label,
                    ])}
                />
                <p className="text-xs text-muted-foreground">
                    Every event's <code className="font-mono">event</code> field is one of{' '}
                    <code className="font-mono text-brand-800 dark:text-brand-400">"order.completed"</code> or{' '}
                    <code className="font-mono text-brand-800 dark:text-brand-400">"order.failed"</code> — use{' '}
                    <code className="font-mono">product</code> to route the payload, not the event name alone.
                </p>
            </div>

            <div id="ref-wh-payload" className="scroll-mt-6 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Payload shape</h3>
                <CodeBlock label="POST to your webhook URL" code={`{\n  "event": "order.completed",\n  "product": "data",\n  "reference": "order_001",\n  "status": "completed",\n  "timestamp": "2026-08-31T10:15:00.000Z",\n  "detail": {\n    "network": "MTN",\n    "size": "5GB"\n  }\n}`} />
                <p className="text-xs text-muted-foreground">
                    <code className="font-mono">reference</code> is the same value you sent (or that was echoed back) when placing
                    the order — use it to look up your own record. <code className="font-mono">detail</code> varies by product and
                    is not present on every event; treat it as supplementary, and treat the earlier{' '}
                    <code className="font-mono">GET /orders/{'{reference}'}</code> response as the source of truth if it's ever
                    ambiguous.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    For <strong>airtime</strong> specifically, an{' '}
                    <code className="font-mono">"order.failed"</code> event's <code className="font-mono">detail</code> can also
                    include <code className="font-mono">reason_code</code> (one of{' '}
                    <code className="font-mono text-brand-800 dark:text-brand-400">"invalid_request"</code> |{' '}
                    <code className="font-mono text-brand-800 dark:text-brand-400">"provider_rejected"</code>) and{' '}
                    <code className="font-mono">reason</code>, a short human-readable sentence. When the provider's failure was
                    definitive and we auto-refunded your wallet, <code className="font-mono">detail</code> additionally includes{' '}
                    <code className="font-mono">refunded: true</code>, <code className="font-mono">refund_amount</code>, and{' '}
                    <code className="font-mono">new_balance</code> — and the event's outer{' '}
                    <code className="font-mono">status</code> field is <code className="font-mono">"refunded"</code> instead of{' '}
                    <code className="font-mono">"failed"</code>.{' '}
                    <strong className="text-foreground/80 ">
                        Your webhook handler should treat both "failed" and "refunded" as terminal failure states
                    </strong>{' '}
                    — checking only for "failed" will silently miss orders we've already refunded.
                </p>
            </div>

            <div id="ref-wh-verify" className="scroll-mt-6 space-y-4">
                <h3 className="text-sm font-bold text-foreground">Verifying signatures</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Every delivery carries an <code className="font-mono">X-Capozy-Signature</code> header — the HMAC-SHA256 of the exact
                    raw request body, keyed with the signing secret you were shown once when you saved the webhook URL above.
                    <strong className="text-foreground/80 "> Always verify it before trusting a payload</strong> — anyone
                    who learns your webhook URL can otherwise POST a fake "completed" event to it.
                </p>
                <EndpointSampleTabs samples={SIGNATURE_VERIFY_SAMPLES} />
            </div>
        </>
    )
}

// Standalone language-tab code sample block, matching ApiEndpointBlock's own
// tab styling but usable outside an endpoint card (the signature-verification
// snippet isn't documenting a request/response, so ApiEndpointBlock's shape
// doesn't fit it).
function EndpointSampleTabs({ samples }: { samples: Record<ApiLangTab, string> }) {
    const langs = Object.keys(samples) as ApiLangTab[]
    const [tab, setTab] = useState<ApiLangTab>(langs[0])
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-xl w-fit">
                {langs.map(l => (
                    <button
                        key={l}
                        onClick={() => setTab(l)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                            tab === l
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-muted-foreground/70'
                        )}
                    >
                        {l}
                    </button>
                ))}
            </div>
            <CodeBlock code={samples[tab]} label={tab} />
        </div>
    )
}

function PageHeader() {
    return (
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl clay-gold flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Developer API</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Integrate data purchases into your applications</p>
            </div>
        </div>
    )
}
