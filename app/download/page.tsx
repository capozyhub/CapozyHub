'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Apple, ArrowLeft, Check, Download, Monitor, Smartphone } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { ClayButton, Notice } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

type Device = 'ios' | 'android' | 'desktop'

function detectDevice(): Device {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) return 'ios'
    if (/android/.test(ua)) return 'android'
    return 'desktop'
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DEVICES: { key: Device; label: string; icon: typeof Apple; browser: string }[] = [
    { key: 'ios', label: 'iPhone', icon: Apple, browser: 'Safari' },
    { key: 'android', label: 'Android', icon: Smartphone, browser: 'Chrome or Samsung Internet' },
    { key: 'desktop', label: 'Computer', icon: Monitor, browser: 'Chrome or Edge' },
]

const STEPS: Record<Device, { title: string; body: React.ReactNode }[]> = {
    ios: [
        { title: 'Open this page in Safari', body: <>Other iPhone browsers cannot install apps. Open this link in <strong>Safari</strong>.</> },
        { title: 'Tap Share', body: <>It is the square with an arrow pointing up, at the bottom of the screen.</> },
        { title: 'Choose Add to Home Screen', body: <>Scroll down the Share menu and tap <strong>Add to Home Screen</strong>.</> },
        { title: 'Tap Add', body: <>Tap <strong>Add</strong> in the top-right corner. The icon now sits on your home screen and opens full screen.</> },
    ],
    android: [
        { title: 'Tap Install below', body: <>If your browser offers one-tap install, the button below turns on. Tap it and confirm.</> },
        { title: 'Or use the browser menu', body: <>Tap the three dots at the top right of Chrome and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</> },
        { title: 'Open it from your home screen', body: <>The icon opens {BRAND.name} full screen, without the address bar.</> },
    ],
    desktop: [
        { title: 'Find the install icon', body: <>In Chrome or Edge, look at the right side of the address bar for a small screen with a down arrow.</> },
        { title: 'Click Install', body: <>Confirm in the prompt. {BRAND.name} is added to your desktop or Start menu.</> },
        { title: 'Open it like any app', body: <>It opens in its own window with no browser controls.</> },
    ],
}

const BENEFITS = [
    'Opens from your home screen like any app',
    'Loads quickly even on a weak connection',
    'No app store and no manual updates',
]

export default function DownloadPage() {
    const [device, setDevice] = useState<Device>('android')
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [hint, setHint] = useState(false)

    useEffect(() => {
        setDevice(detectDevice())
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
            setIsInstalled(true)
        }
    }, [])

    useEffect(() => {
        const onPrompt = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent) }
        const onInstalled = () => { setIsInstalled(true); setDeferredPrompt(null) }
        window.addEventListener('beforeinstallprompt', onPrompt)
        window.addEventListener('appinstalled', onInstalled)
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt)
            window.removeEventListener('appinstalled', onInstalled)
        }
    }, [])

    const install = async () => {
        if (!deferredPrompt) { setHint(true); document.getElementById('install-steps')?.scrollIntoView({ behavior: 'smooth' }); return }
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setIsInstalled(true)
        setDeferredPrompt(null)
    }

    const active = DEVICES.find(d => d.key === device)!
    const canOneTap = device !== 'ios' && !!deferredPrompt

    return (
        <div className="flex min-h-[100dvh] flex-col bg-black">
            <header className="relative isolate overflow-hidden bg-black px-6 pb-24 pt-6 text-white sm:px-10">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-full opacity-90 sm:-right-[8%] sm:w-[65%]" />
                <div className="mx-auto max-w-2xl">
                    <Link href="/" className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-full text-sm font-semibold text-silver-100 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {BRAND.name}
                    </Link>
                    <div className="mt-8 flex items-center gap-4">
                        <BrandLogo width={56} height={56} className="h-14 w-14" />
                        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl">
                            Put {BRAND.name} on your home screen.
                        </h1>
                    </div>
                    <ul className="mt-6 space-y-2 text-silver-200">
                        {BENEFITS.map(b => (
                            <li key={b} className="flex items-center gap-2.5">
                                <span className="clay-gold flex h-5 w-5 shrink-0 items-center justify-center rounded-full"><Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /></span>
                                {b}
                            </li>
                        ))}
                    </ul>
                </div>
            </header>

            <main className="relative -mt-8 flex-1 rounded-t-[2rem] bg-neu px-5 pb-16 pt-8 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10">
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    {isInstalled ? (
                        <Notice tone="info">{BRAND.name} is already installed on this device.</Notice>
                    ) : device !== 'ios' && (
                        <div className="space-y-3">
                            <ClayButton type="button" onClick={install}>
                                <Download className="h-4 w-4" aria-hidden="true" /> Install {BRAND.name}
                            </ClayButton>
                            {hint && !deferredPrompt && (
                                <Notice tone="info">Your browser did not offer one-tap install. Follow the steps below instead.</Notice>
                            )}
                        </div>
                    )}

                    <section id="install-steps" className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7" aria-labelledby="how-title">
                        <h2 id="how-title" className="font-display text-xl font-bold tracking-tight">How to install</h2>

                        <div role="tablist" aria-label="Your device" className="neu-inset flex gap-1 rounded-full p-1">
                            {DEVICES.map(d => (
                                <button
                                    key={d.key}
                                    role="tab"
                                    id={`tab-${d.key}`}
                                    aria-selected={device === d.key}
                                    aria-controls="device-panel"
                                    onClick={() => setDevice(d.key)}
                                    className={cn(
                                        'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold',
                                        FOCUS,
                                        device === d.key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <d.icon className="h-4 w-4" aria-hidden="true" /> {d.label}
                                </button>
                            ))}
                        </div>

                        <div id="device-panel" role="tabpanel" aria-labelledby={`tab-${device}`} className="space-y-5">
                            <p className="text-sm text-muted-foreground">Works in {active.browser}.</p>
                            <ol className="space-y-4">
                                {STEPS[device].map((s, i) => (
                                    <li key={s.title} className="flex items-start gap-4">
                                        <span className="clay-black flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">{i + 1}</span>
                                        <div>
                                            <p className="font-semibold">{s.title}</p>
                                            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                            {canOneTap && (
                                <ClayButton type="button" onClick={install}>
                                    <Download className="h-4 w-4" aria-hidden="true" /> Install now
                                </ClayButton>
                            )}
                        </div>
                    </section>

                    <section className="neu-raised-sm rounded-3xl p-5 text-center">
                        <p className="font-display text-lg font-bold tracking-tight">Know someone who should have it?</p>
                        <p className="mt-1 text-sm text-muted-foreground">Send them this link. They can install straight from their browser.</p>
                        <p className="neu-inset mt-3 inline-block rounded-xl px-4 py-2 font-mono text-sm">{BRAND.domain}/download</p>
                    </section>
                </div>
            </main>
        </div>
    )
}
