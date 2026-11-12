import {
    Bell, ShoppingCart, CreditCard, MessageSquare, Wallet, Shield,
    PartyPopper, Megaphone, Settings,
} from 'lucide-react'

// Shared notification icon + background by `type`. Used by both the bell modal
// and the full notifications page so the visual language never drifts.
export function NotifIcon({ type }: { type: string }) {
    switch (type) {
        case 'order_update':       return <ShoppingCart className="w-4 h-4" />
        case 'payment_success':    return <CreditCard className="w-4 h-4" />
        case 'complaint_resolved': return <MessageSquare className="w-4 h-4" />
        case 'balance_updated':    return <Wallet className="w-4 h-4" />
        case 'role_upgrade':       return <Shield className="w-4 h-4" />
        case 'welcome':            return <PartyPopper className="w-4 h-4" />
        case 'announcement':       return <Megaphone className="w-4 h-4" />
        case 'system':             return <Settings className="w-4 h-4 text-muted-foreground" />
        default:                   return <Bell className="w-4 h-4 text-muted-foreground" />
    }
}

// Clay accent per type — the icon bubble itself carries the color via the
// clay-* modifier (which also sets a readable icon color), instead of a flat
// tinted background.
export function iconBg(type: string): string {
    switch (type) {
        case 'order_update':       return 'clay-blue'
        case 'payment_success':    return 'clay-green'
        case 'complaint_resolved': return 'clay-purple'
        case 'balance_updated':    return 'clay-gold'
        case 'role_upgrade':       return 'clay-purple'
        case 'welcome':            return 'clay-orange'
        case 'announcement':       return 'clay-blue'
        case 'system':             return 'neu-inset'
        default:                  return 'neu-inset'
    }
}
