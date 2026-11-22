'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, Plus, EyeOff, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { clearPricingCache } from '@/lib/pricing-cache'

interface PlanRow {
    id: string
    upgrade_type: 'agent' | 'dealer'
    slug: string
    label: string
    duration_days: number | null
    price: number
    old_price: number | null
    is_popular: boolean
    sort_order: number
    active: boolean
}

interface FormState {
    label: string
    isLifetime: boolean
    duration_days: string
    price: string
    old_price: string
    is_popular: boolean
    active: boolean
    sort_order: string
}

const EMPTY_FORM: FormState = {
    label: '', isLifetime: false, duration_days: '', price: '', old_price: '', is_popular: false, active: true, sort_order: '0',
}

const money = (n: number) => `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AdminRolePlansManager() {
    const [plans, setPlans] = useState<PlanRow[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const [editing, setEditing] = useState<{ type: 'agent' | 'dealer'; plan: PlanRow | null } | null>(null)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [isSaving, setIsSaving] = useState(false)

    const [deleting, setDeleting] = useState<PlanRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const load = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/admin/role-plans', { cache: 'no-store' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to load plans')
            setPlans(data.plans ?? [])
        } catch (e: any) {
            toast.error(e.message || 'Failed to load plans')
            setPlans([])
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const openCreate = (type: 'agent' | 'dealer') => {
        setForm({ ...EMPTY_FORM, sort_order: String(((plans ?? []).filter(p => p.upgrade_type === type).length + 1) * 10) })
        setEditing({ type, plan: null })
    }

    const openEdit = (plan: PlanRow) => {
        setForm({
            label: plan.label,
            isLifetime: plan.duration_days === null,
            duration_days: plan.duration_days === null ? '' : String(plan.duration_days),
            price: String(plan.price),
            old_price: plan.old_price === null ? '' : String(plan.old_price),
            is_popular: plan.is_popular,
            active: plan.active,
            sort_order: String(plan.sort_order),
        })
        setEditing({ type: plan.upgrade_type, plan })
    }

    const save = async () => {
        if (!editing) return
        if (!form.label.trim()) { toast.error('Label is required'); return }
        if (!form.isLifetime && !form.duration_days) { toast.error('Enter the number of days, or mark it Lifetime'); return }
        if (!form.price) { toast.error('Price is required'); return }

        setIsSaving(true)
        try {
            const body = {
                upgrade_type: editing.type,
                label: form.label.trim(),
                duration_days: form.isLifetime ? null : Number(form.duration_days),
                price: Number(form.price),
                old_price: form.old_price ? Number(form.old_price) : null,
                is_popular: form.is_popular,
                active: form.active,
                sort_order: Number(form.sort_order) || 0,
            }
            const url = editing.plan ? `/api/admin/role-plans/${editing.plan.id}` : '/api/admin/role-plans'
            const res = await fetch(url, {
                method: editing.plan ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to save plan')

            clearPricingCache()
            toast.success(editing.plan ? 'Plan updated' : 'Plan created')
            setEditing(null)
            await load()
        } catch (e: any) {
            toast.error(e.message || 'Failed to save plan')
        } finally {
            setIsSaving(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleting) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/admin/role-plans/${deleting.id}`, { method: 'DELETE' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to delete plan')
            clearPricingCache()
            toast.success('Plan deleted')
            setDeleting(null)
            await load()
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete plan')
        } finally {
            setIsDeleting(false)
        }
    }

    const section = (type: 'agent' | 'dealer', title: string) => {
        const rows = (plans ?? []).filter(p => p.upgrade_type === type)
        return (
            <section aria-label={title} className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
                    <Button size="sm" variant="outline" onClick={() => openCreate(type)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add plan
                    </Button>
                </div>
                {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        No {title.toLowerCase()} yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {rows.map(p => {
                            const discounted = p.old_price !== null && p.old_price > p.price
                            return (
                                <div
                                    key={p.id}
                                    className={cn(
                                        'relative flex flex-col rounded-xl border border-border bg-card p-4',
                                        !p.active && 'opacity-60',
                                    )}
                                >
                                    {p.is_popular && (
                                        <span className="absolute -top-2.5 left-4 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-black">Popular</span>
                                    )}
                                    {!p.active && (
                                        <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                            <EyeOff className="h-2.5 w-2.5" /> Hidden
                                        </span>
                                    )}
                                    <p className="truncate text-sm font-semibold">{p.label}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{p.duration_days === null ? 'Lifetime' : `${p.duration_days} days`}</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <p className="font-display text-xl font-bold">{money(p.price)}</p>
                                        {discounted && <p className="text-xs text-muted-foreground line-through">{money(p.old_price!)}</p>}
                                    </div>
                                    <div className="mt-3 flex gap-2 pt-2">
                                        <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => openEdit(p)}>
                                            <Pencil className="mr-1 h-3 w-3" /> Edit
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-8 flex-1 text-xs text-red-600 hover:text-red-600" onClick={() => setDeleting(p)}>
                                            <Trash2 className="mr-1 h-3 w-3" /> Delete
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        )
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {section('agent', 'Agent plans')}
            {section('dealer', 'Dealer plans')}

            <Dialog open={!!editing} onOpenChange={o => { if (!o && !isSaving) setEditing(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editing?.plan ? 'Edit plan' : `New ${editing?.type} plan`}</DialogTitle>
                        <DialogDescription>
                            {editing?.plan ? 'Changes apply to new purchases immediately.' : 'Customers will see this on the Upgrade page once saved.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Label</Label>
                            <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. 7 Days Agent Pass" />
                        </div>

                        {editing?.type === 'agent' && (
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="lifetime"
                                    checked={form.isLifetime}
                                    onCheckedChange={v => setForm(f => ({ ...f, isLifetime: !!v }))}
                                />
                                <Label htmlFor="lifetime" className="cursor-pointer text-xs text-muted-foreground">Lifetime (never expires)</Label>
                            </div>
                        )}

                        {!form.isLifetime && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Duration (days)</Label>
                                <Input type="number" min={1} value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Price (GHS)</Label>
                                <Input type="number" min={0.01} step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Old price (optional)</Label>
                                <Input type="number" min={0} step="0.01" value={form.old_price} onChange={e => setForm(f => ({ ...f, old_price: e.target.value }))} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Position (lower shows first)</Label>
                            <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox id="popular" checked={form.is_popular} onCheckedChange={v => setForm(f => ({ ...f, is_popular: !!v }))} />
                            <Label htmlFor="popular" className="cursor-pointer text-xs text-muted-foreground">Show "Most popular" badge</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="active" checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} />
                            <Label htmlFor="active" className="cursor-pointer text-xs text-muted-foreground">Visible to customers</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={save} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleting} onOpenChange={o => { if (!o && !isDeleting) setDeleting(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete "{deleting?.label}"?</DialogTitle>
                        <DialogDescription>
                            Customers won't be able to buy this plan anymore. Anyone with auto-renew set to it will have it turned off and will be notified. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                            Delete plan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
