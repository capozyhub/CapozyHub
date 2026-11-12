'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID
const CHECK_EVERY_MS = 5 * 60 * 1000
const MIN_GAP_MS = 30 * 1000

/** Shows an "Update now" prompt when a newer deployment is live, and reloads onto it. */
export function UpdatePrompt() {
    const [available, setAvailable] = useState(false)
    const [dismissedFor, setDismissedFor] = useState<string | null>(null)
    const [updating, setUpdating] = useState(false)
    const latest = useRef<string | null>(null)
    const lastCheck = useRef(0)

    const check = useCallback(async () => {
        if (!CURRENT || document.visibilityState !== 'visible') return
        if (Date.now() - lastCheck.current < MIN_GAP_MS) return
        lastCheck.current = Date.now()
        try {
            const res = await fetch('/api/version', { cache: 'no-store' })
            if (!res.ok) return
            const { build } = await res.json()
            if (build && build !== CURRENT) {
                latest.current = build
                setAvailable(true)
            }
        } catch { /* offline or transient: try again at the next check */ }
    }, [])

    useEffect(() => {
        check()
        const timer = setInterval(check, CHECK_EVERY_MS)
        const onVisible = () => { if (document.visibilityState === 'visible') check() }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('online', check)
        return () => {
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('online', check)
        }
    }, [check])

    const update = async () => {
        setUpdating(true)
        try {
            // Keep the registration (it owns the push subscription); just activate the new
            // worker and drop old cached files so the reload pulls everything fresh.
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration()
                await reg?.update().catch(() => {})
                reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
            }
            if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map(k => caches.delete(k)))
            }
        } catch { /* a reload still gets the new version */ }
        window.location.reload()
    }

    if (!available || dismissedFor === latest.current) return null

    return (
        <div role="status" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] z-[9998] mx-auto max-w-sm md:inset-x-auto md:bottom-6 md:left-6 md:mx-0">
            <div className="neu-raised flex items-start gap-3 rounded-3xl p-4">
                <span className="clay-gold flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl">
                    <Sparkles className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-foreground">A new version is ready</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Update to get the latest features and fixes. It only takes a moment.</p>
                    <button
                        type="button"
                        onClick={update}
                        disabled={updating}
                        className="clay-gold mt-3 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold disabled:opacity-60"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
                        {updating ? 'Updating' : 'Update now'}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => setDismissedFor(latest.current)}
                    aria-label="Dismiss"
                    className="neu-inset flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}
