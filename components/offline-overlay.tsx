'use client'

import { useEffect, useState } from 'react'
import { BRAND } from '@/lib/brand'
import { OfflineScreen } from '@/components/offline-screen'

// On a shop page the tab title is the shop's own name (white-label), so show that instead of the platform.
function currentName(): string {
    const path = window.location.pathname
    if (path.includes('/shop/') || path.includes('/shop-domain/')) {
        const title = document.title
        if (title) return title.includes('|') ? title.split('|')[0].trim() : title
    }
    return BRAND.name
}

export function OfflineOverlay() {
    const [isOffline, setIsOffline] = useState(false)
    const [name, setName] = useState<string>(BRAND.name)

    useEffect(() => {
        const sync = () => {
            const offline = !navigator.onLine
            if (offline) setName(currentName())
            setIsOffline(offline)
        }
        sync()
        window.addEventListener('online', sync)
        window.addEventListener('offline', sync)
        // Some browsers miss the offline event; re-read the status now and then as a fallback.
        const interval = setInterval(sync, 3000)
        return () => {
            window.removeEventListener('online', sync)
            window.removeEventListener('offline', sync)
            clearInterval(interval)
        }
    }, [])

    if (!isOffline) return null
    return <OfflineScreen name={name} autoFocus />
}
