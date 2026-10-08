import { createServerClient } from '@supabase/ssr'
import { getAdminSettings } from '@/lib/admin-settings-cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardLayoutClient from './dashboard-layout-client'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies()

    // Verify session and get user ID via the cookie-aware SSR client.
    const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { /* read-only in layout */ },
            },
        }
    )
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
        redirect('/auth')
    }

    // Admin settings (cached: this layout runs on EVERY dashboard page view, see
    // lib/admin-settings-cache.ts). 5-minute TTL (product decision, 2026-09-24):
    // every key here is pure display copy an admin changes rarely.
    //
    // The only gate on the dashboard is "signed in". There is deliberately no
    // phone-verification or profile-completeness redirect: phone numbers are
    // collected unverified and asked for again only where a feature needs one.
    const adminSettings = await getAdminSettings([
        'footer_copyright_text', 'footer_branding_text', 'whatsapp_community_link',
        'terms_current_version', 'terms_min_acceptable_version',
        'terms_effective_date',
    ], 5 * 60 * 1000)

    // Removed 2026-09-30 (owner decision): sub-agents used to be forced to
    // change their access key into a self-chosen password on first login.
    // Now that access keys are delivered over SMS (already a real, private
    // channel to the sub-agent's own phone), the forced change added no real
    // security beyond what SMS delivery already provides, and it broke
    // ordinary dashboard actions — the API-level backstop
    // (middleware.ts, removed in the same change) blocked EVERY /api/** call
    // for a flagged sub-agent outside a 4-path allowlist, which is why a
    // sub-agent trying to use "MTN Number Registration" (or any other
    // feature) got "You must change your password before continuing"
    // instead of the feature working. The `sub_agents.must_change_password`
    // column and lib/sub-agent-account.ts's fetchMustChangePassword/
    // clearMustChangePasswordIfSubAgent helpers are left in place, unused —
    // harmless, and this is trivially reversible if the requirement comes
    // back. /auth/change-password-required still exists as an optional,
    // self-service page (nothing links to it automatically anymore).

    const communityLink = adminSettings.whatsapp_community_link || ''
    return (
        <DashboardLayoutClient adminSettings={adminSettings} communityLink={communityLink}>
            {children}
        </DashboardLayoutClient>
    )
}
