// Shared (browser + server) rules for a shop's public identity: name, link slug and
// description. The wizard uses them for instant feedback; app/api/shop/profile and
// app/api/shop/slug-check enforce them. Never trust the browser copy alone.

export const SHOP_NAME_MIN = 3
export const SHOP_NAME_MAX = 40
export const SHOP_SLUG_MIN = 3
export const SHOP_SLUG_MAX = 30
export const SHOP_DESC_MAX = 400

// Folders and routes the storefront host or the platform already uses, plus words that
// would let a shop pass itself off as the platform, its staff or a payment provider.
const RESERVED_SLUGS = new Set([
    'admin', 'administrator', 'api', 'app', 'apps', 'auth', 'login', 'logout', 'signin', 'signup', 'register',
    'dashboard', 'shop', 'shops', 'store', 'stores', 'status', 'success', 'about', 'support', 'help', 'contact',
    'terms', 'privacy', 'download', 'developers', 'developer', 'join', 'sms', 'offline', 'actions', 'agent',
    'agents', 'www', 'mail', 'email', 'ftp', 'root', 'system', 'test', 'testing', 'null', 'undefined', 'billing',
    'payment', 'payments', 'pay', 'wallet', 'checkout', 'order', 'orders', 'static', 'assets', 'cdn', 'public',
    'official', 'staff', 'team', 'moderator', 'security', 'verify', 'verification', 'webhook', 'webhooks',
    'callback', 'settings', 'account', 'profile', 'home', 'index', 'new', 'edit', 'delete', 'mtn', 'telecel',
    'airteltigo', 'vodafone', 'momo', 'paystack', 'hubtel', 'ghana', 'gra', 'bog', 'ncc',
])

// Whole-word matches only (so "class" or "Essex" are fine).
const BLOCKED_TOKENS = new Set([
    'ass', 'dick', 'cock', 'rape', 'rapist', 'slut', 'sex', 'sexy', 'scam', 'scammer', 'fraud', 'retard',
    'bastard', 'nazi', 'hitler', 'nude', 'nudes', 'xxx', 'sakawa', 'yahooboy',
])

// Matched anywhere in the text once spacing and look-alike characters are removed.
const BLOCKED_SUBSTRINGS = [
    'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'pussy', 'whore', 'asshole', 'porn',
    'sakawa', 'yahooboy',
]

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' }

function squash(text: string): string {
    return text.toLowerCase().replace(/[013457@$!]/g, c => LEET[c] ?? c).replace(/[^a-z]/g, '')
}

function hasBlockedWord(text: string): boolean {
    const tokens = text.toLowerCase().split(/[^a-z0-9@$!]+/).map(t => t.replace(/[013457@$!]/g, c => LEET[c] ?? c))
    if (tokens.some(t => BLOCKED_TOKENS.has(t))) return true
    const flat = squash(text)
    return BLOCKED_SUBSTRINGS.some(w => flat.includes(w))
}

const LINK_LIKE = /(https?:\/\/|www\.|\.(com|net|org|gh|io|co|me|xyz)\b|t\.me\/|wa\.me\/|bit\.ly)/i

/** Collapses runs of whitespace and trims the ends. */
export function cleanText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

/** Returns an error message, or null when the shop name is acceptable. */
export function validateShopName(raw: string): string | null {
    const name = cleanText(raw)
    if (!name) return 'Give your shop a name'
    if (name.length < SHOP_NAME_MIN) return `Use at least ${SHOP_NAME_MIN} characters`
    if (name.length > SHOP_NAME_MAX) return `Keep it to ${SHOP_NAME_MAX} characters or fewer`
    if (!/^[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ '’.&,!-]*$/.test(name)) {
        return "Use letters, numbers and simple punctuation only (' . & , ! -)"
    }
    if ((name.match(/[A-Za-zÀ-ɏ]/g) || []).length < 2) return 'Add a few letters so people can read it'
    if (/(.)\1{4,}/.test(name)) return 'That name repeats the same character too many times'
    if (/\d{7,}/.test(name.replace(/[\s-]/g, ''))) return 'Phone numbers do not belong in a shop name'
    if (LINK_LIKE.test(name)) return 'Links do not belong in a shop name'
    if (/capozy/i.test(name)) return `Names containing "Capozy" are reserved for the platform`
    if (hasBlockedWord(name)) return 'That name is not allowed. Try something friendlier'
    return null
}

/** Typing-time cleanup: lower-case, only a-z 0-9 and single hyphens. A trailing hyphen is kept so people can type "kofi-data". */
export function sanitizeSlugInput(raw: string): string {
    return raw
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-/, '')
        .slice(0, SHOP_SLUG_MAX)
}

