// Client-safe: decides whether the current hostname serves storefronts at the root
// ("shop.<domain>/<slug>", "store.<domain>/<slug>") or under the /shop prefix
// ("capozygh.com/shop/<slug>", Vercel previews, localhost).
//
// This used to be an inline blacklist of the OLD brand's apex domain, so on any other
// non-storefront host (the new apex, preview.*, the *.vercel.app production alias) it
// wrongly answered "root" and generated links with the /shop prefix dropped — which 404.
// An allowlist of the real storefront hosts can't drift that way.
const DEFAULT_STORE_URL = 'https://store.capozygh.com'

function storeHostname(): string {
    try {
        return new URL(process.env.NEXT_PUBLIC_STORE_URL || DEFAULT_STORE_URL).hostname
    } catch {
        return new URL(DEFAULT_STORE_URL).hostname
    }
}

export function isStorefrontHost(hostname: string): boolean {
    const h = (hostname || '').toLowerCase()
    return h.startsWith('shop.') || h.startsWith('store.') || h === storeHostname()
}
