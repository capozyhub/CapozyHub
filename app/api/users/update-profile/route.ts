import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { nameSchema, phoneSchema } from '@/lib/validation'
import { hasTrustedRequestOrigin } from '@/lib/site-url'

export async function PUT(request: NextRequest) {
    try {
        if (!hasTrustedRequestOrigin(request)) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
        }

        const contentType = request.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
        }

        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteClient()
        
        // 1. Authenticate user securely from server-context
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized Configuration' }, { status: 401 })
        }
        
        const userId = authUser.id
        const body = await request.json()
        
        // 2. STRICT INPUT VALIDATION (XSS Prevention)
        // phone_number is accepted but never treated as verified: it is the user's own
        // unverified contact claim. This route uses the service-role client, so every other
        // column (role, status, balances...) must stay out of this schema.
        const profileSchema = z.object({
            first_name: nameSchema.optional(),
            last_name: nameSchema.optional(),
            phone_number: phoneSchema.optional(),
        })

        const validation = profileSchema.safeParse(body)
        if (!validation.success) {
            const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
            console.warn(`[Security] Input validation rejected for User: ${userId} — ${errorDetails.join(', ')}`)
            return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
        }

        // 3. STRICT PAYLOAD FILTERING (Mass Assignment Protection)
        // Destructure only the specifically allowed fields from validated data.
        // If an attacker sends { role: 'admin' } or { phone_number: '...' }, it is
        // completely ignored here — never reaches the schema, let alone the payload.
        const { first_name, last_name, phone_number } = validation.data

        const updatePayload = {
            ...(first_name !== undefined && { first_name: String(first_name).trim() }),
            ...(last_name !== undefined && { last_name: String(last_name).trim() }),
            ...(phone_number !== undefined && { phone_number }),
            updated_at: new Date().toISOString()
        }
        
        // 3. Update the database securely using the authenticated user's ID.
        // Use the shared service-role helper so any future client-config change
        // (custom fetch, retry policy, logger, etc.) is picked up here too.
        const supabaseAdmin = createServerClient()

        const { error: updateError } = await (supabaseAdmin
                .from('users') as any)
                .update(updatePayload)
                .eq('id', userId)

        if (updateError) {
            console.error('[UpdateProfile] Database update error:', updateError)

            if (updateError?.code === '23514') {
                return NextResponse.json(
                    { error: "Contact info can't be changed for a sub-agent account. Contact support." },
                    { status: 400 }
                )
            }

            return NextResponse.json({ error: 'Failed to update profile details' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Profile updated securely' }, { status: 200 })

    } catch (e: any) {
        console.error('[UpdateProfile] API error:', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
