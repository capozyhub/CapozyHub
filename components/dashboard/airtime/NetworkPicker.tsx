import { Check } from 'lucide-react'
import { NetworkIcon } from '@/components/network-icon'
import { cn } from '@/lib/utils'
import { AIRTIME_NETWORKS, type AirtimeNetwork } from './meta'

interface NetworkPickerProps {
    selected: AirtimeNetwork | null
    isEnabled: (network: AirtimeNetwork) => boolean
    onSelect: (network: AirtimeNetwork) => void
}

/** The three networks as pressable tiles; the chosen one sinks in and gets its brand colour as a ring. */
export function NetworkPicker({ selected, isEnabled, onSelect }: NetworkPickerProps) {
    return (
        <div role="radiogroup" aria-label="Network" className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {AIRTIME_NETWORKS.map(net => {
                const active = selected === net.id
                const enabled = isEnabled(net.id)
                return (
                    <button
                        key={net.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!enabled}
                        onClick={() => onSelect(net.id)}
                        className={cn(
                            'relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:py-4',
                            active ? 'well' : 'neu-raised-sm neu-press',
                            !enabled && 'cursor-not-allowed opacity-50',
                        )}
                        style={active ? { boxShadow: `var(--neu-in), 0 0 0 2px ${net.color}` } : undefined}
                    >
                        {active && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                                <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            </span>
                        )}
                        <NetworkIcon network={net.id} size={36} priority />
                        <span className="text-xs font-semibold">{net.label}</span>
                        <span className={cn('flex items-center gap-1 text-[10px] font-medium', enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-emerald-500' : 'bg-red-500')} />
                            {enabled ? 'Live' : 'Unavailable'}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
