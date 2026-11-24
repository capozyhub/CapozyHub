'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, ExternalLink, ShieldAlert, AlertTriangle } from 'lucide-react'
import { cardSurface, mutedSurface, sectionLabel, accent } from './dashboard-tokens'
import { CRITICAL_TOGGLE_KEYS, MONEY_CONFIG_KEYS, TOGGLE_META, type ToggleKey } from '@/lib/admin-settings'

// Per-key default when the setting row is absent (mirrors /admin/settings parsing).
const DEFAULT_ON: Record<ToggleKey, boolean> = {
    auto_fulfillment_enabled: false,
    page_access_storefront: true,
}

const MONEY_LABELS: Record<string, { label: string; prefix?: string; suffix?: string }> = {
    paystack_fee_percent: { label: 'Customer fee', suffix: '%' },
    agent_paystack_fee_percent: { label: 'Agent fee', suffix: '%' },
    dealer_paystack_fee_percent: { label: 'Dealer fee', suffix: '%' },
    paystack_min_topup: { label: 'Min top-up', prefix: '₵' },
    paystack_max_topup: { label: 'Max top-up', prefix: '₵' },
    mtn_price_adjustment: { label: 'MTN adjustment', prefix: '₵' },
}

export function SystemControlCenter() {
    const { isAdmin } = useAuth()
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        const keys = [...CRITICAL_TOGGLE_KEYS, ...MONEY_CONFIG_KEYS]
        ;(supabase.from('admin_settings') as any)
            .select('key, value')
            .in('key', keys)
            .then(({ data }: { data: { key: string; value: string }[] | null }) => {
                if (!active) return
                const map: Record<string, string> = {}
                ;(data || []).forEach(r => { map[r.key] = r.value })
                setSettings(map)
                setLoading(false)
            })
        return () => { active = false }
    }, [])

    const isOn = (key: ToggleKey): boolean => {
        const v = settings[key]
        if (v === undefined) return DEFAULT_ON[key]
        return DEFAULT_ON[key] ? v !== 'false' : v === 'true'
    }

    const handleToggle = async (key: ToggleKey, next: boolean) => {
        if (!isAdmin) return
        setBusy(key)
        const prev = settings[key]
        setSettings(s => ({ ...s, [key]: next ? 'true' : 'false' })) // optimistic
        try {
            const res = await fetch('/api/admin/settings/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: next }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || 'Failed to update')
            }
            // Reconcile from the server's canonical value rather than the optimistic guess.
            const body = await res.json().catch(() => ({}))
            if (body?.value === 'true' || body?.value === 'false') {
                setSettings(s => ({ ...s, [key]: body.value }))
            }
            toast.success(`${TOGGLE_META[key].label} ${next ? 'enabled' : 'disabled'}`)
        } catch (e: any) {
            setSettings(s => ({ ...s, [key]: prev })) // revert
            toast.error(e.message || 'Failed to update setting')
        } finally {
            setBusy(null)
        }
    }

    const paymentMaintenance = process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true'

    return (
        <div className={cn(cardSurface, 'p-5')}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" style={{ color: accent.red }} />
                    <h2 className={sectionLabel}>System controls</h2>
                </div>
                <Link href="/admin/settings" className="inline-flex items-center gap-1 rounded text-xs font-bold text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:hover:text-white dark:focus-visible:outline-brand-500">
                    Open settings <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            {!isAdmin && (
                <div className="flex items-center gap-2 mb-3 text-xs text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5" /> Read-only. You need the admin role to change these.
                </div>
            )}

            {/* Kill-switches */}
            <div className="space-y-2">
                {CRITICAL_TOGGLE_KEYS.map(key => {
                    const on = isOn(key)
                    return (
                        <div key={key} className={cn(mutedSurface, 'p-3 flex items-center justify-between gap-3')}>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">{TOGGLE_META[key].label}</p>
                                <p className="text-xs text-muted-foreground truncate">{TOGGLE_META[key].description}</p>
                            </div>
                            <Switch
                                checked={on}
                                disabled={!isAdmin || busy === key || loading}
                                onCheckedChange={(v) => handleToggle(key, v)}
                                className="flex-shrink-0"
                            />
                        </div>
                    )
                })}

                {/* Payment maintenance — env-controlled, read-only */}
                <div className={cn(mutedSurface, 'p-3 flex items-center justify-between gap-3')}>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            Payment maintenance
                            {paymentMaintenance && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />}
                        </p>
                        <p className="text-xs text-muted-foreground">Set in the environment. Redeploy to change it.</p>
                    </div>
                    <span className={cn('text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap', paymentMaintenance ? 'glass-inset text-amber-700 dark:text-amber-400' : 'glass-inset text-emerald-700 dark:text-emerald-400')}>
                        {paymentMaintenance ? 'ON' : 'OFF'}
                    </span>
                </div>
            </div>

            {/* Read-only money config */}
            <h2 className={cn(sectionLabel, 'mt-5 mb-2')}>Money settings</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MONEY_CONFIG_KEYS.map(key => {
                    const meta = MONEY_LABELS[key]
                    const raw = settings[key]
                    const display = raw && raw.trim() !== '' ? `${meta.prefix || ''}${raw}${meta.suffix || ''}` : '—'
                    return (
                        <div key={key} className={cn(mutedSurface, 'p-2.5')}>
                            <p className="text-xs font-semibold text-muted-foreground truncate">{meta.label}</p>
                            <p className="text-sm font-bold text-foreground">{loading ? '…' : display}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
