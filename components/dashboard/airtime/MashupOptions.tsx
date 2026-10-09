import { Mic2, Wifi, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BundlePreference, MashupBundle } from '@/lib/mashup-bundle'

const PREFERENCES: { id: BundlePreference; label: string; hint: string; icon: typeof Zap }[] = [
    { id: 'balanced', label: 'Balanced', hint: 'Data and minutes', icon: Zap },
    { id: 'data', label: 'More data', hint: 'Lean to data', icon: Wifi },
    { id: 'voice', label: 'More talk', hint: 'Lean to minutes', icon: Mic2 },
]

export function MashupPreference({ value, onChange }: { value: BundlePreference; onChange: (v: BundlePreference) => void }) {
    return (
        <div className="space-y-2">
            <p id="mashup-pref" className="text-sm font-medium">Bundle preference</p>
            <div role="radiogroup" aria-labelledby="mashup-pref" className="grid grid-cols-3 gap-2">
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
                                'flex flex-col items-start gap-0.5 rounded-2xl p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                active ? 'well ring-2 ring-primary/70' : 'neu-raised-sm neu-press',
                            )}
                        >
                            <Icon className={cn('mb-1 h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                            <span className="text-sm font-semibold">{label}</span>
                            <span className="text-[11px] text-muted-foreground">{hint}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/** What the amount is expected to buy, as a data tile and a voice tile. */
export function MashupEstimate({ bundle }: { bundle: MashupBundle }) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                {[
                    { label: 'Data', value: bundle.data, icon: Wifi },
                    { label: 'Voice', value: bundle.voice, icon: Mic2 },
                ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="well flex flex-col items-center rounded-2xl p-3 text-center">
                        <Icon className="mb-1 h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="font-display text-base font-bold">{value}</span>
                    </div>
                ))}
            </div>
            {!bundle.exact && (
                <p className="text-center text-xs text-amber-600 dark:text-amber-500">Below GHS 10 these are estimated ranges. MTN sets the final values.</p>
            )}
        </div>
    )
}
