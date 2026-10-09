import { Check } from 'lucide-react'
import { NetworkIcon } from '@/components/network-icon'
import { cn } from '@/lib/utils'
import { NETWORKS, NETWORK_COLOR, networkLabel } from './network-meta'

interface NetworkTabsProps {
    selected: string
    outOfStock: Record<string, boolean>
    onSelect: (network: string) => void
}

/** The four networks as large pressable tiles. The chosen one sinks in and takes its brand colour as a ring. */
export function NetworkTabs({ selected, outOfStock, onSelect }: NetworkTabsProps) {
    return (
        <div role="tablist" aria-label="Network" className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {NETWORKS.map(network => {
                const active = selected === network
                const out = !!outOfStock[network]
                return (
                    <button
                        key={network}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onSelect(network)}
                        className={cn(
                            'relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:py-4',
                            active ? 'well' : 'neu-raised-sm neu-press',
                        )}
                        style={active ? { boxShadow: `var(--neu-in), 0 0 0 2px ${NETWORK_COLOR[network]}` } : undefined}
                    >
                        {active && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                                <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            </span>
                        )}
                        <NetworkIcon network={network} size={36} priority />
                        <span className="text-[11px] font-semibold leading-tight sm:text-xs">{networkLabel(network)}</span>
                        <span className={cn('flex items-center gap-1 text-[10px] font-medium', out ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', out ? 'bg-red-500' : 'bg-emerald-500')} />
                            {out ? 'Out of stock' : 'Live'}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
