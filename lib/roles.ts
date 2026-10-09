import { ShieldCheck, ShieldHalf, Gem, Medal, Handshake, UserRound, LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'sub-admin' | 'dealer' | 'agent' | 'subagent' | 'customer'

interface RoleConfigItem {
    icon: LucideIcon
    label: string
    rank: string
    /** The role's solid colour: dots, rings, active tabs. */
    color: string
    /** Soft tint for chips and badges. */
    bgColor: string
    /** Readable on both the light and the dark canvas. */
    textColor: string
    /** Lit-from-top-left gradient for the clay avatar and active pills. */
    gradient: string
    /** Text/icon colour that stays readable on `gradient`. */
    ink: string
    /** Glow under the avatar and the active tab. */
    glow: string
}

/**
 * One colour per role so a member's standing reads at a glance everywhere (avatar, header,
 * sidebar card, mobile tabs). Gold stays the Capozy brand colour and is deliberately not a
 * role colour, so a role never looks like a highlighted menu item.
 */
export const roleConfig: Record<UserRole, RoleConfigItem> = {
    'admin': {
        icon: ShieldCheck,
        label: 'Admin',
        rank: '#1',
        color: '#E5383B',
        bgColor: 'rgba(229, 56, 59, 0.12)',
        textColor: '#E5383B',
        gradient: 'linear-gradient(145deg, #FF8A80 0%, #E5383B 55%, #B71C1C 100%)',
        ink: '#FFFFFF',
        glow: 'rgba(229, 56, 59, 0.40)',
    },
    'sub-admin': {
        icon: ShieldHalf,
        label: 'Sub-Admin',
        rank: '#2',
        color: '#F2711C',
        bgColor: 'rgba(242, 113, 28, 0.12)',
        textColor: '#F2711C',
        gradient: 'linear-gradient(145deg, #FFB067 0%, #F2711C 55%, #C2410C 100%)',
        ink: '#FFFFFF',
        glow: 'rgba(242, 113, 28, 0.40)',
    },
    'dealer': {
        icon: Gem,
        label: 'Dealer',
        rank: '#3',
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.12)',
        textColor: '#8B5CF6',
        gradient: 'linear-gradient(145deg, #C4B5FD 0%, #8B5CF6 55%, #5B21B6 100%)',
        ink: '#FFFFFF',
        glow: 'rgba(139, 92, 246, 0.40)',
    },
    'agent': {
        icon: Medal,
        label: 'Agent',
        rank: '#4',
        color: '#16A34A',
        bgColor: 'rgba(22, 163, 74, 0.12)',
        textColor: '#16A34A',
        gradient: 'linear-gradient(145deg, #86EFAC 0%, #16A34A 55%, #166534 100%)',
        ink: '#FFFFFF',
        glow: 'rgba(22, 163, 74, 0.40)',
    },
    'subagent': {
        icon: Handshake,
        label: 'Sub-Agent',
        rank: '#5',
        color: '#0891B2',
        bgColor: 'rgba(8, 145, 178, 0.12)',
        textColor: '#0891B2',
        gradient: 'linear-gradient(145deg, #67E8F9 0%, #0891B2 55%, #155E75 100%)',
        ink: '#FFFFFF',
        glow: 'rgba(8, 145, 178, 0.40)',
    },
    'customer': {
        icon: UserRound,
        label: 'Customer',
        rank: '#6',
        color: '#8E8E8E',
        bgColor: 'rgba(142, 142, 142, 0.16)',
        textColor: '#7A7A7A',
        gradient: 'linear-gradient(145deg, #F4F4F4 0%, #C2C2C2 55%, #8E8E8E 100%)',
        ink: '#1A1A1A',
        glow: 'rgba(142, 142, 142, 0.40)',
    },
}

export function resolveRoleKey(opts: { isAdmin?: boolean; isSubAdmin?: boolean; role?: string | null }): UserRole {
    if (opts.isAdmin) return 'admin'
    if (opts.isSubAdmin) return 'sub-admin'
    return (opts.role && opts.role in roleConfig ? opts.role : 'customer') as UserRole
}
