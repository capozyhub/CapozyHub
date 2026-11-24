'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ShoppingCart, Users, Package, Wallet, CreditCard, Settings, type LucideIcon } from 'lucide-react'
import { cardSurface, mutedSurface, sectionLabel, focusRing, accent } from './dashboard-tokens'

interface QuickAction {
    href: string
    label: string
    icon: LucideIcon
    color: string
    adminOnly?: boolean
}

const ACTIONS: QuickAction[] = [
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, color: accent.blue },
    { href: '/admin/top-up', label: 'Top-up', icon: Wallet, color: accent.yellow, adminOnly: true },
    { href: '/admin/users', label: 'Users', icon: Users, color: accent.violet, adminOnly: true },
    { href: '/admin/packages', label: 'Packages', icon: Package, color: accent.emerald, adminOnly: true },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard, color: accent.red, adminOnly: true },
    { href: '/admin/settings', label: 'Settings', icon: Settings, color: accent.slate, adminOnly: true },
]

export function QuickActions({ isSubAdmin }: { isSubAdmin: boolean }) {
    const actions = ACTIONS.filter(a => !(isSubAdmin && a.adminOnly))

    return (
        <div className={cn(cardSurface, 'p-5')}>
            <h2 className={cn(sectionLabel, 'mb-4')}>Quick actions</h2>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                {actions.map(a => {
                    const Icon = a.icon
                    return (
                        <Link
                            key={a.href}
                            href={a.href}
                            className={cn(mutedSurface, 'glass-hover flex flex-col items-center gap-2 p-3.5 text-center', focusRing)}
                        >
                            <Icon className="h-5 w-5" style={{ color: a.color }} aria-hidden="true" />
                            <span className="text-sm font-medium text-foreground">{a.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
