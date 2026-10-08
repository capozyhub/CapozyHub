import { BRAND } from '@/lib/brand'

export type TermsTone = 'red' | 'amber' | 'gold' | 'green' | 'u' | 'none'

export interface TermsSection {
  id: string
  title: string
  /** Body text with inline [[tone: …]] markup. May contain the {{brand}} token. */
  body: string
  /** Optional right-side status badge, e.g. "Upcoming". */
  badge?: string
  /** 'dashboard' = platform-only (hidden from shop storefronts). Defaults to 'all'. */
  scope?: 'all' | 'dashboard'
  /** Optional buyer-worded body used on shop storefronts (falls back to `body`). */
  storefront?: string
}

export interface TermsChangeEntry {
  version: string
  date: string
  summary: string[]
}

export interface CurrentTerms {
  version: string
  effectiveDate: string
  minAcceptableVersion: string
  changelog: TermsChangeEntry[]
  sections: TermsSection[]
}

// Hard fallback if the DB read ever fails (keeps the app usable).
export const FALLBACK_TERMS_VERSION = '2026-10-08'
export const FALLBACK_EFFECTIVE_DATE = 'October 8, 2026'

/** Lexicographic compare — safe because versions are zero-padded YYYY-MM-DD. */
export function compareVersions(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** True when the user must (re-)accept: never accepted, or accepted an older version. */
export function needsReacceptance(accepted: string | null | undefined, min: string): boolean {
  if (!accepted) return true
  return compareVersions(accepted, min) < 0
}

/** The platform brand name that {{brand}} resolves to on the main site / dashboard. */
export const PLATFORM_BRAND = BRAND.name

/** A section resolved for a specific audience — brand token substituted, ready to render. */
export interface RenderedSection {
  id: string
  title: string
  body: string
  badge?: string
}

/** Replace the {{brand}} token with the audience's brand (platform name or shop name). */
export function renderBrand(text: string, brand: string): string {
  return text.split('{{brand}}').join(brand)
}

/**
 * Resolve which sections to render for an audience, with the {{brand}} token
 * substituted. On a storefront, drops `scope: 'dashboard'` sections and prefers
 * each section's buyer-worded `storefront` body when present.
 */
export function sectionsForAudience(
  sections: TermsSection[],
  opts: { storefront: boolean; brand: string }
): RenderedSection[] {
  return sections
    .filter((s) => (opts.storefront ? s.scope !== 'dashboard' : true))
    .map((s) => ({
      id: s.id,
      title: renderBrand(s.title, opts.brand),
      body: renderBrand(opts.storefront ? (s.storefront ?? s.body) : s.body, opts.brand),
      badge: s.badge,
    }))
}

/**
 * The agreement shown until an admin publishes one in the Terms Manager (stored in
 * terms_versions). Plain-language first draft: have it reviewed by a lawyer before launch.
 * [[red: ...]] / [[amber: ...]] mark the few phrases a reader must not miss.
 */
export const DEFAULT_TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: `{{brand}} is a platform for buying mobile data, airtime, exam result checker vouchers and AFA registrations, and for reselling them through your own shop, sub-agents or our developer API. By creating an account or placing an order you agree to these terms. If you do not agree, please do not use {{brand}}.`,
  },
  {
    id: 'account',
    title: 'Your account',
    body: `You must be at least 18 years old and give accurate details when you sign up. You sign in with your email and a password, and you are responsible for everything done under your account. [[amber: Never share your password or API keys.]] If you think someone else has access, change your password and contact support straight away.`,
  },
  {
    id: 'wallet',
    title: 'Wallet and payments',
    body: `Your wallet holds prepaid funds that you spend on orders. You add money with Mobile Money or a card through our payment partner, Paystack, and any fee is shown before you pay. A wallet is not a bank account: it earns no interest, and its balance can only be spent on {{brand}} or paid out as described in these terms. Shop earnings can be withdrawn to a Mobile Money or bank account you provide. [[red: Check the number or account carefully, because we cannot recover a payout sent to the wrong details.]]`,
  },
  {
    id: 'orders',
    title: 'Orders and delivery',
    body: `When you place an order you choose the product, the network and the recipient number. [[red: Once an order is delivered to a number it cannot be reversed, so check the number and network before you confirm.]] Delivery times depend on mobile networks and our suppliers, and can be slower during outages or busy periods. You can follow every order in your order history.`,
  },
  {
    id: 'refunds',
    title: 'Failed or delayed orders',
    body: `If an order fails, the amount is returned to your wallet. If an order is late or something looks wrong, open it in your dashboard and choose Report issue. We investigate each report and post updates on the order. We may refuse or reverse a refund where an order was delivered, or where a claim is false or abusive.`,
  },
  {
    id: 'prices',
    title: 'Prices',
    body: `Prices are set by us and can change at any time. The price shown when you confirm an order is the price you pay. If you run a shop you set your own selling prices, but you still pay us the reseller price for every order your customers place.`,
  },
  {
    id: 'resellers',
    title: 'Shops, agents and sub-agents',
    body: `Agent and dealer plans give you the prices and tools described when you buy them. If you open a shop you are responsible for its content, its prices and how you treat your customers. If you recruit sub-agents you are responsible for who you invite. We can suspend a shop or an agent that misleads customers or breaks these terms.`,
  },
  {
    id: 'api',
    title: 'Developer API',
    body: `API keys belong to you and must be kept secret. Everything done with your key is treated as done by you, including orders placed by your own code or by anyone who obtains the key. We apply rate limits and can revoke a key that is misused or puts the platform at risk.`,
  },
  {
    id: 'use',
    title: 'Acceptable use',
    body: `Do not use {{brand}} for fraud, to pay with stolen cards or accounts, to abuse refunds or chargebacks, to attack or overload the platform, to collect other people's data, or for anything unlawful. We may investigate suspicious activity and may hold related funds while we do.`,
  },
  {
    id: 'suspension',
    title: 'Suspension and closing your account',
    body: `We can suspend or close an account that breaks these terms or that we reasonably suspect of fraud. You can ask us to close your account at any time. When an account is closed we return any remaining wallet balance to you once unresolved orders and disputes have been settled, unless the law requires us to keep it.`,
  },
  {
    id: 'availability',
    title: 'Availability',
    body: `{{brand}} relies on mobile networks, payment partners and other suppliers. We work to keep the service running, but we cannot promise that it will always be available or free of errors.`,
  },
  {
    id: 'liability',
    title: 'Our responsibility',
    body: `As far as the law allows, we are not responsible for indirect or consequential losses, or for delays and failures caused by networks, payment partners or other services outside our control. Where we are responsible for a problem with an order, our liability is limited to the amount of that order. Nothing in these terms limits a responsibility that cannot lawfully be limited.`,
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: `We may update these terms. When we do, we show the new version and the date it takes effect, and we may ask you to accept it before you carry on. If you keep using {{brand}} after a change takes effect, you accept the new terms.`,
  },
  {
    id: 'law',
    title: 'Governing law and contact',
    body: `These terms are governed by the laws of Ghana. For questions or complaints, contact support using the details in your dashboard.`,
  },
]