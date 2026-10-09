import { Check, GraduationCap } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { LOW_STOCK, examLabel, lowestBulkPrice, portalHost, type RCType } from './meta'

interface ExamCardProps {
    type: RCType
    selected: boolean
    onSelect: () => void
}

/** One exam as a big tile: what it is, where it is used, what it costs, and how much is left. */
export function ExamCard({ type, selected, onSelect }: ExamCardProps) {
    const soldOut = type.available_count === 0
    const notPriced = type.configured === false
    const blocked = soldOut || notPriced
    const low = !soldOut && type.available_count <= LOW_STOCK
    const host = portalHost(type.name)
    const bulkFrom = lowestBulkPrice(type)

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={blocked}
            onClick={onSelect}
            className={cn(
                'relative flex h-full flex-col gap-4 rounded-3xl p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                selected ? 'well ring-2 ring-primary' : 'neu-raised-sm neu-press',
                blocked && 'cursor-not-allowed opacity-55',
            )}
        >
            <span className="flex items-start justify-between gap-3">
                <span className="clay-gold flex h-11 w-11 items-center justify-center rounded-2xl"><GraduationCap className="h-5 w-5" /></span>
                {selected ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                ) : soldOut ? (
                    <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold">Sold out</span>
                ) : notPriced ? (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">No price set</span>
                ) : low ? (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">Only {type.available_count} left</span>
                ) : null}
            </span>

            <span className="min-w-0">
                <span className="block font-display text-2xl font-bold leading-none tracking-tight">{examLabel(type.name)}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{type.name}</span>
                {host && <span className="mt-0.5 block truncate text-xs text-muted-foreground/80">Used at {host}</span>}
            </span>

            <span className="mt-auto block">
                <span className="whitespace-nowrap">
                    <span className="font-display text-xl font-bold tabular-nums">{formatCurrency(type.price)}</span>
                    <span className="text-xs text-muted-foreground"> each</span>
                </span>
                {bulkFrom !== null && !blocked && <span className="mt-0.5 block text-xs font-medium text-emerald-700 dark:text-emerald-400">Down to {formatCurrency(bulkFrom)} each in bulk</span>}
            </span>        </button>
    )
}