import { Mic2, Wifi, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BundlePreference, MashupBundle } from '@/lib/mashup-bundle'

const PREFERENCES: { id: BundlePreference; label: string; hint: string; icon: typeof Zap }[] = [
    { id: 'balanced', label: 'Balanced', hint: 'A bit of both', icon: Zap },
    { id: 'data', label: 'More data', hint: 'Lean to browsing', icon: Wifi },
    { id: 'voice', label: 'More talk', hint: 'Lean to calls', icon: Mic2 },
]

/** Pick what the bundle leans towards: three pill choices, the chosen one sinks in. */
export function MashupPreference({ value, onChange }: { value: BundlePreference; onChange: (v: BundlePreference) => void }) {
    return (
        <div className="space-y-2.5">
            <p id="mashup-pref" className="text-sm font-semibold text-foreground">What should it lean towards?</p>
            <div role="radiogroup" aria-labelledby="mashup-pref" className="grid grid-cols-3 gap-2.5">
                {PREFERENCES.map(({ id, label, hint, icon: Icon }) => {
                    const active = value === id
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onChange(id)}
                            className={cn(
                                'flex flex-col items-center gap-1 rounded-2xl px-2 py-3.5 text-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                                active ? 'neu-inset ring-2 ring-black dark:ring-brand-500' : 'neu-raised-sm neu-press',
                            )}
                        >
                            <Icon className={cn('h-5 w-5', active ? 'text-foreground' : 'text-muted-foreground')} />
                            <span className="text-sm font-semibold">{label}</span>
                            <span className="text-[11px] leading-tight text-muted-foreground">{hint}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/** What the amount is expected to buy, as a data tile and a voice tile. */
export function MashupEstimate({ bundle, tone = 'light' }: { bundle: MashupBundle; tone?: 'light' | 'night' }) {
    const night = tone === 'night'
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
                {[
                    { label: 'Data', value: bundle.data, icon: Wifi },
                    { label: 'Talk time', value: bundle.voice, icon: Mic2 },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className={cn('flex flex-col items-center rounded-2xl p-3.5 text-center', night ? 'neu-night-in' : 'neu-inset')}>
                        <span className="clay-gold mb-1.5 flex h-8 w-8 items-center justify-center rounded-full"><Icon className="h-4 w-4" /></span>
                        <span className={cn('text-xs', night ? 'text-silver-200' : 'text-muted-foreground')}>{label}</span>
                        <span className={cn('font-display text-lg font-bold leading-tight', night && 'text-white')}>{value}</span>
                    </div>
                ))}
            </div>
            {!bundle.exact && (
                <p className={cn('text-center text-xs', night ? 'text-brand-400' : 'text-amber-700 dark:text-amber-400')}>
                    Under GHS 10 these are estimates. MTN sets the final figures.
                </p>
            )}
        </div>
    )
}
