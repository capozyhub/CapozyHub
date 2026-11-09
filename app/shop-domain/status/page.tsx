import { Metadata } from 'next'
import { Suspense } from 'react'
import ShopStatusTracker from '@/app/shop/status/ShopStatusTracker'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Track an order',
    description: 'See where your data, airtime or voucher order has got to.',
}

function StatusLoading() {
    return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">One moment…</p>
        </div>
    )
}

export default function ShopDomainStatusPage() {
    return (
        <Suspense fallback={<StatusLoading />}>
            <ShopStatusTracker />
        </Suspense>
    )
}