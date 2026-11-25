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
    ListChecks,
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
    /** Every page in the group. The sidebar folds the group away unless the current page is inside it. */
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
            { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
            { href: '/dashboard/my-orders', label: 'My Orders', icon: ShoppingCart },
            { href: '/dashboard/transactions', label: 'Activity', icon: Activity },
        ],
    },
    {
        id: 'grow',
        label: 'Grow',
        items: [
            { href: '/dashboard/recruit', label: 'Sub-Agents', icon: UserPlus },
            { href: '/dashboard/upgrade', label: 'Role Upgrade', icon: Crown },
        ],
    },
    {
        id: 'account',
        label: 'Account',
        items: [
            { href: '/dashboard/complaints', label: 'Support', icon: MessageSquare },
            { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
            { href: '/dashboard/profile', label: 'My Profile', icon: User },
            { href: '/dashboard/api', label: 'Developer API', icon: Code2 },
        ],
    },
]

export const userNavItems: NavItem[] = userNavGroups.flatMap(g => g.items)

/** Storefront pages, shown under "My Store" once the member has a shop. */
export const shopMenuItems: NavItem[] = [
    { href: '/dashboard/shop', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/shop/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/shop/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/shop/pricing', label: 'Pricing', icon: Tag },
    { href: '/dashboard/shop/profit-logs', label: 'Earnings', icon: Activity },
    { href: '/dashboard/shop/withdraw', label: 'Withdraw', icon: Banknote },
    { href: '/dashboard/shop/setup', label: 'Shop Profile', icon: Settings },
]

/**
 * Admin menu: collapsible groups. The sidebar keeps open only the group that holds the current page.
 */
export const adminNavGroups: NavGroup[] = [
    {
        id: 'admin-home',
        items: [{ href: '/admin', label: 'Overview', icon: Shield }],
    },
    {
        id: 'admin-orders',
        label: 'Orders',
        items: [
            { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
            { href: '/admin/fulfillment', label: 'Fulfillment', icon: Activity },
            { href: '/admin/airtime', label: 'Airtime & Mashup', icon: Phone },
            { href: '/admin/results-checker', label: 'Results Checker', icon: FileText },
            { href: '/admin/afa-management', label: 'AFA Registration', icon: BadgeCheck },
            { href: '/admin/orders/bulk-update', label: 'Bulk Order Update', icon: ListChecks },
        ],
    },
    {
        id: 'admin-money',
        label: 'Money',
        items: [
            { href: '/admin/top-up', label: 'Top-Up', icon: Wallet },
            { href: '/admin/finance', label: 'Finance', icon: Banknote },
            { href: '/admin/shops/withdrawals', label: 'Shop Withdrawals', icon: Banknote },
            { href: '/admin/payments', label: 'Payments Center', icon: CreditCard },
            { href: '/admin/profits-history', label: 'Profits History', icon: Activity },
        ],
    },
    {
        id: 'admin-people',
        label: 'People',
        items: [
            { href: '/admin/users', label: 'Users', icon: Users },
            { href: '/admin/shops', label: 'Shops', icon: Store },
            { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
            { href: '/admin/roles', label: 'Role Management', icon: Crown },
        ],
    },
    {
        id: 'admin-account',
        label: 'Account',
        items: [
            { href: '/admin/notifications', label: 'Notifications', icon: Bell },
            { href: '/admin/profile', label: 'My Profile', icon: User },
        ],
    },
    {
        id: 'admin-platform',
        label: 'Platform',
        items: [
            { href: '/admin/packages', label: 'Packages', icon: Package },
            { href: '/admin/announcements', label: 'Announcements', icon: Bell },
            { href: '/admin/settings', label: 'Settings', icon: Settings },
            { href: '/admin/mtn-mashup', label: 'MTN Mashup', icon: Package },
            { href: '/admin/sms-broadcast', label: 'SMS Broadcast', icon: Send },
            { href: '/admin/api-keys', label: 'API Keys', icon: Key },
            { href: '/admin/website-requests', label: 'Website Requests', icon: Code2 },
            { href: '/admin/terms', label: 'Terms & Policies', icon: FileText },
        ],
    },
]

export const adminNavItems: NavItem[] = adminNavGroups.flatMap(g => g.items)
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
