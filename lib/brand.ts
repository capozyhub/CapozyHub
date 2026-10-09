/**
 * Single source of truth for the product's name and public URL.
 * Import from here instead of hard-coding the brand in components and metadata.
 */
export const BRAND = {
    name: 'Capozy Hub',
    /** First word, shown in the default text colour next to the accented second word. */
    nameFirst: 'Capozy',
    /** Second word, shown in the accent colour. */
    nameSecond: 'Hub',
    domain: 'capozygh.com',
    /** Where each member's storefront lives: shop.capozygh.com/<slug>. */
    shopHost: 'shop.capozygh.com',
    /** Public site URL; the env var wins so previews and local dev stay self-consistent. */
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'https://capozygh.com').replace(/\/+$/, ''),
    tagline: "Ghana's all-in-one platform for mobile data, airtime, results checkers and reseller tools.",
} as const
