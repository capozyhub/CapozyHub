'use client'

import { useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from '@/lib/toast'
import { examLabel, type Voucher } from './meta'

async function copy(text: string, done: string) {
    try {
        await navigator.clipboard.writeText(text)
        toast.success(done)
    } catch {
        toast.error('Could not copy')
    }
}

function CopyIcon({ text, label }: { text: string; label: string }) {
    const [done, setDone] = useState(false)
    return (
        <button
            type="button"
            aria-label={`Copy ${label}`}
            onClick={async () => { await copy(text, `${label} copied`); setDone(true); setTimeout(() => setDone(false), 1500) }}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            {done ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
    )
}

/**
 * Each voucher as a ticket: the exam on the stub, serial and PIN on the body, split by a dashed
 * tear line. PINs start hidden in lists so a screenshot of the page does not leak them.
 */
export function VoucherCards({ vouchers, typeName, startRevealed = false }: { vouchers: Voucher[]; typeName: string; startRevealed?: boolean }) {
    const [revealed, setRevealed] = useState<Set<number>>(() => new Set(startRevealed ? vouchers.map((_, i) => i) : []))
    const toggle = (i: number) => setRevealed(prev => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i); else next.add(i)
        return next
    })

    return (
        <ul className="grid gap-3 sm:grid-cols-2">
            {vouchers.map((v, i) => {
                const shown = revealed.has(i)
                return (
                    <li key={`${v.serial_number}-${i}`} className="surface overflow-hidden rounded-2xl">
                        <div className="flex items-center justify-between bg-foreground/[0.04] px-4 py-2">
                            <span className="font-display text-sm font-bold tracking-tight">{examLabel(typeName)}</span>
                            <span className="text-xs text-muted-foreground">#{i + 1}</span>
                        </div>
                        <div className="space-y-3 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-muted-foreground">Serial number</p>
                                    <p className="truncate font-mono text-base font-semibold tracking-wide">{v.serial_number}</p>
                                </div>
                                <CopyIcon text={v.serial_number} label="Serial" />
                            </div>
                            <div className="border-t border-dashed border-border" />
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-muted-foreground">PIN</p>
                                    <p className="truncate font-mono text-base font-semibold tracking-wide">{shown ? v.pin : '• • • • • • • • • •'}</p>
                                </div>
                                <div className="flex flex-shrink-0">
                                    <button type="button" onClick={() => toggle(i)} aria-label={shown ? 'Hide PIN' : 'Show PIN'} className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                    <CopyIcon text={v.pin} label="PIN" />
                                </div>
                            </div>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}