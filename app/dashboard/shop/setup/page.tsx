'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BRAND } from '@/lib/brand'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Upload, Loader2, ExternalLink, ArrowLeft, Trash2, CheckCircle2, AlertTriangle,
    Copy, Check, Save, Store,
} from 'lucide-react'
import { cn, normalizeWhatsAppNumber } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { SenderIdExplainer } from '@/components/sms/sender-id-explainer'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { ClayButton, Notice } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { resolveAccent } from '@/components/storefront/accent'
import {
    Field, SetupInput, SetupTextarea, Counter, RefineButton, RefinePanel, SlugStatus, Well, useRefine,
} from '@/components/shop-setup/fields'
import { StorefrontPreview } from '@/components/shop-setup/storefront-preview'
import {
    SHOP_NAME_MAX, SHOP_SLUG_MAX, SHOP_DESC_MAX,
    cleanText, finalizeSlug, sanitizeSlugInput, slugFromName, suggestDescriptions, suggestShopNames,
    validateShopDescription, validateShopName, validateShopSlug,
} from '@/lib/shop-profile-rules'

// ─── Brand colour presets ─────────────────────────────────────────────────────
const BRAND_PRESETS = [
    { name: 'Gold', color: '#F6C30F', accent: '#F6A900' },
    { name: 'Green', color: '#25D366', accent: '#1ebc57' },
    { name: 'Red', color: '#E60000', accent: '#cc0000' },
    { name: 'Ocean', color: '#2563eb', accent: '#1e40af' },
    { name: 'Purple', color: '#7c3aed', accent: '#5b21b6' },
    { name: 'Orange', color: '#ea580c', accent: '#c2410c' },
    { name: 'Rose', color: '#e11d48', accent: '#be123c' },
    { name: 'Teal', color: '#0d9488', accent: '#0f766e' },
    { name: 'Slate', color: '#475569', accent: '#334155' },
    { name: 'Amber', color: '#d97706', accent: '#b45309' },
]

