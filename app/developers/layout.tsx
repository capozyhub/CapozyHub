import type { Metadata } from 'next'
import { SITE, API_BASE } from '@/lib/developer-products'
import { BRAND } from '@/lib/brand'

const TITLE = `Developer API for Ghana: data, airtime, results checker and AFA | ${BRAND.name}`
const DESCRIPTION =
    'Public REST API for Ghana digital services: MTN, Telecel and AirtelTigo data bundles, airtime, WAEC/BECE results checkers and MTN AFA registration. OpenAPI spec included.'

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${SITE}/developers` },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        url: `${SITE}/developers`,
        type: 'website',
        siteName: BRAND.name,
    },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: ` Developer API`,
    description: DESCRIPTION,
    url: `${SITE}/developers`,
    documentation: `${SITE}/developers`,
    termsOfService: `${SITE}/terms`,
    provider: { '@type': 'Organization', name: BRAND.name, url: SITE },
    areaServed: 'GH',
    potentialAction: { '@type': 'ConsumeAction', target: API_BASE },
}

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            {children}
        </>
    )
}
