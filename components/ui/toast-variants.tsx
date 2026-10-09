'use client'

import { toast as sonnerToast } from 'sonner'
import { BRAND } from '@/lib/brand'

type ToastType = 'success' | 'error' | 'info' | 'warning'

/*
 * One raised clay card for every toast. The badge on the left carries the type:
 * success is the brand gold (the check draws itself), the rest stay in their own
 * colours so an error never reads as good news. The thin bar at the bottom is the
 * time left before the toast closes.
 */
const TYPES: Record<ToastType, { badge: string; ink: string; bar: string; label: string }> = {
  success: {
    badge: 'linear-gradient(145deg, #FEE21C 0%, #F6C30F 45%, #F6A900 100%)',
    ink: '#3A2600',
    bar: 'linear-gradient(90deg, #F6A900, #FEE21C)',
    label: 'Success',
  },
  error: {
    badge: 'linear-gradient(145deg, #FF8A80 0%, #E5383B 55%, #B71C1C 100%)',
    ink: '#FFFFFF',
    bar: 'linear-gradient(90deg, #B71C1C, #FF8A80)',
    label: 'Error',
  },
  info: {
    badge: 'linear-gradient(145deg, #F4F4F4 0%, #C2C2C2 55%, #8E8E8E 100%)',
    ink: '#1A1A1A',
    bar: 'linear-gradient(90deg, #8E8E8E, #E8E8E8)',
    label: 'Notice',
  },
  warning: {
    badge: 'linear-gradient(145deg, #FFB067 0%, #F2711C 55%, #C2410C 100%)',
    ink: '#FFFFFF',
    bar: 'linear-gradient(90deg, #C2410C, #FFB067)',
    label: 'Warning',
  },
}

function Glyph({ type, color }: { type: ToastType; color: string }) {
  const common = { stroke: color, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      {type === 'success' && (
        <path d="M5 12.5l4.5 4.5L19 7.5" {...common} pathLength={1} className="cz-toast-check" />
      )}
      {type === 'error' && <path d="M17 7L7 17M7 7l10 10" {...common} />}
      {type === 'info' && <path d="M12 11v6m0-10h.01" {...common} />}
      {type === 'warning' && <path d="M12 7v6m0 4h.01" {...common} />}
    </svg>
  )
}

interface BrandToastProps {
  id: string | number
  title: string
  type: ToastType
  duration: number
  /** Name shown above the message. Defaults to the platform brand; the storefront
   *  overrides it with the shop's own name (white-label). */
  brand?: string
}

export function BrandToast({ id, title, type, duration, brand = BRAND.name }: BrandToastProps) {
  const t = TYPES[type]

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className="cz-toast"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '372px',
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 44px 14px 12px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'hsl(var(--card))',
        color: 'hsl(var(--card-foreground))',
        boxShadow: 'var(--neu-out)',
        animation: 'cz-toast-in 0.45s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          flexShrink: 0,
          borderRadius: '14px',
          background: t.badge,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow:
            'inset 0 2px 3px rgba(255,255,255,0.55), inset 0 -3px 5px rgba(0,0,0,0.22), 0 4px 8px rgba(0,0,0,0.18)',
        }}
      >
        <Glyph type={type} color={t.ink} />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span
          style={{
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            fontSize: '12px',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {t.label} · {brand}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body), system-ui, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}
        >
          {title}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); sonnerToast.dismiss(id) }}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '24px',
          height: '24px',
          borderRadius: '8px',
          border: 'none',
          background: 'hsl(var(--background))',
          boxShadow: 'var(--neu-in)',
          color: 'hsl(var(--muted-foreground))',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '12px',
          right: '12px',
          bottom: '5px',
          height: '3px',
          borderRadius: '3px',
          background: t.bar,
          transformOrigin: 'left center',
          animation: `cz-toast-bar ${duration}ms linear forwards`,
        }}
      />
    </div>
  )
}
