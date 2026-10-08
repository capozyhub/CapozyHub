// scripts/test-api-webhook-signing.ts
import { createHmac } from 'crypto'
import { signWebhookPayload } from '@/lib/api-webhook'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const secret = 'test-secret-abc123'
const payload = JSON.stringify({ event: 'order.completed', product: 'airtime', reference: 'API-abc', status: 'completed', timestamp: '2026-01-01T00:00:00.000Z' })

const signature = signWebhookPayload(secret, payload)
const expected = createHmac('sha256', secret).update(payload).digest('hex')
assertEqual(signature, expected, 'signature matches independently-computed HMAC-SHA256')

// Same payload, different secret -> different signature (sanity: the secret is actually used)
const otherSignature = signWebhookPayload('different-secret', payload)
if (signature === otherSignature) throw new Error('signatures must differ when the secret differs')

// Same secret, different payload -> different signature (sanity: the payload is actually used)
const otherPayloadSignature = signWebhookPayload(secret, payload + ' ')
if (signature === otherPayloadSignature) throw new Error('signatures must differ when the payload differs')

console.log('All api-webhook-signing tests passed.')
