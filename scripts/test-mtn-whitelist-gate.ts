// scripts/test-mtn-whitelist-gate.ts
import { shouldEvaluateWhitelistGate, MTN_WHITELIST_BLOCKED_MESSAGE, canonicalKeyFor } from '../lib/mtn-whitelist-gate'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// ── shouldEvaluateWhitelistGate ────────────────────────────────────────────
assertEqual(shouldEvaluateWhitelistGate('MTN', 'data'), true, 'MTN + data category → evaluate')
assertEqual(shouldEvaluateWhitelistGate('MTN', undefined), true, 'MTN + no category → evaluate')
assertEqual(shouldEvaluateWhitelistGate('MTN', null), true, 'MTN + null category → evaluate')
assertEqual(shouldEvaluateWhitelistGate('mtn', 'data'), true, 'lowercase mtn is still MTN')
assertEqual(shouldEvaluateWhitelistGate(' MTN ', 'data'), true, 'surrounding whitespace on network is trimmed')
assertEqual(shouldEvaluateWhitelistGate('MTN', 'mtn_mashup'), false, 'MTN + mashup category → never evaluate')
assertEqual(shouldEvaluateWhitelistGate('Telecel', 'data'), false, 'Telecel → never evaluate')
assertEqual(shouldEvaluateWhitelistGate('AT-iShare', 'data'), false, 'AT-iShare → never evaluate')
assertEqual(shouldEvaluateWhitelistGate('AT-BigTime', 'data'), false, 'AT-BigTime → never evaluate')
assertEqual(shouldEvaluateWhitelistGate(null, 'data'), false, 'null network → never evaluate')
assertEqual(shouldEvaluateWhitelistGate(undefined, undefined), false, 'undefined network → never evaluate')
assertEqual(shouldEvaluateWhitelistGate('', 'data'), false, 'empty string network → never evaluate')

// ── Malformed-input hazard (documents why checkMtnWhitelistGateBatch must wrap
// its ENTIRE body — including the per-item shouldEvaluateWhitelistGate call —
// in a single try/catch). shouldEvaluateWhitelistGate's contract is
// `string|null|undefined`; a runtime violation (e.g. malformed order data
// slipping a number/object past the type annotation) correctly throws here —
// it is a sync pure helper, not itself required to fail open. The exported
// async batch/single-item gate functions are what must catch this and never
// let it escape to their caller, which is what the fix under review restores. ──
try {
    // @ts-expect-error - exercising a runtime type violation (e.g. malformed order data)
    shouldEvaluateWhitelistGate(12345, 'data')
    console.error('FAIL: shouldEvaluateWhitelistGate(12345, ...) — expected a throw, none happened')
    process.exitCode = 1
} catch {
    console.log('PASS: shouldEvaluateWhitelistGate throws on a non-string truthy network (confirms callers must catch it — checkMtnWhitelistGateBatch now wraps its entire body, so this can no longer escape to batch callers)')
}

// ── canonicalKeyFor (final-review fix: batch/single response-matching mismatch) ──
// lib/agentportal-whitelist.ts documents `normalized` as "AgentPortal's own normalized
// form (falls back to ours when absent)" — NOT guaranteed to already be our canonical
// 0XXXXXXXXX format. canonicalKeyFor must re-derive our canonical key from whatever
// AgentPortal actually echoes back, so the batch gate's lookup map never silently misses.
assertEqual(
    canonicalKeyFor({ normalized: '0241000001', input: '0241000001' }),
    '0241000001',
    'canonicalKeyFor: already-canonical normalized form is used as-is',
)
assertEqual(
    canonicalKeyFor({ normalized: '233241000001', input: '0241000001' }),
    '0241000001',
    'canonicalKeyFor: international-form normalized field is re-canonicalized to our 0XXXXXXXXX form',
)
assertEqual(
    canonicalKeyFor({ normalized: '', input: '0241000001' }),
    '0241000001',
    'canonicalKeyFor: falls back to `input` when `normalized` cannot be canonicalized',
)
assertEqual(
    canonicalKeyFor({ normalized: 'garbage', input: 'also-garbage' }),
    null,
    'canonicalKeyFor: returns null (row dropped, never mis-keyed) when neither field can be canonicalized',
)

// ── Blocked message is stable (surfaces verbatim to buyers on every purchase surface) ──
assertEqual(
    MTN_WHITELIST_BLOCKED_MESSAGE,
    "This number isn't registered to receive MTN data yet. We've submitted it for registration — please try again soon.",
    'blocked message text is exact',
)

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log('\nAll tests passed.')
}
