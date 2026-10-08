// scripts/test-hendylinks-webhook-signature.ts
// Pure-logic tests for the HendyLinks webhook HMAC verification. Run with:
//   npx tsx scripts/test-hendylinks-webhook-signature.ts
//
// Spec-mandated (design spec, Testing section): valid signature accepted, tampered payload
// rejected, missing header rejected, and a constant-time compare — never a plain `===`.
// A length-mismatched signature must return false rather than throw: Node's timingSafeEqual
// THROWS on differing buffer lengths, so an attacker sending a short signature could otherwise
// turn every delivery into a 500 (and, on the retrying supplier side, an infinite redelivery).
//
// The function under test lives in lib/hendylinks-webhook-signature.ts rather than in
// app/api/webhooks/hendylinks/route.ts because a Next.js App Router route.ts may only export
// route handlers and route config — a helper exported from it fails the build's route type check.

import { createHmac } from 'crypto'
import { verifyHendyLinksSignature } from '../lib/hendylinks-webhook-signature'

let passCount = 0

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        passCount++
        console.log(`PASS: ${label}`)
    }
}

const SECRET = 'hl_test_secret_do_not_use_in_production'
const BODY = JSON.stringify({
    event: 'order.status_changed',
    order: { id: 987654, status: 'completed' },
})

function sign(body: string, secret = SECRET): string {
    return createHmac('sha256', secret).update(body).digest('hex')
}

// ── Valid signatures ─────────────────────────────────────────────────────────
assertEqual(verifyHendyLinksSignature(BODY, `sha256=${sign(BODY)}`, SECRET), true, 'valid signature with the sha256= prefix → accepted')
assertEqual(verifyHendyLinksSignature(BODY, sign(BODY), SECRET), true, 'valid signature without the prefix (bare hex) → accepted')
assertEqual(verifyHendyLinksSignature('', `sha256=${sign('')}`, SECRET), true, 'valid signature over an empty body → accepted')

// ── Tampered body ────────────────────────────────────────────────────────────
// The signature is correct for BODY, but the body delivered says 'completed' for a DIFFERENT
// order — the exact forgery this check exists to stop.
const tamperedBody = JSON.stringify({
    event: 'order.status_changed',
    order: { id: 111111, status: 'completed' },
})
assertEqual(verifyHendyLinksSignature(tamperedBody, `sha256=${sign(BODY)}`, SECRET), false, 'tampered body with an otherwise-valid signature → rejected')
assertEqual(verifyHendyLinksSignature(BODY + ' ', `sha256=${sign(BODY)}`, SECRET), false, 'body altered by a single trailing space → rejected')

// ── Tampered signature (same length, so it reaches timingSafeEqual) ──────────
const valid = sign(BODY)
const flipped = (valid[0] === 'a' ? 'b' : 'a') + valid.slice(1)
assertEqual(flipped.length, valid.length, 'sanity: the flipped signature is the same length as the valid one')
assertEqual(verifyHendyLinksSignature(BODY, `sha256=${flipped}`, SECRET), false, 'signature with one hex character changed → rejected')

// ── Missing / empty header ───────────────────────────────────────────────────
assertEqual(verifyHendyLinksSignature(BODY, '', SECRET), false, 'missing X-Webhook-Signature header → rejected')
assertEqual(verifyHendyLinksSignature(BODY, 'sha256=', SECRET), false, 'header present but empty after the prefix → rejected')

// ── Wrong secret ─────────────────────────────────────────────────────────────
assertEqual(verifyHendyLinksSignature(BODY, `sha256=${sign(BODY, 'the_wrong_secret')}`, SECRET), false, 'signature computed with a different secret → rejected')

// ── Fail closed with no secret configured ────────────────────────────────────
assertEqual(verifyHendyLinksSignature(BODY, `sha256=${sign(BODY)}`, ''), false, 'empty secret → rejected (fails closed)')

// ── Length-mismatched signatures MUST NOT THROW ──────────────────────────────
// timingSafeEqual throws on differing buffer lengths. If that escaped, a one-character
// signature would produce a 500 instead of a 401.
function returnsFalseWithoutThrowing(signatureHeader: string, label: string) {
    let threw = false
    let result: boolean | null = null
    try {
        result = verifyHendyLinksSignature(BODY, signatureHeader, SECRET)
    } catch {
        threw = true
    }
    assertEqual({ threw, result }, { threw: false, result: false }, label)
}

returnsFalseWithoutThrowing('sha256=abc', 'signature far too short → false, no throw')
returnsFalseWithoutThrowing(`sha256=${valid.slice(0, -1)}`, 'signature one character too short → false, no throw')
returnsFalseWithoutThrowing(`sha256=${valid}ff`, 'signature longer than expected → false, no throw')
returnsFalseWithoutThrowing('not-even-a-signature', 'garbage header → false, no throw')
returnsFalseWithoutThrowing('sha256=zzzz'.padEnd(71, 'z'), 'non-hex characters at the right length → false, no throw')

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log(`\nAll tests passed. (${passCount} assertions)`)
}
