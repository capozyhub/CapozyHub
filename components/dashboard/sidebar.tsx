'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Crown,
    Loader2,
    LogOut,
    Plus,
    Shield,
    Store,
    X,
    type LucideIcon,
} from 'lucide-react'
import { BrandLogo, BrandTitle } from '@/components/ui/brand'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { cn, formatCurrency } from '@/lib/utils'
import { roleConfig, resolveRoleKey } from '@/lib/roles'
import { RoleAvatar } from '@/components/dashboard/role-avatar'
import { supabase } from '@/lib/supabase'
import { usePageAccess } from '@/hooks/use-page-access'
import { useAdminCounts } from '@/hooks/use-admin-counts'
import {
    ADMIN_COUNT_KEYS,
    adminNavItems,
    isNavActive,
    shopMenuItems,
    userNavGroups,
    type NavItem,
} from '@/components/dashboard/nav-config'
import { sidebarWidth } from '@/components/dashboard/shell'

// Short on purpose: the worst case after creating a shop is that "My Store" lags by this
// long (it heals on the next reload), which is cheaper than querying on every mount.
const SHOP_EXISTENCE_CACHE_TTL_MS = 2 * 60 * 1000

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)]'

function daysLeft(expiresAt?: string | null): number | null {
    if (!expiresAt) return null
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    return days > 0 ? days : 0
}

