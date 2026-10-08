import { Metadata } from 'next'
import { createServerAnonClient } from '@/lib/supabase'
import { ToneText } from '@/components/terms/tone-text'
import { LegalPage } from '@/components/legal/legal-page'
import { BRAND } from '@/lib/brand'
import { DEFAULT_TERMS_SECTIONS, FALLBACK_EFFECTIVE_DATE, PLATFORM_BRAND, sectionsForAudience } from '@/lib/terms'

export const metadata: Metadata = {
    title: `Terms of Service | ${BRAND.name}`,
    description: `The terms that apply when you buy or sell data, airtime, result checkers and AFA registrations on ${BRAND.name}.`,
}

// Rendered from the DB single source of truth; an admin publish reflects within a minute.
// Until one is published, the default agreement in lib/terms.ts is shown.
export const revalidate = 60

export default async function TermsPage() {
    let data: { effective_date?: string; sections?: any[] } | null = null
    try {
        const db = createServerAnonClient() as any
        const res = await db
            .from('terms_versions')
            .select('version, effective_date, sections')
            .eq('is_current', true)
            .maybeSingle()
        data = res.data
    } catch {
        data = null
    }

    const source = data?.sections?.length ? data.sections : DEFAULT_TERMS_SECTIONS
    const rows = sectionsForAudience(source, { storefront: false, brand: PLATFORM_BRAND })
    const effectiveDate: string = data?.effective_date ?? FALLBACK_EFFECTIVE_DATE

    return (
        <LegalPage
            title="Terms of Service"
            lead={`The rules for buying and selling on ${BRAND.name}, written to be read.`}
            updated={effectiveDate}
            otherPage={{ href: '/privacy', label: 'Privacy Policy' }}
            sections={rows.map(s => ({
                id: s.id,
                title: s.title,
                body: <ToneText text={s.body} />,
            }))}
        />
    )
}
