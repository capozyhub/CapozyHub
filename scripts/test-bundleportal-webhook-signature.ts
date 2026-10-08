// scripts/test-bundleportal-webhook-signature.ts
import { createHmac } from 'crypto'
import { verifyBundlePortalSignature } from '../lib/bundleportal-webhook'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
        console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

const secret = 'whsec_test_secret_12345'
const body = JSON.stringify({ event: 'order.completed', order_id: 'abc-123', status: 'completed' })
const validSig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

assertEqual(verifyBundlePortalSignature(body, validSig, secret), true, 'valid signature verifies')
assertEqual(verifyBundlePortalSignature(body, validSig, 'wrong-secret'), false, 'wrong secret fails')
assertEqual(verifyBundlePortalSignature(body + 'tampered', validSig, secret), false, 'tampered body fails')
assertEqual(verifyBundlePortalSignature(body, 'sha256=deadbeef', secret), false, 'wrong-length hex fails without throwing')
assertEqual(verifyBundlePortalSignature(body, '', secret), false, 'empty header fails without throwing')
assertEqual(verifyBundlePortalSignature(body, 'not-even-hex-format', secret), false, 'malformed header fails without throwing')
