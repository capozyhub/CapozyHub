import { getAdminSettings } from '@/lib/admin-settings-cache'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { CopyrightFooter } from '@/components/CopyrightFooter'
import React from 'react'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    // EGRESS: this layout runs on EVERY auth page view, so the settings are cached
    // (see lib/admin-settings-cache.ts). 5-minute TTL: every key is pure display copy
    // an admin changes rarely. Nothing here has a built-in default: the WhatsApp button
    // and footer text only appear once an admin sets real values.
    const adminSettings = await getAdminSettings([
        'whatsapp_admin_number',
        'footer_copyright_text',
        'footer_branding_text',
    ], 5 * 60 * 1000)

    const whatsappAdminNumber = adminSettings.whatsapp_admin_number || ''

    return (
        <div className="relative flex min-h-screen w-full flex-col">
            {whatsappAdminNumber && <FloatingWhatsApp phoneNumber={whatsappAdminNumber} variant="auth" />}
            <div className="flex w-full flex-1 flex-col">{children}</div>
            <CopyrightFooter adminSettings={adminSettings} className="relative z-20 w-full bg-neu" />
        </div>
    )
}
