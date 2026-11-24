import assert from 'node:assert/strict'
import { DEFAULT_TERMS_SECTIONS, sectionsForAudience } from '../lib/terms'

// What a shop buyer (a guest with no account) is allowed to read.
const MEMBER_ONLY_WORDING = /\b(wallet|dashboard|sub-agents?|developer api|api keys?|paystack|password|reseller|withdraw\w*|order history|your account|sign (up|in)|log ?in|subscription|support details|\bwe\b|\bour\b)\b/i
const MEMBER_ONLY_SECTIONS = ['account', 'wallet', 'resellers', 'api', 'suspension']

const members = sectionsForAudience(DEFAULT_TERMS_SECTIONS, { storefront: false, brand: 'Capozy Hub' })
const buyers = sectionsForAudience(DEFAULT_TERMS_SECTIONS, { storefront: true, brand: 'Kofi Data Hub' })

// Members keep the whole agreement.
assert.equal(members.length, DEFAULT_TERMS_SECTIONS.length)

// Buyers never get the member-only sections.
for (const id of MEMBER_ONLY_SECTIONS) {
    assert.ok(!buyers.some(s => s.id === id), `shop buyers must not see the "${id}" section`)
}

// ...and nothing they do get mentions accounts, wallets, dashboards or API keys.
for (const s of buyers) {
    const text = `${s.title} ${s.body}`
    const hit = text.match(MEMBER_ONLY_WORDING)
    assert.equal(hit, null, `storefront section "${s.id}" contains member-only wording: ${hit?.[0]}`)
}

// {{brand}} resolves to the shop on a storefront and never leaks the raw token.
assert.ok(buyers.every(s => !s.body.includes('{{brand}}') && !s.title.includes('{{brand}}')))
assert.ok(buyers.some(s => s.body.includes('Kofi Data Hub')))

console.log(`terms audience: ok (${members.length} member sections, ${buyers.length} shop sections)`)
