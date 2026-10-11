'use client'

import { ArrowDownLeft, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { WalletTransaction } from '@/types/supabase'

export function TransactionsList({ transactions }: { transactions: WalletTransaction[] }) {
    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No top-ups yet</p>
            </div>
        )
    }

    return (
        <ul className="space-y-2.5">
            {transactions.map(txn => (
                <li key={txn.id} className="surface flex items-center gap-3 rounded-2xl p-4">
                    <span className="well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                        <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(txn.created_at ?? '')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="font-display text-sm font-bold tabular-nums text-emerald-600">+{formatCurrency(txn.amount)}</p>
                        <Badge variant={txn.status === 'completed' ? 'completed' : 'pending'} className="mt-0.5 text-[10px]">{txn.status}</Badge>
                    </div>
                </li>
            ))}
        </ul>
    )
}
