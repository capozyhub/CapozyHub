// scripts/test-promo-carousel-storefront-slides.ts
//
// buildStorefrontSlides must only ever advertise products the shop actually
// has active — a shop with only MTN data enabled must never show a Telecel
// or AT slide, and the Become-a-Sub-Agent slide must only ever appear for
// agent/dealer-owned shops (never customer/subagent, single-level only).
import { buildStorefrontSlides } from '@/lib/promo-carousel/storefront-slides'
import type { StorefrontTab } from '@/lib/promo-carousel/storefront-slides'

function assertHasSlide(ids: string[], id: string, label: string) {
    if (!ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be present, got [${ids.join(', ')}]`)
}

function assertMissingSlide(ids: string[], id: string, label: string) {
    if (ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be ABSENT, got [${ids.join(', ')}]`)
}

const noop = () => { /* selectProduct stub */ }

const base = {
    packages: [] as { network: string }[], oosNetworks: [] as string[], airtimeEnabled: false, afaEnabled: false,
    rcEnabled: false, utilitiesEnabled: false, ownerRole: 'agent' as string | null | undefined, shopName: 'Test Shop',
    whatsappNumber: '233200000000' as string | null, ownerPhone: '233200000000', selectProduct: noop as (tab: StorefrontTab) => void,
}

// ── Only active networks with packages appear, OOS is excluded ─────────────
{
    const ids = buildStorefrontSlides({
        ...base,
        packages: [{ network: 'MTN' }, { network: 'Telecel' }],
        oosNetworks: ['Telecel'],
    }).map(s => s.id)
    assertHasSlide(ids, 'network-MTN', 'MTN active, Telecel OOS')
    assertMissingSlide(ids, 'network-Telecel', 'MTN active, Telecel OOS')
    assertMissingSlide(ids, 'network-AT', 'MTN active, Telecel OOS')
}

// ── No package row for a network means no slide, even if not OOS ───────────
{
    const ids = buildStorefrontSlides({ ...base, packages: [{ network: 'MTN' }] }).map(s => s.id)
    assertHasSlide(ids, 'network-MTN', 'only MTN has packages')
    assertMissingSlide(ids, 'network-Telecel', 'only MTN has packages')
}

// ── Networks outside NETWORK_ORDER never get a slide; present+OOS excluded ──
{
    const ids = buildStorefrontSlides({
        ...base,
        packages: [{ network: 'MTN' }, { network: 'Glo' }, { network: 'Telecel' }],
        oosNetworks: ['MTN', 'Glo'],
    }).map(s => s.id)
    assertMissingSlide(ids, 'network-Glo', 'unknown network Glo')
    assertMissingSlide(ids, 'network-MTN', 'MTN present AND OOS')
    assertHasSlide(ids, 'network-Telecel', 'Telecel active')
}

// ── Product toggles gate their slides ───────────────────────────────────────
{
    const idsOff = buildStorefrontSlides({ ...base }).map(s => s.id)
    assertMissingSlide(idsOff, 'airtime', 'airtime off')
    assertMissingSlide(idsOff, 'afa', 'afa off')
    assertMissingSlide(idsOff, 'results-checker', 'rc off')
    assertMissingSlide(idsOff, 'bill-pay', 'utilities off')

    const idsOn = buildStorefrontSlides({
        ...base, airtimeEnabled: true, afaEnabled: true, rcEnabled: true, utilitiesEnabled: true,
    }).map(s => s.id)
    assertHasSlide(idsOn, 'airtime', 'airtime on')
    assertHasSlide(idsOn, 'afa', 'afa on')
    assertHasSlide(idsOn, 'results-checker', 'rc on')
    assertHasSlide(idsOn, 'bill-pay', 'utilities on')
}

// ── Become-a-Sub-Agent: agent/dealer only, never customer/subagent/null ────
for (const ownerRole of ['agent', 'dealer']) {
    const ids = buildStorefrontSlides({ ...base, ownerRole }).map(s => s.id)
    assertHasSlide(ids, 'become-subagent', `owner role ${ownerRole}`)
}
for (const ownerRole of ['customer', 'subagent', null, undefined]) {
    const ids = buildStorefrontSlides({ ...base, ownerRole }).map(s => s.id)
    assertMissingSlide(ids, 'become-subagent', `owner role ${String(ownerRole)}`)
}

