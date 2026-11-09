import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { resolveAccent } from './accent'

/** Server-safe: no hooks, so success/about pages can use it directly. */
export function StorefrontPageFrame({
    name, logoUrl, brandColor, backHref, backLabel, children, headerAction,
}: {
    name: string
    logoUrl?: string | null
    brandColor?: string | null
    backHref: string
    backLabel: string
    headerAction?: React.ReactNode
    children: React.ReactNode
}) {
    const accent = resolveAccent(brandColor)
    return (
        <div className="flex min-h-[100dvh] flex-col bg-black" style={{ ['--shop-accent' as string]: accent }}>
            <header className="relative isolate overflow-hidden bg-black px-6 pb-20 pt-6 text-white sm:px-10">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-full opacity-90 sm:-right-[10%] sm:w-[60%]" />
                <div className="mx-auto flex max-w-[34rem] items-center justify-between gap-3">
                    <Link href={backHref} className="neu-night inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition-colors hover:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
                    </Link>
                    {headerAction}
                </div>
                <div className="mx-auto mt-6 flex max-w-[34rem] items-center gap-4">
                    {logoUrl ? (
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-offset-2 ring-offset-black" style={{ ['--tw-ring-color' as string]: accent }}>
                            <Image src={logoUrl} alt="" fill sizes="56px" className="object-cover" />
                        </span>
                    ) : (
                        <span className="neu-night flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-black" style={{ ['--tw-ring-color' as string]: accent }}>
                            <ShoppingBag className="h-6 w-6 text-brand-400" aria-hidden="true" />
                        </span>
                    )}
                    <p className="font-display text-2xl font-bold leading-tight tracking-tight text-balance">{name}</p>
                </div>
            </header>

            <main className="relative -mt-8 flex-1 rounded-t-[2rem] bg-neu px-5 pb-16 pt-8 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10">
                <div className="mx-auto w-full max-w-[34rem]">{children}</div>
            </main>
        </div>
    )
}
