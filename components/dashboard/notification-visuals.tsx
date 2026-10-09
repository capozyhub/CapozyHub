import {
    Bell, ShoppingCart, CreditCard, MessageSquare, Wallet, Shield,
    PartyPopper, Megaphone, Settings,
} from 'lucide-react'

// Shared notification icon + background by `type`. Used by both the bell modal
// and the full notifications page so the visual language never drifts.
export function NotifIcon({ type }: { type: string }) {
    switch (type) {
        case 'order_update':       return <ShoppingCart className="w-4 h-4 text-brand-700" />
        case 'payment_success':    return <CreditCard className="w-4 h-4 text-green-500" />
        case 'complaint_resolved': return <MessageSquare className="w-4 h-4 text-purple-500" />
        case 'balance_updated':    return <Wallet className="w-4 h-4 text-amber-500" />
        case 'role_upgrade':       return <Shield className="w-4 h-4 text-violet-500" />
        case 'welcome':            return <PartyPopper className="w-4 h-4 text-pink-500" />
        case 'announcement':       return <Megaphone className="w-4 h-4 text-brand-700" />
        case 'system':             return <Settings className="w-4 h-4 text-muted-foreground" />
        default:                   return <Bell className="w-4 h-4 text-muted-foreground" />
    }
}

export function iconBg(type: string): string {
    switch (type) {
        case 'order_update':       return 'bg-brand-100 dark:bg-brand-900/30'
        case 'payment_success':    return 'bg-green-100 dark:bg-green-900/30'
        case 'complaint_resolved': return 'bg-purple-100 dark:bg-purple-900/30'
        case 'balance_updated':    return 'bg-amber-100 dark:bg-amber-900/30'
        case 'role_upgrade':       return 'bg-violet-100 dark:bg-violet-900/30'
        case 'welcome':            return 'bg-pink-100 dark:bg-pink-900/30'
        case 'announcement':       return 'bg-brand-100 dark:bg-brand-900/30'
        case 'system':             return 'bg-muted'
        default:                   return 'bg-muted'
    }
}
