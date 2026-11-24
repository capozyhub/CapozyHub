'use client'

import * as XLSX from 'xlsx'

import { useEffect, useRef, useState, useCallback } from 'react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import {
    Search,
    MoreVertical,
    Ban,
    CheckCircle,
    CheckCircle2,
    Wallet,
    Shield,
    Loader2,
    Trash2,
    Store,
    Phone,
    Calendar,
    Mail,
    Download,
    KeyRound,
    Users as UsersIcon,
    UserCircle,
    BadgeCheck,
    Gem,
    Hourglass,
    Timer,
    Eye,
    ClipboardList,
    MessageSquare,
    ListChecks,
    X,
    UserCog,
    AlertTriangle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { roleConfig, UserRole } from '@/lib/roles'
import { RoleAvatar } from '@/components/dashboard/role-avatar'
import { Notice } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'

// ── Types ────────────────────────────────────────────────────────────────────
interface UserStats {
    total: number
    customers: number
    agents: number
    active_agents: number
    expired_agents: number
    dealers: number
    active_dealers: number
    expired_dealers: number
    staff: number
    subagents: number
    suspended: number
    expired: number
    verified: number
    unverified: number
}

type SuspendPreset = '24h' | '7d' | '30d' | 'custom' | 'permanent'

const SUSPEND_PRESETS: { key: SuspendPreset; label: string; hours: number | null }[] = [
    { key: '24h', label: '24 hours', hours: 24 },
    { key: '7d', label: '7 days', hours: 24 * 7 },
    { key: '30d', label: '30 days', hours: 24 * 30 },
    { key: 'custom', label: 'Custom', hours: null },
    { key: 'permanent', label: 'Permanent', hours: null },
]

// Segment cards: click to filter. `role`/`status`/`verified` map straight onto the API params.
const SEGMENTS: {
    key: string; label: string; icon: any; color: string
    role: string; status: string
    value: (s: UserStats) => number
    sub?: (s: UserStats) => string
}[] = [
    { key: 'total',      label: 'Total',      icon: UsersIcon,  color: 'text-muted-foreground ', role: 'all',      status: 'all',       value: s => s.total },
    { key: 'customers',  label: 'Customers',  icon: UserCircle, color: 'text-muted-foreground', role: 'customer', status: 'all',       value: s => s.customers },
    { key: 'agents',     label: 'Agents',     icon: BadgeCheck, color: 'text-muted-foreground', role: 'agent',    status: 'all',       value: s => s.agents, sub: s => `${s.active_agents} active · ${s.expired_agents} expired` },
    { key: 'dealers',    label: 'Dealers',    icon: Gem,        color: 'text-muted-foreground', role: 'dealer',   status: 'all',       value: s => s.dealers },
    { key: 'subagents',  label: 'Subagents',  icon: UserCog,    color: 'text-muted-foreground', role: 'subagent', status: 'all',       value: s => s.subagents },
    { key: 'staff',      label: 'Staff',      icon: Shield,     color: 'text-muted-foreground', role: 'staff',    status: 'all',       value: s => s.staff },
    { key: 'suspended',  label: 'Suspended',  icon: Ban,        color: 'text-red-600 dark:text-red-400', role: 'all',      status: 'suspended', value: s => s.suspended },
    { key: 'expired',    label: 'Expired',    icon: Timer,      color: 'text-muted-foreground', role: 'all',      status: 'expired',   value: s => s.expired },
]

const walletBalanceOf = (user: any): number =>
    Number(user.wallet_balance ?? (Array.isArray(user.wallets) ? user.wallets[0]?.balance : user.wallets?.balance) ?? 0)

