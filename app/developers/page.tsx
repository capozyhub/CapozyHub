'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import Link from 'next/link'
import {
    Copy, Check,
    Lock, Zap, List, Globe, AlertCircle, Code2, ArrowRight,
    Menu, X, ExternalLink, AlertTriangle,
    UserCheck, Smartphone, GraduationCap, BadgeCheck, Lightbulb,
} from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { BRAND } from '@/lib/brand'

// ─── Types ────────────────────────────────────────────────────────────────────
type Method = 'GET' | 'POST'
type LangTab = 'cURL' | 'Node.js' | 'PHP' | 'Python'

const LANG_TABS: LangTab[] = ['cURL', 'Node.js', 'PHP', 'Python']

// ─── TOC ─────────────────────────────────────────────────────────────────────
const TOC = [
    { id: 'authentication', label: 'Authentication', icon: Lock },
    { id: 'response-format', label: 'Response format', icon: Code2 },
    { id: 'endpoints', label: 'Endpoints', icon: List },
    { id: 'account-role', label: 'Account and role', icon: UserCheck },
    { id: 'airtime', label: 'Airtime', icon: Smartphone },
    { id: 'resultschecker', label: 'Results Checker', icon: GraduationCap },
    { id: 'afa', label: 'AFA Registration', icon: BadgeCheck },
    { id: 'tips', label: 'Tips', icon: Lightbulb },
    { id: 'networks', label: 'Networks', icon: Globe },
    { id: 'errors', label: 'Error codes', icon: AlertCircle },
    { id: 'examples', label: 'Code examples', icon: Zap },
]

// ─── Copy Button ─────────────────────────────────────────────────────────────
function CopyBtn({ text, className }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try { await navigator.clipboard.writeText(text) } catch {
            const el = Object.assign(document.createElement('textarea'), { value: text })
            document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove()
        }
        setCopied(true)
        toast.success('Copied')
        setTimeout(() => setCopied(false), 2200)
    }
    return (
        <button
            onClick={copy}
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                'neu-night text-silver-100 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                className
            )}
        >
            {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    )
}

// ─── Code Block ──────────────────────────────────────────────────────────────
function CodeBlock({ code, label, className }: { code: string; label?: string; className?: string }) {
    return (
        <div className={cn('neu-night rounded-xl overflow-hidden', className)}>
            {label && (
                <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-silver-200/80">{label}</span>
                    <CopyBtn text={code} />
                </div>
            )}
            {!label && (
                <div className="flex justify-end px-2 py-2 border-b border-white/10">
                    <CopyBtn text={code} />
                </div>
            )}
            <div className="neu-night-in overflow-x-auto p-4 m-2 rounded-lg">
                <pre className="text-[13px] font-mono text-silver-100 leading-relaxed whitespace-pre">{code}</pre>
            </div>
        </div>
    )
}

// ─── Inline Code ─────────────────────────────────────────────────────────────
function IC({ children }: { children: React.ReactNode }) {
    return (
        <code className="text-[12px] font-mono bg-muted text-brand-800 dark:text-brand-400 px-1.5 py-0.5 rounded-md">
            {children}
        </code>
    )
}

// ─── Method Badge ─────────────────────────────────────────────────────────────
const METHOD_COLORS: Record<Method, string> = {
    GET: 'bg-foreground/10 text-foreground border-foreground/20',
    POST: 'bg-brand-500/15 text-brand-700 dark:text-brand-400 border-brand-500/30',
}

function MethodBadge({ method }: { method: Method }) {
    return (
        <span className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border font-mono',
            METHOD_COLORS[method]
        )}>
            {method}
        </span>
    )
}

