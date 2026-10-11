'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { VALID_REGIONS } from '@/lib/afa-validation'

interface AfaRegistrationFormProps {
    shopSlug: string
    /** Selling price + Paystack fee, for display only. Server recomputes authoritatively. */
    displayPrice?: number | null
    /**
     * The KYC form's only job is to collect + locally validate the applicant's details,
     * then hand them to the parent, which opens ServiceChargeSheet for payment (native
     * MoMo charge via /api/shop/afa/charge — no redirect, no KYC in Paystack metadata).
     */
    onSubmitDetails: (formData: Record<string, any>, guestEmail: string) => void
}

const GC_PATTERN = /^GHA-\d{9}-\d$/

/** Digits typed in → GHA-XXXXXXXXX-X, built up as the person types. */
function maskGc(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 9) return 'GHA-' + digits
    return 'GHA-' + digits.slice(0, 9) + '-' + digits[9]
}

export default function AfaRegistrationForm({ shopSlug: _shopSlug, displayPrice, onSubmitDetails }: AfaRegistrationFormProps) {
    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [idNumber, setIdNumber] = useState('')
    const [region, setRegion] = useState('')
    const [location, setLocation] = useState('')
    const [occupation, setOccupation] = useState('')
    const [dob, setDob] = useState('')
    const [email, setEmail] = useState('')

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const cleanPhone = phone.replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) {
            toast.error('Enter a valid phone number (0XXXXXXXXX)')
            return
        }
        if (!GC_PATTERN.test(idNumber.trim())) {
            toast.error('Check the Ghana Card number', { description: 'Format: GHA-XXXXXXXXX-X' })
            return
        }
        if (!fullName.trim() || !region || !location.trim() || !occupation.trim() || !dob) {
            toast.error('Fill in every field above')
            return
        }
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            toast.error('Enter a valid email or leave it blank')
            return
        }
        onSubmitDetails({
            full_name: fullName,
            phone: cleanPhone,
            id_type: 'Ghana Card',
            id_number: idNumber.trim(),
            region,
            location,
            occupation,
            date_of_birth: dob,
        }, email.trim())
    }

    const field = 'w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500'
    const labelCls = 'mb-1 block text-xs font-semibold text-muted-foreground'

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card/60 p-3.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                    We only use these details to register this number — they go straight to the AFA system, not anywhere else.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className={labelCls}>Full name</label>
                    <input required value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100}
                        placeholder="As on the Ghana Card" className={field} />
                </div>
                <div>
                    <label className={labelCls}>Phone to register</label>
                    <input required value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel"
                        placeholder="0XXXXXXXXX" className={field} />
                </div>
            </div>

            <div>
                <label className={labelCls}>Ghana Card number</label>
                <input required value={idNumber} onChange={e => setIdNumber(maskGc(e.target.value))}
                    placeholder="GHA-XXXXXXXXX-X" className={cn(field, 'font-mono')} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className={labelCls}>Region</label>
                    <select required value={region} onChange={e => setRegion(e.target.value)} className={field}>
                        <option value="">Select region</option>
                        {VALID_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Town / area</label>
                    <input required value={location} onChange={e => setLocation(e.target.value)} maxLength={100}
                        placeholder="e.g. Kumasi" className={field} />
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className={labelCls}>Occupation</label>
                    <input required value={occupation} onChange={e => setOccupation(e.target.value)} maxLength={100}
                        placeholder="e.g. Trader" className={field} />
                </div>
                <div>
                    <label className={labelCls}>Date of birth (18+)</label>
                    <input required type="date" value={dob} onChange={e => setDob(e.target.value)} className={field} />
                </div>
            </div>

            <div>
                <label className={labelCls}>Email <span className="font-normal">(optional — for your receipt)</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
                    placeholder="you@example.com" className={field} />
            </div>

            <button type="submit"
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white transition-all">
                Continue to payment{displayPrice ? ` — GHS ${displayPrice.toFixed(2)}` : ''}
            </button>
        </form>
    )
}
