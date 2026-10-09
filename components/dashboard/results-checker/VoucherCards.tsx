'use client'

import { useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from '@/lib/toast'
import type { Voucher } from './meta'

async function copy(text: string, done: string) {
    try {
        await navigator.clipboard.writeText(text)
        toast.success(done)
    } catch {
        toast.error('Could not copy')
    }
}

function Field({ label, value, hidden, onToggle }: { label: string; value: string; hidden?: boolean; onToggle?: () => void }) {
    const [copied, setCopied] = useState(false)
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="truncate font-mono text-sm font-semibold tracking-wider">{hidden ? '•••• •••• ••••' : value}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
                {onToggle && (
                    <button type="button" onClick={onToggle} aria-label={hidden ? `Show ${label}` : `Hide ${label}`} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                )}
                <button
                    type="button"
                    aria-label={`Copy ${label}`}
                    onClick={async () => { await copy(value, `${label} copied`); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
            </div>
        </div>
    )
}

/** The PIN and serial of each voucher. PINs start hidden so a screenshot of the list does not leak them. */
export function VoucherCards({ vouchers, startRevealed = false }: { vouchers: Voucher[]; startRevealed?: boolean }) {
    const [revealed, setRevealed] = useState<Set<number>>(() => new Set(startRevealed ? vouchers.map((_, i) => i) : []))
    const toggle = (i: number) => setRevealed(prev => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i); else next.add(i)
        return next
    })

    return (
        <ul className="grid gap-3 sm:grid-cols-2">
            {vouchers.map((v, i) => (
                <li key={`${v.serial_number}-${i}`} className="well space-y-3 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Voucher {i + 1}</span>
                        <button
                            type="button"
                            onClick={() => copy(`Serial: ${v.serial_number}\nPIN: ${v.pin}`, 'Voucher copied')}
                            className="flex items-center gap-1 rounded-md text-xs font-semibold text-foreground/80 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <Copy className="h-3 w-3" /> Copy both
                        </button>
                    </div>
                    <Field label="Serial" value={v.serial_number} />
                    <Field label="PIN" value={v.pin} hidden={!revealed.has(i)} onToggle={() => toggle(i)} />
                </li>
            ))}
        </ul>
    )
}