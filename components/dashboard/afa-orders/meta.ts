import { VALID_REGIONS } from '@/lib/afa-validation'
import type { BadgeProps } from '@/components/ui/badge'

export const REGIONS = VALID_REGIONS

export interface AfaOrder {
    id: string
    full_name: string
    phone: string
    id_number: string
    ghana_card?: string | null
    date_of_birth?: string | null
    location: string
    region: string
    occupation?: string | null
    notes?: string | null
    status: string
    payment_amount?: number | null
    created_at: string
}

export const STATUS: Record<string, { variant: BadgeProps['variant']; label: string; blurb: string }> = {
    pending: { variant: 'pending', label: 'Pending', blurb: 'Received — we have not started on this yet.' },
    processing: { variant: 'processing', label: 'Processing', blurb: "We're working on this registration now." },
    completed: { variant: 'completed', label: 'Done', blurb: 'Registered. This membership does not expire.' },
    cancelled: { variant: 'failed', label: 'Cancelled', blurb: 'This application was cancelled.' },
    refunded: { variant: 'secondary', label: 'Refunded', blurb: 'Refunded to your wallet.' },
}

export const GC_HINT = 'Digits only — we add the GHA- prefix for you'
const GC_PATTERN = /^GHA-\d{9}-\d$/

/** Digits typed in → GHA-XXXXXXXXX-X, built up as the person types. */
export function maskGcInput(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    if (digits.length === 0) return 'GHA-'
    if (digits.length <= 9) return 'GHA-' + digits
    return 'GHA-' + digits.slice(0, 9) + '-' + digits[9]
}

export function validateGhanaCard(value: string): string | null {
    return GC_PATTERN.test(value.trim()) ? null : GC_HINT
}

/** GHA-123456789-0 → GHA-•••••789-0, for the orders list. */
export function maskGhanaCardDisplay(id: string | null | undefined): string {
    if (!id) return '—'
    const m = id.match(/^GHA-(\d{9})-(\d)$/)
    if (!m) return id
    return `GHA-•••••${m[1].slice(-3)}-${m[2]}`
}

export function formatDob(dob: string | null | undefined): string {
    if (!dob) return '—'
    try {
        return new Date(dob).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
        return dob
    }
}

export function ageFrom(dob: string): number {
    const d = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    const m = now.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
    return age
}

/** The latest date of birth that is still 18 years ago — for the date input's `max`. */
export const MIN_DOB_DATE = (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    return d.toISOString().split('T')[0]
})()

export function downloadAfaReceipt(order: AfaOrder) {
    const idNumber = order.id_number ?? order.ghana_card ?? 'N/A'
    const lines = [
        'AFA REGISTRATION RECEIPT',
        '',
        `Order           : ${order.id}`,
        `Submitted       : ${new Date(order.created_at).toLocaleString()}`,
        '',
        `Full name       : ${order.full_name}`,
        `Phone           : ${order.phone}`,
        `Ghana Card      : ${idNumber}`,
        ...(order.date_of_birth ? [`Date of birth   : ${formatDob(order.date_of_birth)}`] : []),
        `Region          : ${order.region}`,
        `Town            : ${order.location}`,
        ...(order.notes ? [`Notes           : ${order.notes}`] : []),
        '',
        `Fee paid        : GHS ${order.payment_amount?.toFixed(2) ?? '—'}`,
        `Status          : ${(order.status || 'pending').toUpperCase()}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `afa-${order.full_name.replace(/\s+/g, '_')}-${order.id.slice(0, 8)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
