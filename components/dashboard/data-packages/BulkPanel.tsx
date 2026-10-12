'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Eye, FileSpreadsheet, FileText, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { cn, formatCurrency, generateReferenceCode } from '@/lib/utils'
import { detectNetwork, validateGhanaianPhone } from '@/lib/phone-validation'
import type { Bundle } from './types'
import { carrierFamily } from './network-meta'
import { errorMessage, isPriceChanged, readJson } from './api'
import {
    findDuplicates,
    parseBulkRows,
    parseBulkText,
    type ParsedLine,
    type ParseOutcome,
    type SkippedLine,
} from '@/lib/data-orders/bulk-parse'

interface ValidationResult extends ParsedLine {
    packagePrice: number
    isValid: boolean
    errorMessage?: string
    packageId?: string
    /** Line number of the first identical phone + volume above this one. */
    duplicateOf?: number
}

interface BulkSuccess {
    ordersPlaced: number
    totalCost: number
    newBalance: number
    orders: { phoneNumber: string; volume: number; packagePrice: number }[]
}

interface BulkPanelProps {
    packages: Bundle[]
    network: string
    getPrice: (pkg: Bundle) => number
    balance: number
    onPlaced: (newBalance: number | null) => void
    /** The server says a price has moved: reload the list so the next preview uses it. */
    onPriceChanged: () => void
}

const MAX_ROWS = 500
// 500 rows of "phone, volume" is a few KB. Anything near this is not a bulk sheet, and the
// whole file is read into memory before a single row can be counted.
const MAX_FILE_BYTES = 1024 * 1024

async function parseSheet(file: File): Promise<ParseOutcome> {
    if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large. Bulk files are a few KB: use up to 500 rows.')
    const workbook = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        // Stop reading after the row limit (plus header and spare rows) so a huge sheet cannot
        // freeze the tab. More rows than that still trips the 500-order limit below.
        sheetRows: MAX_ROWS + 25,
    })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) throw new Error('That file has no sheets')
    return parseBulkRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][])
}