// ── WhatsApp link preferred, tel: fallback when no WhatsApp number ─────────
{
    const slides = buildStorefrontSlides({ ...base, whatsappNumber: '233200000000' })
    const slide = slides.find(s => s.id === 'become-subagent')
    if (!slide) throw new Error('expected become-subagent slide')
    if (!('href' in slide.cta) || !slide.cta.href.startsWith('https://wa.me/233200000000')) {
        throw new Error(`expected WhatsApp href, got ${JSON.stringify(slide.cta)}`)
    }
}
{
    const slides = buildStorefrontSlides({ ...base, whatsappNumber: '+233 20 000 0000' })
    const slide = slides.find(s => s.id === 'become-subagent')
    if (!slide) throw new Error('expected become-subagent slide')
    if (!('href' in slide.cta) || !slide.cta.href.startsWith('https://wa.me/233200000000?text=')) {
        throw new Error(`expected digits-only wa.me href, got ${JSON.stringify(slide.cta)}`)
    }
}
{
    const slides = buildStorefrontSlides({ ...base, whatsappNumber: null, ownerPhone: '233200000001' })
    const slide = slides.find(s => s.id === 'become-subagent')
    if (!slide) throw new Error('expected become-subagent slide')
    if (!('href' in slide.cta) || slide.cta.href !== 'tel:233200000001') {
        throw new Error(`expected tel: fallback href, got ${JSON.stringify(slide.cta)}`)
    }
}

// ── Sparse shop gets padded to a minimum of 3 slides ────────────────────────
{
    const slides = buildStorefrontSlides({ ...base, ownerRole: 'customer' })
    if (slides.length < 3) throw new Error(`expected at least 3 slides for a sparse shop, got ${slides.length}`)
}

// ── Fully-enabled context: every slide has a valid CTA, ids are unique ──────
const full = {
    ...base,
    packages: [{ network: 'MTN' }, { network: 'Telecel' }, { network: 'AT-iShare' }, { network: 'AT-BigTime' }, { network: 'AT' }],
    airtimeEnabled: true, afaEnabled: true, rcEnabled: true, utilitiesEnabled: true,
}
{
    const slides = buildStorefrontSlides(full)
    const ids = slides.map(s => s.id)
    if (new Set(ids).size !== ids.length) throw new Error(`duplicate slide ids: [${ids.join(', ')}]`)
    for (const s of slides) {
        const ok = ('href' in s.cta && typeof s.cta.href === 'string' && s.cta.href.length > 0)
            || ('onClick' in s.cta && typeof s.cta.onClick === 'function')
        if (!ok) throw new Error(`slide "${s.id}" has an invalid cta: ${JSON.stringify(s.cta)}`)
    }
}

// ── In-page CTAs switch to the right storefront tab ─────────────────────────
{
    const calls: StorefrontTab[] = []
    const slides = buildStorefrontSlides({ ...full, selectProduct: tab => { calls.push(tab) } })
    const expected: Record<string, StorefrontTab> = {
        'network-MTN': 'data', 'network-Telecel': 'data', 'network-AT-iShare': 'data',
        'network-AT-BigTime': 'data', 'network-AT': 'data',
        'airtime': 'airtime', 'afa': 'afa', 'results-checker': 'vouchers', 'bill-pay': 'utilities',
    }
    for (const [id, tab] of Object.entries(expected)) {
        const slide = slides.find(s => s.id === id)
        if (!slide) throw new Error(`expected slide "${id}"`)
        if (!('onClick' in slide.cta)) throw new Error(`slide "${id}" should have an onClick cta`)
        calls.length = 0
        slide.cta.onClick()
        if (calls.length !== 1 || calls[0] !== tab) {
            throw new Error(`slide "${id}" should call selectProduct('${tab}') once, got [${calls.join(', ')}]`)
        }
    }
}

// ── Need Help slide: present for every owner role, contacts the shop owner ──
for (const ownerRole of ['agent', 'dealer', 'customer', 'subagent', null]) {
    const ids = buildStorefrontSlides({ ...base, ownerRole }).map(s => s.id)
    assertHasSlide(ids, 'need-help', `need-help for owner role ${String(ownerRole)}`)
}
{
    const slide = buildStorefrontSlides({ ...base, whatsappNumber: '+233 20 000 0000' }).find(s => s.id === 'need-help')
    if (!slide || !('href' in slide.cta)) throw new Error('need-help must be a link CTA')
    if (!slide.cta.href.startsWith('https://wa.me/233200000000?text=')) {
        throw new Error(`need-help should open WhatsApp with digits only, got ${slide.cta.href}`)
    }
    if (!decodeURIComponent(slide.cta.href).includes('Test Shop')) {
        throw new Error('need-help WhatsApp message should name the shop')
    }
}
{
    const slide = buildStorefrontSlides({ ...base, whatsappNumber: null, ownerPhone: '233200000001' }).find(s => s.id === 'need-help')
    if (!slide || !('href' in slide.cta) || slide.cta.href !== 'tel:233200000001') {
        throw new Error('need-help should fall back to tel: when there is no WhatsApp number')
    }
}
// A WhatsApp number with no digits must not produce a broken wa.me/?text= link
for (const id of ['need-help', 'become-subagent']) {
    const slide = buildStorefrontSlides({ ...base, whatsappNumber: '---', ownerPhone: '233200000001' }).find(s => s.id === id)
    if (!slide || !('href' in slide.cta) || slide.cta.href !== 'tel:233200000001') {
        throw new Error(`${id}: all-non-digit WhatsApp number should fall back to tel:`)
    }
}

