import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#000000',
    interactiveWidget: 'resizes-content',
}
import { Bricolage_Grotesque, Figtree } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { OfflineOverlay } from '@/components/offline-overlay'
import { BRAND } from '@/lib/brand'

const body = Figtree({
    subsets: ['latin'],
    variable: '--font-body',
    display: 'swap',
})

const display = Bricolage_Grotesque({
    subsets: ['latin'],
    variable: '--font-display',
    display: 'swap',
})

export const metadata: Metadata = {
    metadataBase: new URL(BRAND.siteUrl),
    title: `${BRAND.name} - Powering Digital Services in Ghana`,
    description: `Buy affordable MTN, Telecel, and AirtelTigo data bundles, airtime, and mashup online in Ghana. Instantly purchase WAEC & BECE Results Checker vouchers, complete MTN AFA Registrations, open your own reseller shop, and integrate our Developer API. Fast, secure, and reliable digital solutions — ${BRAND.name}.`,
    keywords: [
        // Brand
        BRAND.name, BRAND.domain,
        // Data & Airtime
        'buy data bundles Ghana', 'cheap data Ghana', 'affordable data bundles', 'MTN data bundles Ghana',
        'Telecel data bundles', 'AirtelTigo data bundles', 'buy data online Ghana', 'mobile data Ghana',
        'cheap airtime Ghana', 'buy airtime online Ghana', 'MTN airtime Ghana', 'Telecel airtime',
        'data packages Ghana', 'instant data delivery Ghana',
        // Mashup
        'MTN mashup', 'Telecel mashup', 'buy mashup bundles Ghana', 'mashup data Ghana',
        'affordable mashup Ghana', 'MTN mashup bundle',
        // Results Checker
        'buy result checker Ghana', 'WAEC result checker online Ghana', 'BECE result checker Ghana',
        'WASSCE result checker', 'school placement checker Ghana', 'results checker voucher Ghana',
        'cheap result checker Ghana', 'buy WAEC checker online', 'online result checker Ghana',
        // AFA Registration
        'MTN AFA registration Ghana', 'AFA agent registration', 'MTN agent registration Ghana',
        'how to register for AFA Ghana', 'AFA registration fee Ghana',
        // Developer API
        'developer API Ghana', 'VTU API Ghana', 'data reseller API Ghana',
        'airtime API Ghana', 'results checker API', 'digital services API Ghana',
        'reseller platform Ghana', 'bulk data API Ghana', 'data bundle API Ghana',
        'AFA registration API Ghana',
        // General
        'digital services Ghana', 'online digital platform Ghana', 'data reseller Ghana',
        'Ghana fintech', 'instant delivery Ghana'
    ],
    authors: [{ name: BRAND.name }],
    openGraph: {
        title: `${BRAND.name} - Powering Digital Services in Ghana`,
        description: 'Buy data bundles, airtime, mashup, WAEC Results Checkers, AFA Registrations & access our Developer API. Fast, secure digital services in Ghana.',
        type: 'website',
        url: BRAND.siteUrl,
        siteName: BRAND.name,
        images: [
            {
                url: '/logo.png',
                width: 512,
                height: 512,
                alt: `${BRAND.name} logo`,
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: `${BRAND.name} - Powering Digital Services in Ghana`,
        description: 'Buy data bundles, airtime, mashup, WAEC Results Checkers, AFA Registrations & access our Developer API. Fast, secure digital services in Ghana.',
        images: ['/logo.png'],
    },
    appleWebApp: {
        title: BRAND.name,
        statusBarStyle: 'black-translucent',
        capable: true,
    },
    icons: {
        icon: [
            { url: '/icons/icon-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-512x512.png?v=2', sizes: '512x512', type: 'image/png' },
        ],
        shortcut: '/icons/icon-192x192.png?v=2',
        apple: '/icons/apple-touch-icon.png?v=2',
    },
    manifest: '/manifest.json',
}

import { UIProvider } from '@/contexts/ui-context'
import { PageReadyLoader } from '@/components/ui/page-ready-loader'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: "(function(){try{var d=document.documentElement,n=navigator,m=n.deviceMemory,c=n.hardwareConcurrency,s=n.connection&&n.connection.saveData;if((m&&m<=2)||(c&&c<=4)||s||matchMedia('(prefers-reduced-data: reduce)').matches)d.setAttribute('data-perf','lite')}catch(e){}})()" }} />
                <link rel="preload" href="/logo.png" as="image" />
            </head>
            <body className={`${body.variable} ${display.variable} ${body.className}`}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Organization",
                            "name": BRAND.name,
                            "url": `${BRAND.siteUrl}/`,
                            "logo": `${BRAND.siteUrl}/logo.png`,
                            "description": "Powering Digital Services in Ghana. Buy data bundles, airtime, mashup, WAEC Results Checker vouchers and MTN AFA Registrations, and integrate our Developer API.",
                            "areaServed": "GH",
                            "hasOfferCatalog": {
                                "@type": "OfferCatalog",
                                "name": `${BRAND.name} products and APIs`,
                                "itemListElement": [
                                    ['Data Bundles API', 'data-bundles'],
                                    ['Airtime API', 'airtime'],
                                    ['Results Checker API', 'results-checker'],
                                    ['AFA Registration API', 'afa-registration'],
                                ].map(([name, slug]) => ({
                                    "@type": "Offer",
                                    "itemOffered": {
                                        "@type": "Service",
                                        "name": name,
                                        "url": `${BRAND.siteUrl}/developers/${slug}`
                                    }
                                }))
                            },
                            "sameAs": [BRAND.siteUrl]
                        })
                    }}
                />
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                            <UIProvider>
                                <PageReadyLoader />
                                <OfflineOverlay />
                                {children}
                                <Toaster position="top-right" richColors />
                            </UIProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
