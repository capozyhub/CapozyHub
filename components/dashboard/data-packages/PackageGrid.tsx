import { NetworkIcon } from '@/components/network-icon'
import { cn, formatCurrency } from '@/lib/utils'
import type { DataPackage } from '@/types/supabase'
import { NETWORK_COLOR, networkLabel } from './network-meta'

interface PackageGridProps {
    packages: DataPackage[]
    mode: 'grid' | 'list'
    getPrice: (pkg: DataPackage) => number
    onBuy: (pkg: DataPackage) => void
    /** Small tag on each card, for example "Mashup". */
    tag?: string
}

function note(pkg: DataPackage): string | null {
    const d = pkg.description?.trim()
    return d && d !== 'Instant Delivery' ? d : null
}

export function PackageGrid({ packages, mode, getPrice, onBuy, tag }: PackageGridProps) {
    if (mode === 'list') {
        return (
            <ul className="grid gap-3 lg:grid-cols-2">
                {packages.map(pkg => (
                    <li key={pkg.id}>
                        <button
                            type="button"
                            onClick={() => onBuy(pkg)}
                            className="surface group flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl well">
                                <NetworkIcon network={pkg.network} size={28} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                    <span className="truncate font-display text-lg font-bold leading-tight">{pkg.size}</span>
                                    {tag && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold">{tag}</span>}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">{note(pkg) ?? networkLabel(pkg.network)}</span>
                            </span>
                            <span className="font-display text-base font-bold tabular-nums">{formatCurrency(getPrice(pkg))}</span>
                            <span className="clay-gold hidden rounded-xl px-3.5 py-2 text-xs font-bold sm:inline-block">Buy</span>
                        </button>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {packages.map(pkg => (
                <li key={pkg.id}>
                    <button
                        type="button"
                        onClick={() => onBuy(pkg)}
                        className="surface group relative flex h-full w-full flex-col overflow-hidden rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-5 top-0 h-1 rounded-b-full"
                            style={{ backgroundColor: NETWORK_COLOR[pkg.network] ?? '#8E8E8E' }}
                        />
                        <span className="flex items-center justify-between">
                            <NetworkIcon network={pkg.network} size={26} />
                            {tag && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold">{tag}</span>}
                        </span>
                        <span className={cn('mt-4 break-words font-display font-bold leading-tight tracking-tight', tag ? 'text-xl' : 'text-3xl')}>{pkg.size}</span>
                        <span className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">{note(pkg) ?? ''}</span>
                        <span className="mt-3 flex items-center justify-between gap-2">
                            <span className="font-display text-lg font-bold tabular-nums">{formatCurrency(getPrice(pkg))}</span>
                            <span className="clay-gold rounded-xl px-3 py-1.5 text-xs font-bold">Buy</span>
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    )
}
