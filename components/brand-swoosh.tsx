'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * The curve from the logo, drawn as an inflated clay tube. `progress` (0 to 1) is how
 * much of the curve is drawn, so it doubles as a progress indicator: signup steps,
 * reading position, and so on. Decorative only: callers carry the real progress text.
 */
export function BrandSwoosh({ progress = 1, className }: { progress?: number; className?: string }) {
    const uid = useId().replace(/:/g, '')
    const p = Math.min(1, Math.max(0.04, progress))
    const d = 'M-30 330 C 120 352 300 312 410 202 C 480 130 540 72 680 40'
    const dash = { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p }
    const draw = 'transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none'

    return (
        <svg viewBox="0 0 640 360" className={cn('overflow-visible', className)} aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={`${uid}-gold`} gradientUnits="userSpaceOnUse" x1="0" y1="360" x2="640" y2="0">
                    <stop offset="0" stopColor="#F6A900" />
                    <stop offset="0.55" stopColor="#F6C30F" />
                    <stop offset="1" stopColor="#FEE21C" />
                </linearGradient>
                <filter id={`${uid}-blur`} x="-20%" y="-40%" width="140%" height="180%">
                    <feGaussianBlur stdDeviation="9" />
                </filter>
                <filter id={`${uid}-soft`} x="-20%" y="-40%" width="140%" height="180%">
                    <feGaussianBlur stdDeviation="3" />
                </filter>
            </defs>
            {/* Cast shadow */}
            <path d={d} transform="translate(8 18)" fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="44" strokeLinecap="round"
                filter={`url(#${uid}-blur)`} {...dash} className={cn(draw, 'swoosh-fx')} />
            {/* Dark rim, then the gold body */}
            <path d={d} fill="none" stroke="#9A6200" strokeWidth="46" strokeLinecap="round" {...dash} className={draw} />
            <path d={d} fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="38" strokeLinecap="round" {...dash} className={draw} />
            {/* Soft highlight along the top-left, which is what makes it read as inflated */}
            <path d={d} transform="translate(-4 -9)" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="8" strokeLinecap="round"
                filter={`url(#${uid}-soft)`} {...dash} className={cn(draw, 'swoosh-fx')} />
        </svg>
    )
}
