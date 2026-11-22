import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { fetchBalance, isRexamartConfigured } from '@/lib/rexamart-service'

export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        if (!isRexamartConfigured()) {
            return NextResponse.json({ error: 'Rexamart is not configured' }, { status: 503 })
        }

        const result = await fetchBalance()
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 })
        }
        return NextResponse.json({ balance: result.balance, currency: result.currency })
    } catch (error) {
        console.error('[Admin Rexamart Balance] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
