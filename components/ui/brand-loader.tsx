import { BRAND } from '@/lib/brand'

// Styles live in globals.css (.cz-loader*), so there is nothing to inject per instance.

type BrandLoaderProps = {
    /** true = fixed full-screen overlay (route/page transitions). false = inline, no background. */
    fullScreen?: boolean
    /** Size of the mark. Default 'lg' for full-screen, 'md' for inline. */
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const SIZES = {
    sm: { mark: 'w-14', word: false },
    md: { mark: 'w-24', word: false },
    lg: { mark: 'w-40', word: true },
}

// The same curve as the logo, drawn by the loader on repeat. Plain strokes only (no blur
// filters), so it costs next to nothing on low-end phones.
const CURVE = 'M-30 330 C 120 352 300 312 410 202 C 480 130 540 72 680 40'

export function BrandLoader({ fullScreen = true, size, className = '' }: BrandLoaderProps) {
    const s = SIZES[size ?? (fullScreen ? 'lg' : 'md')]

    const mark = (
        <div className={`flex flex-col items-center gap-5 ${className}`} role="status" aria-label={`Loading ${BRAND.name}`}>
            <svg viewBox="-60 10 780 375" className={`cz-loader ${s.mark} h-auto`} aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id="cz-loader-gold" gradientUnits="userSpaceOnUse" x1="0" y1="360" x2="640" y2="0">
                        <stop offset="0" stopColor="#F6A900" />
                        <stop offset="0.55" stopColor="#F6C30F" />
                        <stop offset="1" stopColor="#FEE21C" />
                    </linearGradient>
                </defs>
                <path d={CURVE} fill="none" stroke="#9A6200" strokeWidth="46" strokeLinecap="round" pathLength={1} className="cz-loader-draw" />
                <path d={CURVE} fill="none" stroke="url(#cz-loader-gold)" strokeWidth="38" strokeLinecap="round" pathLength={1} className="cz-loader-draw" />
                <path d={CURVE} transform="translate(-4 -9)" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="8" strokeLinecap="round" pathLength={1} className="cz-loader-draw" />
            </svg>
            {s.word && (
                <p className="cz-loader-word font-display text-xl font-bold tracking-tight text-foreground">
                    {BRAND.nameFirst} <span className="text-brand-600">{BRAND.nameSecond}</span>
                </p>
            )}
        </div>
    )

    // fullScreen=true: renders its own fixed overlay (used by loading.tsx files).
    // fullScreen=false: returns the mark only; the caller is responsible for positioning.
    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background animate-[kfg-fade-in_0.2s_ease]">
                {mark}
            </div>
        )
    }

    return mark
}
