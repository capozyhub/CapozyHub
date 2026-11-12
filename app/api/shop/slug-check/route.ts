import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { limitDistributed } from '@/lib/distributed-rate-limit'
import { sanitizeSlugInput, suggestSlugs, validateShopSlug } from '@/lib/shop-profile-rules'

// Signed-in only and rate limited, so the endpoint cannot be used to harvest which
// storefront links exist. It answers "can I use this?" for the caller's own shop.
export async function GET(request: NextRequest) {
    const supabaseAuth = await createRouteClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = await limitDistributed('shop-slug-check', user.id, 40, 60)
    if (!limit.allowed) {
        return NextResponse.json(
            { error: 'Too many checks. Wait a moment and try again.' },
            { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
        )
    }

    const slug = sanitizeSlugInput(request.nextUrl.searchParams.get('slug') ?? '').replace(/-+$/, '')
    const ruleError = validateShopSlug(slug)
    if (ruleError) {
        return NextResponse.json({ available: false, reason: ruleError })
    }

    const db = createServerClient()
    const { data, error } = await (db as any)
        .from('shop_profiles')
        .select('owner_id')
        .eq('shop_slug', slug)
        .maybeSingle()
    if (error) {
        console.error('[slug-check] lookup failed:', error)
        return NextResponse.json({ error: 'Could not check that link right now.' }, { status: 500 })
    }

    if (data && data.owner_id !== user.id) {
        return NextResponse.json({
            available: false,
            reason: 'That link is already taken',
            suggestions: suggestSlugs(slug),
        })
    }
    return NextResponse.json({ available: true })
}
