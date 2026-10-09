// scripts/test-promo-carousel-dashboard-slides.ts
//
// buildDashboardSlides decides which upsell/status cards a user sees in their
// main-dashboard promo carousel. The subagent exclusions here are the easiest
// rule to regress (subagents must never see Recruit or Upgrade slides), so
// every role combination is pinned explicitly.
import { buildDashboardSlides } from '@/lib/promo-carousel/dashboard-slides'

function assertHasSlide(ids: string[], id: string, label: string) {
    if (!ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be present, got [${ids.join(', ')}]`)
}

function assertMissingSlide(ids: string[], id: string, label: string) {
    if (ids.includes(id)) throw new Error(`${label}: expected slide "${id}" to be ABSENT, got [${ids.join(', ')}]`)
}

const base = {
    hasShop: true,
}

// ── Subagent: never recruit, never upgrade ──────────────────────────────────
{
    const ids = buildDashboardSlides({ ...base, role: 'subagent' }).map(s => s.id)
    assertMissingSlide(ids, 'recruit-subagents', 'subagent')
    assertMissingSlide(ids, 'upgrade-account', 'subagent')
}

// ── Agent: recruit yes, upgrade yes ─────────────────────────────────────────
{
    const ids = buildDashboardSlides({ ...base, role: 'agent' }).map(s => s.id)
    assertHasSlide(ids, 'recruit-subagents', 'agent')
    assertHasSlide(ids, 'upgrade-account', 'agent')
}

// ── Dealer: recruit yes, upgrade no (top tier) ──────────────────────────────
{
    const ids = buildDashboardSlides({ ...base, role: 'dealer' }).map(s => s.id)
    assertHasSlide(ids, 'recruit-subagents', 'dealer')
    assertMissingSlide(ids, 'upgrade-account', 'dealer')
}

// ── Customer: no recruit, upgrade yes ───────────────────────────────────────
{
    const ids = buildDashboardSlides({ ...base, role: 'customer' }).map(s => s.id)
    assertMissingSlide(ids, 'recruit-subagents', 'customer')
    assertHasSlide(ids, 'upgrade-account', 'customer')
}

// ── The MTN whitelist slide is gone: no supplier registration check anywhere ──
for (const role of ['customer', 'agent', 'dealer', 'subagent', null]) {
    assertMissingSlide(buildDashboardSlides({ ...base, role }).map(s => s.id), 'mtn-whitelist', `no whitelist slide for ${String(role)}`)
}

// ── No shop surfaces the launch-shop slide, even for subagents ─────────────
{
    const ids = buildDashboardSlides({ ...base, role: 'subagent', hasShop: false }).map(s => s.id)
    assertHasSlide(ids, 'launch-shop', 'subagent without shop')
}
{
    const ids = buildDashboardSlides({ ...base, role: 'subagent', hasShop: true }).map(s => s.id)
    assertMissingSlide(ids, 'launch-shop', 'subagent with shop')
}

// ── Product slides always present regardless of role ────────────────────────
for (const role of ['customer', 'agent', 'dealer', 'subagent']) {
    const ids = buildDashboardSlides({ ...base, role }).map(s => s.id)
    assertHasSlide(ids, 'product-data', `product slides for ${role}`)
    assertHasSlide(ids, 'product-airtime', `product slides for ${role}`)
    assertHasSlide(ids, 'product-afa', `product slides for ${role}`)
    assertHasSlide(ids, 'product-results-checker', `product slides for ${role}`)
    assertHasSlide(ids, 'product-mashup', `product slides for ${role}`)
}

// ── Announcement slide: only when an announcement is active AND can be opened ──
{
    let opened = 0
    const onOpenAnnouncement = () => { opened++ }
    for (const role of ['customer', 'agent', 'dealer', 'subagent']) {
        const slides = buildDashboardSlides({
            ...base, role, announcement: { title: 'Scheduled maintenance' }, onOpenAnnouncement,
        })
        if (slides[0]?.id !== 'announcement') throw new Error(`announcement slide should lead the carousel for ${role}, got ${slides[0]?.id}`)
        const cta = slides[0].cta
        if (!('onClick' in cta)) throw new Error('announcement CTA must be an in-page action')
        cta.onClick()
    }
    if (opened !== 4) throw new Error(`announcement CTA should call onOpenAnnouncement, called ${opened} times`)

    assertMissingSlide(buildDashboardSlides({ ...base, role: 'customer' }).map(s => s.id), 'announcement', 'no announcement')
    assertMissingSlide(
        buildDashboardSlides({ ...base, role: 'customer', announcement: null, onOpenAnnouncement }).map(s => s.id),
        'announcement', 'announcement null',
    )
    assertMissingSlide(
        buildDashboardSlides({ ...base, role: 'customer', announcement: { title: 'x' } }).map(s => s.id),
        'announcement', 'announcement without an opener',
    )
    const long = buildDashboardSlides({
        ...base, role: 'customer', announcement: { title: 'A'.repeat(200) }, onOpenAnnouncement,
    })[0]
    if (long.title.length > 60) throw new Error(`announcement title should be truncated, got ${long.title.length} chars`)
    const untitled = buildDashboardSlides({ ...base, role: 'customer', announcement: { title: '' }, onOpenAnnouncement })[0]
    if (untitled.title !== 'Important update') throw new Error(`empty title should fall back, got "${untitled.title}"`)
}

console.log('All dashboard promo-carousel slide tests passed.')
