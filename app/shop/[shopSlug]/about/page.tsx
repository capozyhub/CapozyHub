import type { Metadata } from 'next'
import { StorefrontAbout, aboutMetadata } from '@/components/storefront/about-view'

interface Props {
    params: Promise<{ shopSlug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return aboutMetadata((await params).shopSlug)
}

export default async function ShopAboutPage({ params }: Props) {
    const { shopSlug } = await params
    return <StorefrontAbout shopSlug={shopSlug} basePath="/shop" />
}