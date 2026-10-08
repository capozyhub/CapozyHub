// scripts/test-shop-sms-batch-response.ts
// Pure-logic test for the response-parsing half of sendHubtelShopBatchSMS.
// Run: npx tsx scripts/test-shop-sms-batch-response.ts

import { parseShopBatchResponse } from '../lib/sms-service'

let failures = 0
function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`)
        failures++
    } else {
        console.log(`PASS: ${label}`)
    }
}

// Success case: Hubtel returns entries for all recipients
assertEqual(
    parseShopBatchResponse({
        status: 0,
        batchId: 'b1',
        data: [
            { to: '233500000001', messageId: 'm1' },
            { to: '233500000002', messageId: 'm2' },
        ],
    }),
    { ok: true, batchId: 'b1', results: [{ to: '233500000001', messageId: 'm1' }, { to: '233500000002', messageId: 'm2' }] },
    'all recipients confirmed'
)

// Partial case: Hubtel only confirms some recipients
assertEqual(
    parseShopBatchResponse({ status: 0, batchId: 'b2', data: [{ to: '233500000001', messageId: 'm1' }] }),
    { ok: true, batchId: 'b2', results: [{ to: '233500000001', messageId: 'm1' }] },
    'partial confirmation (caller computes failed = requested.length - results.length)'
)

// Error case: non-zero status
assertEqual(
    parseShopBatchResponse({ status: 1, statusDescription: 'bad request' }),
    { ok: false, error: 'bad request', results: [] },
    'error response'
)

// Malformed case: missing data array
assertEqual(
    parseShopBatchResponse({ status: 0, batchId: 'b3' }),
    { ok: true, batchId: 'b3', results: [] },
    'missing data array defaults to empty results'
)

if (failures > 0) {
    console.error(`\n${failures} failure(s)`)
    process.exit(1)
}
console.log('\nAll tests passed')
