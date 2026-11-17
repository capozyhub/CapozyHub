import { NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'

// Admin-only — this dispatches real orders to a supplier and spends float, the same
// posture as toggle-supplier-network and every sync-* route next to it. The previous
// hand-rolled check here also accepted 'sub-admin', contradicting the documented
// "sub-admin limited to orders" policy (enforced everywhere else via
// validateAdminAccess(true, request)'s path allowlist, which this route's own path
// does not match) — a real privilege-escalation gap, not just an inconsistency.
export async function POST(request: Request) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const body = await request.json()
        const { orderIds } = body

        const { processRefulfillment } = await import('@/lib/refulfillment-service')
        
        // Call the shared service for manual refulfillment (isCron: false)
        const result = await processRefulfillment(false, orderIds)

        return NextResponse.json(result)
    } catch (error) {
        console.error('[ManualRefulfill] Route Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
