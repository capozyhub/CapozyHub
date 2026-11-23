// scripts/test-api-auth-scope.ts
//
// There is exactly one API key type ('standard'). Any other key_type on a row (a legacy or
// unknown value) must be refused outright, never treated as standard.
import { unsupportedKeyType } from '@/lib/api-auth'

function assertAllowed(keyType: string) {
    if (unsupportedKeyType(keyType)) throw new Error(`Expected key type "${keyType}" to be ALLOWED, but it was refused`)
}
function assertRefused(keyType: string) {
    const res = unsupportedKeyType(keyType)
    if (!res) throw new Error(`Expected key type "${keyType}" to be REFUSED, but it passed`)
    if (res.status !== 403) throw new Error(`Expected a 403 for key type "${keyType}", got ${res.status}`)
}

assertAllowed('standard')

// Retired types must never pass.
assertRefused('commission')
assertRefused('sms')

// Garbage must never pass either.
assertRefused('')
assertRefused('Standard')
assertRefused('standard ')
assertRefused(undefined as unknown as string)
assertRefused(null as unknown as string)

console.log('All api-auth key-type guard tests passed.')