/** Buy many bundles at once from pasted lines or a spreadsheet. Prices are always set by the server. */
export function BulkPanel({ packages, network, getPrice, balance, onPlaced, onPriceChanged }: BulkPanelProps) {
    const router = useRouter()
    const [inputType, setInputType] = useState<'text' | 'excel'>('text')
    const [text, setText] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [results, setResults] = useState<ValidationResult[]>([])
    // Lines the parser could not read at all. They are listed, never dropped quietly.
    const [skipped, setSkipped] = useState<SkippedLine[]>([])
    const [validating, setValidating] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [previewDone, setPreviewDone] = useState(false)
    // Idempotency key for the batch: made when the preview succeeds and reused on retries,
    // so a double click can never place (and charge for) the same batch twice.
    const [batchRef, setBatchRef] = useState('')
    const [success, setSuccess] = useState<BulkSuccess | null>(null)

    const valid = useMemo(() => results.filter(r => r.isValid), [results])
    const invalidCount = results.filter(r => !r.isValid).length
    const duplicateCount = valid.filter(r => r.duplicateOf !== undefined).length
    const total = useMemo(() => valid.reduce((s, r) => s + r.packagePrice, 0), [valid])

    const reset = () => { setResults([]); setSkipped([]); setPreviewDone(false) }

    const validate = (lines: ParsedLine[]): ValidationResult[] => {
        const duplicates = findDuplicates(lines)
        return lines.map(line => {
            const phone = validateGhanaianPhone(line.phoneNumber)
            if (!phone.isValid) return { ...line, packagePrice: 0, isValid: false, errorMessage: 'Invalid phone' }

            const detected = detectNetwork(line.phoneNumber)
            if (network !== 'AT-BigTime' && detected !== carrierFamily(network)) {
                return { ...line, packagePrice: 0, isValid: false, errorMessage: `Wrong network (${detected})` }
            }
            const pkg = packages.find(p => {
                if (p.network !== network || p.category === 'mtn_mashup') return false
                const size = p.size.toLowerCase()
                if (size.includes('gb')) return parseFloat(size.replace('gb', '').trim()) === line.volume
                if (size.includes('mb')) return parseFloat(size.replace('mb', '').trim()) / 1000 === line.volume
                return false
            })
            if (!pkg) return { ...line, packagePrice: 0, isValid: false, errorMessage: `No ${line.volume}GB package` }
            return { ...line, packagePrice: getPrice(pkg), packageId: pkg.id, isValid: true, duplicateOf: duplicates.get(line.lineNumber) }
        })
    }

    const preview = async () => {
        setValidating(true)
        try {
            let parsed: ParseOutcome
            if (inputType === 'text') {
                if (!text.trim()) { toast.error('Enter phone numbers first'); return }
                parsed = parseBulkText(text)
            } else {
                if (!file) { toast.error('Select a file first'); return }
                parsed = await parseSheet(file)
            }
            const { lines } = parsed
            setSkipped(parsed.skipped)
            if (lines.length + parsed.skipped.length > MAX_ROWS) { toast.error(`Up to ${MAX_ROWS} rows at a time`); setSkipped([]); return }

            const checked = validate(lines)
            setResults(checked)

            const ok = checked.filter(r => r.isValid)
            const cost = ok.reduce((s, r) => s + r.packagePrice, 0)
            const bad = checked.filter(r => !r.isValid).length
            if (parsed.skipped.length > 0) {
                toast.error(`${parsed.skipped.length} ${parsed.skipped.length === 1 ? 'line' : 'lines'} could not be read and will NOT be ordered. See the list below.`)
            }
            if (bad > 0) toast.error(`${bad} invalid ${bad === 1 ? 'entry' : 'entries'}: check the network or phone numbers`)
            if (ok.length === 0) { toast.error('No valid orders found'); return }
            if (balance < cost) { toast.error(`Insufficient balance: need ${formatCurrency(cost)}, have ${formatCurrency(balance)}`); return }

            const dupes = ok.filter(r => r.duplicateOf !== undefined).length
            if (dupes > 0) toast.error(`${dupes} repeated ${dupes === 1 ? 'line' : 'lines'} (same number and bundle). Remove them if that was a mistake.`)
            toast.success(`${ok.length} orders, ${formatCurrency(cost)} total. Balance after: ${formatCurrency(balance - cost)}`)
            setBatchRef(generateReferenceCode())
            setPreviewDone(true)
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : 'Could not read that data')
        } finally {
            setValidating(false)
        }
    }

    const submit = async () => {
        if (!previewDone || valid.length === 0) return
        if (balance < total) { toast.error('Insufficient balance'); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/orders/bulk-purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchReference: batchRef,
                    expectedTotal: Math.round(total * 100) / 100,
                    orders: valid.map(o => ({ packageId: o.packageId, phoneNumber: validateGhanaianPhone(o.phoneNumber).normalizedNumber })),
                }),
            })
            const data = await readJson(res)
            if (isPriceChanged(res, data)) {
                // Nothing was charged. Prices are reloaded and the batch must be previewed again.
                onPriceChanged()
                setPreviewDone(false)
            }
            if (!res.ok) throw new Error(errorMessage(res, data, 'Bulk order failed'))
            if (data.isDuplicate) {
                toast.success('That batch was already placed')
                setText(''); setFile(null); reset(); setBatchRef('')
                onPlaced(null)
                return
            }

            setSuccess({
                ordersPlaced: data.ordersPlaced,
                totalCost: data.totalCost,
                newBalance: data.newBalance,
                orders: valid.map(o => ({ phoneNumber: o.phoneNumber, volume: o.volume, packagePrice: o.packagePrice })),
            })
            setText(''); setFile(null); reset(); setBatchRef('')
            onPlaced(typeof data.newBalance === 'number' ? data.newBalance : null)
        } catch (e: any) {
            toast.error(e.message || 'Error submitting bulk orders')
        } finally {
            setSubmitting(false)
        }
    }

    const downloadTemplate = () => {
        const sheet = XLSX.utils.aoa_to_sheet([['Phone', 'Volume (GB)'], ['0241234567', 5], ['0551234567', 10]])
        const book = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(book, sheet, 'Template')
        XLSX.writeFile(book, 'bulk-order-template.xlsx')
    }

    return (
        <div className="space-y-4">
            <div className="surface overflow-hidden rounded-3xl">
                <div role="tablist" className="well m-3 flex gap-1 rounded-2xl p-1">
                    {([['text', 'Paste text', FileText], ['excel', 'Excel or CSV', FileSpreadsheet]] as const).map(([key, label, Icon]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={inputType === key}
                            onClick={() => { setInputType(key); reset() }}
                            className={cn(
                                'flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                inputType === key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Icon className="h-4 w-4" /> {label}
                        </button>
                    ))}
                </div>

                <div className="space-y-3 px-4 pb-4">
                    {inputType === 'text' ? (
                        <>
                            <p className="text-xs text-muted-foreground">
                                One per line, up to {MAX_ROWS}. For example <code className="font-mono font-bold text-foreground">0241234567 5</code> is 5GB to that number.
                            </p>
                            <textarea
                                aria-label="Phone numbers and volumes"
                                className="well min-h-[160px] w-full resize-none rounded-2xl px-4 py-3 font-mono text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                placeholder={'0241234567  5\n0541234567  10\n0207654321  1'}
                                value={text}
                                onChange={e => { setText(e.target.value); setPreviewDone(false) }}
                            />
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">Two columns: Phone and Volume (GB).</p>
                                <button type="button" onClick={downloadTemplate} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-500">
                                    <Download className="h-3.5 w-3.5" /> Template
                                </button>
                            </div>
                            <label className="well flex cursor-pointer flex-col items-center gap-3 rounded-2xl p-8 text-center transition-colors hover:brightness-95">
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="sr-only"
                                    onChange={e => {
                                        const f = e.target.files?.[0]
                                        if (f) { setFile(f); reset() }
                                    }}
                                />
                                <span className="neu-raised-sm flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><Upload className="h-5 w-5" /></span>
                                <span className="text-sm font-semibold">{file ? file.name : 'Choose a file'}</span>
                                <span className="text-xs text-muted-foreground">.xlsx, .xls or .csv</span>
                            </label>
                        </>
                    )}
                </div>
            </div>

            {skipped.length > 0 && (
                <div role="alert" className="surface overflow-hidden rounded-3xl border border-amber-500/40">
                    <div className="flex items-start gap-2.5 px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">{skipped.length} {skipped.length === 1 ? 'line' : 'lines'} could not be read and will not be ordered</p>
                            <p className="text-xs text-muted-foreground">Fix them and preview again, or leave them out on purpose.</p>
                        </div>
                    </div>
                    <ul className="max-h-40 divide-y divide-border/50 overflow-y-auto border-t border-border/60">
                        {skipped.map(s => (
                            <li key={s.lineNumber} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                                <span className="min-w-0 truncate font-mono">Line {s.lineNumber}: {s.text}</span>
                                <span className="flex-shrink-0 text-amber-600 dark:text-amber-400">{s.reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {results.length > 0 && (
                <div className="surface overflow-hidden rounded-3xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                        <p className="text-sm font-semibold">
                            <span className="text-emerald-600 dark:text-emerald-400">{valid.length} valid</span>
                            {invalidCount > 0 && <span className="text-muted-foreground"> · <span className="text-red-500">{invalidCount} invalid</span></span>}
                            {duplicateCount > 0 && <span className="text-muted-foreground"> · <span className="text-amber-600 dark:text-amber-400">{duplicateCount} repeated</span></span>}
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                            {invalidCount > 0 && (
                                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setResults(prev => prev.filter(r => r.isValid)); setPreviewDone(false) }}>
                                    Clear invalid
                                </button>
                            )}
                            <button type="button" className="text-red-500 hover:text-red-600" onClick={() => { setText(''); setFile(null); reset() }}>
                                Clear all
                            </button>
                        </div>
                    </div>
                    <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto">
                        {results.map((r, i) => (
                            <li key={`${r.lineNumber}-${i}`} className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-foreground/[0.03]">
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', !r.isValid ? 'bg-red-500' : 'bg-emerald-500')} />
                                    <span className="truncate text-sm font-medium">{r.phoneNumber}</span>
                                </span>
                                <span className="flex flex-shrink-0 items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">{r.volume}GB</span>
                                    {r.duplicateOf !== undefined && <span className="text-amber-600 dark:text-amber-400">Same as line {r.duplicateOf}</span>}
                                    {!r.isValid ? <span className="text-red-500">{r.errorMessage}</span>
                                        : <span className="font-semibold">{formatCurrency(r.packagePrice)}</span>}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${r.phoneNumber}`}
                                        onClick={() => { setResults(prev => prev.filter((_, idx) => idx !== i)); setPreviewDone(false) }}
                                        className="rounded-md p-1 opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="surface flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{valid.length}</span> valid {valid.length === 1 ? 'row' : 'rows'}
                    {valid.length > 0 && <> · <span className="font-semibold text-foreground">{formatCurrency(total)}</span></>}
                    {' · '}Wallet {formatCurrency(balance)}
                </p>
                <Button variant="outline" size="sm" onClick={preview} disabled={validating || (inputType === 'text' ? !text.trim() : !file)} className="gap-1.5">
                    {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Preview price
                </Button>
                {valid.length > 0 && balance < total ? (
                    <Button asChild size="sm"><Link href="/dashboard/wallet">Top up</Link></Button>
                ) : (
                    <Button size="sm" onClick={submit} disabled={!previewDone || valid.length === 0 || submitting} className="gap-1.5">
                        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Place order
                    </Button>
                )}
            </div>

            <Dialog open={!!success} onOpenChange={() => setSuccess(null)}>
                <DialogContent aria-describedby={undefined} className="max-w-md rounded-3xl">
                    {success && (
                        <div className="space-y-5">
                            <div className="flex flex-col items-center gap-2 pt-2 text-center">
                                <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"><CheckCircle2 className="h-8 w-8" /></span>
                                <DialogTitle className="font-display text-xl font-semibold">{success.ordersPlaced} {success.ordersPlaced === 1 ? 'order' : 'orders'} placed</DialogTitle>
                                <p className="text-sm text-muted-foreground">Your bundles are on their way.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="well rounded-2xl p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="font-display text-lg font-bold">{formatCurrency(success.totalCost)}</p></div>
                                <div className="well rounded-2xl p-3 text-center"><p className="text-xs text-muted-foreground">Wallet now</p><p className="font-display text-lg font-bold">{formatCurrency(success.newBalance)}</p></div>
                            </div>
                            {success.orders.length > 0 && (
                                <ul className="max-h-[30vh] divide-y divide-border/50 overflow-y-auto rounded-2xl border border-border/60">
                                    {success.orders.map((o, i) => (
                                        <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{o.phoneNumber}</span>
                                            <span className="text-muted-foreground">{o.volume}GB · <span className="font-semibold text-foreground">{formatCurrency(o.packagePrice)}</span></span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setSuccess(null)}>Done</Button>
                                <Button className="flex-1 gap-2" onClick={() => { setSuccess(null); router.push('/dashboard/my-orders') }}>
                                    <ExternalLink className="h-4 w-4" /> View orders
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
