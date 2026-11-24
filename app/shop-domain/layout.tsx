import { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

const SHOP_URL = `https://${BRAND.shopHost}`
const TITLE = `${BRAND.name} Stores: find a shop`
const DESCRIPTION = `Find a ${BRAND.name} reseller shop and buy MTN, Telecel and AirtelTigo data, airtime, WAEC and BECE results checker vouchers and AFA registration online in Ghana.`

export const metadata: Metadata = {
    metadataBase: new URL(SHOP_URL),
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
        'data bundle shop Ghana', 'find data shop', `${BRAND.name} Stores`, BRAND.name,
        'data reseller shops Ghana', 'buy data Ghana', 'buy airtime Ghana',
        'MTN data shop', 'Telecel data shop', 'AirtelTigo data shop',
        'buy waec results checker', 'bece results checker online', 'mtn afa registration ghana',
    ],
    alternates: { canonical: SHOP_URL },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        images: [{ url: '/logo.png', width: 1200, height: 630, alt: `${BRAND.name} Stores` }],
        type: 'website',
        url: SHOP_URL,
        siteName: `${BRAND.name} Stores`,
    },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/logo.png'] },
}

export default function ShopDomainLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}