import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { checkBeneficiaries, isRexamartConfigured } from '@/lib/rexamart-service'
import { consumeRateLimit } from '@/lib/simple-rate-limit'

// Mirrors Rexamart's own limits (max 40 numbers/request, 10 requests/min) so a
// misbehaving admin tab gets a clear local error instead of Rexamart's.
export async function POST(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error || !authResult.user) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
        }
        if (!isRexamartConfigured()) {
            return NextResponse.json({ error: 'Rexamart is not configured' }, { status: 503 })
        }

        const rl = consumeRateLimit(`admin-rexamart-beneficiary:${authResult.user.id}`, 10, 60_000)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 })
        }

        let body: any
        try { body = await request.json() } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const numbers = Array.isArray(body?.numbers)
            ? body.numbers.filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
            : []
        if (numbers.length === 0) {
            return NextResponse.json({ error: 'At least one number is required' }, { status: 400 })
        }
        if (numbers.length > 40) {
            return NextResponse.json({ error: 'At most 40 numbers per request' }, { status: 400 })
        }

        const result = await checkBeneficiaries(numbers)
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 })
        }
        return NextResponse.json({ results: result.results })
    } catch (error) {
        console.error('[Admin Rexamart Beneficiary Check] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
