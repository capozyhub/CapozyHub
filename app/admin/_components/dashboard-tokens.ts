/**
 * Design tokens for the admin fintech console.
 *
 * One disciplined, theme-adaptive system (replaces the old rainbow gradient
 * cards). Surfaces are neutral; brand accents are used semantically on numbers
 * and indicators, never as full-card fills.
 */

/** Primary elevated surface (KPI cards, panels). */
export const cardSurface =
    'rounded-xl border border-border bg-card shadow-sm dark:shadow-none'

/** Secondary/recessed surface (inner tiles, list rows). */
export const mutedSurface =
    'rounded-lg border border-border bg-muted/40'

export const sectionLabel =
    'text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400'

export const kpiValue = 'text-2xl font-bold tracking-tight text-zinc-900 dark:text-white'

/** Semantic accent palette (hex for charts; classes used inline in JSX). */
export const accent = {
    red: '#DC2626',      // alert (semantic only, not brand)
    yellow: '#F6A900',   // Capozy gold: primary highlight
    emerald: '#10B981',  // positive money movement
    rose: '#F43F5E',     // negative / debt
    blue: '#3B82F6',
    violet: '#8B5CF6',
    slate: '#64748B',
} as const

/** Stable colour ramp for breakdown charts (network/category/source slices). */
export const chartPalette = [
    accent.yellow, accent.blue, accent.emerald, accent.violet, accent.red, accent.slate,
]

/** Network → brand-ish colour for network breakdown. */
export const networkColor: Record<string, string> = {
    MTN: accent.yellow,
    TELECEL: accent.red,
    AT: accent.blue,
    AIRTELTIGO: accent.blue,
}

export interface Delta {
    pct: number
    up: boolean
    neutral: boolean
}

/** Period-over-period delta. neutral when there's no prior baseline to compare. */
export function deltaPct(current: number, previous: number): Delta {
    if (!previous || previous === 0) {
        return { pct: current > 0 ? 100 : 0, up: current >= 0, neutral: current === 0 }
    }
    const pct = ((current - previous) / previous) * 100
    return { pct: Math.abs(pct), up: pct >= 0, neutral: Math.abs(pct) < 0.05 }
}
