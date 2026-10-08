// Pure-logic tests for the shared supplier registry (lib/order-supplier.ts).
// Run: npx tsx scripts/test-supplier-registry.ts
//
// WHY: the supplier list was previously hand-written in five places and one of them
// (app/api/v1/data/purchase/route.ts) silently omitted HendyLinks. These tests pin the
// resolver's behaviour so the four dispatch guards can be switched over safely.

import {
    SUPPLIER_NETWORK_SETTING_KEYS,
    resolveEnabledSuppliers,
    type SupplierKey,
} from '../lib/order-supplier'

let failures = 0
function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
        failures++
    } else {
        console.log(`PASS: ${label}`)
    }
}

const ALL_KEYS = Object.keys(SUPPLIER_NETWORK_SETTING_KEYS) as SupplierKey[]

// ── The registry must cover all eight suppliers ─────────────────────────
assertEqual(ALL_KEYS.length, 8, 'registry holds exactly 8 suppliers')
assertEqual(ALL_KEYS.includes('hendylinks'), true, 'registry includes hendylinks (missing from v1 guard before this)')
assertEqual(ALL_KEYS.includes('atishare_console'), true, 'registry includes atishare_console')

// ── Empty / absent settings ──────────────────────────────────────────────
assertEqual(resolveEnabledSuppliers({}, 'AT-iShare'), [], 'empty settings → no suppliers')
assertEqual(resolveEnabledSuppliers(null, 'AT-iShare'), [], 'null settings → no suppliers')
assertEqual(resolveEnabledSuppliers(undefined, 'AT-iShare'), [], 'undefined settings → no suppliers')
assertEqual(resolveEnabledSuppliers({ networks: {} }, 'AT-iShare'), [], 'present but empty map → no suppliers')

// ── Exactly one enabled, for every supplier in the registry ─────────────
for (const key of ALL_KEYS) {
    const settingKey = SUPPLIER_NETWORK_SETTING_KEYS[key]
    const settings = { [settingKey]: { 'AT-iShare': true } }
    assertEqual(resolveEnabledSuppliers(settings, 'AT-iShare'), [key], `only ${key} enabled → [${key}]`)
}

// ── Two enabled → both returned, so callers see length > 1 and halt ─────
assertEqual(
    resolveEnabledSuppliers(
        { hendylinks_networks: { 'AT-iShare': true }, atishare_console_networks: { 'AT-iShare': true } },
        'AT-iShare'
    ),
    ['hendylinks', 'atishare_console'],
    'two enabled → both returned in registry order'
)

// ── Strict boolean check: matches the existing `=== true` comparisons ────
assertEqual(resolveEnabledSuppliers({ networks: { 'AT-iShare': 'true' as any } }, 'AT-iShare'), [], 'string "true" is NOT enabled')
assertEqual(resolveEnabledSuppliers({ networks: { 'AT-iShare': 1 as any } }, 'AT-iShare'), [], 'number 1 is NOT enabled')
assertEqual(resolveEnabledSuppliers({ networks: { 'AT-iShare': false } }, 'AT-iShare'), [], 'explicit false is NOT enabled')

// ── Network isolation ─────────────────────────────────────────────────────
assertEqual(resolveEnabledSuppliers({ networks: { MTN: true } }, 'AT-iShare'), [], 'enabled for a different network → not returned')
assertEqual(resolveEnabledSuppliers({ networks: { MTN: true } }, 'MTN'), ['datakazina'], 'enabled for MTN → returned for MTN')
assertEqual(resolveEnabledSuppliers({ networks: { MTN: true } }, ''), [], 'empty network name → no suppliers')

console.log(failures === 0 ? '\nAll tests passed' : `\n${failures} test(s) failed`)
process.exit(failures > 0 ? 1 : 0)
