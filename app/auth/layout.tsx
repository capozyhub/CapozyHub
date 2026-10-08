import { getAdminSettings } from '@/lib/admin-settings-cache'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import React from 'react'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    // EGRESS: this layout runs on EVERY auth page view, so the setting is cached
    // (see lib/admin-settings-cache.ts). 5-minute TTL: it is display data an admin
    // changes rarely. There is no built-in default: the WhatsApp button only appears
    // once an admin sets a real number.
    const adminSettings = await getAdminSettings(['whatsapp_admin_number'], 5 * 60 * 1000)
    const whatsappAdminNumber = adminSettings.whatsapp_admin_number || ''

    return (
        <>
            {whatsappAdminNumber && <FloatingWhatsApp phoneNumber={whatsappAdminNumber} variant="auth" />}
            {children}
        </>
    )
}
