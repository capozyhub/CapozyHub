'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Scale, History } from 'lucide-react'
import { StatCards } from './components/StatCards'
import { UserSelector } from './components/UserSelector'
import { TopUpForm } from './components/TopUpForm'
import { SettlementsTab } from './components/SettlementsTab'
import { CreditsHistoryTab } from './components/CreditsHistoryTab'
import { cn } from '@/lib/utils'
import { useSearchParams, useRouter } from 'next/navigation'

const ROLE_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'dealer', label: 'Dealer' },
    { value: 'agent', label: 'Agent' },
    { value: 'customer', label: 'Customer' },
    { value: 'sub-admin', label: 'Sub-admin' },
    { value: 'admin', label: 'Admin' },
]

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

interface SelectedUser {
    id: string
    first_name: string
    last_name: string
    phone_number: string
    role: string
    wallet_balance: number
    pending_debt_total: number
    last_admin_topup_at: string | null
    last_admin_topup_amount: number | null
}

type TabType = 'topup' | 'settlements' | 'history'

export default function AdminTopUpPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const tabParam = searchParams.get('tab')
    const initialTab: TabType =
        tabParam === 'settlements' ? 'settlements' :
        tabParam === 'history' ? 'history' : 'topup'

    const [activeTab, setActiveTab] = useState<TabType>(initialTab)
    const [roleFilter, setRoleFilter] = useState('agent')
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null)
    const [stats, setStats] = useState<PageStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [settlementCount, setSettlementCount] = useState(0)
    const [statsFailed, setStatsFailed] = useState(false)

    const fetchStats = useCallback(async () => {
        setStatsFailed(false)
        try {
            const res = await fetch('/api/admin/top-up/page-stats')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
                setSettlementCount(data.pendingDebtUsersCount || 0)
            } else setStatsFailed(true)
        } catch { setStatsFailed(true) } finally { setStatsLoading(false) }
    }, [])

    useEffect(() => { fetchStats() }, [fetchStats])

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        const param = tab !== 'topup' ? `?tab=${tab}` : ''
        router.replace(`/admin/top-up${param}`, { scroll: false })
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Top up wallets
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Add money to a user's wallet, record anything they still owe, and settle it later.
                </p>
            </div>

            {/* Stat Cards */}
            {statsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
            ) : stats ? (
                <StatCards stats={stats} />
            ) : statsFailed ? (
                <div role="alert" className="neu-raised-sm rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-foreground">Could not load the totals above. Topping up still works.</p>
                    <button type="button" onClick={() => { setStatsLoading(true); fetchStats() }} className="clay-silver min-h-10 rounded-full px-4 text-sm font-semibold">Try again</button>
                </div>
            ) : null}

            {/* Tab Switcher — centered, large */}
            <div className="flex justify-center">
                <div role="tablist" className="flex gap-1 neu-inset rounded-2xl p-1.5 w-full sm:w-auto">
                    <button
                        onClick={() => handleTabChange('topup')}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all flex-1 sm:flex-auto justify-center',
                            activeTab === 'topup'
                                ? 'bg-card shadow-md text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <CreditCard className="w-4 h-4" />
                        Top up
                    </button>
                    <button
                        onClick={() => handleTabChange('settlements')}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all relative flex-1 sm:flex-auto justify-center',
                            activeTab === 'settlements'
                                ? 'bg-card shadow-md text-red-600 dark:text-red-400'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Scale className="w-4 h-4" />
                        Settlements
                        {settlementCount > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                {settlementCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('history')}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all flex-1 sm:flex-auto justify-center',
                            activeTab === 'history'
                                ? 'bg-card shadow-md text-brand-700 dark:text-brand-400'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <History className="w-4 h-4" />
                        Credit history
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'topup' && (
                <div className="space-y-4">
                    {/* Role Filter Buttons */}
                    <div className="flex flex-wrap gap-2">
                        {ROLE_FILTERS.map(f => (
                            <button
                                key={f.value}
                                type="button"
                                aria-pressed={roleFilter === f.value}
                                onClick={() => { setRoleFilter(f.value); setSelectedUser(null) }}
                                className={cn(
                                    'px-3 py-2 rounded-full text-xs font-semibold border transition-all',
                                    roleFilter === f.value
                                        ? 'clay-black border-transparent'
                                        : 'bg-card border-border hover:border-border text-muted-foreground'
                                )}
                            >
                                {f.label}
                                {f.value === 'agent' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalAgents})</span>
                                )}
                                {f.value === 'customer' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalCustomers})</span>
                                )}
                                {f.value === 'sub-admin' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalSubAdmins})</span>
                                )}
                                {f.value === 'all' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalUsers})</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* User Selector */}
                    <Card className="border-0">
                        <CardContent className="p-4 sm:p-6">
                            <UserSelector
                                roleFilter={roleFilter}
                                onUserSelect={setSelectedUser}
                                selectedUser={selectedUser}
                                onClear={() => setSelectedUser(null)}
                            />
                        </CardContent>
                    </Card>

                    {/* Top-Up Form */}
                    <Card className="border-0">
                        <CardContent className="p-4 sm:p-6">
                            <TopUpForm
                                selectedUser={selectedUser}
                                onSuccess={() => {
                                    setSelectedUser(null)
                                    fetchStats()
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'settlements' && (
                <Card className="border-0">
                    <CardContent className="p-4 sm:p-6">
                        <SettlementsTab onDebtChange={fetchStats} />
                    </CardContent>
                </Card>
            )}

            {activeTab === 'history' && (
                <Card className="border-0">
                    <CardContent className="p-4 sm:p-6">
                        <CreditsHistoryTab />
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
