import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { accountEmailSchema } from '@/lib/validation'
import { createServerClient } from '@/lib/supabase'
import { hasTrustedRequestOrigin } from '@/lib/site-url'

const schema = z.object({
    email: accountEmailSchema,
})

export async function POST(request: NextRequest) {
    if (!hasTrustedRequestOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { email } = parsed.data
    const admin = createServerClient()

    const { data } = await (admin.from('users') as any).select('id').eq('email', email).maybeSingle()

    // SEC-025: a plain boolean, no detail about which field collided.
    return NextResponse.json({ available: !data })
}
