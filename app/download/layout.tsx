import { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
    title: `Install the ${BRAND.name} app on iPhone, Android or your computer`,
    description: `Add ${BRAND.name} to your home screen for quick access to data, airtime and vouchers. No app store needed.`,
}

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}