export function DashboardSidebar({ communityLink = '' }: { communityLink?: string }) {
    const pathname = usePathname()
    const { dbUser, isAdmin, isSubAdmin, signOut, isSigningOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar, isCollapsed, toggleCollapse } = useUI()
    const { isPageAccessible } = usePageAccess()
    const { counts: adminCounts } = useAdminCounts()

    const [walletBalance, setWalletBalance] = useState(0)
    const [isShopOpen, setIsShopOpen] = useState(false)
    const [isAdminOpen, setIsAdminOpen] = useState(false)
    const [hasShop, setHasShop] = useState<boolean | null>(null)

    const role = dbUser?.role
    const canRecruit = isAdmin || role === 'agent' || role === 'dealer'
    const agentDays = role === 'agent' ? daysLeft(dbUser?.agent_expires_at) : null
    const dealerDays = role === 'dealer' ? daysLeft((dbUser as any)?.dealer_expires_at) : null
    const planDays = agentDays ?? dealerDays

    // Balance, kept live: the row updates the instant a top-up or purchase lands.
    useEffect(() => {
        if (!dbUser?.id) return
        const userId = dbUser.id

        ;(supabase.from('wallets').select('balance').eq('user_id', userId).single() as any)
            .then(({ data }: { data: { balance: number | null } | null }) => {
                if (data) setWalletBalance(data.balance || 0)
            })

        const channel = supabase
            .channel(`sidebar-wallet-${userId}`)
            .on(
                'postgres_changes' as any,
                { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
                (payload: any) => {
                    if (payload.new?.balance !== undefined) setWalletBalance(payload.new.balance)
                },
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [dbUser?.id])

    // Keep a section open while the member is inside it.
    useEffect(() => {
        if (pathname?.startsWith('/dashboard/shop')) setIsShopOpen(true)
        if (pathname?.startsWith('/admin')) setIsAdminOpen(true)
    }, [pathname])

    // Whether the member owns a shop only changes when they create one, so it is cached in
    // sessionStorage (it survives a reload, unlike module state) and scoped to the user so
    // switching accounts on a shared device can never read someone else's answer.
    useEffect(() => {
        if (!dbUser?.id) return
        const userId = dbUser.id
        const cacheKey = `cz_has_shop_${userId}`
        let cancelled = false

        try {
            const cached = sessionStorage.getItem(cacheKey)
            if (cached) {
                const { v, at } = JSON.parse(cached) as { v: boolean; at: number }
                if (Date.now() - at < SHOP_EXISTENCE_CACHE_TTL_MS) {
                    setHasShop(v)
                    return
                }
            }
        } catch { /* storage unavailable: fall through to the query */ }

        ;(supabase.from('shop_profiles').select('id').eq('owner_id', userId).maybeSingle() as any)
            .then(({ data }: { data: { id: string } | null }) => {
                if (cancelled) return
                const exists = !!data
                setHasShop(exists)
                try { sessionStorage.setItem(cacheKey, JSON.stringify({ v: exists, at: Date.now() })) } catch { /* ignore */ }
            })

        return () => { cancelled = true }
    }, [dbUser?.id])

    const roleKey = resolveRoleKey({ isAdmin, isSubAdmin, role })
    const currentRole = roleConfig[roleKey]

    // On lg+ the rail can collapse to icons only. The drawer on small screens is always full,
    // so collapse is applied with lg: classes rather than by not rendering the labels.
    const hideCollapsed = isCollapsed ? 'lg:hidden' : ''
    const onlyCollapsed = isCollapsed ? 'hidden lg:flex' : 'hidden'

    const closeOnMobile = () => { if (window.innerWidth < 1024) closeSidebar() }

    const showTopUp = !(process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true' && !isAdmin) && isPageAccessible('/dashboard/wallet')

    const isVisible = (item: NavItem) => {
        if (item.href === '/dashboard/recruit') return canRecruit && isPageAccessible(item.href)
        if (item.href === '/dashboard/upgrade' && role === 'subagent') return false
        return isPageAccessible(item.href)
    }

    const NavRow = ({ item, label, active, badge }: { item: { href: string; icon: LucideIcon }; label: string; active: boolean; badge?: number }) => (
        <Link
            href={item.href}
            onClick={closeOnMobile}
            title={isCollapsed ? label : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'group relative flex items-center gap-3 rounded-2xl p-1 pr-3 transition-colors',
                FOCUS,
                active ? 'neu-inset' : 'hover:bg-foreground/5',
                isCollapsed && 'lg:justify-center lg:pr-1',
            )}
        >
            <span
                className={cn(
                    'relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl',
                    active ? 'clay-gold' : 'text-muted-foreground group-hover:text-foreground',
                )}
            >
                <item.icon className="h-[18px] w-[18px]" />
                {badge ? (
                    <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--neu-bg)] bg-red-500', !isCollapsed && 'lg:hidden')} />
                ) : null}
            </span>
            <span className={cn('flex-1 truncate text-sm', active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground group-hover:text-foreground', hideCollapsed)}>
                {label}
            </span>
            {badge ? (
                <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white', hideCollapsed)}>
                    {badge > 9 ? '9+' : badge}
                </span>
            ) : null}
        </Link>
    )

    const SectionToggle = ({ icon: Icon, label, active, open, onToggle }: { icon: LucideIcon; label: string; active: boolean; open: boolean; onToggle: () => void }) => (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            title={isCollapsed ? label : undefined}
            className={cn(
                'group flex w-full items-center gap-3 rounded-2xl p-1 pr-3 text-left transition-colors',
                FOCUS,
                active && !open ? 'neu-inset' : 'hover:bg-foreground/5',
                isCollapsed && 'lg:justify-center lg:pr-1',
            )}
        >
            <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl', active ? 'clay-gold' : 'text-muted-foreground group-hover:text-foreground')}>
                <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className={cn('flex-1 truncate text-sm', active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground group-hover:text-foreground', hideCollapsed)}>{label}</span>
            <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform', open && 'rotate-180', hideCollapsed)} />
        </button>
    )

    const GroupLabel = ({ children }: { children: string }) => (
        <p className={cn('px-3 pb-1 pt-4 text-xs font-semibold text-muted-foreground/80', hideCollapsed)}>{children}</p>
    )

    const shopActive = !!pathname?.startsWith('/dashboard/shop')
    const adminActive = !!pathname?.startsWith('/admin')
    const adminItems = adminNavItems.filter(item => isAdmin || (isSubAdmin && item.href === '/admin/orders'))
    const adminAttention = Object.values(ADMIN_COUNT_KEYS).reduce((sum, key) => sum + (adminCounts[key] || 0), 0)

    return (
        <>
            {isInternalSidebarOpen && (
                <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeSidebar} aria-hidden="true" />
            )}

            <aside
                aria-label="Main menu"
                className={cn(
                    'neu-raised fixed z-50 flex flex-col transition-[transform,width] duration-300 ease-out',
                    'left-0 top-0 h-[100dvh] w-[17rem] rounded-r-3xl',
                    'lg:left-3 lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:translate-x-0 lg:rounded-3xl',
                    sidebarWidth(isCollapsed).replace('w-', 'lg:w-'),
                    isInternalSidebarOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                {/* Edge handle: collapse / expand the rail (desktop only) */}
                <button
                    type="button"
                    onClick={toggleCollapse}
                    aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
                    className={cn('neu-raised-sm absolute -right-3 top-8 z-10 hidden h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground lg:flex', FOCUS)}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>

                {/* Brand */}
                <div className={cn('flex h-[4.5rem] flex-shrink-0 items-center justify-between px-4', isCollapsed && 'lg:justify-center lg:px-0')}>
                    <Link href="/dashboard" onClick={closeOnMobile} className={cn('flex items-center gap-3 rounded-full', FOCUS)} aria-label="Dashboard home">
                        <span className="neu-night flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                            <BrandLogo width={40} height={40} className="h-10 w-10" />
                        </span>
                        <BrandTitle className={cn('font-display text-lg leading-none', hideCollapsed)} />
                    </Link>
                    <button
                        type="button"
                        onClick={closeSidebar}
                        aria-label="Close menu"
                        className={cn('neu-raised-sm flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground lg:hidden', FOCUS)}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Member card */}
                {dbUser && (
                    <div className={cn('mx-3 flex-shrink-0 rounded-3xl p-3', 'neu-raised-sm', hideCollapsed)}>
                        <div className="flex items-center gap-3">
                            <RoleAvatar role={roleKey} first={dbUser.first_name} last={dbUser.last_name} />

                            <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-[15px] font-semibold leading-tight text-foreground">
                                    {dbUser.first_name} {dbUser.last_name}
                                </p>
                                <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentRole.color }} />
                                    {currentRole.label}
                                </span>
                            </div>
                        </div>

                        {planDays !== null && (
                            <div className="mt-3">
                                <div className="flex items-baseline justify-between text-xs">
                                    <span className="font-medium text-muted-foreground">{role === 'dealer' ? 'Dealer plan' : 'Agent plan'}</span>
                                    <span className={cn('font-semibold', planDays <= 3 ? 'text-red-500' : 'text-foreground')}>
                                        {planDays} {planDays === 1 ? 'day' : 'days'} left
                                    </span>
                                </div>
                                <div className="neu-inset mt-1.5 h-2 overflow-hidden rounded-full">
                                    <div
                                        className={cn('h-full rounded-full', planDays <= 3 ? 'bg-red-500' : 'bg-brand-500')}
                                        style={{ width: `${Math.max(6, Math.min(100, (planDays / 30) * 100))}%` }}
                                    />
                                </div>
                                <Link href="/dashboard/upgrade" onClick={closeOnMobile} className={cn('mt-2 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-brand-700 hover:underline dark:text-brand-500', FOCUS)}>
                                    <Crown className="h-3.5 w-3.5" /> Renew plan
                                </Link>
                            </div>
                        )}

                        {role === 'customer' && isPageAccessible('/dashboard/upgrade') && (
                            <Link href="/dashboard/upgrade" onClick={closeOnMobile} className={cn('mt-3 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-brand-700 hover:underline dark:text-brand-500', FOCUS)}>
                                <Crown className="h-3.5 w-3.5" /> Upgrade to Agent
                            </Link>
                        )}

                        <div className="neu-inset mt-3 flex items-center justify-between rounded-2xl p-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground">Wallet balance</p>
                                <p className="truncate font-display text-lg font-bold leading-tight tracking-tight text-foreground">{formatCurrency(walletBalance)}</p>
                            </div>
                            {showTopUp && (
                                <Link
                                    href="/dashboard/wallet"
                                    onClick={closeOnMobile}
                                    className={cn('clay-gold flex h-9 flex-shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold', FOCUS)}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Top up
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Collapsed rail: balance shortcut in place of the card */}
                {dbUser && showTopUp && (
                    <Link
                        href="/dashboard/wallet"
                        title={`Top up (${formatCurrency(walletBalance)})`}
                        aria-label="Top up wallet"
                        className={cn('clay-gold mx-auto h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl', FOCUS, onlyCollapsed)}
                    >
                        <Plus className="h-5 w-5" />
                    </Link>
                )}

                {/* Menu */}
                <nav aria-label="Dashboard" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2 scrollbar-thin">
                    {userNavGroups.map(group => {
                        const items = group.items.filter(isVisible)
                        const showShop = group.id === 'grow' && (isAdmin || isSubAdmin || role === 'agent' || role === 'dealer' || role === 'customer' || role === 'subagent')
                        if (items.length === 0 && !showShop) return null
                        return (
                            <div key={group.id} className="space-y-0.5">
                                {group.label && <GroupLabel>{group.label}</GroupLabel>}
                                {group.id === 'grow' && showShop && (
                                    hasShop === false ? (
                                        <NavRow item={{ href: '/dashboard/shop/setup', icon: Store }} label="My Store" active={shopActive} />
                                    ) : (
                                        <div>
                                            <SectionToggle icon={Store} label="My Store" active={shopActive} open={isShopOpen} onToggle={() => setIsShopOpen(v => !v)} />
                                            {isShopOpen && (
                                                <div className={cn('ml-[1.35rem] mt-1 space-y-0.5 border-l border-border pl-3', hideCollapsed)}>
                                                    {shopMenuItems.map(item => {
                                                        const active = pathname === item.href
                                                        return (
                                                            <Link
                                                                key={item.href}
                                                                href={item.href}
                                                                onClick={closeOnMobile}
                                                                aria-current={active ? 'page' : undefined}
                                                                className={cn(
                                                                    'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors',
                                                                    FOCUS,
                                                                    active ? 'neu-inset font-semibold text-foreground' : 'font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                                                                )}
                                                            >
                                                                <item.icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-brand-700 dark:text-brand-500')} />
                                                                {item.label}
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )
                                )}
                                {items.map(item => (
                                    <NavRow key={item.href} item={item} label={item.label} active={isNavActive(pathname, item.href)} />
                                ))}
                            </div>
                        )
                    })}

                    {(isAdmin || isSubAdmin) && (
                        <div className="mt-2 space-y-1 border-t border-border pt-3">
                            <div className="relative">
                                <SectionToggle icon={Shield} label="Admin" active={adminActive} open={isAdminOpen} onToggle={() => setIsAdminOpen(v => !v)} />
                                {adminAttention > 0 && !isAdminOpen && (
                                    <span className={cn('pointer-events-none absolute right-9 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white', hideCollapsed)}>
                                        {adminAttention > 99 ? '99+' : adminAttention}
                                    </span>
                                )}
                            </div>
                            {isAdminOpen && (
                                <div className="space-y-1">
                                    {adminItems.map(item => {
                                        const countKey = ADMIN_COUNT_KEYS[item.href]
                                        return (
                                            <NavRow
                                                key={item.href}
                                                item={item}
                                                label={item.label}
                                                active={isNavActive(pathname, item.href)}
                                                badge={countKey ? adminCounts[countKey] : 0}
                                            />
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                {/* Footer */}
                <div className="flex-shrink-0 space-y-1 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {communityLink && (
                        <a
                            href={communityLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeOnMobile}
                            title={isCollapsed ? 'Join the community' : undefined}
                            className={cn('group flex items-center gap-3 rounded-2xl p-1 pr-3 transition-colors hover:bg-foreground/5', FOCUS, isCollapsed && 'lg:justify-center lg:pr-1')}
                        >
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[#25D366]">
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </span>
                            <span className={cn('truncate text-sm font-medium text-muted-foreground group-hover:text-foreground', hideCollapsed)}>Join the community</span>
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={isSigningOut ? undefined : signOut}
                        disabled={isSigningOut}
                        title={isCollapsed ? 'Log out' : undefined}
                        className={cn('group flex w-full items-center gap-3 rounded-2xl p-1 pr-3 text-left transition-colors hover:bg-red-500/10 disabled:opacity-60', FOCUS, isCollapsed && 'lg:justify-center lg:pr-1')}
                    >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground group-hover:text-red-500">
                            {isSigningOut ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <LogOut className="h-[18px] w-[18px]" />}
                        </span>
                        <span className={cn('truncate text-sm font-medium text-muted-foreground group-hover:text-red-500', hideCollapsed)}>
                            {isSigningOut ? 'Signing out…' : 'Log out'}
                        </span>
                    </button>
                </div>
            </aside>
        </>
    )
}
