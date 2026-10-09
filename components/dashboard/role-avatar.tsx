import { cn } from '@/lib/utils'
import { roleConfig, type UserRole } from '@/lib/roles'

const SIZES = {
    sm: { box: 'h-9 w-9 text-xs', crest: 'h-4 w-4 -bottom-0.5 -right-0.5', icon: 'h-2 w-2' },
    md: { box: 'h-12 w-12 text-base', crest: 'h-5 w-5 -bottom-1 -right-1', icon: 'h-2.5 w-2.5' },
    lg: { box: 'h-16 w-16 text-xl', crest: 'h-6 w-6 -bottom-1 -right-1', icon: 'h-3 w-3' },
}

/**
 * Member avatar: initials on a clay disc in the role's colour, with a small crest carrying the
 * role's icon. The colour, not the icon alone, is what tells roles apart at a glance.
 */
export function RoleAvatar({
    role,
    first,
    last,
    size = 'md',
    className,
}: {
    role: UserRole
    first?: string | null
    last?: string | null
    size?: keyof typeof SIZES
    className?: string
}) {
    const cfg = roleConfig[role] ?? roleConfig.customer
    const s = SIZES[size]
    const Icon = cfg.icon
    const initials = `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'U'

    return (
        <span className={cn('relative inline-flex flex-shrink-0', className)} title={cfg.label}>
            <span
                className={cn('flex items-center justify-center rounded-full font-display font-bold', s.box)}
                style={{
                    background: cfg.gradient,
                    color: cfg.ink,
                    boxShadow: `0 5px 12px ${cfg.glow}, inset -3px -4px 7px rgba(0,0,0,0.22), inset 3px 4px 7px rgba(255,255,255,0.5)`,
                }}
            >
                {initials}
            </span>
            <span
                className={cn('absolute flex items-center justify-center rounded-full border-2 border-[var(--neu-bg)] bg-black', s.crest)}
                style={{ color: cfg.color }}
            >
                <Icon className={s.icon} strokeWidth={3} />
            </span>
        </span>
    )
}
