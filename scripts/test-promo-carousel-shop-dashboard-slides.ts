// scripts/test-promo-carousel-shop-dashboard-slides.ts
//
// buildShopDashboardSlides decides what a shop owner sees on their shop
// dashboard carousel, including the "set up pricing to go live" nudge.
// Pinning the live/not-live branches here protects both.
import { buildShopDashboardSlides } from '@/lib/promo-carousel/shop-dashboard-slides'

function assertHasSlide(ids: string[], id: string, label: string) {
    if (!ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be present, got [${ids.join(', ')}]`)
}

function assertMissingSlide(ids: string[], id: string, label: string) {
    if (ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be ABSENT, got [${ids.join(', ')}]`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const base = { brandColor: '#2563eb' }

// Not live: shows the pricing-setup nudge, hides management slides
{
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: false }).map(s => s.id)
    assertHasSlide(ids, 'setup-pricing', 'not live')
    assertMissingSlide(ids, 'profit-logs', 'not live')
    assertMissingSlide(ids, 'pricing', 'not live')
    assertMissingSlide(ids, 'shop-settings', 'not live')
    assertMissingSlide(ids, 'withdraw-earnings', 'not live')
}

// Live: no pricing-setup nudge, all management slides present
{
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: true }).map(s => s.id)
    assertMissingSlide(ids, 'setup-pricing', 'live')
    assertHasSlide(ids, 'profit-logs', 'live')
    assertHasSlide(ids, 'pricing', 'live')
    assertHasSlide(ids, 'shop-settings', 'live')
    assertHasSlide(ids, 'withdraw-earnings', 'live')
}

// Removed features never appear
for (const shopIsLive of [true, false]) {
    const ids = buildShopDashboardSlides({ ...base, shopIsLive }).map(s => s.id)
    for (const gone of ['ussd-status', 'sms-status', 'bill-pay-status', 'tip-sms-broadcast']) {
        assertMissingSlide(ids, gone, `removed slide, shopIsLive=${shopIsLive}`)
    }
}

// Grow tips always present
{
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: true }).map(s => s.id)
    assertHasSlide(ids, 'tip-whatsapp-status', 'grow tips')
    assertHasSlide(ids, 'tip-qr-code', 'grow tips')
    assertHasSlide(ids, 'tip-reward-returning', 'grow tips')
}

// Every slide: CTA under /dashboard/shop, accent = brand, unique ids
for (const shopIsLive of [true, false]) {
    const slides = buildShopDashboardSlides({ shopIsLive, brandColor: '#ff0066' })
    const seen = new Set<string>()
    for (const s of slides) {
        const label = `slide ${s.id} (live=${shopIsLive})`
        if (!s.cta || !s.cta.href || !s.cta.href.startsWith('/dashboard/shop')) throw new Error(`${label}: bad cta ${JSON.stringify(s.cta)}`)
        assertEq(s.accentColor, '#ff0066', `${label} accentColor`)
        if (seen.has(s.id)) throw new Error(`${label}: duplicate id`)
        seen.add(s.id)
    }
}

console.log('All shop-dashboard promo-carousel slide tests passed.')