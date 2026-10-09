import Link from 'next/link'
import { BadgeCheck, FileText, LifeBuoy, Package, Phone, ShoppingCart, Store, UserPlus, Wallet, type LucideIcon } from 'lucide-react'

interface Action {
    label: string
    hint: string
    href: string
    Icon: LucideIcon
    /** Element ids the guided tour points at; kept so existing tours still find their targets. */
    id?: string
}

const ACTIONS: Action[] = [
    { label: 'Buy data', hint: 'MTN, Telecel, AirtelTigo', href: '/dashboard/data-packages', Icon: Package, id: 'data-packages' },
    { label: 'Airtime', hint: 'Top up any line', href: '/dashboard/airtime', Icon: Phone },
    { label: 'Results checker', hint: 'WAEC vouchers', href: '/dashboard/results-checker', Icon: FileText },
    { label: 'AFA', hint: 'Register or renew', href: '/dashboard/afa-orders', Icon: BadgeCheck },
    { label: 'Top up', hint: 'Fund your wallet', href: '/dashboard/wallet', Icon: Wallet },
    { label: 'Orders', hint: 'Track and retry', href: '/dashboard/my-orders', Icon: ShoppingCart, id: 'order-history' },
    { label: 'My store', hint: 'Sell under your brand', href: '/dashboard/shop', Icon: Store },
    { label: 'Support', hint: 'Complaints and help', href: '/dashboard/complaints', Icon: LifeBuoy, id: 'complaint-button' },
]

export function QuickActions({ canRecruit }: { canRecruit: boolean }) {
    const actions = canRecruit
        ? [...ACTIONS.slice(0, 7), { label: 'Sub-agents', hint: 'Grow your network', href: '/dashboard/recruit', Icon: UserPlus }]
        : ACTIONS

    return (
        <section aria-label="Quick actions">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {actions.map(({ label, hint, href, Icon, id }) => (
                    <li key={href}>
                        <Link
                            id={id}
                            href={href}
                            className="neu-raised-sm neu-press group flex h-full items-center gap-3 rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <span className="neu-inset flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 transition-colors group-hover:text-brand-600 dark:text-brand-500">
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{label}</span>
                                <span className="hidden truncate text-xs text-muted-foreground sm:block">{hint}</span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
