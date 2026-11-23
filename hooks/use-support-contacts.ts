'use client'

import { useEffect, useState } from 'react'
import { getSupportContacts, type SupportContacts } from '@/app/actions/support'

/**
 * The admin-managed support contacts (WhatsApp number, email, phone, links) from Admin > Settings.
 * Read on every mount (the server action has its own short cache), so a changed setting reaches
 * the screen without a redeploy. `contacts` is null until loaded or if the lookup fails; callers
 * must hide the control when the value they need is empty.
 */
export function useSupportContacts() {
    const [contacts, setContacts] = useState<SupportContacts | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        getSupportContacts()
            .then(c => { if (!cancelled) setContacts(c) })
            .catch(() => { if (!cancelled) setContacts(null) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])

    return { contacts, loading }
}
