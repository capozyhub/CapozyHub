import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Wallet,
    User,
    MessageSquare,
    Bell,
    Send,
    Users,
    Settings,
    Shield,
    Crown,
    BadgeCheck,
    Activity,
    Banknote,
    Store,
    Tag,
    Phone,
    FileText,
    Code2,
    Key,
    CreditCard,
    Hourglass,
    ListChecks,
    Percent,
    UserPlus,
    type LucideIcon,
} from 'lucide-react'

export interface NavItem {
    href: string
    label: string
    icon: LucideIcon
}

export interface NavGroup {
    id: string
    /** Sentence-case heading. Omitted for the first group so the menu starts clean. */
    label?: string
    items: NavItem[]
}

/**
 * Member menu, grouped by what people come here to do. Role rules (who sees Sub-Agents,
 * Role Upgrade) and admin page switches are applied by the sidebar, not here.
 */
export const userNavGroups: NavGroup[] = [
    {
        id: 'home',
        items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
        id: 'buy',
        label: 'Buy',
        items: [
            { href: '/dashboard/data-packages', label: 'Data Bundles', icon: Package },
            { href: '/dashboard/airtime', label: 'Airtime & Mashup', icon: Phone },
            { href: '/dashboard/results-checker', label: 'Results Checker', icon: FileText },
            { href: '/dashboard/afa-orders', label: 'AFA Registration', icon: BadgeCheck },
        ],
    },
    {
        id: 'money',
        label: 'Money',
        items: [
            { href: '/dashboard/wallet', label: 'Top Up Wallet', icon: Wallet },
            { href: '/dashboard/commission', label: 'Commission Wallet', icon: Percent },
            { href: '/dashboard/transactions', label: 'My Activities', icon: Activity },
            { href: '/dashboard/my-orders', label: 'Order History', icon: ShoppingCart },
        ],
    },
    {
        id: 'grow',
        label: 'Grow',
        items: [
            { href: '/dashboard/recruit', label: 'Sub-Agents', icon: UserPlus },
            { href: '/dashboard/upgrade', label: 'Role Upgrade', icon: Crown },
            { href: '/dashboard/api', label: 'Developer API', icon: Code2 },
        ],
    },
    {
        id: 'account',
        label: 'Account',
        items: [
            { href: '/dashboard/complaints', label: 'Support & Complaints', icon: MessageSquare },
            { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
            { href: '/dashboard/profile', label: 'My Profile', icon: User },
        ],
    },
]

export const userNavItems: NavItem[] = userNavGroups.flatMap(g => g.items)

/** Storefront pages, shown under "My Store" once the member has a shop. */
export const shopMenuItems: NavItem[] = [
    { href: '/dashboard/shop', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/shop/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/shop/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/shop/profit-logs', label: 'Profit Logs', icon: Activity },
    { href: '/dashboard/shop/pricing', label: 'Pricing', icon: Tag },
    { href: '/dashboard/shop/withdraw', label: 'Withdraw', icon: Banknote },
    { href: '/dashboard/shop/setup', label: 'Shop Profile', icon: Settings },
]

export const adminNavItems: NavItem[] = [
    { href: '/admin', label: 'Admin Dashboard', icon: Shield },
    { href: '/admin/top-up', label: 'Top-Up', icon: Wallet },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/orders/bulk-update', label: 'Bulk Order Update', icon: ListChecks },
    { href: '/admin/results-checker', label: 'Results Checker', icon: FileText },
    { href: '/admin/fulfillment', label: 'Fulfillment', icon: Activity },
    { href: '/admin/number-registration', label: 'Number Registration', icon: Hourglass },
    { href: '/admin/airtime', label: 'Airtime & Mashup', icon: Phone },
    { href: '/admin/shops', label: 'Shops', icon: Store },
    { href: '/admin/shops/withdrawals', label: 'Shop Withdrawals', icon: Banknote },
    { href: '/admin/afa-management', label: 'AFA Management', icon: BadgeCheck },
    { href: '/admin/roles', label: 'Role Management', icon: Users },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/packages', label: 'Packages', icon: Package },
    { href: '/admin/mtn-mashup', label: 'MTN Mashup', icon: Package },
    { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/admin/website-requests', label: 'Website Requests', icon: Code2 },
    { href: '/admin/announcements', label: 'Announcements', icon: Bell },
    { href: '/admin/sms-broadcast', label: 'SMS Broadcast', icon: Send },
    { href: '/admin/finance', label: 'Finance', icon: Banknote },
    { href: '/admin/payments', label: 'Payments Center', icon: CreditCard },
    { href: '/admin/momo-claims', label: 'MoMo Claims', icon: Wallet },
    { href: '/admin/profits-history', label: 'Profits History', icon: Wallet },
    { href: '/admin/api-keys', label: 'API Keys', icon: Key },
    { href: '/admin/terms', label: 'Terms & Policies', icon: FileText },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
]

/** Where the live "needs attention" counts show up in the admin menu. */
export const ADMIN_COUNT_KEYS: Record<string, 'pendingOrders' | 'pendingDebts' | 'pendingFulfillment' | 'pendingShops' | 'pendingWithdrawals' | 'pendingAfa' | 'pendingComplaints'> = {
    '/admin/orders': 'pendingOrders',
    '/admin/top-up': 'pendingDebts',
    '/admin/fulfillment': 'pendingFulfillment',
    '/admin/shops': 'pendingShops',
    '/admin/shops/withdrawals': 'pendingWithdrawals',
    '/admin/afa-management': 'pendingAfa',
    '/admin/complaints': 'pendingComplaints',
}

const TITLE_SOURCES: NavItem[] = [...userNavItems, ...shopMenuItems, ...adminNavItems]

/** The nav entry that owns a path (longest matching href), used for the header title and icon. */
export function resolveNavItem(pathname: string | null): NavItem | undefined {
    if (!pathname) return undefined
    return TITLE_SOURCES
        .filter(item => (item.href === '/dashboard' || item.href === '/admin')
            ? pathname === item.href
            : pathname.startsWith(item.href))
        .sort((a, b) => b.href.length - a.href.length)[0]
}

export function isNavActive(pathname: string | null, href: string): boolean {
    if (href === '/dashboard' || href === '/admin') return pathname === href
    return !!pathname?.startsWith(href)
}
