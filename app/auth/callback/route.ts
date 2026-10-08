import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthCookieOptions } from '@/lib/cookie-domain'

/**
 * Exchanges the one-time `code` that Supabase appends to email links (password
 * recovery, and email confirmation if it is ever switched on) for a session, then
 * sends the user on to `next`.
 *
 * Email + password is the only sign-in method, so there is no provider handling and
 * no profile-completeness redirect here.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)

    const linkError = searchParams.get('error')
    if (linkError) {
        console.error('[Auth Callback] link error:', linkError, searchParams.get('error_description') ?? '')
        return NextResponse.redirect(`${origin}/auth?error=link_failed`)
    }

    const code = searchParams.get('code')

    // Must be a relative path: blocks open-redirect phishing.
    const rawNext = searchParams.get('next') ?? '/dashboard'
    const next =
        rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes(':')
            ? rawNext
            : '/dashboard'

    if (!code) {
        console.error('[Auth Callback] No code in callback URL: check the redirect URLs allowed in Supabase Auth settings')
        return NextResponse.redirect(`${origin}/auth?error=link_failed`)
    }

    const cookieStore = await cookies()

    // Collect the cookies exchangeCodeForSession writes and apply them to the redirect
    // response, so the browser stores the session before following the redirect.
    const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

    // Must be the @supabase/ssr server client: PKCE keeps the code_verifier in a cookie
    // that this client reads when exchanging the code.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: getAuthCookieOptions(),
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(c => pendingCookies.push(c as typeof pendingCookies[number]))
                },
            },
        }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user) {
        console.error('[Auth Callback] exchangeCodeForSession failed:', {
            message: error?.message,
            status: (error as any)?.status,
        })
        return NextResponse.redirect(`${origin}/auth?error=link_failed`)
    }

    const response = NextResponse.redirect(`${origin}${next}`)
    pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    })
    return response
}
