/**
 * MoMo account name resolution for Ghana numbers, via Paystack.
 *
 * Single lookup : one attempt, plus one retry on a miss (provider failures are intermittent)
 * Bulk lookup   : sequential lookups, capped per call
 */

// ─── Network metadata ─────────────────────────────────────────────────────────

const NETWORK_META: Record<string, { label: string; paystackCode: string }> = {
    '024': { label: 'MTN',     paystackCode: 'MTN' },
    '025': { label: 'MTN',     paystackCode: 'MTN' },
    '053': { label: 'MTN',     paystackCode: 'MTN' },
    '054': { label: 'MTN',     paystackCode: 'MTN' },
    '055': { label: 'MTN',     paystackCode: 'MTN' },
    '059': { label: 'MTN',     paystackCode: 'MTN' },
    // Paystack's Ghana mobile-money code for Telecel (ex-Vodafone) is VOD — confirmed
    // against GET /bank?currency=GHS&type=mobile_money (2026-09-28). 'VDF' was rejected
    // with "Unknown bank code: VDF", so the Paystack fallback never worked for Telecel.
    '020': { label: 'TELECEL', paystackCode: 'VOD' },
    '050': { label: 'TELECEL', paystackCode: 'VOD' },
    '026': { label: 'AT',      paystackCode: 'ATL' },
    '027': { label: 'AT',      paystackCode: 'ATL' },
    '056': { label: 'AT',      paystackCode: 'ATL' },
    '057': { label: 'AT',      paystackCode: 'ATL' },
}

export type NameResolveResult = {
    firstName: string
    lastName:  string
    fullName:  string
    provider:  'paystack'
    network:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// No fetch here previously carried a timeout — on Vercel a Serverless Function
// can be frozen the instant it returns a response, so a hanging provider call
// made after the response (e.g. the payer name-resolution kicked off by a
// refund SMS) could wedge forever and never complete. A few seconds is ample
// for a name-lookup call; on timeout these resolvers already return null,
// same as any other failure.
const PROVIDER_TIMEOUT_MS = 5000

function toLocal(normalizedPhone: string): string {
    return '0' + normalizedPhone.slice(3)
}

type NetworkMeta = { label: string; paystackCode: string }

// The network the user explicitly picked wins over the number's prefix: Ghana has
// number portability, so a prefix does not guarantee the number is still on that
// network, and the payout is sent on the picked network.
const NETWORK_HINT_META: Record<string, NetworkMeta> = {
    'MTN MoMo':         { label: 'MTN',     paystackCode: 'MTN' },
    'Telecel Cash':     { label: 'TELECEL', paystackCode: 'VOD' },
    'AirtelTigo Money': { label: 'AT',      paystackCode: 'ATL' },
}

function getMeta(normalizedPhone: string, networkHint?: string): NetworkMeta | null {
    if (networkHint && NETWORK_HINT_META[networkHint]) return NETWORK_HINT_META[networkHint]
    const prefix = toLocal(normalizedPhone).substring(0, 3)
    return NETWORK_META[prefix] ?? null
}

function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/)
    return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

// ─── Paystack ─────────────────────────────────────────────────────────────────

async function resolveViaPaystack(normalizedPhone: string, networkHint?: string): Promise<NameResolveResult | null> {
    const key  = process.env.PAYSTACK_SECRET_KEY
    const meta = getMeta(normalizedPhone, networkHint)
    if (!key || !meta) return null

    try {
        const res  = await fetch(
            `https://api.paystack.co/bank/resolve?account_number=${toLocal(normalizedPhone)}&bank_code=${meta.paystackCode}`,
            { headers: { Authorization: `Bearer ${key}`, 'Cache-Control': 'no-store' }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) }
        )
        const data: any = await res.json().catch(() => ({}))
        if (data.status === true && data.data?.account_name) {
            const fullName = data.data.account_name as string
            return { ...splitName(fullName), fullName, provider: 'paystack', network: meta.label }
        }
        return null
    } catch {
        return null
    }
}

export { getMeta as getNetworkMeta }
// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up one number. Retries once on a miss: provider failures are intermittent. */
export async function resolveNameSingle(
    normalizedPhone: string,
    networkHint?: string
): Promise<NameResolveResult | null> {
    const first = await resolveViaPaystack(normalizedPhone, networkHint)
    if (first) return first
    return await resolveViaPaystack(normalizedPhone, networkHint)
}

/** Maximum phones enriched in one bulk call. */
export const BULK_ENRICH_TOTAL_CAP = 100

/** Bulk name enrichment. Returns a Map of normalizedPhone → NameResolveResult. */
export async function resolveNamesBulk(
    normalizedPhones: string[],
    cap = BULK_ENRICH_TOTAL_CAP
): Promise<Map<string, NameResolveResult>> {
    const results = new Map<string, NameResolveResult>()
    for (const phone of normalizedPhones.slice(0, cap)) {
        try {
            const result = await resolveViaPaystack(phone)
            if (result) results.set(phone, result)
        } catch { /* skip individual failures */ }
    }
    return results
}
