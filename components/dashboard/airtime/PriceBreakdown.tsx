import { formatCurrency } from '@/lib/utils'
import type { AirtimeQuote } from '@/lib/airtime-pricing'
import type { PurchaseMode } from './meta'

interface PriceBreakdownProps {
    quote: AirtimeQuote
    typed: number
    mode: PurchaseMode
    /** True when the fee is added on top, so the beneficiary gets exactly what was typed. */
    feeOnTop: boolean
}

/** What the beneficiary gets, the fee, and what leaves the wallet. */
export function PriceBreakdown({ quote, typed, mode, feeOnTop }: PriceBreakdownProps) {
    const rows: [string, string][] = [
        ['You enter', formatCurrency(typed)],
        [`Service fee (${quote.feeRate}%)`, `${feeOnTop ? '+' : '−'} ${formatCurrency(quote.feeAmount)}`],
    ]
    if (mode === 'airtime') rows.push(['Beneficiary receives', formatCurrency(quote.airtimeAmount)])

    return (
        <dl className="well space-y-2 rounded-2xl p-4 text-sm" aria-label="Price breakdown">
            {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
            ))}
            {!feeOnTop && mode === 'airtime' && (
                <p className="text-xs text-amber-600 dark:text-amber-500">The fee comes out of your amount. Switch on &ldquo;Add the fee on top&rdquo; if they should get all of it.</p>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                <dt className="font-medium">You pay</dt>
                <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(quote.totalPaid)}</dd>
            </div>
        </dl>
    )
}
