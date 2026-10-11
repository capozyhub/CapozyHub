import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Download Capozy Hub App - Install on iPhone, Android & Windows',
    description: 'Install the Capozy Hub app on your phone or computer for faster access, PIN login, and instant data purchases.',
}

export default function DownloadLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
