'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ShoppingCart, Store, Banknote, MessageSquare, BadgeCheck, Crown, ArrowRight, type LucideIcon } from 'lucide-react'
import { cardSurface, focusRing } from './dashboard-tokens'
import type { AdminCounts } from '@/hooks/use-admin-counts'

interface ActionDef {
    key: keyof AdminCounts
    href: string
    label: string
    suffix: string
    icon: LucideIcon
}

// The carded actions. The "N things need you" total is derived from THIS list only, so the
// headline count can never disagree with the cards shown. (Summing every count, including
// pendingFulfillment and pendingDebts, double-counted orders and inflated it.)
const ACTIONS: ActionDef[] = [
    { key: 'pendingOrders', href: '/admin/orders', label: 'Orders', suffix: 'pending', icon: ShoppingCart },
    { key: 'pendingShops', href: '/admin/shops', label: 'Shops', suffix: 'to review', icon: Store },
    { key: 'pendingWithdrawals', href: '/admin/shops/withdrawals', label: 'Withdrawals', suffix: 'pending', icon: Banknote },
    { key: 'pendingComplaints', href: '/admin/complaints', label: 'Complaints', suffix: 'open', icon: MessageSquare },
    { key: 'pendingAfa', href: '/admin/afa-management', label: 'AFA', suffix: 'pending', icon: BadgeCheck },
    { key: 'expiringAgents', href: '/admin/memberships', label: 'Agents', suffix: 'expiring', icon: Crown },
]

/** Total actions = sum of carded counts only (single source of truth). */
export function totalActions(counts: AdminCounts): number {
    return ACTIONS.reduce((sum, a) => sum + (counts[a.key] || 0), 0)
}

export function ActionRequiredRail({ counts }: { counts: AdminCounts }) {
    const active = ACTIONS.filter(a => (counts[a.key] || 0) > 0)
    if (active.length === 0) return null

    return (
        <section aria-label="Needs your attention" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-in fade-in slide-in-from-top-2 duration-500 motion-reduce:animate-none">
            {active.map(a => {
                const Icon = a.icon
                return (
                    <Link key={a.key} href={a.href} className={cn('group rounded-2xl', focusRing)}>
                        <div className={cn(cardSurface, 'glass-hover flex h-full items-center justify-between gap-3 rounded-2xl p-3.5')}>
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="clay-gold flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-muted-foreground">{a.label}</p>
                                    <p className="text-base font-bold tabular-nums text-foreground">
                                        {counts[a.key]} <span className="text-sm font-medium text-muted-foreground">{a.suffix}</span>
                                    </p>
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                        </div>
                    </Link>
                )
            })}
        </section>
    )
}
