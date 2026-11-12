'use client'

import Image from 'next/image'
import { Store } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { resolveAccent } from '@/components/storefront/accent'

/**
 * A small mock of the public storefront that updates as the owner types. It follows the real
 * storefront's rules: a black stage, a light sheet, gold clay button, and the owner's colour
 * used only as a small accent (resolveAccent decides whether it is readable).
 */
export function StorefrontPreview({
    name, slug, description, logo, color,
}: {
    name: string
    slug: string
    description: string
    logo: string | null
    color: string
}) {
    const accent = resolveAccent(color)
    const title = name.trim() || 'Your shop name'
    const blurb = description.trim() || 'A short line about what you sell shows up here.'

    return (
        <figure className="space-y-3" aria-label="Live preview of your storefront">
            <figcaption className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview</figcaption>
            <div className="overflow-hidden rounded-[1.75rem] bg-black shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" />
                    <span className="ml-2 min-w-0 flex-1 truncate rounded-full bg-white/10 px-3 py-1 text-[10px] text-silver-200">
                        {BRAND.shopHost}/{slug || 'your-link'}
                    </span>
                </div>
                <div className="px-5 pb-6 pt-7 text-center text-white">
                    <div
                        className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#111] ring-2 ring-offset-2 ring-offset-black"
                        style={{ ['--tw-ring-color' as string]: accent }}
                    >
                        {logo ? (
                            <Image src={logo} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" />
                        ) : (
                            <Store className="h-7 w-7" style={{ color: accent }} aria-hidden="true" />
                        )}
                    </div>
                    <h3 className="mt-4 break-words font-display text-xl font-bold leading-tight tracking-tight">{title}</h3>
                    <span className="mx-auto mt-2 block h-0.5 w-10 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
                    <p className="mx-auto mt-3 line-clamp-3 max-w-[16rem] break-words text-xs leading-relaxed text-silver-200">{blurb}</p>
                </div>
                <div className="space-y-2.5 rounded-t-[1.5rem] bg-neu px-4 pb-5 pt-4">
                    <div className="grid grid-cols-3 gap-2" aria-hidden="true">
                        {['MTN', 'Telecel', 'AT'].map((n, i) => (
                            <div key={n} className={i === 0 ? 'neu-inset rounded-xl py-2 text-center text-[11px] font-semibold text-foreground' : 'neu-raised-sm rounded-xl py-2 text-center text-[11px] font-semibold text-muted-foreground'}
                                style={i === 0 ? { boxShadow: `inset 0 0 0 2px ${accent}` } : undefined}>
                                {n}
                            </div>
                        ))}
                    </div>
                    <div className="clay-gold flex h-10 items-center justify-center rounded-full text-sm font-semibold" aria-hidden="true">Buy data</div>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">Prices and packages come from your pricing step. Your shop opens once they are approved.</p>
        </figure>
    )
}
