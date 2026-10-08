// Pure-logic tests for lib/shop-sender-suggestions.ts.
//
// The worked-example table in
// docs/superpowers/specs/2026-08-12-shop-feature-improvements-design.md §2 is the
// source of truth for expected output — every row of it is asserted below, in
// slot order (Compact, Initials, Primary+GH, Primary+HUB).
//
// Run: npx tsx scripts/test-shop-sender-suggestions.ts
import { generateSenderSuggestions } from '../lib/shop-sender-suggestions'

function assertIncludes(actual: string[], expected: string, label: string) {
    if (!actual.includes(expected)) {
        console.error(`FAIL: ${label} — expected ${JSON.stringify(actual)} to include "${expected}"`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

function assertEqualList(actual: string[], expected: string[], label: string) {
    const same = actual.length === expected.length && actual.every((v, i) => v === expected[i])
    if (!same) {
        console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

function assertNoneMatch(actual: string[], pattern: RegExp, label: string) {
    const bad = actual.filter(s => pattern.test(s))
    if (bad.length > 0) {
        console.error(`FAIL: ${label} — found blocked-looking candidates: ${JSON.stringify(bad)}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// ── The spec's worked table, row by row ────────────────────────────────────
assertEqualList(
    generateSenderSuggestions('Kofi Data Bundle Solutions'),
    ['KofiSolutio', 'KOFI', 'KofiGH', 'KofiHUB'],
    'Kofi Data Bundle Solutions → strips "data"/"bundle" filler words',
)
assertEqualList(
    generateSenderSuggestions('Savage14'),
    ['Savage14', 'SAVA', 'Savage14GH', 'Savage14HUB'],
    'Savage14 → single-word name, initials fall back to first 4 letters',
)
assertEqualList(
    generateSenderSuggestions('KING FLEXY GUEST PORTAL'),
    ['FlexyGuest', 'KFGP', 'KingGH', 'KingHUB'],
    'KING FLEXY GUEST PORTAL → all-caps input normalizes to title case',
)
assertEqualList(
    generateSenderSuggestions('MTN Top Up Zone'),
    ['TopUpZone', 'MTUZ', 'TopGH', 'TopHUB'],
    'MTN Top Up Zone → telecom code retried out of every slot',
)
assertEqualList(
    generateSenderSuggestions('GCB Trusted Traders'),
    ['TrustedTrad', 'GTT', 'TrustedGH', 'TrustedHUB'],
    'GCB Trusted Traders → bank code retried out of every slot',
)
assertEqualList(
    generateSenderSuggestions('Kwame Electronics Shop'),
    ['KwameElectr', 'KWAM', 'KwameGH', 'KwameHUB'],
    'Kwame Electronics Shop → strips "shop"',
)

// ── Adversarial: reserved brands must never survive into the output ────────
assertNoneMatch(
    generateSenderSuggestions('KING FLEXY GUEST PORTAL'),
    /kingflexy/i,
    'KING FLEXY GUEST PORTAL → never suggests the reserved platform brand',
)
assertNoneMatch(
    generateSenderSuggestions('MTN Top Up Zone'),
    /^MTN/i,
    'MTN Top Up Zone → no suggestion starts with MTN',
)
assertNoneMatch(
    generateSenderSuggestions('GCB Trusted Traders'),
    /^GCB/i,
    'GCB Trusted Traders → no suggestion starts with GCB',
)

// ── Collision against existing senders (not just the static blocklist) ─────
const withExisting = generateSenderSuggestions('Savage14', { existing: ['Savage14GH'] })
assertNoneMatch(withExisting, /^Savage14GH$/, 'existing-sender collision is excluded from output')
assertIncludes(withExisting, 'Savage14', 'existing-sender collision only drops the colliding slot')

// Leet/lookalike collisions fold the same way the approval path folds them.
assertNoneMatch(
    generateSenderSuggestions('Savage14', { existing: ['SavageiaHUB'] }),
    /^Savage14HUB$/,
    'leet-folded existing sender ("SavageiaHUB") still counts as a collision',
)

// ── Degenerate inputs must not throw or emit junk ──────────────────────────
assertEqualList(generateSenderSuggestions(''), [], 'empty shop name → no suggestions')
assertEqualList(generateSenderSuggestions('   !!!   '), [], 'punctuation-only shop name → no suggestions')
assertEqualList(generateSenderSuggestions('Shop'), ['Shop', 'SHOP', 'ShopGH', 'ShopHUB'], 'all-filler name falls back to the original words')

// ── Every candidate must satisfy the charset rule ──────────────────────────
for (const name of [
    'Kofi Data Bundle Solutions', 'Savage14', 'KING FLEXY GUEST PORTAL',
    'MTN Top Up Zone', 'GCB Trusted Traders', 'Kwame Electronics Shop',
    'A', 'Ab', "O'Brien & Sons Ltd", 'Telecel Data Hub', '12345',
]) {
    for (const s of generateSenderSuggestions(name)) {
        if (!/^[A-Za-z0-9]{3,11}$/.test(s) || !/[A-Za-z]/.test(s)) {
            console.error(`FAIL: charset check — "${s}" (from "${name}") violates the sender-ID charset rule`)
            process.exitCode = 1
        }
    }
}
console.log('PASS: all suggestions satisfy the charset rule')

// Suggestions are deterministic — the same name always yields the same list.
assertEqualList(
    generateSenderSuggestions('Kofi Data Bundle Solutions'),
    generateSenderSuggestions('Kofi Data Bundle Solutions'),
    'algorithm is deterministic',
)

if (process.exitCode !== 1) console.log('\nAll shop-sender-suggestions tests passed.')
