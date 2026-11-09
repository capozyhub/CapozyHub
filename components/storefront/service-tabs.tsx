'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ServiceTab<K extends string = string> {
    key: K
    label: string
    icon: LucideIcon
}

/**
 * One inset track with a gold pill on the active service, the same control the landing
 * page uses for its product switcher. Scrolls sideways on narrow screens instead of wrapping.
 */
export function ServiceTabs<K extends string>({
    tabs, active, onChange,
}: {
    tabs: ServiceTab<K>[]
    active: K
    onChange: (key: K) => void
}) {
    return (
        <div role="tablist" aria-label="What would you like to buy" className="neu-inset flex gap-1.5 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map(({ key, label, icon: Icon }) => {
                const on = key === active
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange(key)}
                        className={cn(
                            'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors motion-reduce:transition-none',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500',
                            on ? 'clay-gold' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
