'use client'

import { useEffect, useRef } from 'react'
import { WifiOff } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'

/**
 * The "no connection" screen, shared by the /~offline fallback page and the live overlay.
 * No data fetching and no network assets: it must render with the network down.
 */
export function OfflineScreen({ name, autoFocus = false }: { name: string; autoFocus?: boolean }) {
    const retry = useRef<HTMLButtonElement>(null)
    useEffect(() => { if (autoFocus) retry.current?.focus() }, [autoFocus])

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="offline-title"
            aria-describedby="offline-body"
            className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-black p-4"
        >
            <BrandSwoosh className="pointer-events-none absolute -bottom-10 -right-[25%] w-full opacity-60 sm:w-[70%]" />
            <div className="neu-night relative w-full max-w-[26rem] space-y-6 rounded-[2rem] p-8 text-center text-white sm:p-10">
                <span className="clay-gold mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                    <WifiOff className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-brand-400">{name}</p>
                    <h1 id="offline-title" className="font-display text-3xl font-bold tracking-tight">You are offline</h1>
                    <p id="offline-body" className="text-sm leading-relaxed text-silver-200">
                        There is no internet connection. Check your data or Wi-Fi, then try again. Anything you were doing is safe.
                    </p>
                </div>
                <button
                    ref={retry}
                    type="button"
                    onClick={() => window.location.reload()}
                    className="clay-gold flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
