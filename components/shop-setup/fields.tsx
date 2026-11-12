'use client'

import { useState } from 'react'
import { Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FOCUS } from '@/components/auth/auth-shell'

const INPUT =
    'h-12 rounded-xl border-0 bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground/70 shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500'

export function Field({
    id, label, optional, hint, error, action, counter, children,
}: {
    id: string
    label: string
    optional?: boolean
    hint?: React.ReactNode
    error?: string
    action?: React.ReactNode
    counter?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
                <Label htmlFor={id} className="text-sm font-semibold text-foreground">
                    {label}
                    {optional && <span className="ml-1.5 text-xs font-medium text-muted-foreground">Optional</span>}
                </Label>
                <div className="flex items-center gap-3">
                    {counter}
                    {action}
                </div>
            </div>
            {children}
            {error
                ? <p id={`${id}-note`} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
                : hint && <div id={`${id}-note`} className="text-xs text-muted-foreground">{hint}</div>}
        </div>
    )
}

export function Well({ invalid, className, children }: { invalid?: boolean; className?: string; children: React.ReactNode }) {
    return <div className={cn('neu-inset rounded-xl', invalid && 'ring-2 ring-red-500', className)}>{children}</div>
}

export function SetupInput({
    id, value, onChange, invalid, className, ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    id: string
    value: string
    onChange: (v: string) => void
    invalid?: boolean
}) {
    return (
        <Well invalid={invalid}>
            <Input
                {...rest}
                id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)}
                aria-invalid={invalid || undefined} aria-describedby={`${id}-note`}
                className={cn(INPUT, className)}
            />
        </Well>
    )
}

export function SetupTextarea({
    id, value, onChange, invalid, ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
    id: string
    value: string
    onChange: (v: string) => void
    invalid?: boolean
}) {
    return (
        <Well invalid={invalid}>
            <Textarea
                {...rest}
                id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)}
                aria-invalid={invalid || undefined} aria-describedby={`${id}-note`}
                className="min-h-[7rem] resize-none rounded-xl border-0 bg-transparent px-4 py-3 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500"
            />
        </Well>
    )
}

export function Counter({ value, max }: { value: number; max: number }) {
    return (
        <span className={cn(
            'text-xs font-medium tabular-nums',
            value >= max ? 'text-red-600 dark:text-red-400' : value > max * 0.85 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
        )}>
            {value}/{max}
        </span>
    )
}

export interface RefineState {
    ideas: string[] | null
    open: boolean
    toggle: () => void
    shuffle: () => void
    close: () => void
}

/** `getIdeas` runs each time the panel opens or is shuffled, so every click can bring fresh options. */
export function useRefine(getIdeas: () => string[]): RefineState {
    const [ideas, setIdeas] = useState<string[] | null>(null)
    return {
        ideas,
        open: ideas !== null,
        toggle: () => setIdeas(prev => (prev === null ? getIdeas() : null)),
        shuffle: () => setIdeas(getIdeas()),
        close: () => setIdeas(null),
    }
}

/** For owners who are stuck: offers ideas instead of a blank box. Pair with <RefinePanel /> under the field. */
export function RefineButton({ refine, label = 'Refine', disabled }: { refine: RefineState; label?: string; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            aria-expanded={refine.open}
            onClick={refine.toggle}
            className={cn('clay-silver inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-black disabled:opacity-50', FOCUS)}
        >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </button>
    )
}

export function RefinePanel({ refine, title, onPick }: { refine: RefineState; title: string; onPick: (idea: string) => void }) {
    if (!refine.ideas) return null
    return (
        <div className="neu-inset space-y-2 rounded-2xl p-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
            <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={refine.shuffle}
                        className={cn('flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground hover:text-foreground', FOCUS)}>
                        <RefreshCw className="h-3 w-3" aria-hidden="true" /> Shuffle
                    </button>
                    <button type="button" onClick={refine.close} aria-label="Close ideas"
                        className={cn('flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', FOCUS)}>
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            {refine.ideas.length === 0 ? (
                <p className="px-1 pb-1 text-xs text-muted-foreground">No ideas this time. Try typing a word you like first.</p>
            ) : (
                <ul className="space-y-2">
                    {refine.ideas.map((idea) => (
                        <li key={idea}>
                            <button
                                type="button"
                                onClick={() => { onPick(idea); refine.close() }}
                                className={cn('neu-raised-sm neu-press w-full rounded-xl px-3.5 py-2.5 text-left text-sm leading-snug text-foreground', FOCUS)}
                            >
                                {idea}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
export function SlugStatus({
    state, message, suggestions, onPick,
}: {
    state: 'idle' | 'checking' | 'ok' | 'bad'
    message?: string
    suggestions?: string[]
    onPick: (slug: string) => void
}) {
    if (state === 'idle') return null
    return (
        <div className="space-y-2" aria-live="polite">
            <p className={cn(
                'flex items-center gap-2 text-xs font-medium',
                state === 'bad' ? 'text-red-600 dark:text-red-400' : state === 'ok' ? 'text-foreground' : 'text-muted-foreground'
            )}>
                {state === 'checking' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking if it is free</>}
                {state === 'ok' && <><span className="clay-gold flex h-4 w-4 items-center justify-center rounded-full"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span> That link is yours to take</>}
                {state === 'bad' && message}
            </p>
            {state === 'bad' && suggestions && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {suggestions.map(s => (
                        <button key={s} type="button" onClick={() => onPick(s)}
                            className={cn('neu-raised-sm neu-press rounded-full px-3 py-1.5 font-mono text-xs text-foreground', FOCUS)}>
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
