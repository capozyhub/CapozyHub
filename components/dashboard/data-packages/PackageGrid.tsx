import { ArrowRight } from 'lucide-react'
import { NetworkIcon } from '@/components/network-icon'
import { cn, formatCurrency } from '@/lib/utils'
import type { Bundle } from './types'
import { NETWORK_COLOR, networkClayClass, networkLabel } from './network-meta'

interface PackageGridProps {
    packages: Bundle[]
    mode: 'grid' | 'list'
    getPrice: (pkg: Bundle) => number
    onBuy: (pkg: Bundle) => void
    /** Small tag on each card, for example "Mashup". */
    tag?: string
}

function note(pkg: Bundle): string | null {
    const d = pkg.description?.trim()
    return d && d !== 'Instant Delivery' ? d : null
}

export function PackageGrid({ packages, mode, getPrice, onBuy, tag }: PackageGridProps) {
    if (mode === 'list') {
        return (
            <ul className="grid gap-3 lg:grid-cols-2">
                {packages.map(pkg => {
                    const color = NETWORK_COLOR[pkg.network] ?? '#8E8E8E'
                    return (
                    <li key={pkg.id}>
                        <button
                            type="button"
                            onClick={() => onBuy(pkg)}
                            className="surface group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3.5 pl-5 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            style={{ backgroundImage: `linear-gradient(90deg, ${color}1A 0%, transparent 65%)` }}
                        >
                            <span
                                aria-hidden="true"
                                className="absolute inset-y-3 left-2 w-1 rounded-full"
                                style={{ backgroundColor: color }}
                            />
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
                            <span className={cn(networkClayClass(pkg.network), 'hidden items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-bold sm:inline-flex')}>
                                Buy <ArrowRight className="h-3 w-3" />
                            </span>
                        </button>
                    </li>
                    )
                })}
            </ul>
        )
    }

    return (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {packages.map(pkg => {
                const color = NETWORK_COLOR[pkg.network] ?? '#8E8E8E'
                return (
                <li key={pkg.id}>
                    <button
                        type="button"
                        onClick={() => onBuy(pkg)}
                        className="surface group relative flex h-full w-full flex-col overflow-hidden rounded-[1.25rem] p-4 text-left transition-transform hover:-translate-y-1 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        style={{ backgroundImage: `linear-gradient(135deg, ${color}1F 0%, transparent 60%)` }}
                    >
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-5 top-0 h-1.5 rounded-b-full transition-[height] group-hover:h-2"
                            style={{ backgroundColor: color }}
                        />
                        <span className="flex items-center justify-between">
                            <span className="well flex h-9 w-9 items-center justify-center rounded-xl">
                                <NetworkIcon network={pkg.network} size={22} />
                            </span>
                            {tag && <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold">{tag}</span>}
                        </span>
                        <span className={cn('mt-4 break-words font-display font-bold leading-tight tracking-tight', tag ? 'text-xl' : 'text-3xl')}>{pkg.size}</span>
                        <span className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">{note(pkg) ?? ''}</span>
                        <span className="mt-3 flex items-center justify-between gap-2">
                            <span className="font-display text-lg font-bold tabular-nums">{formatCurrency(getPrice(pkg))}</span>
                            <span className={cn(networkClayClass(pkg.network), 'flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold')}>
                                Buy <ArrowRight className="h-3 w-3" />
                            </span>
                        </span>
                    </button>
                </li>
                )
            })}
        </ul>
    )
}
