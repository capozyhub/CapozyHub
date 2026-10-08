// scripts/test-sms-rate-limit-merge.ts
// Pure-logic test for the read-merge-write behavior required when writing
// a single bucket into the shared admin_settings.api_rate_limits blob —
// must preserve every OTHER bucket's value, never blind-overwrite.

function mergeRateLimitDefault(current: Record<string, number> | null | undefined, smsValue: number): Record<string, number> {
    return { ...(current || {}), sms: smsValue }
}

function applyAccountRateLimitOverride(current: Record<string, number> | null | undefined, limitPerMin: number | null): Record<string, number> {
    const next: Record<string, number> = { ...(current || {}) }
    if (limitPerMin === null) {
        delete next.sms
    } else {
        next.sms = limitPerMin
    }
    return next
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) throw new Error(`FAIL ${label}: expected ${e}, got ${a}`)
}

// Existing blob has other buckets set — they must survive.
assertEqual(
    mergeRateLimitDefault({ packages: 10, purchase: 20, sms: 30 }, 50),
    { packages: 10, purchase: 20, sms: 50 },
    'preserves other buckets, updates sms'
)

// No existing blob (first-ever write) — sms alone is fine.
assertEqual(
    mergeRateLimitDefault(null, 45),
    { sms: 45 },
    'handles null current value'
)
assertEqual(
    mergeRateLimitDefault(undefined, 45),
    { sms: 45 },
    'handles undefined current value'
)

// Per-account override: clearing (null) must DELETE the sms key, not set it to null/0.
assertEqual(
    applyAccountRateLimitOverride({ sms: 50 }, null),
    {},
    'clearing override deletes the sms key entirely'
)
// Setting an override preserves any other keys that might exist on that row.
assertEqual(
    applyAccountRateLimitOverride({ sms: 50, someOtherBucket: 5 }, 75),
    { sms: 75, someOtherBucket: 5 },
    'setting override preserves unrelated existing keys'
)

console.log('All sms-rate-limit merge tests passed.')
