// scripts/test-refund-sms-copy.ts
//
// Guards the guest refund SMS on three things that cost real money or real support load:
//
//  1. LENGTH. Over 160 chars an SMS silently splits into two segments and bills double,
//     on every refund, forever. Nothing else in the codebase catches that.
//  2. WORDING. Guests were calling sellers instead of messaging them, because the old
//     copy said "Contact <number>". The action must be named before the number. They were
//     also reading "was refunded" as "money already received" — copy now leads with
//     "wasn't completed; refunded" and says "to receive" instead (2026-09-24).
//  3. ESCALATION WINDOW. Tightened from 24h to 6h (2026-09-24) so guests who never hear
//     back from the seller reach support sooner.
//
// Pure-logic test, run with: npx tsx scripts/test-refund-sms-copy.ts

import { buildShopGuestRefundMessage, buildAfaGuestRefundMessage } from '../lib/sms-service'

const SMS_SINGLE_SEGMENT_LIMIT = 160

let failures = 0
function check(cond: boolean, label: string, extra?: string) {
    if (cond) {
        console.log(`PASS: ${label}`)
    } else {
        console.error(`FAIL: ${label}${extra ? ` — ${extra}` : ''}`)
        failures++
    }
}

// Realistic worst case actually reachable from the orders table: the longest network
// label, the longest `size` string the shop order processor writes (mashup/airtime
// render as e.g. "GHS 500.00 Mashup Bundle"), and a phone stored in +233 form.
const WORST = {
    network: 'Telecel',
    size: 'GHS 500.00 Mashup Bundle',
    ownerPhone: '+233241234567',
}
const TYPICAL = {
    network: 'MTN',
    size: '5GB',
    ownerPhone: '0241234567',
}

for (const [label, details] of [['typical', TYPICAL], ['worst case', WORST]] as const) {
    const msg = buildShopGuestRefundMessage(details)
    check(
        msg.length <= SMS_SINGLE_SEGMENT_LIMIT,
        `${label} message fits one SMS segment (${msg.length} chars)`,
        `${msg.length} > ${SMS_SINGLE_SEGMENT_LIMIT}: "${msg}"`,
    )
    // Non-GSM characters (emoji, curly quotes) force UCS-2, which drops the single-segment
    // limit from 160 to 70 — well under our length. Keep the copy plain ASCII.
    check(
        // eslint-disable-next-line no-control-regex
        /^[\x00-\x7F]*$/.test(msg),
        `${label} message is plain ASCII (no emoji/smart quotes → stays GSM-7)`,
    )
}

const sample = buildShopGuestRefundMessage(TYPICAL)

check(
    sample.includes(`WhatsApp (not a call) ${TYPICAL.ownerPhone}`),
    'seller number is introduced as WhatsApp AND explicitly marked not a call',
    sample,
)
check(
    /\(not a call\)/.test(sample),
    'the explicit "(not a call)" instruction is present',
    sample,
)
check(
    !/Contact\s/i.test(sample),
    'copy avoids the word "Contact", which read as an invitation to call',
    sample,
)
check(
    sample.indexOf('WhatsApp') < sample.indexOf(TYPICAL.ownerPhone),
    'the action ("WhatsApp") appears before the seller number, not after',
    sample,
)
check(
    sample.includes(TYPICAL.size),
    'message still identifies which order was refunded by size (network deliberately omitted — SMS goes straight to the beneficiary)',
    sample,
)
check(
    !sample.includes(TYPICAL.network),
    'network is NOT in the text (still required in the details object for the caller\'s gating check, just not rendered)',
    sample,
)
check(
    sample.includes('0578065809'),
    'the 6hr escalation route to support is still present',
    sample,
)
check(
    /6h/.test(sample) && !/24h/.test(sample),
    'escalation window reads 6h, not the old 24h',
    sample,
)
check(
    /wasn.t completed/.test(sample),
    'copy leads with "wasn\'t completed" so guests don\'t read "refunded" as money already received',
    sample,
)

for (const [label, phone] of [['typical', '0241234567'], ['worst case', '+233241234567']] as const) {
    const msg = buildAfaGuestRefundMessage({ ownerPhone: phone })
    check(
        msg.length <= SMS_SINGLE_SEGMENT_LIMIT,
        `AFA ${label} message fits one SMS segment (${msg.length} chars)`,
        `${msg.length} > ${SMS_SINGLE_SEGMENT_LIMIT}: "${msg}"`,
    )
    check(
        // eslint-disable-next-line no-control-regex
        /^[\x00-\x7F]*$/.test(msg),
        `AFA ${label} message is plain ASCII`,
    )
    check(/\(not a call\)/.test(msg), `AFA ${label} message keeps "(not a call)"`, msg)
    check(!/Contact\s/i.test(msg), `AFA ${label} message avoids "Contact"`, msg)
}
console.log(`AFA sample: ${buildAfaGuestRefundMessage({ ownerPhone: '0241234567' })}`)

console.log(`\nSample (${sample.length} chars): ${sample}`)
console.log(failures === 0 ? '\nAll tests PASSED' : `\n${failures} test(s) FAILED`)
if (failures > 0) process.exitCode = 1