/** Final form of a slug: no leading or trailing hyphen. */
export function finalizeSlug(raw: string): string {
    return sanitizeSlugInput(raw).replace(/-+$/, '')
}

/** Turns a shop name into a link-friendly slug. */
export function slugFromName(name: string): string {
    return finalizeSlug(name.replace(/&/g, ' and ').replace(/['’]/g, ''))
}

/** Returns an error message, or null when the slug is acceptable. */
export function validateShopSlug(slug: string): string | null {
    if (!slug) return 'Pick a link for your shop'
    if (slug.length < SHOP_SLUG_MIN) return `Use at least ${SHOP_SLUG_MIN} characters`
    if (slug.length > SHOP_SLUG_MAX) return `Keep it to ${SHOP_SLUG_MAX} characters or fewer`
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return 'Use lowercase letters, numbers and single hyphens only'
    if (/^\d+$/.test(slug)) return 'Add some letters. A link made only of numbers is easy to confuse'
    const flat = slug.replace(/-/g, '')
    if (RESERVED_SLUGS.has(slug) || RESERVED_SLUGS.has(flat)) return 'That link is reserved. Try another'
    if (flat.includes('capozy')) return 'Links containing "capozy" are reserved for the platform'
    if (hasBlockedWord(slug.replace(/-/g, ' '))) return 'That link is not allowed. Try another'
    return null
}

/** Returns an error message, or null when the description is acceptable (empty is fine). */
export function validateShopDescription(raw: string): string | null {
    const text = cleanText(raw)
    if (!text) return null
    if (text.length > SHOP_DESC_MAX) return `Keep it to ${SHOP_DESC_MAX} characters or fewer`
    if (/[<>]/.test(text)) return 'Angle brackets are not allowed'
    if (LINK_LIKE.test(text)) return 'Links are not allowed here. Add your group link in the Community step'
    if (/capozy/i.test(text) && /official|support|staff|admin/i.test(text)) return 'Please do not imply you are the platform'
    if (hasBlockedWord(text)) return 'Please keep the description family-friendly'
    return null
}

// ─── Refine: suggestions ──────────────────────────────────────────────────────
// Deliberately template-based, not a model call: no key to leak, no cost per click,
// nothing a shop owner can prompt-inject, and every suggestion is run through the
// same validators the server enforces.

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

function shuffle<T>(items: T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

function titleCase(text: string): string {
    return cleanText(text).toLowerCase().replace(/(^|[\s-])([a-zà-ɏ])/g, (_, sep, ch) => sep + ch.toUpperCase())
}

const NAME_ADJECTIVES = ['Swift', 'Prime', 'Bright', 'Smart', 'Rapid', 'Royal', 'Trusty', 'Eagle', 'Unity', 'Joy', 'Solid', 'Sunrise', 'Kente', 'Savanna', 'Golden']
const NAME_NOUNS = ['Data Hub', 'Data Plug', 'Bundles', 'Connect', 'Data Store', 'Top-Up Spot', 'Data Corner', 'Net Link', 'Data Point']
const NAME_WITH_SEED = [
    (s: string) => `${s} Data Hub`,
    (s: string) => `${s} Data Plug`,
    (s: string) => `${s} Connect`,
    (s: string) => `${s} Bundles`,
    (s: string) => `${s} Data Store`,
    (s: string) => `${s} Top-Up Spot`,
    (s: string) => `${s}'s Data Corner`,
    (s: string) => `${s} Net Link`,
    (s: string) => `Quick ${s} Data`,
    (s: string) => `${s} Airtime & Data`,
]

/** Up to `count` valid, distinct shop names. `seed` is whatever the owner typed so far, or their first name. */
export function suggestShopNames(seed: string, count = 5): string[] {
    const words = titleCase(seed.replace(/['’]s\b/gi, '').replace(/[^A-Za-zÀ-ɏ ]/g, ' ')).split(' ').filter(Boolean)
    const word = (words.length <= 2 ? words : words.slice(0, 1)).join(' ')
    const out = new Set<string>()
    const candidates: string[] = []
    if (word.length >= 2) {
        for (const make of shuffle(NAME_WITH_SEED)) candidates.push(make(word))
    }
    for (let i = 0; i < 24; i++) candidates.push(`${pick(NAME_ADJECTIVES)} ${pick(NAME_NOUNS)}`)
    for (const name of candidates) {
        if (out.size >= count) break
        if (name.length <= SHOP_NAME_MAX && !validateShopName(name)) out.add(name)
    }
    return [...out]
}

/** Slug options for a shop name, all valid; availability is checked separately. */
export function suggestSlugs(name: string, count = 4): string[] {
    const base = slugFromName(name)
    if (base.length < 2) return []
    const trim = (s: string) => finalizeSlug(s.slice(0, SHOP_SLUG_MAX))
    const options = [
        trim(`${base}-gh`),
        trim(`${base.slice(0, SHOP_SLUG_MAX - 5)}-data`),
        trim(`${base.slice(0, SHOP_SLUG_MAX - 4)}-hub`),
        trim(`${base.slice(0, SHOP_SLUG_MAX - 3)}-${Math.floor(10 + Math.random() * 89)}`),
        trim(base),
    ]
    return [...new Set(options)].filter(s => !validateShopSlug(s)).slice(0, count)
}

const DESCRIPTION_TEMPLATES = [
    (n: string) => `${n} sells MTN, Telecel and AT data bundles at honest prices. Pick your network, enter the number and pay with Mobile Money.`,
    (n: string) => `Need data in a hurry? ${n} has bundles for every network. Order, pay with MoMo and you are done. Questions? Just message us.`,
    (n: string) => `Affordable data for every network from ${n}. Simple ordering, clear prices and a real person to talk to when you need help.`,
    (n: string) => `${n}: data bundles and airtime without the stress. Choose a package, pay with Mobile Money and track your order any time.`,
    (n: string) => `Buy data the easy way at ${n}. Clear prices, all major networks, and friendly support if anything goes wrong.`,
]

function polish(text: string): string {
    let t = cleanText(text)
    if (!t) return t
    t = t.replace(/\s+([,.!?;:])/g, '$1').replace(/([,.!?;:])(?=[A-Za-z])/g, '$1 ')
    t = t.charAt(0).toUpperCase() + t.slice(1)
    if (!/[.!?]$/.test(t)) t += '.'
    return t
}

/**
 * With text: the owner's own words, tidied, plus the same thing with a closing line added.
 * Without text: fresh drafts built from the shop name. Every result fits the description rules.
 */
export function suggestDescriptions(shopName: string, existing: string, count = 3): string[] {
    const name = cleanText(shopName) || 'Our shop'
    const results: string[] = []
    const base = polish(existing)
    if (base) {
        results.push(base)
        const closers = ['Message us any time and we will help.', 'Order in a few taps and pay with Mobile Money.', 'Clear prices, no surprises.']
        for (const closer of shuffle(closers)) {
            const joined = `${base} ${closer}`
            if (joined.length <= SHOP_DESC_MAX) results.push(joined)
        }
    }
    for (const make of shuffle(DESCRIPTION_TEMPLATES)) results.push(make(name))
    const seen = new Set<string>()
    return results.filter(r => {
        if (seen.has(r) || r.length > SHOP_DESC_MAX || validateShopDescription(r)) return false
        seen.add(r)
        return true
    }).slice(0, count)
}
