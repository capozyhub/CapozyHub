'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Loader2, ArrowUpDown, Eye, Wallet, TrendingUp, TrendingDown, Users, Shield, User } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast'

export default function AdminFinancePage() {
    const router = useRouter()
    const [users, setUsers] = useState<any[]>([])
    const [stats, setStats] = useState<any>({ totalBalance: 0, totalCredited: 0, totalSpent: 0 })
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [sortBy, setSortBy] = useState('balance')
    const [sortOrder, setSortOrder] = useState('desc')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [roleFilter, setRoleFilter] = useState('all')
    const [loadFailed, setLoadFailed] = useState(false)
    const usersSeq = useRef(0)
    const statsSeq = useRef(0)
    const ITEMS_PER_PAGE = 20

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
            setPage(0)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Fetch data
    useEffect(() => {
        fetchUsers()
        fetchStats()
    }, [debouncedSearch, sortBy, sortOrder, page, roleFilter])

    const fetchStats = async () => {
        const seq = ++statsSeq.current
        try {
            const queryParams = new URLSearchParams()
            if (roleFilter !== 'all') queryParams.append('role', roleFilter)

            const response = await fetch(`/api/admin/finance/stats?${queryParams}`)
            if (!response.ok) throw new Error('Failed to fetch stats')
            const data = await response.json()
            if (seq === statsSeq.current) setStats(data)
        } catch (error) {
            console.error('Stats Error:', error)
        }
    }

    const fetchUsers = async () => {
        const seq = ++usersSeq.current
        try {
            setLoading(true)
            setLoadFailed(false)
            const offset = page * ITEMS_PER_PAGE
            const queryParams = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: offset.toString(),
                sort: sortBy,
                order: sortOrder,
                search: debouncedSearch
            })

            if (roleFilter !== 'all') queryParams.append('role', roleFilter)

            const response = await fetch(`/api/admin/finance/users?${queryParams}`)
            if (!response.ok) throw new Error('Failed to fetch data')
            const data = await response.json()
            if (seq !== usersSeq.current) return

            setUsers(data.users || [])
            setTotalCount(data.totalCount || 0)
        } catch (error) {
            if (seq === usersSeq.current) setLoadFailed(true)
        } finally {
            if (seq === usersSeq.current) setLoading(false)
        }
    }

    const handleSort = (column: string) => {
        setPage(0)
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        return sortOrder === 'asc'
            ? <TrendingUp className="ml-2 h-4 w-4 text-primary" />
            : <TrendingDown className="ml-2 h-4 w-4 text-primary" />
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
                        Wallet balances
                    </h1>
                    <p className="text-muted-foreground">
                        See what each user holds in their wallet and open their transaction history.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-[180px]">
                        <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(0) }}>
                            <SelectTrigger aria-label="Filter by role">
                                <SelectValue placeholder="All roles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All roles</SelectItem>
                                <SelectItem value="dealer">Dealers</SelectItem>
                                <SelectItem value="customer">Customers</SelectItem>
                                <SelectItem value="agent">Agents</SelectItem>
                                <SelectItem value="admin">Admins</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Big Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <Card className="neu-raised-sm border-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Money held in wallets
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCurrency(stats.totalBalance)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across {stats.count || 0} users
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-0">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                aria-label="Search users" placeholder="Search by name, phone or email…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
                                const [col, ord] = val.split('-')
                                setSortBy(col)
                                setSortOrder(ord)
                                setPage(0)
                            }}>
                                <SelectTrigger className="w-[180px]" aria-label="Sort by">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="balance-desc">Highest balance</SelectItem>
                                    <SelectItem value="balance-asc">Lowest balance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[300px]">User</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted transition-colors text-right"
                                        onClick={() => handleSort('balance')}
                                    >
                                        <div className="flex justify-end items-center">
                                            Balance
                                            <SortIcon column="balance" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            <div className="flex justify-center items-center gap-2 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading balances…
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : loadFailed ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center" role="alert">
                                            <p className="text-sm text-foreground">Could not load the balances.</p>
                                            <Button size="sm" variant="outline" className="mt-2" onClick={() => { fetchUsers(); fetchStats() }}>Try again</Button>
                                        </TableCell>
                                    </TableRow>
                                ) : loadFailed ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center" role="alert">
                                            <p className="text-sm text-foreground">Could not load the balances.</p>
                                            <Button size="sm" variant="outline" className="mt-2" onClick={() => { fetchUsers(); fetchStats() }}>Try again</Button>
                                        </TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No users match this search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-muted/50 dark:hover:bg-card/50 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed user'}</span>
                                                    <span className="text-xs text-muted-foreground">{user.phone_number}</span>
                                                    <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-bold text-lg text-foreground">
                                                    {formatCurrency(user.wallet_balance)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className=""
                                                    onClick={() => router.push(`/admin/finance/${user.id}`)}
                                                >
                                                    View history
                                                    <Eye className="w-4 h-4 ml-2" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                    Showing {users.length} of {totalCount} users
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * ITEMS_PER_PAGE >= totalCount || loading}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