// ─── Endpoint Section (always open, plain) ────────────────────────────────────
function EndpointSection({
    method, path, description, queryParams, requestBody, responseBody, notes, codeSamples,
}: {
    method: Method; path: string; description: string
    queryParams?: { name: string; type: string; required: boolean; desc: string }[]
    requestBody?: string; responseBody: string; notes?: string[]
    codeSamples: Record<LangTab, string>
}) {
    const [lang, setLang] = useState<LangTab>('cURL')

    return (
        <div className="neu-raised-sm rounded-3xl overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
                <MethodBadge method={method} />
                <code className="text-sm font-mono font-semibold text-foreground break-all">{path}</code>
                <span className="text-xs text-muted-foreground ml-auto hidden sm:block">{description}</span>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

                {/* Query params */}
                {queryParams && queryParams.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold mb-3">Query parameters</p>
                        <div className="neu-inset rounded-xl overflow-hidden divide-y divide-border">
                            {queryParams.map(p => (
                                <div key={p.name} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                                    <code className="font-mono text-brand-800 dark:text-brand-400 text-xs font-bold w-24 flex-shrink-0 mt-0.5">{p.name}</code>
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.type}</span>
                                    {!p.required && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">optional</span>}
                                    <span className="text-muted-foreground text-xs flex-1 min-w-[140px]">{p.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Request / Response */}
                <div className={cn('grid gap-5', requestBody ? 'sm:grid-cols-2' : 'grid-cols-1 max-w-xl')}>
                    {requestBody && (
                        <div>
                            <p className="text-sm font-semibold mb-2">Request body</p>
                            <CodeBlock code={requestBody} />
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-semibold mb-2">Response</p>
                        <CodeBlock code={responseBody} />
                    </div>
                </div>

                {/* Notes */}
                {notes && notes.length > 0 && (
                    <ul className="space-y-2 neu-inset rounded-xl p-4">
                        {notes.map((note, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5 flex-shrink-0">→</span>
                                <span className="leading-relaxed">{note}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Code samples */}
                <div className="space-y-2">
                    <p className="text-sm font-semibold">Code sample</p>
                    <div className="neu-inset flex flex-wrap gap-1 p-1 rounded-full w-fit" role="tablist" aria-label="Language">
                        {LANG_TABS.map(l => (
                            <button
                                key={l}
                                role="tab"
                                aria-selected={lang === l}
                                onClick={() => setLang(l)}
                                className={cn(
                                    'min-h-9 px-3 rounded-full text-xs font-semibold transition-all',
                                    lang === l
                                        ? 'clay-gold'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    <CodeBlock code={codeSamples[lang]} label={lang} />
                </div>
            </div>
        </div>
    )
}

// ─── Section Heading ──────────────────────────────────────────────────────────
function SectionHeading({ id, num, label }: { id: string; num: number; label: string }) {
    return (
        <h2 id={id} className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight text-foreground scroll-mt-24">
            <span className="clay-gold w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" aria-hidden="true">
                {num}
            </span>
            {label}
        </h2>
    )
}

// ─── Table ────────────────────────────────────────────────────────────────────
function DocTable({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
    return (
        <div className="neu-raised-sm rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                    <thead>
                        <tr className="bg-muted/60">
                            {head.map(h => (
                                <th key={h} className="text-left px-5 py-3 text-sm font-semibold text-muted-foreground">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/40 transition-colors">
                                {row.map((cell, j) => (
                                    <td key={j} className="px-5 py-3 text-foreground/80">{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Endpoint Data ────────────────────────────────────────────────────────────
// v1 has been fully ported and eliminated (owner decision, 2026-08-31 — all
// developers were notified and confirmed). BASE now points at the ONLY live
// API surface; every sample below inherits the flip automatically since they
// all interpolate ${BASE} rather than hardcoding a version.
const BASE = 'https://api.capozygh.com/api'
const KEY = 'cs_live_your_api_key_here'

const PACKAGES_SAMPLES: Record<LangTab, string> = {
    'cURL': `# All packages
curl -X GET ${BASE}/packages \\
  -H "Authorization: ${KEY}"

# Filter by network
curl -X GET "${BASE}/packages?network=MTN" \\
  -H "Authorization: ${KEY}"

# Filter by network + size
curl -X GET "${BASE}/packages?network=MTN&size_gb=5" \\
  -H "Authorization: ${KEY}"`,
    'Node.js': `// All packages
const res = await fetch('${BASE}/packages', {
  headers: { 'Authorization': '${KEY}' },
});
console.log(await res.json());

// Filter by network
const mtn = await fetch('${BASE}/packages?network=MTN', {
  headers: { 'Authorization': '${KEY}' },
});
console.log(await mtn.json());`,
    'PHP': `<?php
$ch = curl_init('${BASE}/packages?network=MTN');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

# All packages
r = requests.get('${BASE}/packages',
  headers={'Authorization': '${KEY}'})
print(r.json())

# Filter by network
r = requests.get('${BASE}/packages',
  headers={'Authorization': '${KEY}'},
  params={'network': 'MTN'})
print(r.json())`,
}

const PURCHASE_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X POST ${BASE}/data/purchase \\
  -H "Authorization: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "volume_gb": 5,
    "recipient": "0551617309",
    "reference": "order_001"
  }'`,
    'Node.js': `const res = await fetch('${BASE}/data/purchase', {
  method: 'POST',
  headers: {
    'Authorization': '${KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    network: 'MTN', volume_gb: 5,
    recipient: '0551617309', reference: 'order_001',
  }),
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${BASE}/data/purchase');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: ${KEY}',
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
  '${BASE}/data/purchase',
  headers={'Authorization': '${KEY}'},
  json={
    'network': 'MTN', 'volume_gb': 5,
    'recipient': '0551617309', 'reference': 'order_001',
  }
)
print(r.json())`,
}

const BULK_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X POST ${BASE}/data/bulk \\
  -H "Authorization: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orders": [
      {"network":"MTN","volume_gb":5,"recipient":"0551617309","reference":"b_001"},
      {"network":"Telecel","volume_gb":2,"recipient":"0201234567","reference":"b_002"}
    ]
  }'`,
    'Node.js': `const res = await fetch('${BASE}/data/bulk', {
  method: 'POST',
  headers: { 'Authorization': '${KEY}', 'Content-Type': 'application/json' },
  body: JSON.stringify({ orders: [
    { network: 'MTN', volume_gb: 5, recipient: '0551617309', reference: 'b_001' },
    { network: 'Telecel', volume_gb: 2, recipient: '0201234567', reference: 'b_002' },
  ]}),
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${BASE}/data/bulk');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${KEY}', 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['orders' => [
    ['network'=>'MTN','volume_gb'=>5,'recipient'=>'0551617309','reference'=>'b_001'],
    ['network'=>'Telecel','volume_gb'=>2,'recipient'=>'0201234567','reference'=>'b_002'],
  ]]),
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.post('${BASE}/data/bulk',
  headers={'Authorization': '${KEY}'},
  json={'orders': [
    {'network':'MTN','volume_gb':5,'recipient':'0551617309','reference':'b_001'},
    {'network':'Telecel','volume_gb':2,'recipient':'0201234567','reference':'b_002'},
  ]}
)
print(r.json())`,
}

const BALANCE_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${BASE}/wallet/balance \\
  -H "Authorization: ${KEY}"`,
    'Node.js': `const res = await fetch('${BASE}/wallet/balance', {
  headers: { 'Authorization': '${KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${BASE}/wallet/balance');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests
r = requests.get('${BASE}/wallet/balance',
  headers={'Authorization': '${KEY}'})
print(r.json())`,
}

const ORDER_STATUS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${BASE}/orders/your_reference_here \\
  -H "Authorization: ${KEY}"`,
    'Node.js': `const ref = 'your_reference_here';
const res = await fetch(\`${BASE}/orders/\${ref}\`, {
  headers: { 'Authorization': '${KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ref = 'your_reference_here';
$ch = curl_init("${BASE}/orders/$ref");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests
ref = 'your_reference_here'
r = requests.get(f'${BASE}/orders/{ref}',
  headers={'Authorization': '${KEY}'})
print(r.json())`,
}

// ─── Endpoint Data ───────────────────────────────────────────────────────
// API_BASE and BASE are now the same string — the full v1→v2 port completed
// and v1 is retired. Kept as a separate name (rather than merged into BASE)
// because these product sections (Account & Role, Airtime, Results Checker,
// AFA Registration) were added before the port and this avoids re-touching
// every sample in this block for a purely cosmetic rename.
const API_BASE = 'https://api.capozygh.com/api'
const API_KEY = KEY // same key material — one standard key for the whole API

const ACCOUNT_ROLE_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/account/role \\
  -H "Authorization: ${API_KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/account/role', {
  headers: { 'Authorization': '${API_KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/account/role');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.get('${API_BASE}/account/role',
  headers={'Authorization': '${API_KEY}'})
print(r.json())`,
}

const AIRTIME_PURCHASE_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X POST ${API_BASE}/airtime/purchase \\
  -H "Authorization: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "beneficiary_phone": "0551617309",
    "amount": 10,
    "reference": "air_001"
  }'`,
    'Node.js': `const res = await fetch('${API_BASE}/airtime/purchase', {
  method: 'POST',
  headers: { 'Authorization': '${KEY}', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    network: 'MTN', beneficiary_phone: '0551617309',
    amount: 10, reference: 'air_001',
  }),
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/airtime/purchase');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: ${KEY}',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'network' => 'MTN', 'beneficiary_phone' => '0551617309',
    'amount' => 10, 'reference' => 'air_001',
  ]),
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.post(
  '${API_BASE}/airtime/purchase',
  headers={'Authorization': '${KEY}'},
  json={
    'network': 'MTN', 'beneficiary_phone': '0551617309',
    'amount': 10, 'reference': 'air_001',
  }
)
print(r.json())`,
}

const AIRTIME_ORDERS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/airtime/orders \\
  -H "Authorization: ${KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/airtime/orders', {
  headers: { 'Authorization': '${KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/airtime/orders');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.get('${API_BASE}/airtime/orders',
  headers={'Authorization': '${KEY}'})
print(r.json())`,
}

const AIRTIME_STATUS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/airtime/orders/air_001 \\
  -H "Authorization: ${KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/airtime/orders/air_001', {
  headers: { 'Authorization': '${KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/airtime/orders/air_001');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests
ref = 'air_001'
r = requests.get(f'${API_BASE}/airtime/orders/{ref}',
  headers={'Authorization': '${KEY}'})
print(r.json())`,
}

const RC_TYPES_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/resultschecker/types \\
  -H "Authorization: ${API_KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/resultschecker/types', {
  headers: { 'Authorization': '${API_KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/resultschecker/types');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.get('${API_BASE}/resultschecker/types',
  headers={'Authorization': '${API_KEY}'})
print(r.json())`,
}

const RC_PURCHASE_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X POST ${API_BASE}/resultschecker/purchase \\
  -H "Authorization: ${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "typeId": "uuid-of-a-type-from-GET-types",
    "quantity": 1,
    "reference": "rc_001"
  }'`,
    'Node.js': `const res = await fetch('${API_BASE}/resultschecker/purchase', {
  method: 'POST',
  headers: { 'Authorization': '${API_KEY}', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    typeId: 'uuid-of-a-type-from-GET-types',
    quantity: 1, reference: 'rc_001',
    // recipientPhone / recipientEmail are optional — omit both to receive
    // the vouchers in this response only and deliver them yourself.
  }),
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/resultschecker/purchase');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: ${API_KEY}',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'typeId' => 'uuid-of-a-type-from-GET-types',
    'quantity' => 1, 'reference' => 'rc_001',
  ]),
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.post(
  '${API_BASE}/resultschecker/purchase',
  headers={'Authorization': '${API_KEY}'},
  json={
    'typeId': 'uuid-of-a-type-from-GET-types',
    'quantity': 1, 'reference': 'rc_001',
  }
)
print(r.json())`,
}

const RC_ORDERS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/resultschecker/orders \\
  -H "Authorization: ${API_KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/resultschecker/orders', {
  headers: { 'Authorization': '${API_KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/resultschecker/orders');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.get('${API_BASE}/resultschecker/orders',
  headers={'Authorization': '${API_KEY}'})
print(r.json())`,
}

const RC_STATUS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/resultschecker/orders/rc_001 \\
  -H "Authorization: ${API_KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/resultschecker/orders/rc_001', {
  headers: { 'Authorization': '${API_KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/resultschecker/orders/rc_001');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests
ref = 'rc_001'
r = requests.get(f'${API_BASE}/resultschecker/orders/{ref}',
  headers={'Authorization': '${API_KEY}'})
print(r.json())`,
}

const AFA_REGISTER_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X POST ${API_BASE}/afa/register \\
  -H "Authorization: ${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "afa_001",
    "full_name": "Kwame Mensah",
    "phone": "0551617309",
    "id_type": "Ghana Card",
    "id_number": "GHA-123456789-0",
    "date_of_birth": "1995-04-12",
    "region": "Greater Accra",
    "location": "Madina"
  }'`,
    'Node.js': `const res = await fetch('${API_BASE}/afa/register', {
  method: 'POST',
  headers: { 'Authorization': '${API_KEY}', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reference: 'afa_001',
    full_name: 'Kwame Mensah', phone: '0551617309',
    id_type: 'Ghana Card', id_number: 'GHA-123456789-0',
    date_of_birth: '1995-04-12', region: 'Greater Accra', location: 'Madina',
  }),
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/afa/register');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: ${API_KEY}',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'reference' => 'afa_001',
    'full_name' => 'Kwame Mensah', 'phone' => '0551617309',
    'id_type' => 'Ghana Card', 'id_number' => 'GHA-123456789-0',
    'date_of_birth' => '1995-04-12', 'region' => 'Greater Accra', 'location' => 'Madina',
  ]),
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.post(
  '${API_BASE}/afa/register',
  headers={'Authorization': '${API_KEY}'},
  json={
    'reference': 'afa_001',
    'full_name': 'Kwame Mensah', 'phone': '0551617309',
    'id_type': 'Ghana Card', 'id_number': 'GHA-123456789-0',
    'date_of_birth': '1995-04-12', 'region': 'Greater Accra', 'location': 'Madina',
  }
)
print(r.json())`,
}

const AFA_ORDERS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/afa/orders \\
  -H "Authorization: ${API_KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/afa/orders', {
  headers: { 'Authorization': '${API_KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/afa/orders');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests

r = requests.get('${API_BASE}/afa/orders',
  headers={'Authorization': '${API_KEY}'})
print(r.json())`,
}

const AFA_STATUS_SAMPLES: Record<LangTab, string> = {
    'cURL': `curl -X GET ${API_BASE}/afa/orders/afa_001 \\
  -H "Authorization: ${API_KEY}"`,
    'Node.js': `const res = await fetch('${API_BASE}/afa/orders/afa_001', {
  headers: { 'Authorization': '${API_KEY}' },
});
console.log(await res.json());`,
    'PHP': `<?php
$ch = curl_init('${API_BASE}/afa/orders/afa_001');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: ${API_KEY}'],
]);
echo curl_exec($ch); curl_close($ch);`,
    'Python': `import requests
ref = 'afa_001'
r = requests.get(f'${API_BASE}/afa/orders/{ref}',
  headers={'Authorization': '${API_KEY}'})
print(r.json())`,
}

// ─── TOC Nav ──────────────────────────────────────────────────────────────────
function TocNav({ activeSection, onSelect }: { activeSection: string; onSelect: (id: string) => void }) {
    return (
        <nav aria-label="On this page" className="space-y-1">
            <p className="px-3 pb-2 text-sm font-semibold text-muted-foreground">On this page</p>
            {TOC.map(item => {
                const Icon = item.icon
                const active = activeSection === item.id
                return (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500',
                            active ? 'neu-inset font-semibold text-foreground' : 'font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                        )}
                    >
                        <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-brand-700 dark:text-brand-500')} aria-hidden="true" />
                        {item.label}
                    </button>
                )
            })}
            <div className="mt-4 space-y-2 border-t border-border pt-4">
                <Link href="/dashboard/api" className="clay-gold flex min-h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                    Get an API key <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="/openapi.yaml" target="_blank" rel="noopener noreferrer" className="clay-black flex min-h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                    OpenAPI spec <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
            </div>
        </nav>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DevelopersPage() {
    const [activeSection, setActiveSection] = useState('authentication')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeLang, setActiveLang] = useState<LangTab>('cURL')

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => { entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) }) },
            { rootMargin: '-15% 0% -65% 0%', threshold: 0 }
        )
        TOC.forEach(({ id }) => { const el = document.getElementById(id); if (el) observer.observe(el) })
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : ''
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
    }, [sidebarOpen])

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setActiveSection(id)
        setSidebarOpen(false)
    }

    return (
        <div className="min-h-screen bg-black">

            {sidebarOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
                    <div role="dialog" aria-modal="true" aria-label="Contents" className="neu-raised fixed inset-y-0 left-0 z-50 flex w-72 flex-col rounded-r-3xl lg:hidden">
                        <div className="flex flex-shrink-0 items-center justify-between px-5 py-4">
                            <span className="font-display text-base font-bold">API docs</span>
                            <button onClick={() => setSidebarOpen(false)} className="neu-raised-sm flex h-9 w-9 items-center justify-center rounded-full" aria-label="Close contents">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <TocNav activeSection={activeSection} onSelect={scrollTo} />
                        </div>
                    </div>
                </>
            )}

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <header className="relative isolate overflow-hidden bg-black text-white">
                <BrandSwoosh className="pointer-events-none absolute -bottom-10 -right-[28%] -z-10 w-full opacity-80 sm:-right-[8%] sm:w-[65%]" />
                <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pb-28 xl:max-w-6xl 2xl:max-w-[1600px]">
                    <Link href="/" aria-label={BRAND.name} className="flex w-fit items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                        <BrandLogo width={40} height={40} className="h-10 w-10" />
                        <span className="font-display text-xl font-bold tracking-tight">{BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span></span>
                    </Link>
                    <h1 className="mt-10 font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl">
                        Build on the {BRAND.name} API.
                    </h1>
                    <p className="mt-4 max-w-xl text-lg leading-relaxed text-silver-200">
                        Sell data bundles, airtime, results checker vouchers and AFA registration from your own app. Orders are paid from your wallet at your role&apos;s price.
                    </p>
                    <div className="mt-8 grid max-w-2xl gap-4">
                        <div className="neu-night flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
                            <span className="text-sm font-semibold text-silver-200">Base URL</span>
                            <code className="overflow-x-auto whitespace-nowrap font-mono text-sm font-semibold text-white">{BASE}</code>
                            <CopyBtn text={BASE} className="ml-auto" />
                        </div>
                        <div className="neu-night rounded-2xl">
                            <div className="flex items-center justify-between px-4 pt-3">
                                <span className="text-sm font-semibold text-silver-200">Authentication header</span>
                                <CopyBtn text={`Authorization: ${KEY}`} />
                            </div>
                            <div className="neu-night-in m-2 overflow-x-auto rounded-xl px-4 py-3">
                                <pre className="whitespace-nowrap font-mono text-sm text-brand-400">{'Authorization: '}<span className="text-white">{KEY}</span></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Docs sheet ───────────────────────────────────────────────── */}
            <main className="relative -mt-8 rounded-t-[2rem] bg-neu shadow-[0_-18px_40px_rgba(0,0,0,0.35)]">
                {/* Coverage notice: the most important scope fact, shown before anything else. */}
                <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 xl:max-w-6xl 2xl:max-w-[1600px]">
                    <div className="neu-inset flex items-start gap-3 rounded-2xl px-4 py-3.5" role="note">
                        <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" aria-hidden="true" />
                        <p className="text-sm leading-relaxed text-foreground">
                            <strong>Ghana networks only.</strong> The API serves MTN, Telecel, AT-iShare and AT-BigTime on Ghanaian numbers. International numbers and networks are not supported.
                        </p>
                    </div>
                </div>

                {/* Mobile contents bar */}
                <div className="sticky top-0 z-30 mx-auto mt-4 max-w-5xl px-4 lg:hidden">
                    <div className="neu-raised-sm flex items-center justify-between gap-4 rounded-2xl px-4 py-2.5">
                        <span className="truncate text-sm font-semibold">
                            {TOC.find(t => t.id === activeSection)?.label ?? 'Introduction'}
                        </span>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="clay-gold flex min-h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                        >
                            <Menu className="h-3.5 w-3.5" aria-hidden="true" />Contents
                        </button>
                    </div>
                </div>

            <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 xl:max-w-6xl 2xl:max-w-[1600px]">
                <div className="flex flex-col gap-10 lg:flex-row">

                    <aside className="hidden w-52 flex-shrink-0 lg:block xl:w-60">
                        <div className="sticky top-8">
                            <TocNav activeSection={activeSection} onSelect={scrollTo} />
                        </div>
                    </aside>
                    <div className="flex-1 min-w-0 space-y-14">

                        {/* 1. Authentication */}
                        <section id="authentication" className="space-y-5">
                            <SectionHeading id="authentication" num={1} label="Authentication" />
                            <div className="neu-raised-sm rounded-3xl p-6 space-y-5">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    All API requests must include your API key in the <IC>Authorization</IC> header — no Bearer prefix required.
                                </p>
                                <CodeBlock code={`Authorization: ${KEY}`} />
                                <div className="flex items-start gap-3 neu-inset rounded-xl p-4">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" aria-hidden="true" />
                                    <p className="text-sm text-foreground">
                                        <strong>Save your key.</strong> Your API key is shown <em>only once</em> when generated. Store it securely — losing it requires generating a new key, which permanently revokes the old one.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground mb-3">Getting Your API Key</h3>
                                    <ol className="space-y-2">
                                        {[
                                            `Log in to your ${BRAND.name} account (agent role required)`,
                                            'Navigate to Dashboard → Developer API',
                                            'Click Generate API Key and accept the policy',
                                            'Copy and store the key — it will not be shown again',
                                            'Wait for admin approval (status: pending → active)',
                                        ].map((step, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                                <span className="clay-gold w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    {i + 1}
                                                </span>
                                                {step}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </section>

                        {/* 2. Response Format */}
                        <section id="response-format" className="space-y-5">
                            <SectionHeading id="response-format" num={2} label="Response format" />
                            <div className="neu-raised-sm rounded-3xl p-6 space-y-5">
                                <p className="text-sm text-muted-foreground">All responses follow a consistent JSON structure:</p>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5" /> Success
                                        </p>
                                        <CodeBlock code={`{\n  "success": true,\n  "data": { ... },\n  "meta": {\n    "timestamp": "2026-..."\n  }\n}`} />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" /> Error
                                        </p>
                                        <CodeBlock code={`{\n  "success": false,\n  "error": {\n    "code": 400,\n    "message": "..."\n  }\n}`} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 3. Endpoints */}
                        <section id="endpoints" className="space-y-5">
                            <SectionHeading id="endpoints" num={3} label="Endpoints" />
                            <p className="text-sm text-muted-foreground">Eight endpoints — all require a valid API key in the <IC>Authorization</IC> header.</p>
                            <div className="space-y-6">

                                <EndpointSection
                                    method="GET" path="/api/packages"
                                    description="List all available data packages with pricing for your account role. Call this first to discover valid network and size combinations."
                                    queryParams={[
                                        { name: 'network', type: 'string', required: false, desc: 'Filter by network: MTN, Telecel, AT-iShare, AT-BigTime (case-sensitive)' },
                                        { name: 'size_gb', type: 'number', required: false, desc: 'Filter by exact GB size e.g. 5' },
                                    ]}
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "packages": [\n      {\n        "id": "uuid-...",\n        "network": "MTN",\n        "size": "5GB",\n        "volume_gb": 5,\n        "price": 4.50,\n        "currency": "GHS"\n      }\n    ],\n    "total": 12\n  }\n}`}
                                    notes={[
                                        'Price is your role-specific price (agent, dealer, or standard customer).',
                                        'Only packages with is_available = true are returned.',
                                        'Use this to validate network/size combinations before placing orders.',
                                    ]}
                                    codeSamples={PACKAGES_SAMPLES}
                                />

                                <EndpointSection
                                    method="POST" path="/api/data/purchase"
                                    description="Purchase a single data bundle for a recipient phone number. Deducts from your wallet instantly."
                                    requestBody={`{\n  "network": "MTN",\n  "volume_gb": 5,\n  "recipient": "0551617309",\n  "reference": "order_001"\n}`}
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "order_001",\n    "status": "pending",\n    "network": "MTN",\n    "size": "5GB",\n    "recipient": "0551617309",\n    "price": 4.50,\n    "new_balance": 120.50\n  }\n}`}
                                    notes={[
                                        'reference is your idempotency key — sending the same reference twice returns the existing order without double-charging.',
                                        'status starts as "pending". Poll GET /api/orders/{reference} to track it.',
                                        'network must be one of: MTN, Telecel, AT-iShare, AT-BigTime (case-sensitive).',
                                        'volume_gb must match an available package. Use GET /packages to confirm.',
                                        'recipient must be a Ghana mobile number: 0XXXXXXXXX (10 digits) or 233XXXXXXXXX.',
                                    ]}
                                    codeSamples={PURCHASE_SAMPLES}
                                />

                                <EndpointSection
                                    method="POST" path="/api/data/bulk"
                                    description="Purchase up to 100 data bundles in a single batch. The batch is all-or-nothing: a validation failure (invalid network, package not found, out of stock, blocked recipient) rejects the whole batch and nothing is charged."
                                    requestBody={`{\n  "orders": [\n    {\n      "network": "MTN",\n      "volume_gb": 5,\n      "recipient": "0551617309",\n      "reference": "b_001"\n    },\n    {\n      "network": "Telecel",\n      "volume_gb": 2,\n      "recipient": "0201234567",\n      "reference": "b_002"\n    }\n  ]\n}`}
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "orders_placed": 2,\n    "total_cost": 7.00,\n    "new_balance": 113.50,\n    "orders": [\n      { "order_id": "...", "reference": "b_001", "status": "pending" }\n    ]\n  }\n}`}
                                    notes={[
                                        'Maximum 100 orders per batch request.',
                                        'All-or-nothing: one bad order in the array rejects the whole batch and nothing is charged.',
                                        'Sending the same references again returns the existing orders without charging (is_duplicate: true).',
                                        'Each order in the array follows the same rules as single purchase.',
                                    ]}
                                    codeSamples={BULK_SAMPLES}
                                />

                                <EndpointSection
                                    method="GET" path="/api/wallet/balance"
                                    description="Retrieve your current wallet balance in GHS. Use before large orders to verify you have sufficient funds."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "balance": 124.50,\n    "currency": "GHS"\n  }\n}`}
                                    notes={[
                                        'Top up your wallet via the web dashboard at capozygh.com/dashboard/wallet.',
                                        'Check balance before bulk orders to prevent partial failures due to insufficient funds.',
                                    ]}
                                    codeSamples={BALANCE_SAMPLES}
                                />

                                <EndpointSection
                                    method="GET" path="/api/orders/{reference}"
                                    description="Check the fulfillment status of an order using the reference code you provided when placing it."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "order_001",\n    "status": "completed",\n    "network": "MTN",\n    "size": "5GB",\n    "recipient": "0551617309",\n    "price": 4.50,\n    "source": "api",\n    "created_at": "2026-..."\n  }\n}`}
                                    notes={[
                                        'Use the same reference you passed when calling /data/purchase or /data/bulk.',
                                        'Status lifecycle: pending → processing → completed | failed | refunded.',
                                        'pending — order accepted and awaiting dispatch to the network.',
                                        'processing — dispatched to the network and being fulfilled.',
                                        'completed — bundle delivered successfully.',
                                        'failed — the order could not be fulfilled.',
                                        'refunded — the order was refunded to your wallet / original payment method.',
                                        'Poll this endpoint after placing an order to confirm delivery.',
                                    ]}
                                    codeSamples={ORDER_STATUS_SAMPLES}
                                />

                            </div>
                        </section>

                        {/* 4. Account & Role */}
                        <section id="account-role" className="space-y-5">
                            <SectionHeading id="account-role" num={4} label="Account and role" />
                            <p className="text-sm text-muted-foreground">
                                Check your own role and, if it&apos;s time-limited, how many days are left — no support ticket needed.
                            </p>
                            <div className="space-y-6">
                                <EndpointSection
                                    method="GET" path="/api/account/role"
                                    description="Returns your current role and, for dealer/agent, the days remaining before it lapses."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "role": "dealer",\n    "is_active": true,\n    "is_permanent": false,\n    "expires_at": "2026-...",\n    "days_remaining": 12\n  }\n}`}
                                    notes={[
                                        'is_permanent: true and expires_at: null means a lifetime dealer/agent, or a plain customer account — there is nothing to expire.',
                                        'is_active becomes false the moment expires_at passes, even though role in the users table has not changed yet — the platform prices you as a customer from that exact moment on every endpoint, not just this one.',
                                        'Rate limit: 30/min.',
                                    ]}
                                    codeSamples={ACCOUNT_ROLE_SAMPLES}
                                />
                            </div>
                        </section>

                        {/* 5. Airtime */}
                        <section id="airtime" className="space-y-5">
                            <SectionHeading id="airtime" num={5} label="Airtime" />
                            <p className="text-sm text-muted-foreground">
                                Send MTN, Telecel, or AT airtime to a beneficiary from your wallet. The beneficiary receives exactly the amount you send;
                                the platform fee is added on top. Orders start as <IC>pending</IC> and are fulfilled by our team: poll the status endpoint or use a webhook.
                            </p>
                            <div className="space-y-6">
                                <EndpointSection
                                    method="POST" path="/api/airtime/purchase"
                                    description="Send airtime to a beneficiary from your wallet. The order is fulfilled by our team — poll GET /airtime/orders/{reference} for the final status."
                                    requestBody={`{\n  "network": "MTN",\n  "beneficiary_phone": "0551617309",\n  "amount": 10,\n  "reference": "air_001"\n}`}
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "air_001",\n    "status": "pending",\n    "network": "MTN",\n    "beneficiary_phone": "0551617309",\n    "airtime_amount": 10,\n    "fee_amount": 0,\n    "total_paid": 10,\n    "new_balance": 90\n  }\n}`}
                                    notes={[
                                        'reference is your idempotency key (3–100 chars) — a repeat with the SAME reference and body returns the existing order instead of charging again; a reused reference against a DIFFERENT order returns 409 and your wallet is not charged.',
                                        'fee_amount is the platform fee added on top: the beneficiary receives exactly amount, and total_paid = amount + fee_amount.',
                                        'Rate limit: 10/min.',
                                    ]}
                                    codeSamples={AIRTIME_PURCHASE_SAMPLES}
                                />
                                <EndpointSection
                                    method="GET" path="/api/airtime/orders"
                                    description="List your most recent airtime orders."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "orders": [ { "order_id": "uuid-...", "reference": "air_001", "status": "completed", "network": "MTN", "airtime_amount": 10 } ]\n  }\n}`}
                                    notes={['Returns at most 30 records, newest first. Rate limit: 30/min.']}
                                    codeSamples={AIRTIME_ORDERS_SAMPLES}
                                />
                                <EndpointSection
                                    method="GET" path="/api/airtime/orders/{reference}"
                                    description="Check the status of one airtime order using the reference you sent when placing it."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "air_001",\n    "status": "refunded",\n    "network": "MTN",\n    "beneficiary_phone": "0551617309",\n    "airtime_amount": 10,\n    "reason": "The transaction could not be completed by the payment provider."\n  }\n}`}
                                    notes={['Rate limit: 30/min.', 'Status flow: pending → processing → completed | failed | refunded. A definitive provider failure auto-refunds your wallet — status becomes "refunded" and `reason` is present with a short, fixed explanation (never raw provider text).']}
                                    codeSamples={AIRTIME_STATUS_SAMPLES}
                                />
                            </div>
                        </section>

                        {/* 6. Results Checker */}
                        <section id="resultschecker" className="space-y-5">
                            <SectionHeading id="resultschecker" num={6} label="Results Checker" />
                            <p className="text-sm text-muted-foreground">
                                Sell WAEC/BECE/WASSCE results checker vouchers. Same <IC>standard</IC> key.
                            </p>
                            <div className="neu-inset rounded-xl p-4 text-xs text-foreground leading-relaxed">
                                <strong>Vouchers are returned directly in the purchase response</strong> — there is no separate
                                &quot;retrieve voucher&quot; call. <IC>recipientPhone</IC> / <IC>recipientEmail</IC> are optional
                                and have no fallback to your own account: omit both and Capozy Hub sends nothing — you own
                                delivering the voucher to your customer.
                            </div>
                            <div className="space-y-6">
                                <EndpointSection
                                    method="GET" path="/api/resultschecker/types"
                                    description="List available voucher types with YOUR OWN role-based price and current stock."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "types": [ { "type_id": "uuid-...", "name": "WAEC BECE", "price": 18, "available_count": 412, "is_active": true } ]\n  }\n}`}
                                    notes={['Rate limit: 30/min.']}
                                    codeSamples={RC_TYPES_SAMPLES}
                                />
                                <EndpointSection
                                    method="POST" path="/api/resultschecker/purchase"
                                    description="Buy voucher(s). Stock is checked BEFORE your wallet is touched — insufficient stock is rejected upfront, never charged then refunded."
                                    requestBody={`{\n  "typeId": "uuid-of-a-type-from-GET-types",\n  "quantity": 1,\n  "reference": "rc_001",\n  "recipientPhone": "0551617309",\n  "recipientEmail": "customer@example.com"\n}`}
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order": { "id": "uuid-...", "reference": "rc_001", "status": "completed", "type_name": "WAEC BECE", "quantity": 1, "unit_price": 18, "total_paid": 18 },\n    "vouchers": [ { "id": "uuid-...", "pin": "1234-5678-9012", "serial_number": "SN-000123" } ],\n    "new_balance": 82\n  }\n}`}
                                    notes={[
                                        'recipientPhone / recipientEmail are OPTIONAL. Pass either (or both) to also have Capozy Hub deliver the voucher by SMS/email as a courtesy — the vouchers array in this response is always the authoritative copy either way.',
                                        'reference is your idempotency key — a reused reference against a different order returns 409, wallet untouched.',
                                        'Rate limit: 10/min.',
                                    ]}
                                    codeSamples={RC_PURCHASE_SAMPLES}
                                />
                                <EndpointSection
                                    method="GET" path="/api/resultschecker/orders"
                                    description="List your most recent results checker orders."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "orders": [ { "id": "uuid-...", "reference": "rc_001", "status": "completed", "type_name": "WAEC BECE", "quantity": 1 } ]\n  }\n}`}
                                    notes={['Returns at most 30 records, newest first. Rate limit: 30/min.']}
                                    codeSamples={RC_ORDERS_SAMPLES}
                                />
                                <EndpointSection
                                    method="GET" path="/api/resultschecker/orders/{reference}"
                                    description="Look up one order, including its vouchers again if you need to recover them."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order": { "id": "uuid-...", "reference": "rc_001", "status": "completed" },\n    "vouchers": [ { "id": "uuid-...", "pin": "1234-5678-9012", "serial_number": "SN-000123" } ]\n  }\n}`}
                                    notes={['Rate limit: 30/min.']}
                                    codeSamples={RC_STATUS_SAMPLES}
                                />
                            </div>
                        </section>

                        {/* 7. AFA Registration */}
                        <section id="afa" className="space-y-5">
                            <SectionHeading id="afa" num={7} label="AFA Registration" />
                            <p className="text-sm text-muted-foreground">
                                Register an MTN AFA agent on behalf of your customer. Same <IC>standard</IC> key.
                            </p>
                            <div className="space-y-6">
                                <EndpointSection
                                    method="POST" path="/api/afa/register"
                                    description="Submit an AFA registration. Requires a valid Ghana Card and a supported region."
                                    requestBody={`{\n  "reference": "afa_001",\n  "full_name": "Kwame Mensah",\n  "phone": "0551617309",\n  "id_type": "Ghana Card",\n  "id_number": "GHA-123456789-0",\n  "date_of_birth": "1995-04-12",\n  "region": "Greater Accra",\n  "location": "Madina"\n}`}
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "order_id": "uuid-...",\n    "reference": "afa_001",\n    "status": "pending",\n    "new_balance": 64.0\n  }\n}`}
                                    notes={[
                                        'id_type must be exactly "Ghana Card"; id_number must match GHA-XXXXXXXXX-X.',
                                        'region must be one of the 16 official Ghana regions (Greater Accra, Ashanti, Western, Eastern, Central, Northern, Volta, Upper East, Upper West, Bono, Bono East, Ahafo, Savannah, North East, Oti, Western North).',
                                        'Applicant must be 18 or older — computed from date_of_birth.',
                                        'reference is your idempotency key. It is GLOBAL across all developers, not just your own account — a reused reference already taken by anyone returns 409, never a silent success.',
                                        'This carries Ghana Card KYC data — send it only over HTTPS, which is all this API accepts.',
                                        'Rate limit: 10/min.',
                                    ]}
                                    codeSamples={AFA_REGISTER_SAMPLES}
                                />
                                <EndpointSection
                                    method="GET" path="/api/afa/orders"
                                    description="List your most recent AFA registrations."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "orders": [ { "id": "uuid-...", "reference": "afa_001", "status": "pending" } ]\n  }\n}`}
                                    notes={['Returns at most 30 records, newest first. Rate limit: 30/min.']}
                                    codeSamples={AFA_ORDERS_SAMPLES}
                                />
                                <EndpointSection
                                    method="GET" path="/api/afa/orders/{reference}"
                                    description="Check the status of one AFA registration."
                                    responseBody={`{\n  "success": true,\n  "data": {\n    "id": "uuid-...",\n    "reference": "afa_001",\n    "status": "processing"\n  }\n}`}
                                    notes={[
                                        'Status lifecycle: pending → processing → completed | cancelled.',
                                        'Rate limit: 30/min.',
                                    ]}
                                    codeSamples={AFA_STATUS_SAMPLES}
                                />
                            </div>
                        </section>

                        {/* 10. Tips & Recommendations */}
                        <section id="tips" className="space-y-6">
                            <SectionHeading id="tips" num={8} label="Tips" />
                            <p className="text-sm text-muted-foreground">
                                One key covers the whole API: data, airtime, results checker, AFA, wallet and orders.
                            </p>

                            <div className="neu-raised-sm rounded-3xl p-6 space-y-4">
                                <p className="text-sm font-bold text-foreground">Your API key</p>
                                <ul className="space-y-2.5 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2"><span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5">→</span><span>Always send a unique <IC>reference</IC> per order — it becomes your idempotency key. A retry with the SAME reference and body safely returns the existing order instead of charging twice; reusing a reference for a genuinely DIFFERENT order returns <IC>409</IC> instead of a silent duplicate charge.</span></li>
                                    <li className="flex items-start gap-2"><span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5">→</span><span>Poll <IC>GET .../orders/&#123;reference&#125;</IC> after placing an order rather than assuming success from the initial <IC>pending</IC> status.</span></li>
                                    <li className="flex items-start gap-2"><span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5">→</span><span>Results Checker vouchers arrive directly in the purchase response — save them immediately. There is no separate voucher-retrieval call beyond the order-status lookup.</span></li>
                                    <li className="flex items-start gap-2"><span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5">→</span><span>Validate the AFA Ghana Card format and region client-side before calling the API — it avoids a wasted request on an obvious input mistake.</span></li>
                                    <li className="flex items-start gap-2"><span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5">→</span><span>If you serve dealer/agent accounts, check <IC>GET /account/role</IC> — pricing is expiry-aware everywhere, so a lapsed reseller is automatically billed as a customer the moment their tier expires.</span></li>
                                    <li className="flex items-start gap-2"><span className="text-brand-700 dark:text-brand-500 font-bold mt-0.5">→</span><span>Every list endpoint returns at most 30 records. Design your integration to look up by reference or page through results, not to fetch everything in one call.</span></li>
                                </ul>
                            </div>

                            <div className="neu-raised-sm rounded-3xl p-6 space-y-4">
                                <p className="text-sm font-bold text-foreground">Network number validation</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    We detect a recipient/beneficiary&apos;s network from the number&apos;s prefix before submitting an
                                    order. As of this writing:
                                </p>
                                <DocTable
                                    head={['Network', 'Prefixes']}
                                    rows={[
                                        ['MTN', '024, 025, 053, 054, 055, 059'],
                                        ['Telecel', '020, 050'],
                                        ['AirtelTigo', '026, 027, 056, 057'],
                                    ]}
                                />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    These are <strong>not guaranteed to stay fixed</strong> — Ghanaian operators occasionally get
                                    reassigned or new ranges opened by the regulator. Don&apos;t hardcode this list as a permanent
                                    source of truth in your own client-side validation; our API&apos;s response is the final word on
                                    whether a number/network pairing is accepted, and it&apos;s worth re-checking this page
                                    periodically for changes.
                                </p>
                            </div>

                            <div className="neu-inset rounded-xl p-4 text-sm text-foreground">
                                Need a higher rate limit, custom pricing, or a role adjustment? Message admin support from your
                                dashboard — don&apos;t build workarounds around a limit; we can usually just raise it for you.
                            </div>
                        </section>

                        {/* 11. Networks */}
                        <section id="networks" className="space-y-5">
                            <SectionHeading id="networks" num={9} label="Networks" />
                            <DocTable
                                head={['Network Value', 'Provider', 'Notes']}
                                rows={[
                                    [<code key="mtn" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"MTN"</code>, 'MTN Ghana', 'Most widely available bundles'],
                                    [<code key="tel" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"Telecel"</code>, 'Telecel Ghana (formerly Vodafone)', ''],
                                    [<code key="at1" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"AT-iShare"</code>, 'AirtelTigo iShare', 'AirtelTigo bundle type 1'],
                                    [<code key="at2" className="font-mono text-brand-800 dark:text-brand-400 text-xs">"AT-BigTime"</code>, 'AirtelTigo BigTime', 'AirtelTigo bundle type 2'],
                                ]}
                            />
                            <div className="neu-inset rounded-xl p-4 text-sm text-foreground">
                                Network values are <strong>case-sensitive</strong>. Use <IC>GET /packages</IC> to see exactly which networks and sizes are currently available.
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                This is the complete list — the four networks above are the only ones this API serves. There is no
                                network value for any carrier outside Ghana, and none will be accepted.
                            </p>
                        </section>

                        {/* 12. Error Codes */}
                        <section id="errors" className="space-y-5">
                            <SectionHeading id="errors" num={10} label="Error codes" />
                            <DocTable
                                head={['Code', 'When it occurs']}
                                rows={[
                                    [<span key="400" className="font-mono font-bold text-red-500">400</span>, 'Bad request — invalid phone, volume_gb, network value, or malformed body'],
                                    [<span key="401" className="font-mono font-bold text-red-500">401</span>, 'Missing or invalid API key'],
                                    [<span key="403" className="font-mono font-bold text-red-500">403</span>, 'Key pending approval, revoked, suspended account, or role not allowed'],
                                    [<span key="404" className="font-mono font-bold text-red-500">404</span>, 'Package or order not found for the given network/size/reference'],
                                    [<span key="409" className="font-mono font-bold text-amber-500">409</span>, 'Duplicate reference — an order with this reference already exists.'],
                                    [<span key="429" className="font-mono font-bold text-amber-500">429</span>, 'Rate limit exceeded — back off and retry after a short delay'],
                                    [<span key="500" className="font-mono font-bold text-muted-foreground">500</span>, 'Internal server error — contact support if persistent'],
                                    [<span key="503" className="font-mono font-bold text-muted-foreground">503</span>, 'API feature temporarily disabled by administrator'],
                                ]}
                            />
                        </section>

                        {/* 13. Code Examples */}
                        <section id="examples" className="space-y-5">
                            <SectionHeading id="examples" num={11} label="Code examples" />
                            <p className="text-sm text-muted-foreground">Complete runnable data purchase example. Select your language.</p>
                            <div className="neu-inset flex flex-wrap gap-1 p-1 rounded-full w-fit" role="tablist" aria-label="Language">
                                {LANG_TABS.map(l => (
                                    <button key={l} role="tab" aria-selected={activeLang === l} onClick={() => setActiveLang(l)}
                                        className={cn('min-h-10 px-4 rounded-full text-sm font-semibold transition-all',
                                            activeLang === l
                                                ? 'clay-gold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <CodeBlock code={PURCHASE_SAMPLES[activeLang]} label={activeLang} />
                        </section>

                        {/* Footer */}
                        <div className="border-t border-border pt-10 text-center">
                            <p className="text-sm text-muted-foreground mb-4">Ready to start building?</p>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <Link href="/dashboard/api" className="clay-gold inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-8 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                                    Get your API key <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                                <a href="/openapi.yaml" target="_blank" rel="noopener noreferrer" className="clay-black inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-8 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                                    OpenAPI spec <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </a>
                            </div>                            <p className="mt-6 text-xs text-muted-foreground">
                                &copy; {new Date().getFullYear()} {BRAND.name}. Need help? Contact support from your dashboard.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
            </main>
        </div>
    )
}