function expiryInfo(user: any): { label: string; expired: boolean } | null {
    const raw = user.role === 'agent' ? user.agent_expires_at
        : user.role === 'dealer' ? user.dealer_expires_at : null
    if (!raw) return null
    const ms = new Date(raw).getTime() - Date.now()
    if (ms <= 0) return { label: 'Expired', expired: true }
    const days = Math.ceil(ms / 86_400_000)
    return { label: days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`, expired: false }
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [stats, setStats] = useState<UserStats | null>(null)
    const [exporting, setExporting] = useState(false)
    const [loadFailed, setLoadFailed] = useState(false)
    const listSeq = useRef(0)
    const ITEMS_PER_PAGE = 50

    // Wallet Adjustment Dialog
    const [adjustmentDialogUser, setAdjustmentDialogUser] = useState<any>(null)
    const [adjustmentAmount, setAdjustmentAmount] = useState('')
    const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit')
    const [adjustmentDescription, setAdjustmentDescription] = useState('Admin manual adjustment')
    const [isAdjusting, setIsAdjusting] = useState(false)

    // Suspension Dialog (single or bulk)
    const [suspendTargets, setSuspendTargets] = useState<any[] | null>(null)
    const [suspendPreset, setSuspendPreset] = useState<SuspendPreset>('24h')
    const [suspendCustomUntil, setSuspendCustomUntil] = useState('')
    const [suspendReason, setSuspendReason] = useState('')
    const [suspendSms, setSuspendSms] = useState(true)
    const [isSuspending, setIsSuspending] = useState(false)

    // Generic confirm dialog (replaces native confirm() — iOS-PWA safe)
    const [confirmAction, setConfirmAction] = useState<{
        title: string
        description: string
        destructive?: boolean
        confirmLabel: string
        onConfirm: () => Promise<void>
    } | null>(null)
    const [isConfirmBusy, setIsConfirmBusy] = useState(false)

    // Detail drawer
    const [detailUser, setDetailUser] = useState<any>(null)
    const [detailData, setDetailData] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailFailed, setDetailFailed] = useState(false)

    // Bulk selection
    const [selectMode, setSelectMode] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/users/stats')
            const json = await res.json()
            if (res.ok && json.stats) setStats(json.stats)
        } catch (e) {
            console.error('Stats fetch error:', e)
        }
    }, [])

    useEffect(() => { fetchStats() }, [fetchStats])

    // Fetch on filter/search change
    useEffect(() => {
        setPage(0)
        fetchUsers(0, true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, roleFilter, statusFilter])

    const fetchUsers = async (pageToFetch: number, isNewSearch = false) => {
        // Only the newest request may update the list, so a slow earlier reply cannot overwrite it.
        const seq = ++listSeq.current
        try {
            setLoading(true)
            setLoadFailed(false)
            const offset = pageToFetch * ITEMS_PER_PAGE
            const url = `/api/admin/users?limit=${ITEMS_PER_PAGE}&offset=${offset}&search=${encodeURIComponent(debouncedSearch)}&role=${roleFilter}&status=${statusFilter}`

            const response = await fetch(url)
            if (!response.ok) {
                const result = await response.json().catch(() => ({}))
                throw new Error(typeof result.error === 'string' && result.error.length < 160 ? result.error : 'We could not load users. Try again.')
            }
            const data = await response.json()
            if (seq !== listSeq.current) return

            const newUsers = data.users || []
            setUsers(prev => (isNewSearch ? newUsers : [...prev, ...newUsers]))
            setTotalCount(data.totalCount || 0)
            setHasMore(newUsers.length === ITEMS_PER_PAGE)
        } catch (error: any) {
            if (seq !== listSeq.current) return
            console.error('Error fetching users:', error)
            if (isNewSearch) { setUsers([]); setTotalCount(0); setHasMore(false) }
            setLoadFailed(true)
            toast.error(error.message || 'We could not load users. Try again.')
        } finally {
            if (seq === listSeq.current) setLoading(false)
        }
    }

    const loadMore = () => {
        if (!loading && hasMore) {
            const nextPage = page + 1
            setPage(nextPage)
            fetchUsers(nextPage)
        }
    }

    const applySegment = (seg: typeof SEGMENTS[number]) => {
        setRoleFilter(seg.role)
        setStatusFilter(seg.status)
    }
    const segmentActive = (seg: typeof SEGMENTS[number]) =>
        roleFilter === seg.role && statusFilter === seg.status

    // ── Status (suspend / activate) ──────────────────────────────────────────
    const postStatus = async (userId: string, body: Record<string, unknown>) => {
        const response = await fetch('/api/admin/users/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...body }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to update user status')
        return result
    }

    const openSuspendDialog = (targets: any[]) => {
        // Admin accounts are server-protected from suspension — drop them up front.
        const eligible = targets.filter(t => t.role !== 'admin')
        if (eligible.length === 0) { toast.error('Admin accounts cannot be suspended'); return }
        if (eligible.length < targets.length) toast.warning('Admin accounts were excluded')
        setSuspendPreset('24h')
        setSuspendCustomUntil('')
        setSuspendReason('')
        setSuspendSms(true)
        setSuspendTargets(eligible)
    }

    const submitSuspension = async () => {
        if (!suspendTargets || suspendTargets.length === 0) return

        const preset = SUSPEND_PRESETS.find(p => p.key === suspendPreset)!
        const body: Record<string, unknown> = {
            status: 'suspended',
            reason: suspendReason.trim() || undefined,
            sendSms: suspendSms,
        }
        if (suspendPreset === 'custom') {
            if (!suspendCustomUntil) { toast.error('Pick the suspension end date/time'); return }
            const d = new Date(suspendCustomUntil)
            if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
                toast.error('Suspension end must be in the future'); return
            }
            body.until = d.toISOString()
        } else if (preset.hours) {
            body.durationHours = preset.hours
        } // permanent → neither field

        setIsSuspending(true)
        let ok = 0, failed = 0
        for (const target of suspendTargets) {
            try {
                const res = await postStatus(target.id, body)
                setUsers(prev => prev.map(u => u.id === target.id
                    ? { ...u, status: 'suspended', suspended_until: res.suspended_until ?? null, suspension_reason: suspendReason.trim() || null }
                    : u))
                ok++
            } catch (e: any) {
                console.error('Suspend error:', e)
                failed++
            }
        }
        setIsSuspending(false)
        setSuspendTargets(null)
        setSelected(new Set()); setSelectMode(false)
        fetchStats()
        if (failed === 0) toast.success(ok === 1 ? 'User suspended' : `${ok} users suspended`)
        else toast.error(`${ok} suspended, ${failed} failed`)
    }

    const activateUsers = async (targets: any[]) => {
        targets = targets.filter(t => t.role !== 'admin') // server-protected anyway
        let ok = 0, failed = 0
        for (const target of targets) {
            try {
                await postStatus(target.id, { status: 'active' })
                setUsers(prev => prev.map(u => u.id === target.id
                    ? { ...u, status: 'active', suspended_until: null, suspension_reason: null }
                    : u))
                ok++
            } catch (e: any) {
                console.error('Activate error:', e)
                failed++
            }
        }
        setSelected(new Set()); setSelectMode(false)
        fetchStats()
        if (failed === 0) toast.success(ok === 1 ? 'User activated' : `${ok} users activated`)
        else toast.error(`${ok} activated, ${failed} failed`)
    }

    // ── Role change (dialog confirm) ─────────────────────────────────────────
    const requestRoleChange = (user: any, newRole: string) => {
        setConfirmAction({
            title: `Make ${user.first_name || 'user'} ${newRole}?`,
            description: `${user.first_name} ${user.last_name || ''} will immediately get ${newRole} permissions and pricing.${newRole === 'agent' ? ' The agent plan starts now.' : newRole === 'dealer' ? ' The dealer plan starts now.' : ''}`,
            confirmLabel: `Make ${newRole}`,
            onConfirm: async () => {
                const response = await fetch('/api/admin/users/role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, role: newRole }),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Failed to update user role')
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
                fetchStats()
                toast.success(`Role updated to ${newRole}`)
            },
        })
    }

    // ── Wallet adjustment ────────────────────────────────────────────────────
    const handleManualAdjustment = async () => {
        if (!adjustmentDialogUser || !adjustmentAmount) return
        const amount = parseFloat(adjustmentAmount)
        if (isNaN(amount) || amount <= 0) { toast.error('Invalid amount'); return }

        setIsAdjusting(true)
        try {
            const response = await fetch('/api/admin/users/wallet/adjustment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: adjustmentDialogUser.id,
                    amount,
                    type: adjustmentType,
                    description: adjustmentDescription,
                }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to adjust wallet')

            toast.success(`Wallet ${adjustmentType === 'credit' ? 'credited' : 'debited'} successfully`)
            setUsers(prev => prev.map(u => u.id === adjustmentDialogUser.id
                ? { ...u, wallet_balance: result.newBalance, wallets: { balance: result.newBalance } }
                : u))
            setAdjustmentDialogUser(null)
            setAdjustmentAmount('')
        } catch (error: any) {
            console.error('Adjustment error:', error)
            toast.error(error.message || `Failed to ${adjustmentType} wallet`)
        } finally {
            setIsAdjusting(false)
        }
    }

    // ── Reset password / delete (dialog confirm) ─────────────────────────────
    const requestResetPassword = (user: any) => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'this user'
        setConfirmAction({
            title: 'Send password reset email?',
            description: `${name} will receive an email with a link to set a new password.`,
            confirmLabel: 'Send reset email',
            onConfirm: async () => {
                const response = await fetch('/api/admin/users/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id }),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Failed to send reset email')
                toast.success(`Password reset email sent to ${name}`)
            },
        })
    }

    const requestDelete = (user: any) => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'this user'
        setConfirmAction({
            title: `Delete ${name} for good?`,
            description: 'This removes the account, wallet, orders and history for good. It cannot be undone.',
            destructive: true,
            confirmLabel: 'Delete for good',
            onConfirm: async () => {
                const response = await fetch('/api/admin/users/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id }),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Failed to delete user')
                setUsers(prev => prev.filter(u => u.id !== user.id))
                fetchStats()
                toast.success('User deleted')
            },
        })
    }

    const runConfirm = async () => {
        if (!confirmAction) return
        setIsConfirmBusy(true)
        try {
            await confirmAction.onConfirm()
            setConfirmAction(null)
        } catch (e: any) {
            toast.error(e.message || 'Action failed')
        } finally {
            setIsConfirmBusy(false)
        }
    }

    // ── Detail drawer ────────────────────────────────────────────────────────
    const openDetail = async (user: any) => {
        setDetailUser(user)
        setDetailData(null)
        setDetailLoading(true)
        setDetailFailed(false)
        try {
            const res = await fetch(`/api/admin/users/${user.id}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to load details')
            setDetailData(json)
        } catch (e: any) {
            setDetailFailed(true)
            toast.error(e.message || 'We could not load this user. Try again.')
        } finally {
            setDetailLoading(false)
        }
    }

    // ── Bulk selection helpers ───────────────────────────────────────────────
    const toggleSelected = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const selectedUsers = users.filter(u => selected.has(u.id))

    // ── Export (ALL matching, not just loaded pages) ─────────────────────────
    const exportContacts = async () => {
        setExporting(true)
        try {
            const url = `/api/admin/users?all=true&search=${encodeURIComponent(debouncedSearch)}&role=${roleFilter}&status=${statusFilter}`
            const res = await fetch(url)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Export fetch failed')

            const source: any[] = selectMode && selected.size > 0 ? selectedUsers : (json.users || [])
            const usersWithPhones = source.filter(u => u.phone_number)
            if (usersWithPhones.length === 0) { toast.error('None of these users have a phone number to export.'); return }

            const rows = usersWithPhones.map(user => ({
                firstname: user.first_name || 'Unknown',
                lastname: user.last_name || '',
                phone: user.phone_number,
                email: user.email || '',
                date_of_birth: '',
            }))

            const worksheet = XLSX.utils.json_to_sheet(rows, {
                header: ['firstname', 'lastname', 'phone', 'email', 'date_of_birth'],
            })
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')
            const timestamp = new Date().toISOString().split('T')[0]
            XLSX.writeFile(workbook, `contacts_${timestamp}.xlsx`)
            toast.success(`Exported ${rows.length} contacts`)
        } catch (error: any) {
            console.error('Export error:', error)
            toast.error(error.message || 'Failed to export contacts')
        } finally {
            setExporting(false)
        }
    }

    const suspensionLabel = (user: any) => {
        if (user.status !== 'suspended') return null
        if (!user.suspended_until) return 'Suspended · permanent'
        const d = new Date(user.suspended_until)
        if (d.getTime() <= Date.now()) return 'Suspension elapsed — reactivating soon'
        return `Suspended until ${d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
    }

    return (
        <div className="space-y-5 pb-24">
            {/* Header + search + filters */}
            <div className="flex flex-col gap-3 sticky top-0 z-30 border-b border-border bg-[var(--neu-bg)]/95 py-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Users</h1>
                        <p className="text-sm text-muted-foreground">{totalCount} matching account{totalCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={selectMode ? 'default' : 'outline'}
                            onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }}
                            className="gap-2 rounded-xl"
                        >
                            <ListChecks className="w-4 h-4" />
                            {selectMode ? 'Done' : 'Select'}
                        </Button>
                        <Button
                            onClick={exportContacts}
                            disabled={exporting}
                            variant="outline"
                            className="gap-2 rounded-xl"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {selectMode && selected.size > 0 ? `Export ${selected.size} selected` : 'Export contacts'}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        <label htmlFor="user-search" className="sr-only">Search users</label>
                        <Input
                            id="user-search"
                            name="user-search"
                            placeholder="Search by name, email or phone"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="neu-inset rounded-xl border-0 pl-9 shadow-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:flex gap-2">
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="sm:w-40 neu-inset rounded-xl border-0 shadow-none focus:ring-2 focus:ring-black dark:focus:ring-brand-500">
                                <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All roles</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="sub-admin">Sub-admin</SelectItem>
                                <SelectItem value="dealer">Dealer</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="subagent">Subagent</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="sm:w-40 neu-inset rounded-xl border-0 shadow-none focus:ring-2 focus:ring-black dark:focus:ring-brand-500">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                                <SelectItem value="expired">Expired role</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Stats / filter cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
                {SEGMENTS.map(seg => {
                    const Icon = seg.icon
                    const active = segmentActive(seg)
                    return (
                        <button
                            key={seg.key}
                            type="button"
                            onClick={() => applySegment(seg)}
                            aria-pressed={active}
                            className={cn(
                                'rounded-2xl p-3 text-left',
                                active ? 'neu-inset' : 'neu-raised-sm neu-press',
                                FOCUS,
                            )}
                        >
                            <Icon className={cn('w-4 h-4 mb-1.5', seg.color)} aria-hidden="true" />
                            <p className="font-display text-xl font-bold leading-none">{stats ? seg.value(stats) : '—'}</p>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">{seg.label}</p>
                            {seg.sub && stats && (
                                <p className="text-[10px] text-muted-foreground/70 truncate">{seg.sub(stats)}</p>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            {loading && users.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-label="Loading users" />
                </div>
            ) : loadFailed && users.length === 0 ? (
                <div className="mx-auto max-w-sm space-y-3 py-16 text-center">
                    <Notice>We could not load users.</Notice>
                    <Button variant="outline" onClick={() => fetchUsers(0, true)}>Try again</Button>
                </div>
            ) : users.length === 0 ? (
                <div className="neu-inset mx-auto max-w-md rounded-3xl p-8 text-center">
                    <p className="font-semibold">No users found</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try a different name, email or number, or clear the filters.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {users.map((user) => {
                            const expiry = expiryInfo(user)
                            const suspText = suspensionLabel(user)
                            const isSelected = selected.has(user.id)
                            return (
                                <Card
                                    key={user.id}
                                    className={cn(
                                        'group relative overflow-hidden rounded-[2rem] border-0',
                                        isSelected ? 'neu-inset ring-2 ring-brand-500' : 'neu-raised'
                                    )}
                                >
                                    {selectMode && (
                                        <button
                                            className="absolute inset-0 z-20 cursor-pointer"
                                            aria-label={isSelected ? 'Deselect user' : 'Select user'}
                                            onClick={() => toggleSelected(user.id)}
                                        />
                                    )}
                                    {selectMode && (
                                        <div className="absolute top-3 left-3 z-30 pointer-events-none">
                                            <Checkbox checked={isSelected} className="h-5 w-5 bg-background" />
                                        </div>
                                    )}
                                    <CardContent className="p-5 space-y-4">
                                        {/* Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3 items-center min-w-0">
                                                <RoleAvatar role={(user.role || 'customer') as UserRole} first={user.first_name} last={user.last_name} />
                                                <div className="min-w-0">
                                                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground line-clamp-1">
                                                        {user.first_name} {user.last_name}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        {(() => {
                                                            const userRole = (user.role || 'customer') as UserRole
                                                            const config = roleConfig[userRole] || roleConfig['customer']
                                                            return (
                                                                <Badge
                                                                    className={cn('border-0', userRole === 'sub-admin' ? 'text-black' : 'text-white')}
                                                                    style={{ backgroundColor: config.color }}
                                                                >
                                                                    {config.label}
                                                                </Badge>
                                                            )
                                                        })()}
                                                        <span className="neu-inset inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                                            <span className={cn('h-1.5 w-1.5 rounded-full', user.status === 'active' ? 'bg-emerald-500' : user.status === 'suspended' ? 'bg-red-500' : 'bg-silver-200')} aria-hidden="true" />
                                                            {user.status === 'active' ? 'Active' : user.status === 'suspended' ? 'Suspended' : String(user.status || 'Unknown')}
                                                        </span>
                                                        {expiry && (
                                                            <span className={cn(
                                                                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                                                expiry.expired
                                                                    ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                                                                    : 'bg-muted text-muted-foreground'
                                                            )}>
                                                                {expiry.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label={`Actions for ${user.first_name || 'user'} ${user.last_name || ''}`.trim()} className="h-10 w-10 relative z-30 text-muted-foreground hover:text-foreground rounded-full">
                                                        <MoreVertical className="w-5 h-5" aria-hidden="true" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => openDetail(user)}>
                                                        <Eye className="w-4 h-4 mr-2" />
                                                        View details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setAdjustmentDialogUser(user)
                                                        setAdjustmentType('credit')
                                                        setAdjustmentDescription('Admin manual credit')
                                                    }}>
                                                        <Wallet className="w-4 h-4 mr-2" />
                                                        Credit wallet
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setAdjustmentDialogUser(user)
                                                        setAdjustmentType('debit')
                                                        setAdjustmentDescription('Admin manual debit')
                                                    }}>
                                                        <Wallet className="w-4 h-4 mr-2" />
                                                        Debit wallet
                                                    </DropdownMenuItem>
                                                    {/* Admin accounts can't be suspended/demoted/deleted (server-enforced lockout protection) */}
                                                    {user.role !== 'admin' && (user.status === 'suspended' ? (
                                                        <DropdownMenuItem onClick={() => activateUsers([user])}>
                                                            <CheckCircle className="w-4 h-4 mr-2" />
                                                            Activate account
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => openSuspendDialog([user])}>
                                                            <Ban className="w-4 h-4 mr-2" />
                                                            Suspend account…
                                                        </DropdownMenuItem>
                                                    ))}
                                                    {user.role !== 'admin' && (
                                                        <>
                                                            <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">Change role</DropdownMenuLabel>
                                                            {(['customer', 'agent', 'dealer', 'sub-admin', 'admin'] as const)
                                                                .filter(r => r !== user.role)
                                                                .map(r => (
                                                                    <DropdownMenuItem key={r} onClick={() => requestRoleChange(user, r)}>
                                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: roleConfig[r].color }} />
                                                                        Make {roleConfig[r].label}
                                                                    </DropdownMenuItem>
                                                                ))}
                                                        </>
                                                    )}
                                                    <div className="h-px bg-border my-1" />
                                                    <DropdownMenuItem
                                                        onClick={() => requestResetPassword(user)}
                                                        
                                                    >
                                                        <KeyRound className="w-4 h-4 mr-2" />
                                                        Reset password
                                                    </DropdownMenuItem>
                                                    {user.role !== 'admin' && (
                                                        <>
                                                            <div className="h-px bg-border my-1" />
                                                            <DropdownMenuItem
                                                                onClick={() => requestDelete(user)}
                                                                className="text-red-600 focus:text-red-700 focus:bg-red-500/10 dark:text-red-400"
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Delete user
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Suspension banner */}
                                        {suspText && (
                                            <div className="neu-inset rounded-2xl px-3 py-2">
                                                <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                                                    <Hourglass className="w-3.5 h-3.5 flex-shrink-0" />
                                                    {suspText}
                                                </p>
                                                {user.suspension_reason && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                                        Reason: {user.suspension_reason}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Details */}
                                        <div className="space-y-2">
                                            <div className="neu-inset flex items-center gap-2.5 text-muted-foreground p-2.5 rounded-xl">
                                                <Mail className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                                                <span className="truncate text-sm font-medium">{user.email}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="neu-inset flex items-center gap-2.5 text-muted-foreground p-2.5 rounded-xl">
                                                    <Phone className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                                                    <span className="text-sm font-medium truncate">{user.phone_number || 'N/A'}</span>
                                                </div>
                                                <div className="neu-inset flex items-center gap-2.5 text-muted-foreground p-2.5 rounded-xl">
                                                    <Calendar className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                                                    <span className="text-sm font-medium truncate">{formatDate(user.created_at).split(',')[0]}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Wallet */}
                                        <div className="pt-1 flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-muted-foreground mb-0.5">Wallet balance</span>
                                                <span className="font-display text-xl font-bold tracking-tight text-foreground">
                                                    {formatCurrency(walletBalanceOf(user))}
                                                </span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9 px-3 rounded-xl relative z-30"
                                                onClick={() => openDetail(user)}
                                            >
                                                <Eye className="w-4 h-4 mr-1.5" />
                                                Details
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                    {hasMore && (
                        <div className="flex justify-center py-8">
                            <Button
                                onClick={loadMore}
                                disabled={loading}
                                variant="outline"
                                className="min-w-[200px] rounded-xl"
                            >
                                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Load more ({users.length} of {totalCount})
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Bulk action bar */}
            {selectMode && selected.size > 0 && (
                <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 neu-night rounded-2xl px-4 py-3 text-white">
                    <span className="text-sm font-bold whitespace-nowrap">{selected.size} selected</span>
                    <Button size="sm" variant="destructive" className="h-8 rounded-lg" onClick={() => openSuspendDialog(selectedUsers)}>
                        <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend
                    </Button>
                    <Button size="sm" className="h-8 rounded-lg" onClick={() => activateUsers(selectedUsers)}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Activate
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Clear selection" className="h-8 rounded-lg text-white hover:text-white" onClick={() => setSelected(new Set())}>
                        <X className="w-4 h-4" aria-hidden="true" />
                    </Button>
                </div>
            )}

            {/* Wallet Adjustment Dialog */}
            <Dialog open={!!adjustmentDialogUser} onOpenChange={() => setAdjustmentDialogUser(null)}>
                <DialogContent className="rounded-[2rem]" aria-describedby="adjustment-description">
                    <DialogHeader>
                        <DialogTitle>{adjustmentType === 'credit' ? 'Credit' : 'Debit'} wallet</DialogTitle>
                        <DialogDescription id="adjustment-description">
                            {adjustmentType === 'credit' ? 'Add funds to' : 'Deduct funds from'} {adjustmentDialogUser?.first_name} {adjustmentDialogUser?.last_name}&apos;s wallet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="adjustment-type">Adjustment type</Label>
                            <Select
                                value={adjustmentType}
                                onValueChange={(value: 'credit' | 'debit') => setAdjustmentType(value)}
                            >
                                <SelectTrigger id="adjustment-type" name="adjustment-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="credit">Credit (+)</SelectItem>
                                    <SelectItem value="debit">Debit (-)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adjustment-amount">Amount (GH₵)</Label>
                            <Input
                                id="adjustment-amount"
                                name="adjustment-amount"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adjustment-description-input">Description</Label>
                            <Input
                                id="adjustment-description-input"
                                name="adjustment-description"
                                value={adjustmentDescription}
                                onChange={(e) => setAdjustmentDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdjustmentDialogUser(null)}>Cancel</Button>
                        <Button
                            variant={adjustmentType === 'debit' ? 'destructive' : 'default'}
                            onClick={handleManualAdjustment}
                            disabled={isAdjusting}
                        >
                            {isAdjusting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {adjustmentType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Suspension Dialog (single + bulk) */}
            <Dialog open={!!suspendTargets} onOpenChange={(open) => { if (!open) setSuspendTargets(null) }}>
                <DialogContent className="rounded-[2rem]" aria-describedby="suspend-description">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ban className="w-5 h-5" aria-hidden="true" />
                            Suspend {suspendTargets?.length === 1
                                ? `${suspendTargets[0].first_name || ''} ${suspendTargets[0].last_name || ''}`.trim() || 'user'
                                : `${suspendTargets?.length ?? 0} users`}
                        </DialogTitle>
                        <DialogDescription id="suspend-description">
                            Suspended users cannot use their dashboard until the suspension ends or an admin reactivates them.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>How long</Label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                                {SUSPEND_PRESETS.map(p => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => setSuspendPreset(p.key)}
                                        className={cn(
                                            'px-2 py-2 text-xs font-semibold rounded-xl border transition-all',
                                            FOCUS,
                                            suspendPreset === p.key
                                                ? 'clay-black border-transparent'
                                                : 'neu-raised-sm border-transparent'
                                        )}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            {suspendPreset === 'permanent' && (
                                <p className="text-[11px] text-red-600 dark:text-red-400">
                                    Permanent. The account stays suspended until an admin reactivates it.
                                </p>
                            )}
                        </div>
                        {suspendPreset === 'custom' && (
                            <div className="space-y-2">
                                <Label>Suspend until</Label>
                                <Input
                                    type="datetime-local"
                                    value={suspendCustomUntil}
                                    onChange={(e) => setSuspendCustomUntil(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="suspend-reason">Reason (the user will see this)</Label>
                            <Textarea
                                id="suspend-reason"
                                rows={2}
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="e.g. Suspicious activity on the account"
                            />
                        </div>
                        <div className="neu-inset flex items-center justify-between rounded-2xl p-3">
                            <div>
                                <p className="text-sm font-medium flex items-center gap-1.5">
                                    <MessageSquare className="w-4 h-4" aria-hidden="true" /> SMS alert
                                </p>
                                <p className="text-[11px] text-muted-foreground">Text the user that their account is suspended, and until when. Sends once SMS is set up.</p>
                            </div>
                            <Switch checked={suspendSms} onCheckedChange={setSuspendSms} aria-label="Send an SMS alert" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSuspendTargets(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={submitSuspension}
                            disabled={isSuspending}
                        >
                            {isSuspending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                            Suspend {suspendTargets && suspendTargets.length > 1 ? `${suspendTargets.length} users` : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Generic confirm dialog */}
            <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open && !isConfirmBusy) setConfirmAction(null) }}>
                <DialogContent className="rounded-[2rem]" aria-describedby="confirm-description">
                    <DialogHeader>
                        <DialogTitle>{confirmAction?.title}</DialogTitle>
                        <DialogDescription id="confirm-description">{confirmAction?.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" disabled={isConfirmBusy} onClick={() => setConfirmAction(null)}>Cancel</Button>
                        <Button
                            variant={confirmAction?.destructive ? 'destructive' : 'default'}
                            onClick={runConfirm}
                            disabled={isConfirmBusy}
                        >
                            {isConfirmBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {confirmAction?.confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail drawer */}
            <Sheet open={!!detailUser} onOpenChange={(open) => { if (!open) { setDetailUser(null); setDetailData(null); setDetailFailed(false) } }}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{detailUser?.first_name} {detailUser?.last_name}</SheetTitle>
                        <SheetDescription>{detailUser?.email}</SheetDescription>
                    </SheetHeader>
                    {detailLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : detailFailed ? (
                        <div className="mt-5 space-y-3">
                            <Notice>We could not load this user.</Notice>
                            <Button variant="outline" onClick={() => detailUser && openDetail(detailUser)}>Try again</Button>
                        </div>
                    ) : detailData ? (
                        <div className="space-y-5 mt-5">
                            {/* Profile chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {(() => {
                                    const r = (detailData.user.role || 'customer') as UserRole
                                    const c = roleConfig[r] || roleConfig.customer
                                    return <Badge className={cn('border-0', r === 'sub-admin' ? 'text-black' : 'text-white')} style={{ backgroundColor: c.color }}>{c.label}</Badge>
                                })()}
                                <Badge variant="outline" className={detailData.user.status === 'active' ? '' : 'text-red-600 border-red-300 dark:text-red-400'}>
                                    {detailData.user.status === 'active' ? 'Active' : detailData.user.status === 'suspended' ? 'Suspended' : detailData.user.status}
                                </Badge>
                            </div>

                            {detailData.user.status === 'suspended' && (
                                <div className="rounded-lg bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/50 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
                                    {detailData.user.suspended_until
                                        ? `Suspended until ${new Date(detailData.user.suspended_until).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
                                        : 'Suspended — permanent'}
                                    {detailData.user.suspension_reason && <div className="mt-0.5 opacity-80">Reason: {detailData.user.suspension_reason}</div>}
                                </div>
                            )}

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: 'Orders', value: detailData.stats.totalOrders, icon: ClipboardList, color: 'text-muted-foreground' },
                                    { label: 'Completed', value: detailData.stats.completedOrders, icon: CheckCircle2, color: 'text-muted-foreground' },
                                    { label: 'Total Spent', value: formatCurrency(detailData.stats.totalSpent), icon: Wallet, color: 'text-muted-foreground' },
                                    { label: 'Wallet', value: formatCurrency(detailData.stats.walletBalance), icon: Wallet, color: 'text-muted-foreground' },
                                    { label: 'Complaints', value: detailData.stats.complaints, icon: MessageSquare, color: 'text-red-600' },
                                    { label: 'Shop', value: detailData.stats.hasShop ? (detailData.stats.shopName || 'Yes') : '—', icon: Store, color: 'text-muted-foreground' },
                                    { label: 'Recruited By', value: detailData.stats.recruitedBy || '—', icon: UsersIcon, color: 'text-muted-foreground' },
                                ].map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <div key={item.label} className="neu-inset rounded-2xl p-3">
                                            <Icon className={cn('w-4 h-4 mb-1', item.color)} />
                                            <p className="text-base font-bold leading-tight truncate">{item.value}</p>
                                            <p className="text-[11px] text-muted-foreground">{item.label}</p>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Profile facts */}
                            <div className="space-y-1.5 text-sm">
                                <p className="flex justify-between gap-2"><span className="text-muted-foreground">Phone</span><span className="font-medium">{detailData.user.phone_number || 'N/A'}</span></p>
                                <p className="flex justify-between gap-2"><span className="text-muted-foreground">Joined</span><span className="font-medium">{formatDate(detailData.user.created_at)}</span></p>
                                {detailData.user.agent_expires_at && (
                                    <p className="flex justify-between gap-2"><span className="text-muted-foreground">Agent expires</span><span className="font-medium">{formatDate(detailData.user.agent_expires_at)}</span></p>
                                )}
                                {detailData.user.dealer_expires_at && (
                                    <p className="flex justify-between gap-2"><span className="text-muted-foreground">Dealer expires</span><span className="font-medium">{formatDate(detailData.user.dealer_expires_at)}</span></p>
                                )}
                            </div>

                            {/* Recent transactions */}
                            <div>
                                <p className="mb-2 text-xs font-semibold text-muted-foreground">Recent wallet activity</p>
                                {detailData.recentTransactions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No wallet transactions.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {detailData.recentTransactions.map((tx: any) => (
                                            <div key={tx.id} className="neu-inset flex items-center justify-between gap-2 rounded-2xl px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium truncate">{tx.description || tx.source}</p>
                                                    <p className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                                                </div>
                                                <span className={cn('text-sm font-bold flex-shrink-0', tx.type === 'credit' ? 'text-foreground' : 'text-red-600 dark:text-red-400')}>
                                                    {tx.type === 'credit' ? '+' : '−'}{formatCurrency(Number(tx.amount) || 0)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    )
}
