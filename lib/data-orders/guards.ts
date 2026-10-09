import { toCanonicalPhone, phoneLookupVariants } from '@/lib/data-orders/phone'

/**
 * Which of these canonical numbers are on the blacklist, matching any spelling the row was
 * stored under. FAILS CLOSED: if the lookup itself errors, this throws, so a database blip
 * can never turn into "nobody is blacklisted".
 */
export async function findBlacklistedPhones(supabase: any, canonicalPhones: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(canonicalPhones))
    if (unique.length === 0) return new Set()

    const lookup = unique.flatMap(phoneLookupVariants)
    const { data, error } = await supabase.from('phone_blacklist').select('phone_number').in('phone_number', lookup)
    if (error) throw new Error(`Blacklist lookup failed: ${error.message}`)

    const blocked = new Set<string>()
    for (const row of (data ?? []) as Array<{ phone_number: string }>) {
        const canonical = toCanonicalPhone(row.phone_number)
        if (canonical) blocked.add(canonical)
    }
    return blocked
}

export interface Buyer {
    role: string | null
    status: string | null
    agent_expires_at: string | null
    dealer_expires_at: string | null
    email: string | null
    phone_number: string | null
    first_name: string | null
    last_name: string | null
    order_success_sms_enabled: boolean | null
}

export type BuyerResult =
    | { ok: true; buyer: Buyer }
    | { ok: false; status: number; error: string }

/**
 * The buying member, re-read from the database on every purchase (never from the request).
 * A missing profile or a suspended account is refused here, before any money moves.
 */
export async function loadBuyer(supabase: any, userId: string): Promise<BuyerResult> {
    const { data, error } = await supabase
        .from('users')
        .select('role, status, agent_expires_at, dealer_expires_at, email, phone_number, first_name, last_name, order_success_sms_enabled')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        console.error('[data-orders] buyer lookup failed:', error.message)
        return { ok: false, status: 503, error: 'We could not verify your account. Please try again.' }
    }
    if (!data) return { ok: false, status: 403, error: 'Account not found' }
    if (data.status === 'suspended') {
        return { ok: false, status: 403, error: 'Your account is currently suspended. Please contact support.' }
    }
    return { ok: true, buyer: data as Buyer }
}
