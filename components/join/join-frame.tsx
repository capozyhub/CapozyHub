import Image from 'next/image'
import { Store } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { resolveAccent } from '@/components/storefront/accent'

/**
 * Frame for the invite (/join) pages. These pages are white-label on purpose: no platform name or logo.
 * It uses the Capozy surfaces, and the upline's logo and colour only as the accent.
 */
export function JoinFrame({ title, lead, logoUrl, brandColor, children }: {
    title: string
    lead?: string
    logoUrl?: string | null
    brandColor?: string | null
    children: React.ReactNode
}) {
    const accent = resolveAccent(brandColor)
    return (
        <div className="flex min-h-[100dvh] flex-col bg-black" style={{ ['--shop-accent' as string]: accent }}>
            <header className="relative isolate overflow-hidden bg-black px-6 pb-24 pt-10 text-white sm:px-10">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-full opacity-90 sm:-right-[8%] sm:w-[60%]" />
                <div className="mx-auto flex max-w-md items-center gap-4">
                    {logoUrl ? (
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-offset-2 ring-offset-black" style={{ ['--tw-ring-color' as string]: accent }}>
                            <Image src={logoUrl} alt="" fill sizes="56px" className="object-cover" />
                        </span>
                    ) : (
                        <span className="neu-night flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-black" style={{ ['--tw-ring-color' as string]: accent }}>
                            <Store className="h-6 w-6 text-brand-400" aria-hidden="true" />
                        </span>
                    )}
                    <div>
                        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-balance">{title}</h1>
                        {lead && <p className="mt-2 text-silver-200">{lead}</p>}
                    </div>
                </div>
            </header>
            <main className="relative -mt-8 flex-1 rounded-t-[2rem] bg-neu px-5 pb-16 pt-8 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10">
                <div className="mx-auto w-full max-w-md">{children}</div>
            </main>
        </div>
    )
}
