import { DEFAULT_TERMS_SECTIONS, type TermsSection, type TermsChangeEntry } from './terms'

// The agreement the seed scripts (scripts/seed-terms.ts, scripts/print-seed-sql.ts) publish.
// It is the same text as DEFAULT_TERMS_SECTIONS in lib/terms.ts, so there is one draft to
// review, not two. Once published, the database is authoritative and admins edit it in the
// Terms Manager (no redeploy).
//
// Highlight rule: [[tone: ...]] on SHORT key phrases only (about 2-6 words), never a whole sentence.
// Tones: red=prohibition, amber=caution, gold=important, green=reassurance, u=underline.

export const INITIAL_TERMS_VERSION = '2026-11-24'
export const INITIAL_EFFECTIVE_DATE = 'November 24, 2026'
export const INITIAL_REQUIRES_REACCEPTANCE = true

export const INITIAL_CHANGELOG: TermsChangeEntry[] = [
  {
    version: INITIAL_TERMS_VERSION,
    date: INITIAL_EFFECTIVE_DATE,
    summary: [
      'First Capozy Hub terms',
      'Shop buyers now see a shorter version written for them',
    ],
  },
]

export const INITIAL_SECTIONS: TermsSection[] = DEFAULT_TERMS_SECTIONS