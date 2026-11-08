// scripts/test-wallet-upgrade.ts
//
// Pins the price/plan resolution used by every membership charge: unknown plans must be
// rejected (never silently priced as 30d / 6m), and a bad stored price must never be charged.
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

eq(resolveUpgradePrice('agent', '30d', []).price, 99.99, 'default 30d')
eq(resolveUpgradePrice('agent', '3d', [{ key: 'agent_upgrade_price_3d', value: '12.5' }]).price, 12.5, 'stored value')
eq(resolveUpgradePrice('dealer', '1m', []).planLabel, '1 Month Dealer Pass', 'dealer label')

expectThrow(() => resolveUpgradePrice('agent', 'bogus', []), UpgradeInputError, 'unknown agent plan')
expectThrow(() => resolveUpgradePrice('agent', '__proto__', []), UpgradeInputError, 'proto plan')
expectThrow(() => resolveUpgradePrice('agent', '6m', []), UpgradeInputError, 'dealer plan on agent type')
expectThrow(() => resolveUpgradePrice('dealer', '30d', []), UpgradeInputError, 'agent plan on dealer type')
expectThrow(() => resolveUpgradePrice('dealer', undefined, []), UpgradeInputError, 'missing plan')

for (const bad of ['-5', '0', 'abc', 'NaN', null]) {
    expectThrow(
        () => resolveUpgradePrice('agent', '14d', [{ key: 'agent_upgrade_price_14d', value: bad }]),
        UpgradePricingError,
        `bad stored price ${bad}`,
    )
}

eq(isValidPlan('agent', 'permanent'), true, 'permanent valid')
eq(isValidPlan('dealer', 'permanent'), false, 'permanent not dealer')

console.log('test-wallet-upgrade: all assertions passed')
