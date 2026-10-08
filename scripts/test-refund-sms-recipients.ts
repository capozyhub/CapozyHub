// scripts/test-refund-sms-recipients.ts
//
// selectRefundSmsRecipients is the single source of truth for the
// beneficiary/payer dedup rule: index 0 is always the beneficiary, and index
// 1 (if present) is the payer. notifyShopGuestRefund in lib/refund-service.ts
// sends the beneficiary's SMS first and separately (so a slow/unbounded payer
// lookup can never delay or silence it), then calls this function only to
// decide whether `recipients.length > 1` warrants a second, independent send
// to the payer. The pure return-value contract asserted below is unchanged
// by that reordering.
import { sameGhanaNumber, selectRefundSmsRecipients } from '../lib/refund-service'

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

assertEqual(sameGhanaNumber('0241234567', '0241234567'), true, 'identical local numbers → same')
assertEqual(sameGhanaNumber('0241234567', '233241234567'), true, '233-form vs 0-form → same')
assertEqual(sameGhanaNumber('+233 24 123 4567', '0241234567'), true, 'spaces and +233 → same')
assertEqual(sameGhanaNumber('0241234567', '0209998888'), false, 'different numbers → not same')
assertEqual(sameGhanaNumber(null, '0241234567'), false, 'null → not same')
assertEqual(sameGhanaNumber('0241234567', undefined), false, 'undefined → not same')
assertEqual(sameGhanaNumber('', ''), false, 'empty strings → not same (nothing to compare)')

assertEqual(selectRefundSmsRecipients('0241234567', null), ['0241234567'], 'unknown payer → beneficiary only')
assertEqual(selectRefundSmsRecipients('0241234567', undefined), ['0241234567'], 'undefined payer → beneficiary only')
assertEqual(selectRefundSmsRecipients('0241234567', '0241234567'), ['0241234567'], 'payer same as beneficiary → one send')
assertEqual(selectRefundSmsRecipients('0241234567', '233241234567'), ['0241234567'], 'payer same line in 233 form → one send')
assertEqual(selectRefundSmsRecipients('0241234567', '0209998888'), ['0241234567', '0209998888'], 'different payer → both, beneficiary first')
assertEqual(selectRefundSmsRecipients('0241234567', ''), ['0241234567'], 'empty payer string → beneficiary only')

if (process.exitCode === 1) {
    console.error('Some refund-sms-recipient tests FAILED')
} else {
    console.log('All refund-sms-recipient tests passed.')
}
