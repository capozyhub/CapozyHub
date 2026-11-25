// The one place that says what a developer API key looks like.
//
// New keys are issued as `cs_live_` + 32 lowercase hex chars (cs = commission services).
// Keys issued before the rename start with `cz_live_` and stay valid until their owner
// regenerates, so every check accepts both. Keep this file free of imports: the edge
// middleware uses it too.

/** What newly generated keys start with. */
export const API_KEY_PREFIX = 'cs_live_'

/** Prefixes that identify a key issued by this platform, newest first. */
export const ISSUED_KEY_PREFIXES = ['cs_live_', 'cz_live_'] as const

/** Exact shape of a valid issued key, old or new. */
export const API_KEY_SHAPE = /^c[sz]_live_[a-f0-9]{32}$/

/** True when a stored key_prefix (first 16 chars of a key) belongs to a format that can authenticate. */
export function isIssuedKeyPrefix(prefix: string | null | undefined): boolean {
    const p = String(prefix || '')
    return ISSUED_KEY_PREFIXES.some(x => p.startsWith(x))
}
