'use client'

import { cn } from '@/lib/utils'
import { focusRing } from './dashboard-tokens'
import type { DashRange } from './use-admin-dashboard'

const OPTIONS: { value: DashRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
]

export function TimeRange({ value, onChange }: { value: DashRange; onChange: (r: DashRange) => void }) {
    return (
        <div role="group" aria-label="Time range" className="glass inline-flex w-fit items-center gap-1 rounded-full p-1">
            {OPTIONS.map(o => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        'h-9 rounded-full px-4 text-sm font-semibold transition-colors motion-reduce:transition-none',
                        value === o.value ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                        focusRing,
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}
