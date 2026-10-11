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

// commission: only /api/utilities/*
assertAllowed('commission', '/api/utilities/pay')
assertBlocked('commission', '/api/data/purchase')
assertBlocked('commission', '/api/sms/send')

// sms: only /api/sms/*
assertAllowed('sms', '/api/sms/send')
assertAllowed('sms', '/api/sms/balance')
assertBlocked('sms', '/api/data/purchase')
assertBlocked('sms', '/api/utilities/pay')

// standard: unrestricted EXCEPT utilities and sms (existing + new restriction)
assertAllowed('standard', '/api/data/purchase')
assertAllowed('standard', '/api/wallet/balance')
assertBlocked('standard', '/api/sms/send')

// commission scope was widened to also cover /api/airtime/* (Task 3).
assertAllowed('commission', '/api/airtime/purchase')
assertBlocked('standard', '/api/airtime/purchase')
assertBlocked('sms', '/api/airtime/purchase')

// Prefix confusion must not defeat the scope guard either.
assertAllowed('standard', '/api/utilitiesx/foo')
assertAllowed('standard', '/api/smsx/foo')

console.log('All api-auth scope guard tests passed.')
