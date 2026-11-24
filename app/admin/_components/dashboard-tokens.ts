/**
 * Design tokens for the admin overview.
 *
 * The page is frosted glass over a soft gold-and-silver glow (see .glass in globals.css).
 * Panels are `glass`, tiles inside them are `glass-inset`. Text keeps the theme colours
 * (foreground / muted-foreground), so it stays readable in both light and dark mode; colour is
 * used on icons, charts and status words only.
 */

/** A frosted panel (KPI cards, charts, lists). */
export const cardSurface = 'glass rounded-3xl'

/** A recessed tile inside a panel (stat tiles, list rows). */
export const mutedSurface = 'glass-inset rounded-2xl'

/** Panel heading. */
export const sectionLabel = 'text-sm font-semibold text-foreground/80'

/** Big number on a KPI card. Steps down on narrow screens so money figures never overflow. */
export const kpiValue = 'min-w-0 break-words font-display text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl xl:text-3xl'

/** Round frosted bubble behind a coloured icon. */
export const iconBubble = 'glass-inset flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full'

/** Keyboard focus ring for links and buttons on glass. */
export const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:focus-visible:outline-brand-500'
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
