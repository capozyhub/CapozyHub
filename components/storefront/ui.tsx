import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Inset text field shared by every storefront form. */
export const FIELD =
    'neu-inset h-[3.25rem] w-full rounded-full border-0 bg-transparent px-5 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500'

export const FOCUS =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

/** Heading block that opens each service panel. */
export function ServiceHeading({ icon: Icon, title, blurb }: { icon: LucideIcon; title: string; blurb: string }) {
    return (
        <div className="mb-6 flex items-start gap-4">
            <span className="clay-gold flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
                <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
            </div>
        </div>
    )
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
    return (
        <label htmlFor={htmlFor} className="mb-2 block px-1 text-sm font-semibold text-foreground">
            {children} {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
        </label>
    )
}

/** Round selectable pill: raised when idle, pressed-in with an outline when chosen. */
export function Pill({ on, className, ...props }: { on: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            aria-pressed={on}
            {...props}
            className={cn(
                'flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-foreground transition-shadow disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none',
                FOCUS,
                on ? 'neu-inset ring-2 ring-[var(--shop-accent,#F6C30F)]' : 'neu-raised-sm neu-press',
                className
            )}
        />
    )
}

export const PrimaryButton = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        {...props}
        className={cn('clay-gold flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-base font-semibold disabled:opacity-50', FOCUS, className)}
    />
)

/** Black plate that totals up an order, echoing the stage behind the sheet. */
export function TotalPlate({ rows, totalLabel, total }: { rows: { label: string; value: string; strong?: boolean }[]; totalLabel: string; total: string }) {
    return (
        <div className="rounded-3xl bg-black p-5 text-white">
            <dl className="space-y-2.5 text-sm">
                {rows.map(r => (
                    <div key={r.label} className="flex items-baseline justify-between gap-4">
                        <dt className="text-silver-200">{r.label}</dt>
                        <dd className={cn('tabular-nums', r.strong ? 'font-semibold text-white' : 'text-silver-200')}>{r.value}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/15 pt-4">
                <span className="text-sm font-semibold">{totalLabel}</span>
                <span className="font-display text-3xl font-bold tabular-nums text-brand-400">{total}</span>
            </div>
        </div>
    )
}

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
    return (
        <div role={tone === 'warn' ? 'alert' : undefined} className={cn('neu-inset rounded-2xl px-4 py-3 text-sm leading-relaxed', tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
            {children}
        </div>
    )
}