const PHONE_RE = /^(0|\+233)[2-9][0-9]{8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const cleanPhone = (v: string) => v.replace(/[\s-]/g, '')

function detectPlatform(url: string): string | null {
    if (!url) return null
    try {
        const hostname = new URL(url).hostname.toLowerCase()
        if (hostname.includes('whatsapp.com')) return 'WhatsApp'
        if (hostname.includes('t.me') || hostname.includes('telegram')) return 'Telegram'
        if (hostname.includes('facebook.com') || hostname.includes('fb.com')) return 'Facebook'
        if (hostname.includes('youtube.com')) return 'YouTube'
        if (hostname.includes('tiktok.com')) return 'TikTok'
        if (hostname.includes('instagram.com')) return 'Instagram'
        return 'Link'
    } catch { return null }
}

function communityLinkError(link: string): string | null {
    const v = link.trim()
    if (!v) return null
    if (!v.startsWith('https://')) return 'Start the link with https://'
    if (v.length > 500) return 'That link is too long'
    try { new URL(v) } catch { return 'That does not look like a valid link' }
    return null
}

interface ShopForm {
    shop_name: string
    shop_slug: string
    description: string
    owner_phone: string
    owner_email: string
    whatsapp_number: string
    community_link: string
    brand_color: string
    brand_accent: string
}

const STEPS = [
    { key: 'details', label: 'Details', heading: 'Name your shop', lead: 'A name people remember and a link they can share. You can polish the wording later.' },
    { key: 'contact', label: 'Contact', heading: 'How customers reach you', lead: 'Shown on your storefront so buyers can ask questions before they pay.' },
    { key: 'community', label: 'Community', heading: 'Bring your people along', lead: 'Point customers to the group where you post offers and updates.' },
    { key: 'branding', label: 'Branding', heading: 'Make it look like yours', lead: 'A logo and one colour. The Capozy look does the rest.' },
    { key: 'sms', label: 'SMS', heading: 'Keep customers in the loop', lead: 'Text buyers when their order goes through. Optional, any time.' },
] as const

const SETUP_PROGRESS_LS_KEY = 'shop-setup-progress'

type SlugState = { state: 'idle' | 'checking' | 'ok' | 'bad'; message?: string; suggestions?: string[] }

export default function ShopSetupPage() {
    const { dbUser } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const pendingNavRef = useRef<string | null>(null)
    const slugCheckSeqRef = useRef(0)
    const slugTouchedRef = useRef(false)

    const [existingShopId, setExistingShopId] = useState<string | null>(null)
    const [savedIsActive, setSavedIsActive] = useState(false)
    const [slugLocked, setSlugLocked] = useState(false)
    const [saved, setSaved] = useState({ name: '', slug: '', description: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [slug, setSlug] = useState<SlugState>({ state: 'idle' })
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [showUnsavedModal, setShowUnsavedModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [activeStep, setActiveStep] = useState(0)
    const [completedSteps, setCompletedSteps] = useState<string[]>([])
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [createSuccessOpen, setCreateSuccessOpen] = useState(false)
    const [successLinkCopied, setSuccessLinkCopied] = useState(false)
    const [smsStatus, setSmsStatus] = useState<{ enabled: boolean; activationFee: number; activated: boolean; mainBalance: number; profitBalance: number } | null>(null)
    const [smsLoading, setSmsLoading] = useState(false)
    const [smsPaySource, setSmsPaySource] = useState<'wallet' | 'profit'>('wallet')
    // The paid SMS activation needs a synchronous lock: button state only updates after a
    // re-render, so two quick taps could otherwise both send a request.
    const smsActivatingRef = useRef(false)

    const [form, setForm] = useState<ShopForm>({
        shop_name: '',
        shop_slug: '',
        description: '',
        owner_phone: '',
        owner_email: '',
        whatsapp_number: '',
        community_link: '',
        brand_color: '#F6C30F',
        brand_accent: '#F6A900',
    })

    const updateForm = useCallback((updates: Partial<ShopForm>) => {
        setForm(prev => ({ ...prev, ...updates }))
        setHasUnsavedChanges(true)
    }, [])

    const firstName = ((dbUser as any)?.first_name as string | undefined) || ''
    const nameRefine = useRefine(() => suggestShopNames(form.shop_name.trim() || firstName))
    const descRefine = useRefine(() => suggestDescriptions(form.shop_name, form.description))

    useEffect(() => {
        if (dbUser) fetchExistingShop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser])

    // The SMS endpoint 404s until the shop exists, so only ask once it does.
    useEffect(() => {
        if (STEPS[activeStep]?.key !== 'sms' || !existingShopId) return
        fetch('/api/shop/sms/status').then(r => r.json()).then(res => {
            if (res.success) setSmsStatus(res.data)
        }).catch(() => { /* the step shows its loading state; nothing else to do */ })
    }, [activeStep, existingShopId])

    const fetchExistingShop = async () => {
        const { data } = await ((supabase as any)
            .from('shop_profiles')
            .select('*')
            .eq('owner_id', dbUser!.id)
            .maybeSingle())

        if (data) {
            setExistingShopId(data.id)
            setLogoUrl(data.logo_url)
            setLogoPreview(data.logo_url)
            setSavedIsActive(!!data.is_active)
            setSlugLocked(!!data.is_active || data.pricing_status === 'approved')
            slugTouchedRef.current = true
            setSaved({ name: data.shop_name || '', slug: data.shop_slug || '', description: data.description || '' })
            setForm({
                shop_name: data.shop_name || '',
                shop_slug: data.shop_slug || '',
                description: data.description || '',
                owner_phone: data.owner_phone || '',
                owner_email: data.owner_email || '',
                whatsapp_number: normalizeWhatsAppNumber(data.whatsapp_number || ''),
                community_link: data.community_link || '',
                brand_color: data.brand_color || '#F6C30F',
                brand_accent: data.brand_accent || '#F6A900',
            })
        }

        // Resume where they left off: the database first (works across devices), then this browser.
        try {
            const dbProgress = data?.setup_progress
            const lsRaw = typeof window !== 'undefined' ? localStorage.getItem(SETUP_PROGRESS_LS_KEY) : null
            const lsProgress = lsRaw ? JSON.parse(lsRaw) : null
            const progress = dbProgress && typeof dbProgress.step === 'number' ? dbProgress : lsProgress
            if (progress && typeof progress.step === 'number') {
                setActiveStep(Math.min(Math.max(progress.step, 0), STEPS.length - 1))
                if (Array.isArray(progress.completed)) setCompletedSteps(progress.completed)
            }
        } catch { /* unreadable progress just means starting at step one */ }

        setLoading(false)
    }

    // ─── Slug availability ────────────────────────────────────────────────────
    // Rules run locally for instant feedback; availability goes through the API, which
    // is signed-in only and rate limited (the browser no longer queries shop_profiles).
    useEffect(() => {
        const seq = ++slugCheckSeqRef.current
        const candidate = form.shop_slug.replace(/-+$/, '')
        if (slugLocked || !candidate) { setSlug({ state: 'idle' }); return }
        if (candidate === saved.slug) { setSlug({ state: 'ok' }); return }
        const ruleError = validateShopSlug(candidate)
        if (ruleError) { setSlug({ state: 'bad', message: ruleError }); return }

        setSlug({ state: 'checking' })
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/shop/slug-check?slug=${encodeURIComponent(candidate)}`)
                if (seq !== slugCheckSeqRef.current) return
                if (!res.ok) { setSlug({ state: 'idle' }); return }
                const data = await res.json()
                if (seq !== slugCheckSeqRef.current) return
                setSlug(data.available
                    ? { state: 'ok' }
                    : { state: 'bad', message: data.reason || 'That link is not available', suggestions: data.suggestions })
            } catch {
                // The server re-checks on save, so a failed pre-check should not block typing.
                if (seq === slugCheckSeqRef.current) setSlug({ state: 'idle' })
            }
        }, 400)
        return () => clearTimeout(timer)
    }, [form.shop_slug, saved.slug, slugLocked])

    // ─── Validation ───────────────────────────────────────────────────────────
    const normalizedWA = normalizeWhatsAppNumber(form.whatsapp_number)
    const waValid = !normalizedWA || /^233\d{9}$/.test(normalizedWA)

    // Single source of truth for field rules: "Continue" gating and the final save both read
    // it. Name, link and description are only held to the current rules when the owner has
    // changed them, so shops created under older rules can still save other settings.
    const collectFieldErrors = (): Record<string, string> => {
        const errors: Record<string, string> = {}
        const name = cleanText(form.shop_name)
        if (!name || name !== saved.name) {
            const e = validateShopName(name)
            if (e) errors.shop_name = e
        }
        const linkSlug = finalizeSlug(form.shop_slug)
        if (!slugLocked && (!linkSlug || linkSlug !== saved.slug)) {
            const e = validateShopSlug(linkSlug)
            if (e) errors.shop_slug = e
            else if (slug.state === 'bad') errors.shop_slug = slug.message || 'That link is not available'
        }
        if (form.description.trim() && cleanText(form.description) !== saved.description) {
            const e = validateShopDescription(form.description)
            if (e) errors.description = e
        }
        const phone = cleanPhone(form.owner_phone)
        if (!phone) errors.owner_phone = 'Enter the number customers can call'
        else if (!PHONE_RE.test(phone)) errors.owner_phone = 'Use a Ghana number like 0244123456'
        if (form.whatsapp_number && !waValid) errors.whatsapp_number = 'Use a Ghana WhatsApp number like 0244123456'
        const email = form.owner_email.trim()
        if (email && !EMAIL_RE.test(email)) errors.owner_email = 'That email address does not look right'
        const linkErr = communityLinkError(form.community_link)
        if (linkErr) errors.community_link = linkErr
        return errors
    }

    // A field missing from a step's list is still enforced on the final save.
    const STEP_FIELDS: Record<number, string[]> = {
        0: ['shop_name', 'shop_slug', 'description'],
        1: ['owner_phone', 'whatsapp_number', 'owner_email'],
        2: ['community_link'],
    }

    const validateStep = (stepIdx: number): boolean => {
        const all = collectFieldErrors()
        const errors: Record<string, string> = {}
        for (const key of STEP_FIELDS[stepIdx] || []) if (all[key]) errors[key] = all[key]
        if (Object.keys(errors).length > 0) {
            setFieldErrors(prev => ({ ...prev, ...errors }))
            return false
        }
        return true
    }

    const blurValidate = (key: string, value: string) => {
        if (!value.trim()) return
        const e = collectFieldErrors()[key]
        if (e) setFieldErrors(p => ({ ...p, [key]: e }))
    }

    const clearError = (key: string) => setFieldErrors(p => (p[key] ? { ...p, [key]: '' } : p))

    // Turns the API's "field: message" strings into field errors. If the problem is a Details
    // field while another step is showing, jump back so the message is visible.
    const applyServerDetails = (details: string[]) => {
        const errors: Record<string, string> = {}
        for (const d of details) {
            const idx = d.indexOf(':')
            if (idx > 0) errors[d.slice(0, idx).trim()] = d.slice(idx + 1).trim()
        }
        setFieldErrors(prev => ({ ...prev, ...errors }))
        if (activeStep !== 0 && ['shop_name', 'shop_slug', 'description'].some(k => errors[k])) goToStep(0)
    }

    const currentName = () => cleanText(form.shop_name)
    // An unchanged slug is sent exactly as stored, never re-normalised, so older long links survive.
    const currentSlug = () => (form.shop_slug === saved.slug ? saved.slug : finalizeSlug(form.shop_slug))
    const markSaved = () => setSaved({ name: currentName(), slug: currentSlug(), description: cleanText(form.description) })

    // ─── Wizard navigation ────────────────────────────────────────────────────
    const persistProgress = (step: number, completed: string[]) => {
        try { localStorage.setItem(SETUP_PROGRESS_LS_KEY, JSON.stringify({ step, completed })) } catch { /* storage blocked: non-fatal */ }
    }

    const goToStep = (stepIdx: number) => {
        const clamped = Math.min(Math.max(stepIdx, 0), STEPS.length - 1)
        setActiveStep(clamped)
        persistProgress(clamped, completedSteps)
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Navigation only. Nothing saved is erased; that is what "Delete shop" is for.
    const startOver = async () => {
        setCompletedSteps([])
        setActiveStep(0)
        persistProgress(0, [])
        if (existingShopId) await persistProgressToDb(0, [])
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const lookupAndSetExistingShop = async (): Promise<boolean> => {
        const { data: created } = await ((supabase as any)
            .from('shop_profiles')
            .select('id')
            .eq('owner_id', dbUser!.id)
            .maybeSingle())
        if (created?.id) {
            setExistingShopId(created.id)
            return true
        }
        return false
    }

    // Step one creates the shop row; every later step updates it. That ordering is what lets the
    // logo upload (which needs an existing shop) work in the Branding step.
    const createShopIfNeeded = async (): Promise<boolean> => {
        if (existingShopId) return true
        setSaving(true)
        try {
            const res = await fetch('/api/shop/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop_name: currentName(),
                    shop_slug: currentSlug(),
                    description: form.description.trim(),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                // 409 without details means an earlier attempt already created the row.
                if (res.status === 409 && !data.details) {
                    if (await lookupAndSetExistingShop()) { markSaved(); return true }
                    toast.error("Your shop was created but we couldn't confirm it. Refresh and try again.")
                    return false
                }
                if (data.details) applyServerDetails(data.details as string[])
                else toast.error(data.error || 'Could not create your shop. Please try again.')
                return false
            }
            // The API does not return the new id, so look it up. Reporting success without it
            // would make every later step silently skip saving.
            if (!(await lookupAndSetExistingShop())) {
                toast.error("Your shop was created but we couldn't confirm it. Refresh and try again.")
                return false
            }
            markSaved()
            setHasUnsavedChanges(false)
            return true
        } catch {
            toast.error('Could not create your shop. Please try again.')
            return false
        } finally {
            setSaving(false)
        }
    }

    // What each step writes when you press Continue. SMS has its own endpoints.
    const STEP_SAVE_FIELDS: Partial<Record<string, () => Record<string, unknown>>> = {
        details: () => ({ description: form.description.trim() }),
        contact: () => ({
            owner_phone: cleanPhone(form.owner_phone),
            owner_email: form.owner_email.trim() || '',
            whatsapp_number: normalizeWhatsAppNumber(form.whatsapp_number) || '',
        }),
        community: () => ({ community_link: form.community_link.trim() || '' }),
        branding: () => ({
            brand_color: form.brand_color,
            brand_accent: form.brand_accent,
            logo_url: logoUrl || '',
        }),
    }

    const savePartial = async (stepKey: string): Promise<boolean> => {
        const build = STEP_SAVE_FIELDS[stepKey]
        if (!build) return true
        setSaving(true)
        try {
            const res = await fetch('/api/shop/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shop_name: currentName(), shop_slug: currentSlug(), ...build() }),
            })
            const data = await res.json()
            if (!res.ok) {
                if (data.details) applyServerDetails(data.details as string[])
                else toast.error(data.error || 'Could not save this step. Please try again.')
                return false
            }
            markSaved()
            setHasUnsavedChanges(false)
            return true
        } catch {
            toast.error('Could not save this step. Please try again.')
            return false
        } finally {
            setSaving(false)
        }
    }

    // Best effort: local storage already covers resuming on the same device.
    const persistProgressToDb = async (step: number, completed: string[]) => {
        try {
            await fetch('/api/shop/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shop_name: saved.name || currentName(), shop_slug: saved.slug || currentSlug(), setup_progress: { step, completed } }),
            })
        } catch { /* ignored on purpose */ }
    }

    const goNext = async () => {
        if (!validateStep(activeStep)) return
        const stepKey = STEPS[activeStep].key
        if (activeStep === 0 && !existingShopId) {
            if (!(await createShopIfNeeded())) return
        } else if (existingShopId) {
            if (!(await savePartial(stepKey))) return
        }
        const completed = completedSteps.includes(stepKey) ? completedSteps : [...completedSteps, stepKey]
        setCompletedSteps(completed)
        const next = Math.min(activeStep + 1, STEPS.length - 1)
        setActiveStep(next)
        persistProgress(next, completed)
        if (existingShopId) await persistProgressToDb(next, completed)
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleNameChange = (value: string) => {
        const follow = !existingShopId && !slugTouchedRef.current
        updateForm({ shop_name: value, ...(follow ? { shop_slug: slugFromName(value) } : {}) })
        clearError('shop_name')
        if (follow) clearError('shop_slug')
    }

    // ─── Logo upload ──────────────────────────────────────────────────────────
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5MB'); return }
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Only JPG, PNG, or WEBP images allowed'); return
        }
        const reader = new FileReader()
        reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
        reader.readAsDataURL(file)
        setUploading(true)
        try {
            const body = new FormData()
            body.append('file', file)
            body.append('type', 'logo')
            const res = await fetch('/api/shop/upload', { method: 'POST', body })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Upload failed')
            setLogoUrl(data.publicUrl)
            setHasUnsavedChanges(true)
            toast.success('Logo uploaded')
        } catch (err: any) {
            toast.error(err.message || 'Upload failed. Please try again.')
            setLogoPreview(logoUrl)
        } finally { setUploading(false) }
    }

    // ─── Final save ───────────────────────────────────────────────────────────
    const handleSave = async (thenNavigate?: string) => {
        setFieldErrors({})
        const errors = collectFieldErrors()
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors)
            const firstDetails = ['shop_name', 'shop_slug', 'description'].some(k => errors[k]) ? 0
                : ['owner_phone', 'whatsapp_number', 'owner_email'].some(k => errors[k]) ? 1 : 2
            if (firstDetails !== activeStep) goToStep(firstDetails)
            toast.error('A few fields need your attention')
            return
        }

        setSaving(true)
        try {
            const payload = {
                shop_name: currentName(),
                shop_slug: currentSlug(),
                description: form.description.trim().slice(0, SHOP_DESC_MAX),
                owner_phone: cleanPhone(form.owner_phone),
                owner_email: form.owner_email.trim() || '',
                whatsapp_number: normalizeWhatsAppNumber(form.whatsapp_number) || '',
                community_link: form.community_link.trim() || '',
                brand_color: form.brand_color,
                brand_accent: form.brand_accent,
                logo_url: logoUrl || '',
                setup_progress: {
                    step: STEPS.length - 1,
                    completed: STEPS.map(s => s.key) as unknown as string[],
                },
            }

            const res = await fetch('/api/shop/profile', {
                method: existingShopId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()

            if (!res.ok) {
                if (Array.isArray(data.details)) {
                    applyServerDetails(data.details)
                    throw new Error(data.error || 'Please fix the highlighted fields.')
                }
                throw new Error(data.error || 'Failed to save shop')
            }

            markSaved()
            setHasUnsavedChanges(false)
            try { localStorage.removeItem(SETUP_PROGRESS_LS_KEY) } catch { /* non-fatal */ }
            if (thenNavigate) {
                toast.success(existingShopId ? 'Shop updated' : 'Shop created. Now set your prices to go live.')
                router.push(thenNavigate)
            } else if (!existingShopId) {
                setCreateSuccessOpen(true)
            } else {
                toast.success('Shop updated')
                router.push('/dashboard/shop')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to save shop')
        } finally {
            setSaving(false)
        }
    }

    const handleEnableSms = async () => {
        if (smsActivatingRef.current) return
        smsActivatingRef.current = true
        setSmsLoading(true)
        try {
            const res = await fetch('/api/shop/sms/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paidFrom: smsPaySource }),
            })
            const data = await res.json()
            if (!data.success) { toast.error(data.error || 'Could not activate SMS.'); return }
            toast.success('SMS activated')
            setSmsStatus(prev => prev ? { ...prev, activated: true } : prev)
        } catch {
            toast.error('Could not activate SMS. Please try again.')
        } finally {
            smsActivatingRef.current = false
            setSmsLoading(false)
        }
    }

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    const handleNavAway = (href: string) => {
        if (hasUnsavedChanges) { pendingNavRef.current = href; setShowUnsavedModal(true) }
        else router.push(href)
    }

    const goToPricing = () => {
        setCreateSuccessOpen(false)
        router.push('/dashboard/shop/pricing?from=setup')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20" role="status" aria-label="Loading your shop">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const step = STEPS[activeStep]
    const shopLink = finalizeSlug(form.shop_slug)
    const shopUrl = shopLink ? `https://${BRAND.shopHost}/${shopLink}` : ''
    const platform = detectPlatform(form.community_link)
    const accentAdjusted = resolveAccent(form.brand_color).toLowerCase() !== form.brand_color.toLowerCase()
    const preview = (
        <StorefrontPreview name={form.shop_name} slug={shopLink} description={form.description} logo={logoPreview} color={form.brand_color} />
    )

    return (
        <div className="mx-auto w-full max-w-5xl space-y-5 pb-32">
            <ConfirmDialog open={showUnsavedModal} onOpenChange={setShowUnsavedModal} tone="amber" title="You have unsaved changes" body="If you leave now, your changes will be lost.">
                <button type="button" className={cn('clay-silver h-12 flex-1 rounded-full text-sm font-semibold text-black', FOCUS)}
                    onClick={() => { setShowUnsavedModal(false); if (pendingNavRef.current) router.push(pendingNavRef.current); pendingNavRef.current = null }}>
                    Leave anyway
                </button>
                <ClayButton type="button" loading={saving} className="h-12 min-h-0 flex-1 text-sm"
                    onClick={async () => { setShowUnsavedModal(false); await handleSave(pendingNavRef.current || undefined); pendingNavRef.current = null }}>
                    Save and go
                </ClayButton>
            </ConfirmDialog>

            <ConfirmDialog open={showDeleteModal} onOpenChange={setShowDeleteModal} tone="red" title="Delete your shop?" body="This permanently deletes your shop, all orders and your profit wallet. It cannot be undone.">
                <button type="button" disabled={saving} className={cn('clay-silver h-12 flex-1 rounded-full text-sm font-semibold text-black disabled:opacity-60', FOCUS)}
                    onClick={() => setShowDeleteModal(false)}>
                    Keep my shop
                </button>
                <button type="button" disabled={saving} className={cn('clay clay-red flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60', FOCUS)}
                    onClick={async () => {
                        setShowDeleteModal(false)
                        setSaving(true)
                        try {
                            const { error } = await supabase.rpc('delete_shop_data')
                            if (error) throw error
                            setHasUnsavedChanges(false)
                            toast.success('Shop deleted')
                            router.replace('/dashboard/shop')
                        } catch (err: any) {
                            toast.error(err.message || 'Failed to delete shop')
                            setSaving(false)
                        }
                    }}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} Delete shop
                </button>
            </ConfirmDialog>

            {/* Stage: the same black stage and swoosh as sign-in and the storefront */}
            <header className="relative isolate overflow-hidden rounded-[2rem] bg-black px-5 pb-6 pt-5 text-white sm:px-8 sm:pb-8 sm:pt-6">
                <BrandSwoosh
                    progress={(activeStep + 1) / STEPS.length}
                    className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-[110%] opacity-90 sm:-right-[10%] sm:w-[62%]"
                />
                <button type="button" onClick={() => handleNavAway('/dashboard/shop')}
                    className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-silver-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                    <ArrowLeft className="h-4 w-4" /> Shop dashboard
                </button>
                <p className="mt-6 text-sm font-semibold text-brand-400" aria-live="polite">
                    Step {activeStep + 1} of {STEPS.length}
                    {completedSteps.length > 0 && activeStep > 0 && (
                        <button type="button" onClick={startOver} className="ml-3 font-medium text-silver-200 underline underline-offset-2 hover:text-white">Start over</button>
                    )}
                </p>
                <h1 key={step.key} className="mt-2 max-w-md font-display text-3xl font-bold leading-[1.05] tracking-tight text-balance animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:text-4xl">
                    {step.heading}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-silver-200 sm:text-base">{step.lead}</p>

                <nav aria-label="Setup steps" className="mt-6 flex gap-2 overflow-x-auto pb-1">
                    {STEPS.map((s, i) => {
                        const isDone = completedSteps.includes(s.key) || i < activeStep
                        const isCurrent = i === activeStep
                        const canJump = isDone || i <= activeStep || !!existingShopId
                        return (
                            <button
                                key={s.key} type="button" disabled={!canJump} onClick={() => canJump && goToStep(i)}
                                aria-current={isCurrent ? 'step' : undefined}
                                className={cn(
                                    'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                                    isCurrent ? 'clay-gold' : isDone ? 'neu-night text-white' : 'neu-night-in text-silver-200/70',
                                    !canJump && 'cursor-not-allowed'
                                )}
                            >
                                {isDone && !isCurrent && <Check className="h-3 w-3 text-brand-500" strokeWidth={3} />}
                                {s.label}
                            </button>
                        )
                    })}
                </nav>
            </header>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
                <AnimatePresence mode="wait">
                    <motion.section
                        key={step.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="neu-raised space-y-6 rounded-[2rem] p-5 sm:p-7"
                    >
                        {/* Step 1 */}
                        {activeStep === 0 && (
                            <>
                                <div className="space-y-3">
                                    <Field
                                        id="shop_name" label="Shop name" error={fieldErrors.shop_name}
                                        counter={<Counter value={form.shop_name.length} max={SHOP_NAME_MAX} />}
                                        action={<RefineButton refine={nameRefine} label="Suggest" />}
                                        hint="Shown at the top of your storefront and in the browser tab."
                                    >
                                        <SetupInput
                                            id="shop_name" value={form.shop_name} onChange={handleNameChange}
                                            maxLength={SHOP_NAME_MAX} autoComplete="organization" placeholder="e.g. Kofi's Data Corner"
                                            invalid={!!fieldErrors.shop_name}
                                            onBlur={() => blurValidate('shop_name', form.shop_name)}
                                        />
                                    </Field>
                                    <RefinePanel refine={nameRefine} title={form.shop_name.trim() || firstName ? 'Names built around yours' : 'Not sure what to call it? Try one of these'}
                                        onPick={handleNameChange} />
                                </div>

                                <div className="space-y-3">
                                    <Field
                                        id="shop_slug" label="Shop link" error={fieldErrors.shop_slug}
                                        counter={<Counter value={form.shop_slug.length} max={SHOP_SLUG_MAX} />}
                                        hint={slugLocked ? 'Locked now that your shop is live, so every link you have shared keeps working.' : 'Lowercase letters, numbers and hyphens. Short links are easier to share.'}
                                    >
                                        <Well invalid={!!fieldErrors.shop_slug || slug.state === 'bad'} className="flex items-center overflow-hidden">
                                            <span className="shrink-0 pl-4 text-sm text-muted-foreground">{BRAND.shopHost}/</span>
                                            <input
                                                id="shop_slug" name="shop_slug" value={form.shop_slug} disabled={slugLocked}
                                                onChange={(e) => {
                                                    slugTouchedRef.current = true
                                                    updateForm({ shop_slug: sanitizeSlugInput(e.target.value) })
                                                    clearError('shop_slug')
                                                }}
                                                maxLength={SHOP_SLUG_MAX} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="kofi-data"
                                                aria-describedby="shop_slug-note"
                                                className="h-12 min-w-0 flex-1 bg-transparent pl-1 pr-4 font-mono text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black disabled:opacity-60 dark:focus-visible:ring-brand-500"
                                            />
                                        </Well>
                                    </Field>
                                    {!slugLocked && (
                                        <SlugStatus state={slug.state} message={slug.message} suggestions={slug.suggestions}
                                            onPick={(s) => { slugTouchedRef.current = true; updateForm({ shop_slug: s }); clearError('shop_slug') }} />
                                    )}
                                    {shopUrl && slug.state === 'ok' && existingShopId && (
                                        <a href={shopUrl} target="_blank" rel="noopener noreferrer"
                                            className={cn('inline-flex items-center gap-1.5 rounded text-xs font-semibold text-brand-800 underline underline-offset-2 dark:text-brand-400', FOCUS)}>
                                            Open your storefront <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <Field
                                        id="description" label="Description" optional error={fieldErrors.description}
                                        counter={<Counter value={form.description.length} max={SHOP_DESC_MAX} />}
                                        action={<RefineButton refine={descRefine} label={form.description.trim() ? 'Refine' : 'Write one for me'} />}
                                        hint="One or two friendly sentences about what you sell. No links here."
                                    >
                                        <SetupTextarea
                                            id="description" value={form.description} maxLength={SHOP_DESC_MAX} rows={4}
                                            onChange={(v) => { updateForm({ description: v }); clearError('description') }}
                                            placeholder="What do you sell, and why should people buy from you?"
                                            invalid={!!fieldErrors.description}
                                            onBlur={() => blurValidate('description', form.description)}
                                        />
                                    </Field>
                                    <RefinePanel refine={descRefine}
                                        title={form.description.trim() ? 'Your words, tidied, plus a few ways to finish them' : 'Drafts to start from. Edit freely after'}
                                        onPick={(v) => { updateForm({ description: v }); clearError('description') }} />
                                </div>

                                <div className="neu-inset flex items-start justify-between gap-3 rounded-2xl p-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold">Shop status</p>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {existingShopId
                                                ? 'Your shop opens by itself once your prices are submitted and approved. There is nothing to switch on here.'
                                                : 'New shops start closed. Set your prices after this and the shop opens by itself once they are approved.'}
                                        </p>
                                    </div>
                                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', savedIsActive ? 'clay-gold' : 'clay-black')}>
                                        {savedIsActive ? 'Open' : 'Closed'}
                                    </span>
                                </div>
                                <div className="lg:hidden">{preview}</div>
                            </>
                        )}

                        {/* Step 2 */}
                        {activeStep === 1 && (
                            <>
                                <Field id="owner_phone" label="Phone number" error={fieldErrors.owner_phone} hint="Customers see this on your storefront. Needed before your shop can open.">
                                    <SetupInput id="owner_phone" value={form.owner_phone} inputMode="tel" autoComplete="tel" maxLength={16} placeholder="0244123456"
                                        invalid={!!fieldErrors.owner_phone}
                                        onChange={(v) => { updateForm({ owner_phone: v }); clearError('owner_phone') }}
                                        onBlur={() => blurValidate('owner_phone', form.owner_phone)} />
                                </Field>
                                <Field id="owner_email" label="Email" optional error={fieldErrors.owner_email} hint="For order receipts and platform notices.">
                                    <SetupInput id="owner_email" type="email" inputMode="email" autoComplete="email" maxLength={120} value={form.owner_email} placeholder="you@example.com"
                                        invalid={!!fieldErrors.owner_email}
                                        onChange={(v) => { updateForm({ owner_email: v }); clearError('owner_email') }}
                                        onBlur={() => blurValidate('owner_email', form.owner_email)} />
                                </Field>
                                <Field id="whatsapp_number" label="WhatsApp number" optional error={fieldErrors.whatsapp_number}
                                    hint={form.whatsapp_number.trim() && waValid ? (
                                        <span className="flex flex-wrap items-center gap-x-1.5 text-foreground">
                                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Saved as <span className="font-mono">{normalizedWA}</span>
                                            <a href={`https://wa.me/${normalizedWA}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Test the link</a>
                                        </span>
                                    ) : 'Adds a WhatsApp chat button to your storefront. Write it any way: 0244123456 or +233244123456.'}>
                                    <SetupInput id="whatsapp_number" value={form.whatsapp_number} inputMode="tel" maxLength={16} placeholder="0244123456"
                                        invalid={!!fieldErrors.whatsapp_number}
                                        onChange={(v) => { updateForm({ whatsapp_number: v }); clearError('whatsapp_number') }}
                                        onBlur={() => blurValidate('whatsapp_number', form.whatsapp_number)} />
                                </Field>
                            </>
                        )}

                        {/* Step 3 */}
                        {activeStep === 2 && (
                            <Field id="community_link" label="Group or channel link" optional error={fieldErrors.community_link}
                                action={platform && <span className="clay-black rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{platform}</span>}
                                hint="A WhatsApp group, Telegram channel, Facebook group or similar. It must start with https://">
                                <SetupInput id="community_link" type="url" inputMode="url" value={form.community_link} maxLength={500} autoCapitalize="none" spellCheck={false}
                                    placeholder="https://chat.whatsapp.com/..." invalid={!!fieldErrors.community_link}
                                    onChange={(v) => { updateForm({ community_link: v }); clearError('community_link') }}
                                    onBlur={() => blurValidate('community_link', form.community_link)} />
                            </Field>
                        )}

                        {/* Step 4 */}
                        {activeStep === 3 && (
                            <>
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold">Logo <span className="ml-1.5 text-xs font-medium text-muted-foreground">JPG, PNG or WEBP, up to 5MB</span></p>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                        className={cn('neu-inset flex w-full flex-col items-center gap-2 rounded-2xl px-4 py-7 text-center text-muted-foreground', FOCUS)}>
                                        {logoPreview ? (
                                            <span className="relative block h-20 w-20 overflow-hidden rounded-full bg-black ring-2 ring-offset-2 ring-offset-[var(--neu-bg)]" style={{ ['--tw-ring-color' as string]: resolveAccent(form.brand_color) }}>
                                                <Image src={logoPreview} alt="Your logo" fill unoptimized className="object-cover" />
                                            </span>
                                        ) : uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8" />}
                                        <span className="text-sm font-semibold text-foreground">{uploading ? 'Uploading' : logoPreview ? 'Tap to change your logo' : 'Tap to add your logo'}</span>
                                        <span className="text-xs">Square works best. It is shown as a circle.</span>
                                    </button>
                                    {logoPreview && (
                                        <button type="button" onClick={() => { setLogoPreview(null); setLogoUrl(null); setHasUnsavedChanges(true) }}
                                            className={cn('inline-flex items-center gap-1.5 rounded text-xs font-semibold text-red-700 dark:text-red-400', FOCUS)}>
                                            <Trash2 className="h-3.5 w-3.5" /> Remove logo
                                        </button>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} aria-label="Upload shop logo" />
                                </div>

                                <div className="space-y-3">
                                    <p className="text-sm font-semibold">Accent colour</p>
                                    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6" role="radiogroup" aria-label="Accent colour">
                                        {BRAND_PRESETS.map((p) => {
                                            const on = form.brand_color.toLowerCase() === p.color.toLowerCase()
                                            return (
                                                <button key={p.name} type="button" role="radio" aria-checked={on}
                                                    onClick={() => updateForm({ brand_color: p.color, brand_accent: p.accent })}
                                                    className={cn('flex flex-col items-center gap-1.5 rounded-2xl p-2.5 text-[11px] font-semibold', on ? 'neu-inset' : 'neu-raised-sm neu-press', FOCUS)}>
                                                    <span className="h-7 w-7 rounded-full shadow-[inset_0_2px_2px_rgba(255,255,255,0.45),inset_0_-2px_3px_rgba(0,0,0,0.25)]" style={{ backgroundColor: p.color }} />
                                                    {p.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <label className="neu-inset flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold">
                                        <input type="color" value={form.brand_color} onChange={(e) => updateForm({ brand_color: e.target.value, brand_accent: e.target.value })}
                                            className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Pick a custom colour" />
                                        Custom colour <span className="ml-auto font-mono text-xs font-medium text-muted-foreground">{form.brand_color}</span>
                                    </label>
                                    {accentAdjusted && (
                                        <Notice tone="info">
                                            That shade is too light or too dark to read on the storefront, so it shows as Capozy gold. Pick a mid-tone to see yours.
                                        </Notice>
                                    )}
                                    <p className="text-xs text-muted-foreground">Your colour is used for small touches: the logo ring, the line under your name and selected options. The rest stays Capozy black and gold.</p>
                                </div>
                                <div className="lg:hidden">{preview}</div>
                            </>
                        )}

                        {/* Step 5 */}
                        {activeStep === 4 && (
                            <div className="space-y-4">
                                {!smsStatus ? (
                                    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading</p>
                                ) : !smsStatus.enabled ? (
                                    <Notice tone="info">SMS is not available on the platform right now. Check back from your dashboard later.</Notice>
                                ) : smsStatus.activated ? (
                                    <Notice tone="info"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> SMS is active for your shop.</span></Notice>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm">One-time activation fee: <strong>GHS {smsStatus.activationFee.toFixed(2)}</strong></p>
                                        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pay with">
                                            {([['wallet', 'Wallet', smsStatus.mainBalance], ['profit', 'Profit', smsStatus.profitBalance]] as const).map(([key, label, bal]) => (
                                                <button key={key} type="button" role="radio" aria-checked={smsPaySource === key} onClick={() => setSmsPaySource(key)}
                                                    className={cn('rounded-2xl px-4 py-3 text-left', smsPaySource === key ? 'neu-inset' : 'neu-raised-sm neu-press', FOCUS)}>
                                                    <span className="block text-sm font-semibold">{label}</span>
                                                    <span className="block text-xs text-muted-foreground">GHS {bal.toFixed(2)}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <ClayButton type="button" onClick={handleEnableSms} loading={smsLoading}>Enable SMS</ClayButton>
                                    </div>
                                )}
                                <a href="/dashboard/shop/sms" target="_blank" rel="noopener noreferrer"
                                    className={cn('inline-block rounded text-sm font-semibold text-brand-800 underline underline-offset-2 dark:text-brand-400', FOCUS)}>
                                    Set up templates and sender ID
                                </a>
                            </div>
                        )}
                    </motion.section>
                </AnimatePresence>

                <aside className="hidden lg:sticky lg:top-6 lg:block">{preview}</aside>
            </div>

            <Dialog open={createSuccessOpen} onOpenChange={setCreateSuccessOpen}>
                <DialogContent className="max-w-md rounded-[2rem]" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-display text-xl">
                            <CheckCircle2 className="h-5 w-5" /> Your shop is created
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">One more step: set your prices. Your shop opens to customers once they are approved.</p>
                        {shopUrl && (
                            <div className="neu-inset flex items-center gap-2 rounded-xl px-3 py-2">
                                <span className="flex-1 truncate font-mono text-xs">{shopUrl}</span>
                                <Button type="button" size="sm" variant="secondary" className="h-8 shrink-0 gap-1 rounded-full text-[11px]"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(shopUrl)
                                            setSuccessLinkCopied(true)
                                            toast.success('Link copied')
                                            setTimeout(() => setSuccessLinkCopied(false), 2000)
                                        } catch {
                                            toast.error('Could not copy. Press and hold the link to copy it.')
                                        }
                                    }}>
                                    {successLinkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    {successLinkCopied ? 'Copied' : 'Copy'}
                                </Button>
                            </div>
                        )}
                        <div className="neu-raised-sm space-y-2 rounded-2xl p-3.5">
                            <p className="flex items-center justify-between text-xs font-semibold">
                                Order texts from your own brand
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Optional</span>
                            </p>
                            <SenderIdExplainer variant="compact" />
                            <Link href="/dashboard/shop/sms" className={cn('inline-flex rounded text-xs font-semibold text-brand-800 underline underline-offset-2 dark:text-brand-400', FOCUS)}>
                                Request a sender ID
                            </Link>
                        </div>
                    </div>
                    <DialogFooter>
                        <ClayButton type="button" onClick={goToPricing}><Save className="h-4 w-4" /> Set my prices</ClayButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Navigation */}
            <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 bg-background/90 px-1 pb-2 pt-3 backdrop-blur max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+52px)]">
                <button type="button" onClick={() => goToStep(activeStep - 1)} disabled={activeStep === 0 || saving}
                    className={cn('clay-silver flex h-12 items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-black disabled:opacity-60', FOCUS, activeStep === 0 && 'invisible')}>
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {activeStep < STEPS.length - 1 ? (
                    <ClayButton type="button" onClick={goNext} loading={saving} disabled={uploading || slug.state === 'checking' || (!slugLocked && slug.state === 'bad' && activeStep === 0)}
                        className="h-12 min-h-0 w-auto min-w-[10rem] px-8 text-sm">
                        {saving ? 'Saving' : 'Continue'}
                    </ClayButton>
                ) : (
                    <ClayButton type="button" onClick={() => handleSave()} loading={saving} disabled={uploading}
                        className="h-12 min-h-0 w-auto min-w-[10rem] px-8 text-sm">
                        {saving ? 'Finishing' : existingShopId ? 'Save changes' : 'Create shop and set prices'}
                    </ClayButton>
                )}
            </div>

            {existingShopId && (
                <section className="neu-inset flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Danger zone">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400"><Store className="h-4 w-4" /> Delete shop</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Permanently removes your shop, orders and profit wallet. This cannot be undone.</p>
                    </div>
                    <button type="button" onClick={() => setShowDeleteModal(true)} disabled={saving}
                        className={cn('clay clay-red h-10 shrink-0 rounded-full px-5 text-sm font-semibold disabled:opacity-60', FOCUS)}>
                        Delete shop
                    </button>
                </section>
            )}
        </div>
    )
}

function ConfirmDialog({
    open, onOpenChange, tone, title, body, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; tone: 'amber' | 'red'; title: string; body: string; children: React.ReactNode }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm rounded-[2rem]" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="flex items-start gap-3 text-left">
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone === 'red' ? 'clay clay-red' : 'clay-gold')}>
                            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block font-display text-lg font-bold">{title}</span>
                            <span className="mt-1 block text-sm font-normal text-muted-foreground">{body}</span>
                        </span>
                    </DialogTitle>
                </DialogHeader>
                <div className="flex gap-3">{children}</div>
            </DialogContent>
        </Dialog>
    )
}
