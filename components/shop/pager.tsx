'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZES = [10, 25, 50] as const

/** Client-side paging for a list that is already loaded. Resets to page 1 when `resetKey` changes. */
export function usePaged<T>(items: T[], resetKey: string = '', initialSize: number = 10) {
    const [page, setPage] = useState(1)
    const [size, setSize] = useState<number>(initialSize)
    const pages = Math.max(1, Math.ceil(items.length / size))

    useEffect(() => { setPage(1) }, [resetKey, size])
    useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])

    const visible = useMemo(() => items.slice((page - 1) * size, page * size), [items, page, size])
    return { visible, page, setPage, size, setSize, pages, total: items.length }
}

interface PagerProps {
    page: number
    pages: number
    size: number
    total: number
    onPage: (p: number) => void
    onSize: (s: number) => void
    className?: string
}

export function Pager({ page, pages, size, total, onPage, onSize, className }: PagerProps) {
    if (total <= SIZES[0]) return null
    const from = (page - 1) * size + 1
    const to = Math.min(page * size, total)
    const btn = 'neu-raised-sm neu-press inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

    return (
        <nav aria-label="Pagination" className={cn('mt-4 flex flex-wrap items-center justify-between gap-3', className)}>
            <p className="text-xs text-muted-foreground" aria-live="polite">
                Showing <span className="font-semibold text-foreground">{from}–{to}</span> of <span className="font-semibold text-foreground">{total}</span>
            </p>
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Per page
                    <select
                        value={size}
                        onChange={(e) => onSize(Number(e.target.value))}
                        className="neu-inset h-9 rounded-xl border-0 bg-transparent px-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>
                <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="text-xs font-semibold tabular-nums">{page} / {pages}</span>
                <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
                    Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </nav>
    )
}
