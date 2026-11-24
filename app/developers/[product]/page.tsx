import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { notFound } from 'next/navigation'
import {
    API_BASE,
    DEVELOPER_PRODUCTS,
    KEY_INFO,
    SITE,
    getProduct,
} from '@/lib/developer-products'

export const dynamicParams = false

export function generateStaticParams() {
    return DEVELOPER_PRODUCTS.map(p => ({ product: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
    const { product } = await params
    const p = getProduct(product)
    if (!p) return {}
    const url = `${SITE}/developers/${p.slug}`
    return {
        title: `${p.title} | ${BRAND.name}`,
        description: p.description,
        keywords: p.keywords,
        alternates: { canonical: url },
        openGraph: { title: p.title, description: p.description, url, type: 'article', siteName: BRAND.name },
        twitter: { card: 'summary_large_image', title: p.title, description: p.description },
    }
}

export default async function DeveloperProductPage({ params }: { params: Promise<{ product: string }> }) {
    const { product } = await params
    const p = getProduct(product)
    if (!p) notFound()

    const key = p.keyType ? KEY_INFO[p.keyType] : null
    const others = DEVELOPER_PRODUCTS.filter(o => o.slug !== p.slug)

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: p.title,
        description: p.description,
        url: `${SITE}/developers/${p.slug}`,
        inLanguage: 'en-GH',
        about: p.name,
        publisher: { '@type': 'Organization', name: BRAND.name, url: SITE },
    }

    const linkClass = 'rounded font-semibold underline underline-offset-2 text-brand-800 dark:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

    return (
        <div className="flex min-h-[100dvh] flex-col bg-black">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <header className="relative isolate overflow-hidden bg-black px-6 pb-24 pt-6 text-white sm:px-10">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-full opacity-90 sm:-right-[8%] sm:w-[60%]" />
                <div className="mx-auto max-w-3xl">
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 text-sm text-silver-200">
                        <Link href="/" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">{BRAND.name}</Link>
                        <span aria-hidden="true">/</span>
                        <Link href="/developers" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">Developer API</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page" className="text-white">{p.name}</span>
                    </nav>
                    <h1 className="mt-8 font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl">{p.title}</h1>
                    <p className="mt-4 max-w-2xl text-lg leading-relaxed text-silver-200">{p.intro}</p>
                    <Link href="/auth" className="clay-gold mt-8 inline-flex min-h-[3.25rem] items-center gap-2 rounded-full px-8 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                        Get your API key <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </header>

            <main className="relative -mt-8 flex-1 rounded-t-[2rem] bg-neu px-5 pb-16 pt-8 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10">
                <div className="mx-auto w-full max-w-3xl space-y-8">
                    {p.endpoints.length > 0 && (
                        <section className="neu-raised space-y-4 rounded-[2rem] p-6 sm:p-7" aria-labelledby="endpoints-title">
                            <h2 id="endpoints-title" className="font-display text-2xl font-bold tracking-tight">Endpoints</h2>
                            <p className="text-sm text-muted-foreground">
                                Base URL: <code className="font-mono">{API_BASE}</code>
                                {key && (
                                    <>
                                        {' '}· Send your {key.label} (<code className="font-mono">{key.prefix}...</code>) as-is in the{' '}
                                        <code className="font-mono">Authorization</code> header.
                                    </>
                                )}
                            </p>
                            <ul className="neu-inset divide-y divide-border rounded-2xl">
                                {p.endpoints.map(e => (
                                    <li key={e.method + e.path} className="space-y-1 p-4">
                                        <p className="font-mono text-sm">
                                            <span className="mr-2 rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-bold">{e.method}</span>{e.path}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{e.summary}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {p.curl && (
                        <section className="space-y-3" aria-labelledby="example-title">
                            <h2 id="example-title" className="font-display text-2xl font-bold tracking-tight">Example request</h2>
                            <pre className="neu-night overflow-x-auto rounded-2xl p-5 text-xs text-silver-100 sm:text-sm" tabIndex={0}>
                                <code>{p.curl}</code>
                            </pre>
                        </section>
                    )}

                    <section className="neu-raised-sm space-y-3 rounded-3xl p-6" aria-labelledby="start-title">
                        <h2 id="start-title" className="font-display text-xl font-bold tracking-tight">Next steps</h2>
                        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                            <li><Link href="/developers" className={linkClass}>Full API documentation</Link> with every request and response</li>
                            <li><a href="/openapi.yaml" className={linkClass}>OpenAPI 3 specification</a></li>
                            <li><Link href="/auth" className={linkClass}>Sign in or create an account</Link> to generate your API key</li>
                        </ul>
                    </section>

                    <section className="space-y-3" aria-labelledby="more-title">
                        <h2 id="more-title" className="font-display text-xl font-bold tracking-tight">Other APIs</h2>
                        <ul className="flex flex-wrap gap-2">
                            {others.map(o => (
                                <li key={o.slug}>
                                    <Link
                                        href={`/developers/${o.slug}`}
                                        className="neu-raised-sm neu-press inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500"
                                    >
                                        {o.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </main>
        </div>
    )
}