import type { Metadata } from 'next'
import { StorefrontSuccess, successMetadata } from '@/components/storefront/success-view'

interface Props {
    params: Promise<{ shopSlug: string }>
    searchParams: Promise<{ ref?: string }>
}

export const revalidate = 0 // Always fresh for success page

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return successMetadata((await params).shopSlug)
}

export default async function ShopDomainSuccessPage({ params, searchParams }: Props) {
    const { shopSlug } = await params
    const { ref } = await searchParams
    return <StorefrontSuccess shopSlug={shopSlug} reference={ref} basePath="" />
}
