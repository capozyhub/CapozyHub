// scripts/test-account-email-schema.ts
//
// Regression guard for accountEmailSchema (lib/validation.ts). Root cause,
// 2026-09-29: three orphaned auth.users rows were found with malformed
// addresses like "petabenney@8" — no dot, no real domain. emailSchema's own
// regex (requires a dot in the domain) already rejects that exact string, so
// those rows predate this check or were created via a path that bypasses it
// entirely (not something this schema alone can fix retroactively). What IS
// this schema's job going forward: reject ANY domain that isn't a real,
// recognized consumer email provider — not just "has a dot somewhere" — for
// every flow that creates or looks up a LOGIN identity (signup, sub-agent
// creation/reset, forgot-password, resend-confirmation, check-availability).
// Deliberately NOT applied to shop owner_email (app/api/shop/profile) or
// results-checker recipient email — those are business/receipt contact
// addresses, not login identities, and a real shop legitimately may use a
// custom business domain.
import { accountEmailSchema } from '../lib/validation'

let pass = 0, fail = 0
function assert(cond: boolean, msg: string) {
    if (cond) { console.log(`PASS: ${msg}`); pass++ }
    else { console.error(`FAIL: ${msg}`); fail++ }
}

// ── Rejects the exact malformed shape found live in production ──
assert(!accountEmailSchema.safeParse('petabenney@8').success, 'rejects "petabenney@8" (no real domain)')
assert(!accountEmailSchema.safeParse('foo@bar').success, 'rejects a domain with no dot at all')
assert(!accountEmailSchema.safeParse('foo@bar.xyz').success, 'rejects a syntactically-valid but unrecognized domain')
assert(!accountEmailSchema.safeParse('foo@kingflexygh-fake.com').success, 'rejects a plausible-looking but non-allowlisted domain')

// ── Accepts real, common consumer providers ──
for (const addr of [
    'user@gmail.com', 'user@googlemail.com', 'user@icloud.com', 'user@outlook.com',
    'user@hotmail.com', 'user@live.com', 'user@yahoo.com', 'user@yahoo.co.uk',
]) {
    assert(accountEmailSchema.safeParse(addr).success, `accepts ${addr}`)
}

// ── Case-insensitive on the domain ──
assert(accountEmailSchema.safeParse('user@GMAIL.COM').success, 'accepts an uppercase domain (case-insensitive match)')

if (fail > 0) {
    console.error(`\n${pass} passed, ${fail} failed`)
    process.exit(1)
}
console.log(`\nAll ${pass} accountEmailSchema checks passed.`)
