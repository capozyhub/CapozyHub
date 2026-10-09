'use client'

import { useEffect, useState, forwardRef, type ButtonHTMLAttributes } from 'react'
import Link from 'next/link'
import { Bell, Code2, Headphones, Key, Loader2, LogOut, Mail, Menu, MessageCircle, Settings, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { PWAInstallButton } from '@/components/pwa-install-prompt'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, normalizeWhatsAppNumber } from '@/lib/utils'
import { roleConfig, resolveRoleKey } from '@/lib/roles'
import { getSupportContacts } from '@/app/actions/support'
import { HybridHeaderTitle } from '@/components/dashboard/HybridHeaderTitle'
import { RoleAvatar } from '@/components/dashboard/role-avatar'
import { headerOffset } from '@/components/dashboard/shell'

interface DashboardHeaderProps {
    /** Called when the bell is pressed; the parent layout owns the notification modal. */
    onOpenNotifications: () => void
    /** Live unread count driven by the parent layout's realtime state. */
    unreadCount: number
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--neu-bg)]'

const RoundButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function RoundButton({ className, ...props }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            className={cn('neu-raised-sm neu-press relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', FOCUS, className)}
            {...props}
        />
    )
})

export function DashboardHeader({ onOpenNotifications, unreadCount }: DashboardHeaderProps) {
    const { dbUser, signOut, isSigningOut, isAdmin, isSubAdmin } = useAuth()
    const { isCollapsed, toggleSidebar } = useUI()
    const [supportContacts, setSupportContacts] = useState({ whatsapp: '', email: '' })

    useEffect(() => {
        if (dbUser) getSupportContacts().then(setSupportContacts)
    }, [dbUser])

    const roleKey = resolveRoleKey({ isAdmin, isSubAdmin, role: dbUser?.role })
    const currentRole = roleConfig[roleKey]
    const canUseApi = isAdmin || dbUser?.role === 'agent' || dbUser?.role === 'dealer'

    return (
        <header
            className={cn(
                'neu-raised-sm fixed left-0 right-0 top-0 z-30 flex h-14 items-center transition-[left] duration-300 ease-out',
                'rounded-b-3xl lg:right-3 lg:top-3 lg:rounded-2xl',
                headerOffset(isCollapsed),
            )}
        >
            <div className="flex h-full w-full items-center gap-2 px-3 lg:px-4">
                <RoundButton onClick={toggleSidebar} aria-label="Open menu" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                </RoundButton>

                <HybridHeaderTitle />

                <div className="flex items-center gap-2">
                    <div className="hidden sm:block">
                        <PWAInstallButton />
                    </div>
                    <ThemeToggle />

                    <span
                        className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold md:inline-flex"
                        style={{ backgroundColor: currentRole.bgColor, color: currentRole.textColor }}
                    >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentRole.color }} />
                        {currentRole.label}
                    </span>

                    <RoundButton onClick={onOpenNotifications} aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}>
                        <Bell className="h-[18px] w-[18px]" />
                        {unreadCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--neu-bg)]">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </RoundButton>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <RoundButton aria-label="Help and support" className="hidden sm:flex">
                                <Headphones className="h-[18px] w-[18px]" />
                            </RoundButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-60 rounded-2xl" align="end">
                            <DropdownMenuLabel className="font-normal">
                                <p className="text-sm font-semibold leading-none">Need a hand?</p>
                                <p className="mt-1.5 text-xs leading-none text-muted-foreground">Reach the {` `}team any of these ways</p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/complaints" className="cursor-pointer">
                                    <Headphones className="mr-2 h-4 w-4" /> Support center
                                </Link>
                            </DropdownMenuItem>
                            {supportContacts.email && (
                                <DropdownMenuItem asChild>
                                    <a href={`mailto:${supportContacts.email}`} className="cursor-pointer">
                                        <Mail className="mr-2 h-4 w-4" /> Email us
                                    </a>
                                </DropdownMenuItem>
                            )}
                            {supportContacts.whatsapp && (
                                <DropdownMenuItem asChild>
                                    <a href={`https://wa.me/${normalizeWhatsAppNumber(supportContacts.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                        <MessageCircle className="mr-2 h-4 w-4" /> Chat on WhatsApp
                                    </a>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" aria-label="Account menu" className={cn('rounded-full transition-transform active:scale-95', FOCUS)}>
                                <RoleAvatar role={roleKey} first={dbUser?.first_name} last={dbUser?.last_name} size="sm" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 rounded-2xl" align="end">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-3">
                                    <RoleAvatar role={roleKey} first={dbUser?.first_name} last={dbUser?.last_name} size="md" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold leading-tight">{dbUser?.first_name} {dbUser?.last_name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{dbUser?.email}</p>
                                        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: currentRole.textColor }}>
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentRole.color }} />
                                            {currentRole.label}
                                        </span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/profile" className="cursor-pointer"><User className="mr-2 h-4 w-4" /> My profile</Link>
                            </DropdownMenuItem>
                            {canUseApi && (
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/api" className="cursor-pointer"><Key className="mr-2 h-4 w-4" /> Developer API</Link>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <Link href="/developers" className="cursor-pointer"><Code2 className="mr-2 h-4 w-4" /> API documentation</Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                                <>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/settings" className="cursor-pointer"><Settings className="mr-2 h-4 w-4" /> Admin settings</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/api-keys" className="cursor-pointer"><Key className="mr-2 h-4 w-4" /> API key approvals</Link>
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={isSigningOut ? undefined : signOut}
                                disabled={isSigningOut}
                                className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                                {isSigningOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                                {isSigningOut ? 'Signing out…' : 'Log out'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
