// scripts/test-promo-carousel-shop-dashboard-slides.ts
//
// buildShopDashboardSlides decides what a shop owner sees on their shop
// dashboard carousel, including the "set up pricing to go live" nudge that
// previously didn't exist anywhere on this page. Pinning the live/not-live
// and role-gated (Bill Pay) branches here protects both.
import { buildShopDashboardSlides } from '@/lib/promo-carousel/shop-dashboard-slides'

function assertHasSlide(ids: string[], id: string, label: string) {
    if (!ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be present, got [${ids.join(', ')}]`)
}

function assertMissingSlide(ids: string[], id: string, label: string) {
    if (ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be ABSENT, got [${ids.join(', ')}]`)
}

const base = {
    smsConfirmEnabled: true, utilitiesEnabled: false, ownerRole: 'agent', brandColor: '#2563eb',
}

// ── Not live: shows the pricing-setup nudge, hides management slides ───────
{
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: false }).map(s => s.id)
    assertHasSlide(ids, 'setup-pricing', 'not live')
    assertMissingSlide(ids, 'profit-logs', 'not live')
    assertMissingSlide(ids, 'pricing', 'not live')
    assertMissingSlide(ids, 'shop-settings', 'not live')
    assertMissingSlide(ids, 'withdraw-earnings', 'not live')
}

// ── Live: no pricing-setup nudge, all management slides present ────────────
{
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: true }).map(s => s.id)
    assertMissingSlide(ids, 'setup-pricing', 'live')
    assertHasSlide(ids, 'profit-logs', 'live')
    assertHasSlide(ids, 'pricing', 'live')
    assertHasSlide(ids, 'shop-settings', 'live')
    assertHasSlide(ids, 'withdraw-earnings', 'live')
}

// ── Bill Pay slide only for agent/dealer owners ─────────────────────────────
{
    const idsAgent = buildShopDashboardSlides({ ...base, shopIsLive: true, ownerRole: 'agent' }).map(s => s.id)
    assertHasSlide(idsAgent, 'bill-pay-status', 'agent owner')

    const idsDealer = buildShopDashboardSlides({ ...base, shopIsLive: true, ownerRole: 'dealer' }).map(s => s.id)
    assertHasSlide(idsDealer, 'bill-pay-status', 'dealer owner')

    const idsCustomer = buildShopDashboardSlides({ ...base, shopIsLive: true, ownerRole: 'customer' }).map(s => s.id)
    assertMissingSlide(idsCustomer, 'bill-pay-status', 'customer owner')

    const idsSubagent = buildShopDashboardSlides({ ...base, shopIsLive: true, ownerRole: 'subagent' }).map(s => s.id)
    assertMissingSlide(idsSubagent, 'bill-pay-status', 'subagent owner')
}

// ── SMS status slide always present regardless of live state; USSD is gone ─
for (const shopIsLive of [true, false]) {
    const ids = buildShopDashboardSlides({ ...base, shopIsLive }).map(s => s.id)
    assertMissingSlide(ids, 'ussd-status', `ussd slide removed, shopIsLive=${shopIsLive}`)
    assertHasSlide(ids, 'sms-status', `sms slide, shopIsLive=${shopIsLive}`)
}

// ── Grow-tips always present ─────────────────────────────────────────────────
{
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: true }).map(s => s.id)
    assertHasSlide(ids, 'tip-whatsapp-status', 'grow tips')
    assertHasSlide(ids, 'tip-qr-code', 'grow tips')
    assertHasSlide(ids, 'tip-reward-returning', 'grow tips')
    assertHasSlide(ids, 'tip-sms-broadcast', 'grow tips')
}

function findSlide(ctx: Parameters<typeof buildShopDashboardSlides>[0], id: string) {
    const s = buildShopDashboardSlides(ctx).find(x => x.id === id)
    if (!s) throw new Error(`slide "${id}" not found`)
    return s
}

function assertEq(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

// ── (a) In-page anchor CTAs for toggles that live on /dashboard/shop ───────
{
    const ctx = { ...base, shopIsLive: true, ownerRole: 'agent' }
    assertEq(findSlide(ctx, 'sms-status').cta.href, '/dashboard/shop#sms-confirm-toggle', 'sms cta href')
    assertEq(findSlide(ctx, 'bill-pay-status').cta.href, '/dashboard/shop#bill-pay-toggle', 'bill pay cta href')
}

// ── (c) SMS slide copy ──────────────────────────────────────────────────────
{
    const off = findSlide({ ...base, shopIsLive: true, smsConfirmEnabled: false }, 'sms-status')
    assertEq(off.title, 'Turn on SMS confirmations', 'sms off title')
    assertEq(off.cta.label, 'Turn On', 'sms off cta')
    const on = findSlide({ ...base, shopIsLive: true, smsConfirmEnabled: true }, 'sms-status')
    assertEq(on.title, 'SMS confirmations are on', 'sms on title')
    assertEq(on.cta.label, 'Manage', 'sms on cta')
}

// ── (d) null/undefined owner role: no bill pay slide ───────────────────────
for (const ownerRole of [null, undefined]) {
    const ids = buildShopDashboardSlides({ ...base, shopIsLive: true, ownerRole }).map(s => s.id)
    assertMissingSlide(ids, 'bill-pay-status', `ownerRole=${ownerRole}`)
}

// ── (e) Every slide: CTA under /dashboard/shop, accent = brand, unique ids ──
for (const shopIsLive of [true, false]) {
    for (const ownerRole of ['agent', 'subagent']) {
        const slides = buildShopDashboardSlides({ ...base, shopIsLive, ownerRole, brandColor: '#ff0066' })
        const seen = new Set<string>()
        for (const s of slides) {
            const label = `slide ${s.id} (live=${shopIsLive}, role=${ownerRole})`
            if (!s.cta || !s.cta.href || !s.cta.href.startsWith('/dashboard/shop')) throw new Error(`${label}: bad cta ${JSON.stringify(s.cta)}`)
            assertEq(s.accentColor, '#ff0066', `${label} accentColor`)
            if (seen.has(s.id)) throw new Error(`${label}: duplicate id`)
            seen.add(s.id)
        }
    }
}

console.log('All shop-dashboard promo-carousel slide tests passed.')
