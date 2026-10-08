// scripts/test-shop-sellable.ts
//
// isShopSaleSellable is the single "may this shop sale be charged?" rule shared by
// the storefront checkout and the USSD shop path. A wrong answer either lets a shop
// sell below its cost (the platform absorbs the loss) or blocks legitimate sales,
// so the boundary rules are pinned here. Mirrors lib/shop-checkout.ts:
//   normal shop -> profit must be > 0; sub-agent shop -> profit >= 0 (zero markup is legal).
import { isShopSaleSellable } from '@/lib/pricing/cost-basis'

function assertEq(actual: boolean, expected: boolean, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`)
}

// ── Normal (non-sub) shops: strictly positive profit required ────────────────
assertEq(isShopSaleSellable(5, 4, false), true, 'normal: above cost')
assertEq(isShopSaleSellable(4, 4, false), false, 'normal: at cost (zero profit)')
assertEq(isShopSaleSellable(3.99, 4, false), false, 'normal: below cost')
assertEq(isShopSaleSellable(4.31, 4.3, false), true, 'normal: one pesewa above cost')

// ── Sub-agent shops: zero markup is legal, negative is not ───────────────────
assertEq(isShopSaleSellable(4, 4, true), true, 'sub: at cost (zero markup)')
assertEq(isShopSaleSellable(3.99, 4, true), false, 'sub: below cost')
assertEq(isShopSaleSellable(4.5, 4, true), true, 'sub: above cost')

// ── Floating-point: prices are GHS with 2 decimals — compare at pesewa precision
assertEq(isShopSaleSellable(4.3, 4.3, true), true, 'sub: float-equal at cost')
assertEq(isShopSaleSellable(0.3, 0.1 + 0.2, false), false, 'normal: 0.1+0.2 vs 0.3 is zero profit, not positive')
assertEq(isShopSaleSellable(0.1 + 0.2, 0.3, true), true, 'sub: 0.1+0.2 vs 0.3 is zero profit, not negative')

// ── Invalid prices are never sellable ────────────────────────────────────────
assertEq(isShopSaleSellable(0, 0, true), false, 'zero selling price')
assertEq(isShopSaleSellable(-1, -2, true), false, 'negative selling price')
assertEq(isShopSaleSellable(NaN, 4, false), false, 'NaN selling price')
assertEq(isShopSaleSellable(5, NaN, false), false, 'NaN cost')
assertEq(isShopSaleSellable(Infinity, 4, false), false, 'infinite selling price')

console.log('All shop-sellable tests passed.')
