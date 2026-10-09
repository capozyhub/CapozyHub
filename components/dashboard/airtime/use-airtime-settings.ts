'use client'

import { useEffect, useState } from 'react'

/**
 * The admin-set fees, limits and on/off switches for airtime and Mashup, as the raw key/value map
 * the server prices from (so the page and the server read the very same numbers).
 */
export function useAirtimeSettings() {
    const [settings, setSettings] = useState<Record<string, string> | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        fetch('/api/user/airtime-settings', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(j => { if (!cancelled) setSettings(j?.settings ?? null) })
            .catch(() => { if (!cancelled) setSettings(null) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])

    return { settings, loading }
}

export function isNetworkEnabled(settings: Record<string, string> | null, network: string): boolean {
    return settings?.[`airtime_enabled_${network.toLowerCase()}`] !== 'false'
}

/** Mashup is MTN-only and needs the dashboard switch, the MTN Mashup switch and MTN airtime all on. */
export function isMashupEnabled(settings: Record<string, string> | null): boolean {
    if (!settings) return false
    return settings.dashboard_mashup_enabled === 'true'
        && settings.mashup_enabled_mtn !== 'false'
        && settings.airtime_enabled_mtn !== 'false'
}
