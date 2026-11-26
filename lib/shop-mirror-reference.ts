// lib/shop-mirror-reference.ts
// The reference_code given to the internal orders / airtime_orders row that mirrors a
// storefront sale. One definition, so the writer and every reader agree.
//
// It is the full Paystack reference (SHOP-<shop>-<ms>-<8 hex>), which is already unique.
// Until 2026-11-26 it was `SHOP-` + the last 10 characters of that reference (one timestamp
// digit + 32 random bits). orders.reference_code is UNIQUE, so two sales that collided on
// those 10 characters made the second mirror insert fail for a PAID order (~0.1% across 10k
// sales, ~11% across 100k). Rows written in the old form still exist, so lookups must match
// both forms.

/** The mirror reference written for a new storefront sale. */
export function shopMirrorReference(paystackReference: string): string {
    return paystackReference.startsWith('SHOP-') ? paystackReference : `SHOP-${paystackReference}`
}

/** The pre-2026-11-26 short form, still present on older rows. */
export function legacyShopMirrorReference(paystackReference: string): string {
    return `SHOP-${paystackReference.slice(-10)}`
}

/** Both forms, for lookups that must also find rows written before the change. */
export function shopMirrorReferenceCandidates(paystackReference: string): string[] {
    return Array.from(new Set([shopMirrorReference(paystackReference), legacyShopMirrorReference(paystackReference)]))
}
