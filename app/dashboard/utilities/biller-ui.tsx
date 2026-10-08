// Presentation-only per-biller accent system. Colors are grounded in each
// provider's own brand identity (ECG = its real logo blue/red — deliberately
// NOT the generic "electricity = yellow" assumption; indigo picked over
// DSTV's plain blue to stay visually distinct in the biller grid — Ghana
// Water = sky blue, DSTV = brand blue, GOtv = brand green, StarTimes = brand
// red) so the biller grid and verification card read as "this specific
// provider," not an arbitrary palette. Pure data — no hooks, safe to import
// from any component.
import { Zap, Droplets, Tv, MonitorPlay, Satellite, type LucideIcon } from 'lucide-react'
import type { UtilityBiller } from '@/lib/hubtel-utility/billers'

export interface BillerUI {
    Icon: LucideIcon
    /** Soft icon-badge background + fg (light/dark). */
    badge: string
    /** Ring accent used around the verification-card avatar. */
    ring: string
    /** Text accent matching the brand color. */
    text: string
    /** Solid left-border / progress-fill accent. */
    bar: string
}

export const BILLER_UI: Record<UtilityBiller, BillerUI> = {
    ecg: {
        Icon: Zap,
        badge: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
        ring: 'ring-brand-400/70 dark:ring-brand-500/50',
        text: 'text-brand-700 dark:text-brand-400',
        bar: 'bg-brand-600',
    },
    ghana_water: {
        Icon: Droplets,
        badge: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
        ring: 'ring-brand-400/70 dark:ring-brand-500/50',
        text: 'text-brand-700 dark:text-brand-400',
        bar: 'bg-brand-500',
    },
    dstv: {
        Icon: Tv,
        badge: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
        ring: 'ring-brand-400/70 dark:ring-brand-500/50',
        text: 'text-brand-700 dark:text-brand-400',
        bar: 'bg-brand-600',
    },
    gotv: {
        Icon: MonitorPlay,
        badge: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
        ring: 'ring-green-400/70 dark:ring-green-500/50',
        text: 'text-green-700 dark:text-green-400',
        bar: 'bg-green-600',
    },
    startimes: {
        Icon: Satellite,
        badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
        ring: 'ring-red-400/70 dark:ring-red-500/50',
        text: 'text-red-700 dark:text-red-400',
        bar: 'bg-red-600',
    },
}
