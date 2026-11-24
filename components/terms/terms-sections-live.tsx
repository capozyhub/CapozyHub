'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ToneText } from './tone-text'
import { sectionsForAudience, type TermsSection } from '@/lib/terms'

/**
 * Renders the current agreement for shop buyers (guests with no account) from the single DB
 * source (/api/terms/current). Members-only sections are left out and each section uses its
 * buyer wording, so a guest never reads about wallets, dashboards or API keys. Drop-in for
 * any storefront page: one edit in the Admin Terms Manager updates every surface.
 */
export function TermsSectionsLive({ className, brandName = 'this store' }: { className?: string; brandName?: string }) {
  const [data, setData] = useState<{ sections: TermsSection[]; effectiveDate: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/terms/current')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j?.success) setData({ sections: j.data.sections, effectiveDate: j.data.effectiveDate })
        else setFailed(true)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) {
    return <p role="alert" className="text-sm text-muted-foreground">The terms could not be loaded. Refresh the page to try again.</p>
  }
  if (!data) {
    return <p role="status" className="text-sm text-muted-foreground">Loading the terms…</p>
  }

  const rows = sectionsForAudience(data.sections, { storefront: true, brand: brandName })

  return (
    <div className={className ?? 'space-y-6'}>
      {rows.map((s, i) => (
        <section key={s.id}>
          <h3 className="mb-1 font-display text-base font-bold tracking-tight text-foreground">
            {i + 1}. {s.title}
            {s.badge ? (
              <span className="neu-inset ml-2 rounded px-1.5 py-0.5 align-middle text-xs font-semibold text-brand-800 dark:text-brand-400">
                {s.badge}
              </span>
            ) : null}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <ToneText text={s.body} />
          </p>
        </section>
      ))}
      <p className="pt-2 text-xs text-muted-foreground">
        Last updated {data.effectiveDate} ·{' '}
        <Link href="/terms" className="font-semibold underline underline-offset-4 hover:text-foreground">Read the full terms</Link>
      </p>
    </div>
  )
}
