// scripts/test-api-auth-scope.ts
import { keyTypeScopeGuard } from '@/lib/api-auth'

function assertBlocked(keyType: 'standard' | 'commission' | 'sms', path: string) {
    const res = keyTypeScopeGuard(keyType, path)
    if (!res) throw new Error(`Expected ${keyType} to be BLOCKED on ${path}, but it passed`)
}
function assertAllowed(keyType: 'standard' | 'commission' | 'sms', path: string) {
    const res = keyTypeScopeGuard(keyType, path)
    if (res) throw new Error(`Expected ${keyType} to be ALLOWED on ${path}, but it was blocked`)
}

// commission: only /api/v1/utilities/*
assertAllowed('commission', '/api/v1/utilities/pay')
assertBlocked('commission', '/api/v1/data/purchase')
assertBlocked('commission', '/api/v1/sms/send')

// sms: only /api/v1/sms/*
assertAllowed('sms', '/api/v1/sms/send')
assertAllowed('sms', '/api/v1/sms/balance')
assertBlocked('sms', '/api/v1/data/purchase')
assertBlocked('sms', '/api/v1/utilities/pay')

// standard: unrestricted EXCEPT utilities and sms (existing + new restriction)
assertAllowed('standard', '/api/v1/data/purchase')
assertAllowed('standard', '/api/v1/wallet/balance')
assertBlocked('standard', '/api/v1/sms/send')

// v2 scoping must behave identically to v1 — the guard is version-agnostic so
// that porting a route to v2 cannot silently fail open.
assertAllowed('commission', '/api/v2/utilities/pay')
assertBlocked('commission', '/api/v2/data/purchase')
assertBlocked('commission', '/api/v2/sms/send')
assertAllowed('sms', '/api/v2/sms/send')
assertBlocked('sms', '/api/v2/utilities/pay')
assertAllowed('standard', '/api/v2/data/purchase')
assertBlocked('standard', '/api/v2/utilities/pay')
assertBlocked('standard', '/api/v2/sms/send')

// commission scope was widened to also cover /api/v2/airtime/* (Task 3).
assertAllowed('commission', '/api/v2/airtime/purchase')
assertBlocked('standard', '/api/v2/airtime/purchase')
assertBlocked('sms', '/api/v2/airtime/purchase')

// Prefix confusion must not defeat the scope guard either.
assertAllowed('standard', '/api/v2/utilitiesx/foo')
assertAllowed('standard', '/api/v1/smsx/foo')

console.log('All api-auth scope guard tests passed.')
