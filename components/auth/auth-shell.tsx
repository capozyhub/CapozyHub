'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

export const FOCUS =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
const FOCUS_ON_DARK =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'

/**
 * Shared frame for every account page (sign in, sign up, password recovery).
 * A black stage carries the headline and the brand swoosh; on desktop it sits beside
 * the form, on mobile the form rises over it like a sheet. `progress` draws the
 * swoosh, so multi-step flows show where you are without a separate progress bar.
 */
export function AuthShell({
    heading,
    lead,
    progress = 1,
    stepLabel,
    backHref = '/',
    backLabel = 'Home',
    children,
}: {
    heading: React.ReactNode
    lead?: React.ReactNode
    progress?: number
    /** Visible text for multi-step flows, e.g. "Step 2 of 4". */
    stepLabel?: string
    backHref?: string
    backLabel?: string
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-[100dvh] flex-col bg-black lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:bg-neu">
            <aside className="relative isolate overflow-hidden bg-black px-6 pb-28 pt-6 text-white sm:px-10 sm:pb-32 lg:flex lg:min-h-[100dvh] lg:flex-col lg:justify-between lg:p-12 lg:pb-12 xl:p-16">
                <BrandSwoosh
                    progress={progress}
                    className="pointer-events-none absolute bottom-12 -right-[28%] -z-10 w-[130%] sm:bottom-14 sm:-right-[8%] sm:w-[75%] lg:-bottom-10 lg:-right-[22%] lg:w-[125%]"
                />

                <Link href="/" aria-label={BRAND.name} className={cn('flex w-fit items-center gap-2.5 rounded-full', FOCUS_ON_DARK)}>
                    <BrandLogo width={40} height={40} className="h-10 w-10" />
                    <span className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                        {BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span>
                    </span>
                </Link>

                <div className="mt-8 max-w-md lg:mt-0">
                    {stepLabel && (
                        <p className="mb-3 text-sm font-semibold text-brand-400" aria-live="polite">{stepLabel}</p>
                    )}
                    <h1
                        key={typeof heading === 'string' ? heading : undefined}
                        className="font-display text-[1.9rem] font-bold leading-[1.05] tracking-tight text-white text-balance animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:text-4xl xl:text-5xl"
                    >
                        {heading}
                    </h1>
                    {lead && <p className="mt-4 hidden text-lg leading-relaxed text-silver-200 sm:block">{lead}</p>}
                </div>

                <p className="hidden text-sm text-silver-200/80 lg:block">{BRAND.domain}</p>
            </aside>

            <main className="relative -mt-8 flex flex-1 flex-col rounded-t-[2rem] bg-neu px-5 pb-10 pt-6 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10 lg:mt-0 lg:min-h-[100dvh] lg:justify-center lg:rounded-none lg:shadow-none">
                <div className="mx-auto w-full max-w-[26rem]">
                    <Link href={backHref} className={cn('mb-6 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-muted-foreground hover:text-foreground', FOCUS)}>
                        <ArrowLeft className="h-4 w-4" /> {backLabel}
                    </Link>
                    {children}
                </div>
            </main>
        </div>
    )
}
