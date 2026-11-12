'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { ToneText } from '@/components/terms/tone-text'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { sectionsForAudience, type CurrentTerms } from '@/lib/terms'

/**
 * Guest storefront acceptance gate. Same scroll-gated UX as the logged-in modal,
 * but a guest who declines simply cancels the purchase (no sign-out) — they can
 * browse, they just can't buy until they accept.
 */
export function StorefrontTermsGate({
  open, terms, brandName, onAccept, onCancel, blocking = false,
}: {
  open: boolean
  terms: CurrentTerms | null
  brandName: string
  onAccept: () => void
  onCancel: () => void
  /** When true the gate is the page-load boundary blocking the storefront until the guest
   *  decides — closing it (tap outside, Esc, the X) counts as declining, same as the button. */
  blocking?: boolean
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [progress, setProgress] = useState(0)

  const check = () => {
    const el = bodyRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setProgress(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)))
    if (max <= 4 || el.scrollHeight - el.scrollTop - el.clientHeight < 24) setReachedEnd(true)
  }

  useEffect(() => {
    if (!open) { setReachedEnd(false); setProgress(0); return }
    const el = bodyRef.current
    if (!el) return
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, terms])

  if (!terms) return null

  // Storefront audience: buyer-relevant sections only, {{brand}} → shop name.
  const rows = sectionsForAudience(terms.sections, { storefront: true, brand: brandName })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent
        hideCloseButton
        // Tapping the backdrop is always treated as Decline (same as the X / Decline button) —
        // even on the blocking page-load boundary, so a guest isn't ever trapped. Escape is the
        // one thing we still swallow while blocking, since it's easy to hit by accident while
        // scrolling the agreement on a physical keyboard.
        onEscapeKeyDown={blocking ? (e) => e.preventDefault() : undefined}
        className="w-full sm:max-w-md max-h-[92dvh] overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border-0 bg-neu p-0 gap-0 shadow-[0_-18px_40px_rgba(0,0,0,0.35)]"
      >
        {/* Drag handle + close — same round icon button every storefront sheet uses */}
        <div className="relative flex items-center justify-center pt-3 pb-1">
          <div className="h-1 w-9 rounded-full bg-foreground/15" />
          <button
            onClick={onCancel}
            aria-label="Close"
            className="neu-raised-sm neu-press absolute right-4 top-2 flex h-9 w-9 items-center justify-center rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Header: black plate, like the stage behind every storefront sheet */}
        <div className="relative isolate mx-5 mt-2 overflow-hidden rounded-2xl bg-black px-5 pb-5 pt-4 text-white">
          <BrandSwoosh className="pointer-events-none absolute -bottom-10 -right-[20%] -z-10 w-[80%] opacity-60" />
          <span className="clay-gold inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest">
            Before You Buy
          </span>
          <DialogTitle className="mt-2 font-display text-xl font-bold tracking-tight">
            Terms &amp; Conditions
          </DialogTitle>
          <p className="text-xs font-medium text-silver-200">
            Effective {terms.effectiveDate} · version {terms.version}
          </p>
        </div>

        {/* Scroll progress */}
        <div className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-brand-400 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          onScroll={check}
          className="overflow-y-auto max-h-[42vh] px-5 py-5 overscroll-contain scroll-smooth"
        >
          {rows.map((s, i) => (
            <div key={s.id} className="mb-5">
              <h3 className="text-sm font-bold tracking-tight text-foreground mb-1">
                {i + 1}. {s.title}
                {s.badge ? (
                  <span className="ml-2 align-middle text-[9px] font-black uppercase tracking-wide text-brand-700 dark:text-brand-400 neu-inset rounded px-1.5 py-0.5">
                    {s.badge}
                  </span>
                ) : null}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                <ToneText text={s.body} />
              </p>
            </div>
          ))}
          <p className="text-center text-xs text-muted-foreground/70 pt-1">
            Need help? Use this shop's <span className="font-semibold">Need Help</span> or WhatsApp contact.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-black/5 dark:border-white/10 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          {!reachedEnd && (
            <p className="text-center text-xs text-muted-foreground mb-2">▼ Scroll to the end to enable Accept</p>
          )}
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              className="neu-raised-sm neu-press flex-1 h-11 rounded-full text-sm font-semibold text-foreground"
            >
              Decline
            </button>
            <button
              onClick={onAccept}
              disabled={!reachedEnd}
              className="clay-gold flex-1 h-11 rounded-full text-sm font-bold transition disabled:opacity-45 disabled:grayscale"
            >
              I Accept &amp; Continue
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
