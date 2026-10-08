// Pure-logic test for the shop-profile write schema: owner_phone must be
// optional (Step 1 of the setup wizard creates a shop with only
// shop_name/shop_slug — see docs/superpowers/specs/2026-09-10-shop-setup-wizard-redesign-design.md §4).
import { z } from 'zod'
import { shortTextSchema, phoneSchema, slugSchema } from '../lib/validation'

// Mirrors the schema shape in app/api/shop/profile/route.ts — kept inline
// here so this test has no import-time side effects from the route file
// (which reads cookies()/env at module scope via its other imports).
const shopProfileSchema = z.object({
    shop_name: shortTextSchema,
    shop_slug: slugSchema,
    owner_phone: phoneSchema.or(z.literal('')).optional().nullable(),
})

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(`FAIL: ${msg}`)
    console.log(`PASS: ${msg}`)
}

// Step-1-only payload (no owner_phone at all) must validate.
const step1Result = shopProfileSchema.safeParse({
    shop_name: 'Test Shop',
    shop_slug: 'test-shop-123',
})
assert(step1Result.success, 'Step 1 payload (no owner_phone) validates')

// Empty string must validate (form default before Contact step is filled).
const emptyPhoneResult = shopProfileSchema.safeParse({
    shop_name: 'Test Shop',
    shop_slug: 'test-shop-123',
    owner_phone: '',
})
assert(emptyPhoneResult.success, 'Empty-string owner_phone validates')

// A garbage phone must still fail — relaxing "required" must not relax "valid".
const badPhoneResult = shopProfileSchema.safeParse({
    shop_name: 'Test Shop',
    shop_slug: 'test-shop-123',
    owner_phone: 'not-a-phone',
})
assert(!badPhoneResult.success, 'Invalid owner_phone still rejected')

console.log('All shop-profile schema tests passed.')
