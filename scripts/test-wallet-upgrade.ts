// scripts/test-wallet-upgrade.ts
//
// Pins the price/plan resolution used by every membership charge: unknown or deleted
// plans must be rejected (never silently priced as a different plan), and a bad stored
// price must never be charged.
import {
    resolveUpgradePrice,
    isValidPlan,
    UpgradeInputError,
    UpgradePricingError,
} from '@/lib/wallet-upgrade'

function expectThrow(fn: () => unknown, ctor: new (...a: any[]) => Error, label: string) {
    try { fn() } catch (e) {
        if (e instanceof ctor) return
        throw new Error(`${label}: wrong error type: ${e}`)
    }
    throw new Error(`${label}: expected throw`)
}
function eq(a: unknown, b: unknown, label: string) {
    if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`)
}

const plan = (upgrade_type: 'agent' | 'dealer', slug: string, price: unknown, label: string, duration_days: number | null, active = true) =>
    ({ upgrade_type, slug, price, label, duration_days, active })

const PLANS = [
    plan('agent', '30d', 99.99, '30 Days Agent Pass', 30),
    plan('agent', '3d', 12.5, '3 Days Agent Pass', 3),
    plan('agent', '14d', 49.99, '14 Days Agent Pass', 14),
    plan('agent', 'permanent', 149.99, 'Permanent Agent Pass', null),
    plan('dealer', '1m', 99.99, '1 Month Dealer Pass', 30),
    plan('agent', 'retired', 9.99, 'Retired Plan', 7, false),
]

eq(resolveUpgradePrice('agent', '30d', PLANS).price, 99.99, 'stored value')
eq(resolveUpgradePrice('agent', '3d', PLANS).price, 12.5, 'stored value (different plan)')
eq(resolveUpgradePrice('dealer', '1m', PLANS).planLabel, '1 Month Dealer Pass', 'dealer label')
eq(resolveUpgradePrice('agent', 'permanent', PLANS).planDays, null, 'lifetime plan has no days')

expectThrow(() => resolveUpgradePrice('agent', 'bogus', PLANS), UpgradeInputError, 'unknown agent plan')
expectThrow(() => resolveUpgradePrice('agent', '__proto__', PLANS), UpgradeInputError, 'proto plan')
expectThrow(() => resolveUpgradePrice('agent', '1m', PLANS), UpgradeInputError, 'dealer plan on agent type')
expectThrow(() => resolveUpgradePrice('dealer', '30d', PLANS), UpgradeInputError, 'agent plan on dealer type')
expectThrow(() => resolveUpgradePrice('dealer', undefined, PLANS), UpgradeInputError, 'missing plan')
expectThrow(() => resolveUpgradePrice('agent', 'retired', PLANS), UpgradeInputError, 'deleted/inactive plan is never charged')
expectThrow(() => resolveUpgradePrice('agent', '30d', []), UpgradeInputError, 'no plans configured')

for (const bad of [-5, 0, 'abc', NaN, null]) {
    expectThrow(
        () => resolveUpgradePrice('agent', '14d', [plan('agent', '14d', bad, '14 Days Agent Pass', 14)]),
        UpgradePricingError,
        `bad stored price ${bad}`,
    )
}

eq(isValidPlan('agent', 'permanent'), true, 'non-empty string is shape-valid')
eq(isValidPlan('agent', ''), false, 'empty string is not shape-valid')
eq(isValidPlan('agent', 123), false, 'non-string is not shape-valid')

console.log('test-wallet-upgrade: all assertions passed')
