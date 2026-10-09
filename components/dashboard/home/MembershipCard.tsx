'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Crown, Shield, Zap, ZapOff } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { roleConfig, resolveRoleKey } from '@/lib/roles'
import { RoleAvatar } from '@/components/dashboard/role-avatar'
import AutoUpgradeQuickModal from '@/components/upgrade/AutoUpgradeQuickModal'

function daysUntil(iso?: string | null): number | null {
    if (!iso) return null
    const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
    return d > 0 ? d : 0
}

function memberFor(createdAt?: string | null): string {
    if (!createdAt) return 'New member'
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
    if (days < 1) return 'Joined today'
    if (days < 30) return `Member for ${days} ${days === 1 ? 'day' : 'days'}`
    if (days < 365) { const m = Math.floor(days / 30); return `Member for ${m} ${m === 1 ? 'month' : 'months'}` }
    const y = Math.floor(days / 365)
    return `Member for ${y} ${y === 1 ? 'year' : 'years'}`
}

const linkClass = 'inline-flex items-center gap-1 rounded text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-brand-500'

export function MembershipCard() {
    const { dbUser, isAdmin, isSubAdmin, refreshUser } = useAuth()
    const [modal, setModal] = useState<'enable' | 'manage' | null>(null)
    if (!dbUser) return null

    const roleKey = resolveRoleKey({ isAdmin, isSubAdmin, role: dbUser.role })
    const cfg = roleConfig[roleKey]
    const paid = dbUser.role === 'agent' || dbUser.role === 'dealer'
    const expiresAt = dbUser.role === 'dealer' ? (dbUser as any).dealer_expires_at ?? null : dbUser.agent_expires_at ?? null
    const days = paid ? daysUntil(expiresAt) : null
    const autoOn: boolean = (dbUser as any).auto_upgrade_enabled ?? false
    const autoPlan: string | null = (dbUser as any).auto_upgrade_plan ?? null
    const low = days !== null && days <= 7

    return (
        <>
            {modal && paid && (
                <AutoUpgradeQuickModal
                    mode={modal}
                    userRole={dbUser.role as 'agent' | 'dealer'}
                    expiresAt={expiresAt}
                    currentPlan={autoPlan}
                    firstName={dbUser.first_name ?? ''}
                    onClose={() => setModal(null)}
                    onUpdated={async () => { setModal(null); await refreshUser() }}
                />
            )}

            <section aria-label="Membership" className="neu-raised-sm rounded-3xl p-5 sm:p-6">
                <div className="flex items-center gap-4">
                    <RoleAvatar role={roleKey} first={dbUser.first_name} last={dbUser.last_name} size="lg" />
                    <div className="min-w-0">
                        <p className="truncate font-display text-lg font-semibold leading-tight">{dbUser.first_name} {dbUser.last_name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium" style={{ color: cfg.textColor }}>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            {cfg.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{memberFor(dbUser.created_at)}</p>
                    </div>
                </div>

                {paid && days !== null && (
                    <div className="mt-5">
                        <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium text-muted-foreground">{dbUser.role === 'dealer' ? 'Dealer plan' : 'Agent plan'}</span>
                            <span className={cn('font-semibold tabular-nums', days <= 3 ? 'text-red-500' : low ? 'text-brand-700 dark:text-brand-500' : 'text-foreground')}>
                                {days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} left` : 'Expired'}
                            </span>
                        </div>
                        <div className="neu-inset mt-2 h-2.5 overflow-hidden rounded-full">
                            <div
                                className={cn('h-full rounded-full', days <= 3 ? 'bg-red-500' : 'bg-brand-500')}
                                style={{ width: `${Math.max(5, Math.min(100, (days / 30) * 100))}%` }}
                            />
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setModal(autoOn ? 'manage' : 'enable')}
                                className="inline-flex items-center gap-2 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {autoOn ? <Zap className="h-4 w-4 text-emerald-500" /> : <ZapOff className="h-4 w-4" />}
                                Auto-renew {autoOn ? 'on' : 'off'}
                                {autoOn && autoPlan ? ` (${autoPlan === '6m' ? '6 months' : autoPlan})` : ''}
                            </button>
                            {low && (
                                <Link href="/dashboard/upgrade" className="clay-gold rounded-xl px-4 py-1.5 text-xs font-bold">Renew</Link>
                            )}
                        </div>
                    </div>
                )}

                {dbUser.role === 'customer' && (
                    <div className="neu-inset mt-5 rounded-2xl p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold"><Crown className="h-4 w-4 text-brand-700 dark:text-brand-500" /> Pay less on every bundle</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Agents and dealers buy at wholesale prices and can sell under their own storefront.</p>
                        <Link href="/dashboard/upgrade" className={cn(linkClass, 'mt-3')}>See upgrade plans <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </div>
                )}

                {(isAdmin || isSubAdmin) && (
                    <Link href="/admin" className={cn(linkClass, 'mt-5')}>
                        <Shield className="h-4 w-4" /> Open the admin panel <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                )}
            </section>
        </>
    )
}
