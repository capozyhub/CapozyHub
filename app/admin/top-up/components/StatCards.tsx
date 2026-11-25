'use client'

import { Wallet, Users, Crown, User, TrendingUp, Banknote, AlertTriangle, ShieldCheck } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import Link from 'next/link'

interface PageStats {
    totalWalletBalance: number
    totalUsers: number
    totalDealers: number
    totalAgents: number
    totalCustomers: number
    totalSubAdmins: number
    totalAdminTopUpsToday: number
    totalCreditedToday: number
    totalOwed: number
    pendingDebtUsersCount: number
}

export function StatCards({ stats }: { stats: PageStats }) {
    const owed = stats.totalOwed > 0
    const debtors = stats.pendingDebtUsersCount > 0
    const cards: { label: string; value: string; icon: any; tone?: string; href?: string }[] = [
        { label: 'Money in wallets', value: formatCurrency(stats.totalWalletBalance), icon: Wallet },
        { label: 'Users', value: String(stats.totalUsers), icon: Users },
        { label: 'Dealers', value: String(stats.totalDealers), icon: ShieldCheck },
        { label: 'Agents', value: String(stats.totalAgents), icon: Crown },
        { label: 'Customers', value: String(stats.totalCustomers), icon: User },
        { label: 'Top-ups today', value: String(stats.totalAdminTopUpsToday), icon: TrendingUp },
        { label: 'Credited today', value: formatCurrency(stats.totalCreditedToday), icon: Banknote },
        {
            label: 'Owed to you',
            value: formatCurrency(stats.totalOwed),
            icon: AlertTriangle,
            tone: owed ? 'text-red-600 dark:text-red-400' : undefined,
            href: '/admin/top-up?tab=settlements',
        },
        {
            label: 'Users who owe',
            value: `${stats.pendingDebtUsersCount} ${stats.pendingDebtUsersCount === 1 ? 'user' : 'users'}`,
            icon: Users,
            tone: debtors ? 'text-red-600 dark:text-red-400' : undefined,
            href: '/admin/top-up?tab=settlements',
        },
    ]

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cards.map((card) => {
                const content = (
                    <div className={cn('neu-raised-sm rounded-3xl p-4', card.href && 'transition-transform hover:-translate-y-0.5')}>
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-muted-foreground mb-1 truncate">{card.label}</p>
                                <p className={cn('text-lg sm:text-xl font-semibold tabular-nums truncate', card.tone ?? 'text-foreground')}>{card.value}</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-muted flex-shrink-0 flex items-center justify-center">
                                <card.icon className={cn('w-4 h-4', card.tone ?? 'text-muted-foreground')} />
                            </div>
                        </div>
                    </div>
                )
                return card.href ? (
                    <Link key={card.label} href={card.href} className="rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-brand-500">{content}</Link>
                ) : (
                    <div key={card.label}>{content}</div>
                )
            })}
        </div>
    )
}