// ── MTN whitelist slide: only when MTN is actually sellable; replaces the generic tip ──
{
    const calls: string[] = []
    const selectProduct = (tab: string) => { calls.push(tab) }
    const withMtn = buildStorefrontSlides({ ...base, packages: [{ network: 'MTN' }], selectProduct })
    const ids = withMtn.map(s => s.id)
    assertHasSlide(ids, 'mtn-whitelist', 'MTN active')
    assertMissingSlide(ids, 'instant-delivery-awareness', 'MTN active replaces the generic tip')
    const slide = withMtn.find(s => s.id === 'mtn-whitelist')!
    if (!('onClick' in slide.cta)) throw new Error('whitelist CTA must be an in-page action')
    slide.cta.onClick()
    if (calls.join() !== 'data') throw new Error(`whitelist CTA should open the data tab, got [${calls.join()}]`)
    const copy = `${slide.title} ${slide.body} ${slide.cta.label}`.toLowerCase()
    for (const banned of ['agentportal', 'agent portal', 'bundleportal', 'bundle portal', '24 hour', '24h']) {
        if (copy.includes(banned)) throw new Error(`whitelist slide copy must not contain "${banned}"`)
    }

    // MTN missing, or out of stock: no whitelist slide, the generic tip stays
    for (const [label, ctx] of [
        ['no MTN packages', { packages: [{ network: 'Telecel' }] }],
        ['MTN out of stock', { packages: [{ network: 'MTN' }], oosNetworks: ['MTN'] }],
    ] as const) {
        const ids2 = buildStorefrontSlides({ ...base, ...ctx }).map(s => s.id)
        assertMissingSlide(ids2, 'mtn-whitelist', label)
        assertHasSlide(ids2, 'instant-delivery-awareness', label)
    }
}

// ── Announcement slide: admin or shop notice, leads the carousel, opens the modal ──
{
    let opened = 0
    const onOpenAnnouncement = () => { opened++ }
    for (const type of ['admin', 'shop'] as const) {
        const slides = buildStorefrontSlides({
            ...base, announcement: { type, title: 'Holiday hours' }, onOpenAnnouncement,
        })
        if (slides[0]?.id !== 'announcement') throw new Error(`${type} announcement slide should lead, got ${slides[0]?.id}`)
        if (slides[0].title !== 'Holiday hours') throw new Error(`${type} slide should use the announcement title`)
        const cta = slides[0].cta
        if (!('onClick' in cta)) throw new Error('announcement CTA must be an in-page action')
        cta.onClick()
    }
    if (opened !== 2) throw new Error(`announcement CTA should call onOpenAnnouncement, called ${opened} times`)

    const admin = buildStorefrontSlides({ ...base, announcement: { type: 'admin' }, onOpenAnnouncement })[0]
    const shop = buildStorefrontSlides({ ...base, announcement: { type: 'shop' }, onOpenAnnouncement })[0]
    if (admin.eyebrow === shop.eyebrow) throw new Error('admin and shop announcements should be labelled differently')
    if (admin.title !== 'Important update') throw new Error(`missing title should fall back, got "${admin.title}"`)
    if (!shop.body.includes('Test Shop')) throw new Error('shop announcement body should name the shop')

    assertMissingSlide(buildStorefrontSlides({ ...base }).map(s => s.id), 'announcement', 'no announcement')
    assertMissingSlide(
        buildStorefrontSlides({ ...base, announcement: null, onOpenAnnouncement }).map(s => s.id),
        'announcement', 'announcement null',
    )
    assertMissingSlide(
        buildStorefrontSlides({ ...base, announcement: { type: 'shop' } }).map(s => s.id),
        'announcement', 'announcement without an opener',
    )
}

console.log('All storefront promo-carousel slide tests passed.')
