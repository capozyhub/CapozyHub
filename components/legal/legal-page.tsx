import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { ReadingProgress } from '@/components/legal/reading-progress'
import { BRAND } from '@/lib/brand'

export interface LegalSection {
    id: string
    title: string
    body: React.ReactNode
}

const FOCUS =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

/**
 * Frame for the terms and privacy pages: a black header with the brand swoosh, a
 * sticky contents list on desktop, and the clauses on a soft raised sheet. Clauses are
 * numbered because they are cross-referenced ("see clause 4").
 */
export function LegalPage({
    title, lead, updated, sections, otherPage,
}: {
    title: string
    lead: string
    updated: string
    sections: LegalSection[]
    otherPage: { href: string; label: string }
}) {
    return (
        <div className="min-h-screen bg-neu text-foreground">
            <ReadingProgress />

            <header className="relative isolate overflow-hidden bg-black text-white">
                <BrandSwoosh progress={1} className="pointer-events-none absolute -bottom-8 -right-[30%] -z-10 w-[130%] sm:-right-[8%] sm:w-[70%] lg:-right-[2%] lg:w-[55%]" />
                <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6 sm:px-8 sm:pb-28">
                    <div className="flex items-center justify-between">
                        <Link href="/" aria-label={BRAND.name} className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                            <BrandLogo width={36} height={36} className="h-9 w-9" />
                            <span className="font-display text-xl font-bold tracking-tight">{BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span></span>
                        </Link>
                        <Link href="/" className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-silver-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                            <ArrowLeft className="h-4 w-4" /> Home
                        </Link>
                    </div>
                    <h1 className="mt-14 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-white text-balance sm:text-5xl">{title}</h1>
                    <p className="mt-4 max-w-xl text-lg leading-relaxed text-silver-200">{lead}</p>
                    <p className="mt-6 text-sm text-silver-200/80">Last updated {updated}</p>
                </div>
            </header>

            <div className="relative mx-auto -mt-12 w-full max-w-6xl px-5 pb-20 sm:px-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
                <nav aria-label="On this page" className="neu-raised-sm sticky top-6 hidden self-start rounded-2xl p-5 lg:block">
                    <p className="mb-3 font-display text-base font-semibold text-foreground">On this page</p>
                    <ol className="space-y-2 text-sm">
                        {sections.map((s, i) => (
                            <li key={s.id}>
                                <a href={`#${s.id}`} className={`flex gap-2 rounded text-muted-foreground hover:text-foreground ${FOCUS}`}>
                                    <span className="w-5 shrink-0 tabular-nums text-brand-700 dark:text-brand-500">{i + 1}.</span>
                                    <span>{s.title}</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <article className="neu-raised rounded-[2rem] p-6 sm:p-10">
                    <div className="space-y-10">
                        {sections.map((s, i) => (
                            <section key={s.id} id={s.id} className="scroll-mt-8">
                                <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                                    <span className="mr-2 tabular-nums text-brand-700 dark:text-brand-500">{i + 1}.</span>{s.title}
                                </h2>
                                <div className="mt-3 max-w-prose whitespace-pre-line text-base leading-relaxed text-muted-foreground [&_p]:text-base [&_p]:leading-relaxed">{s.body}</div>
                            </section>
                        ))}
                    </div>
                    <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
                        See also our <Link href={otherPage.href} className={`rounded font-semibold text-brand-800 underline underline-offset-4 dark:text-brand-400 ${FOCUS}`}>{otherPage.label}</Link>.
                    </p>
                </article>
            </div>
        </div>
    )
}
