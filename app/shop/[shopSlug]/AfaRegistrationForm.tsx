'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { VALID_REGIONS } from '@/lib/afa-validation'
import { FIELD, PrimaryButton } from '@/components/storefront/ui'

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

    const field = FIELD
    const labelCls = 'mb-2 block px-1 text-sm font-semibold text-foreground'

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="neu-inset flex items-start gap-3 rounded-2xl px-4 py-3.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                    These details are used only to register this number. They go straight to the AFA system and nowhere else.
                </p>
            </div>

            <div>
                <label htmlFor="afa-name" className={labelCls}>Full name</label>
                <input id="afa-name" required value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100}
                    placeholder="Exactly as on your Ghana Card" className={field} />
            </div>

            <div>
                <label htmlFor="afa-phone" className={labelCls}>Number to register</label>
                <input id="afa-phone" required value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel"
                    placeholder="024 123 4567" className={field} />
            </div>

            <div>
                <label htmlFor="afa-gc" className={labelCls}>Ghana Card number</label>
                <input id="afa-gc" required value={idNumber} onChange={e => setIdNumber(maskGc(e.target.value))}
                    placeholder="GHA-000000000-0" className={cn(field, 'font-mono')} />
            </div>

            <div>
                <label htmlFor="afa-region" className={labelCls}>Region</label>
                <select id="afa-region" required value={region} onChange={e => setRegion(e.target.value)} className={cn(field, 'appearance-none')}>
                    <option value="">Pick your region</option>
                    {VALID_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            <div>
                <label htmlFor="afa-town" className={labelCls}>Town or area</label>
                <input id="afa-town" required value={location} onChange={e => setLocation(e.target.value)} maxLength={100}
                    placeholder="e.g. Kumasi" className={field} />
            </div>

            <div>
                <label htmlFor="afa-job" className={labelCls}>What do you do?</label>
                <input id="afa-job" required value={occupation} onChange={e => setOccupation(e.target.value)} maxLength={100}
                    placeholder="e.g. Trader" className={field} />
            </div>

            <div>
                <label htmlFor="afa-dob" className={labelCls}>Date of birth <span className="font-normal text-muted-foreground">(you must be 18 or older)</span></label>
                <input id="afa-dob" required type="date" value={dob} onChange={e => setDob(e.target.value)} className={field} />
            </div>

            <div>
                <label htmlFor="afa-email" className={labelCls}>Email <span className="font-normal text-muted-foreground">(receipt, optional)</span></label>
                <input id="afa-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
                    placeholder="you@example.com" className={field} />
            </div>

            <PrimaryButton type="submit">
                Continue to payment{displayPrice ? ` · GHS ${displayPrice.toFixed(2)}` : ''}
            </PrimaryButton>
        </form>
    )
}