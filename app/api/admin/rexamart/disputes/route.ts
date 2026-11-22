import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { listDisputes, fileDispute, isRexamartConfigured, type RexamartProductKind } from '@/lib/rexamart-service'

export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        if (!isRexamartConfigured()) {
            return NextResponse.json({ error: 'Rexamart is not configured' }, { status: 503 })
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || undefined
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
        const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

        const result = await listDisputes(status, limit, offset)
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 502 })
        }
        return NextResponse.json({ disputes: result.disputes })
    } catch (error) {
        console.error('[Admin Rexamart Disputes] GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Lets an admin file a not-received dispute directly (e.g. a customer complaint that
// never went through Rexamart's own channel). Filing twice for the same order is safe
// — Rexamart returns the original reference with created:false.
export async function POST(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        if (!isRexamartConfigured()) {
            return NextResponse.json({ error: 'Rexamart is not configured' }, { status: 503 })
        }

        let body: any
        try { body = await request.json() } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
        const description = typeof body?.description === 'string' ? body.description.trim() : ''
        const productKind: RexamartProductKind = ['data', 'msp', 'bmi', 'afa'].includes(body?.productKind) ? body.productKind : 'data'

        if (!orderId || !description) {
            return NextResponse.json({ error: 'orderId and description are required' }, { status: 400 })
        }

        const result = await fileDispute(orderId, description, productKind)
        if (!result.success) {
            return NextResponse.json({ error: result.error, errorCode: result.errorCode }, { status: 502 })
        }
        return NextResponse.json(result)
    } catch (error) {
        console.error('[Admin Rexamart Disputes] POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
