'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { resolveNavItem } from '@/components/dashboard/nav-config'

/** Page title with the icon of the menu entry that owns the current route. */
export function HybridHeaderTitle() {
    const pathname = usePathname()
    const item = resolveNavItem(pathname)
    const Icon = item?.icon ?? LayoutDashboard

    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="neu-inset hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 dark:text-brand-500 sm:flex">
                <Icon className="h-[18px] w-[18px]" />
            </span>
            <h1 className="truncate font-display text-base font-semibold leading-none tracking-tight lg:text-lg">
                {item?.label ?? 'Dashboard'}
            </h1>
        </div>
    )
}
