'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Copy, Trash2, Plus, X, Save } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
    auto_upgrade_count: number
}

interface RowDraft {
    label: string
    price: string
    old_price: string
    is_popular: boolean
    active: boolean
}

interface CreateFormState {
    label: string
    isLifetime: boolean
    duration_days: string
    price: string
    old_price: string
    is_popular: boolean
    active: boolean
    sort_order: string
}

const EMPTY_FORM: CreateFormState = {
    label: '', isLifetime: false, duration_days: '', price: '', old_price: '', is_popular: false, active: true, sort_order: '0',
}

const money = (n: number) => `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const draftOf = (p: PlanRow): RowDraft => ({
    label: p.label,
    price: String(p.price),
    old_price: p.old_price === null ? '' : String(p.old_price),
    is_popular: p.is_popular,
    active: p.active,
})

export default function RolePlansManager() {
    const [plans, setPlans] = useState<PlanRow[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
    const [savingId, setSavingId] = useState<string | null>(null)
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

    const [creating, setCreating] = useState<{ type: 'agent' | 'dealer' } | null>(null)
    const [form, setForm] = useState<CreateFormState>(EMPTY_FORM)
    const [isCreating, setIsCreating] = useState(false)

    const [deleting, setDeleting] = useState<PlanRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const load = async () => {
        setIsLoading(true)
        setLoadError(null)
        try {
            const res = await fetch('/api/admin/role-plans', { cache: 'no-store' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to load plans')
            const rows: PlanRow[] = data.plans ?? []
            setPlans(rows)
            setDrafts(Object.fromEntries(rows.map(p => [p.id, draftOf(p)])))
        } catch (e: any) {
            setLoadError(e.message || 'Failed to load plans')
            setPlans(null)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const isDirty = (p: PlanRow) => {
        const d = drafts[p.id]
        if (!d) return false
        return (
            d.label.trim() !== p.label ||
            Number(d.price) !== p.price ||
            (d.old_price ? Number(d.old_price) : null) !== p.old_price ||
            d.is_popular !== p.is_popular ||
            d.active !== p.active
        )
    }

    const setDraft = (id: string, patch: Partial<RowDraft>) => {
        setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    }

    const saveRow = async (p: PlanRow) => {
        const d = drafts[p.id]
        if (!d) return
        if (!d.label.trim()) { toast.error('Label is required'); return }
        const price = Number(d.price)
        if (!Number.isFinite(price) || price <= 0) { toast.error('Enter a valid price'); return }

        setSavingId(p.id)
        try {
            const res = await fetch(`/api/admin/role-plans/${p.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: d.label.trim(),
                    duration_days: p.duration_days,
                    price,
                    old_price: d.old_price ? Number(d.old_price) : null,
                    is_popular: d.is_popular,
                    active: d.active,
                    sort_order: p.sort_order,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to save plan')
            clearPricingCache()
            toast.success('Plan saved')
            await load()
        } catch (e: any) {
            toast.error(e.message || 'Failed to save plan')
        } finally {
            setSavingId(null)
        }
    }

    const openCreate = (type: 'agent' | 'dealer') => {
        setForm({ ...EMPTY_FORM, sort_order: String(((plans ?? []).filter(p => p.upgrade_type === type).length + 1) * 10) })
        setCreating({ type })
    }

    const openDuplicate = (p: PlanRow) => {
        setForm({
            label: `${p.label} (copy)`,
            isLifetime: p.duration_days === null,
            duration_days: p.duration_days === null ? '' : String(p.duration_days),
            price: String(p.price),
            old_price: p.old_price === null ? '' : String(p.old_price),
            is_popular: false,
            active: false,
            sort_order: String(p.sort_order + 1),
        })
        setCreating({ type: p.upgrade_type })
        setDuplicatingId(p.id)
    }

    const submitCreate = async () => {
        if (!creating) return
        if (!form.label.trim()) { toast.error('Label is required'); return }
        if (!form.isLifetime && !form.duration_days) { toast.error('Enter the number of days, or mark it Lifetime'); return }
        if (!form.price) { toast.error('Price is required'); return }

        setIsCreating(true)
        try {
            const res = await fetch('/api/admin/role-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    upgrade_type: creating.type,
                    label: form.label.trim(),
                    duration_days: form.isLifetime ? null : Number(form.duration_days),
                    price: Number(form.price),
                    old_price: form.old_price ? Number(form.old_price) : null,
                    is_popular: form.is_popular,
                    active: form.active,
                    sort_order: Number(form.sort_order) || 0,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Failed to create plan')
            clearPricingCache()
            toast.success('Plan created')
            setCreating(null)
            setDuplicatingId(null)
            await load()
        } catch (e: any) {
            toast.error(e.message || 'Failed to create plan')
        } finally {
            setIsCreating(false)
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
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCreate(type)}>
                        <Plus className="mr-1 h-3 w-3" /> Add plan
                    </Button>
                </div>
                {rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                        No {title.toLowerCase()} yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border dark:border-border/60">
                        <table className="w-full min-w-[720px] text-xs">
                            <thead>
                                <tr className="border-b border-border bg-muted/60 dark:border-border/60 dark:bg-muted/30">
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Length</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Price (GHS)</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Old price</th>
                                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Popular</th>
                                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Visible</th>
                                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Auto-renew</th>
                                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border dark:divide-border/40">
                                {rows.map(p => {
                                    const d = drafts[p.id] ?? draftOf(p)
                                    const dirty = isDirty(p)
                                    return (
                                        <tr key={p.id} className={cn(!d.active && 'opacity-60')}>
                                            <td className="px-3 py-2 align-top">
                                                <p className="font-medium text-foreground">{p.duration_days === null ? 'Lifetime' : `${p.duration_days}d`}</p>
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <Input
                                                    value={d.label}
                                                    onChange={e => setDraft(p.id, { label: e.target.value })}
                                                    className="h-8 w-44 text-xs"
                                                />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <Input
                                                    type="number" step="0.01" min={0.01}
                                                    value={d.price}
                                                    onChange={e => setDraft(p.id, { price: e.target.value })}
                                                    className="h-8 w-24 text-xs"
                                                />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <Input
                                                    type="number" step="0.01" min={0}
                                                    placeholder="None"
                                                    value={d.old_price}
                                                    onChange={e => setDraft(p.id, { old_price: e.target.value })}
                                                    className="h-8 w-24 text-xs"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center align-top">
                                                <Checkbox
                                                    checked={d.is_popular}
                                                    onCheckedChange={v => setDraft(p.id, { is_popular: !!v })}
                                                    aria-label="Most popular"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center align-top">
                                                <Switch
                                                    checked={d.active}
                                                    onCheckedChange={v => setDraft(p.id, { active: v })}
                                                    aria-label="Visible to customers"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center align-top tabular-nums text-muted-foreground">
                                                {p.auto_upgrade_count}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        className="h-7 px-2 text-[11px]"
                                                        disabled={!dirty || savingId === p.id}
                                                        onClick={() => saveRow(p)}
                                                    >
                                                        {savingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openDuplicate(p)} title="Duplicate with a new length">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 hover:text-red-600" onClick={() => setDeleting(p)} title="Delete">
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (loadError || plans === null) {
        return (
            <div className="space-y-3 rounded-lg border border-dashed border-border px-4 py-6 text-center">
                <p className="text-sm font-medium">Couldn't load the upgrade plans.</p>
                <p className="text-xs text-muted-foreground">{loadError}. If this is a fresh database, the role_upgrade_plans migration (20261122) hasn't been applied yet.</p>
                <Button size="sm" variant="outline" onClick={load}>Try again</Button>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
                A plan's length can't change once created — duplicate it to a new length, then hide the old one.
            </p>
            {section('agent', 'Agent plans')}
            {section('dealer', 'Dealer plans')}

            <Dialog open={!!creating} onOpenChange={o => { if (!o && !isCreating) { setCreating(null); setDuplicatingId(null) } }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{duplicatingId ? 'Duplicate plan' : `New ${creating?.type} plan`}</DialogTitle>
                        <DialogDescription>Customers will see this on the Role Upgrade page once saved.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Label</Label>
                            <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. 7 Days Agent Pass" />
                        </div>

                        {creating?.type === 'agent' && (
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
                        <Button variant="outline" onClick={() => { setCreating(null); setDuplicatingId(null) }} disabled={isCreating}>Cancel</Button>
                        <Button onClick={submitCreate} disabled={isCreating}>
                            {isCreating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
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
                            {deleting && deleting.auto_upgrade_count > 0
                                ? `${deleting.auto_upgrade_count} user(s) have auto-renew set to this plan — it will be turned off for them and they'll be notified. `
                                : ''}
                            Customers won't be able to buy this plan anymore. This cannot be undone.
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
