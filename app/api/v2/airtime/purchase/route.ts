import { NextRequest } from 'next/server'
import { validateApiKey, isApiError, apiSuccess, apiError, logApiRequest, getClientIp, requireKeyType } from '@/lib/api-auth'
import { consumeRateLimit } from '@/lib/simple-rate-limit'
import { quoteAirtimeCommission } from '@/lib/airtime-pricing'
import { toCanonicalPhone } from '@/lib/data-orders/phone'
import { findBlacklistedPhones, loadBuyer } from '@/lib/data-orders/guards'
import { placeAirtimeOrder } from '@/lib/data-orders/place-airtime'
import { resolveSubAgentContext } from '@/lib/sub-agent-account'

// ============================================================================
// POST /api/v2/airtime/purchase
// Mirrors app/api/airtime/create/route.ts's validation/pricing/idempotency
// exactly, adapted to API-key auth. Mashup is NOT available here — it is
// dashboard-only and MTN-only. See
// docs/superpowers/specs/2026-08-24-api-v2-new-products-design.md.
// ============================================================================

const ENDPOINT = '/api/v2/airtime/purchase'
const NETWORK_KEY_MAP: Record<string, string> = { MTN: 'mtn', Telecel: 'telecel', AT: 'at' }
const VALID_NETWORKS = ['MTN', 'Telecel', 'AT']

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)

    const auth = await validateApiKey(request)
    if (isApiError(auth)) {
        logApiRequest({ apiKeyId: null, userId: null, endpoint: ENDPOINT, method: 'POST', statusCode: auth.status, responseTimeMs: Date.now() - startTime, ip, errorMessage: 'Authentication failed' })
        return auth
    }

    const { userId, apiKeyId, effectiveRole, supabase } = auth
    const done = (statusCode: number, errorMessage?: string) =>
        logApiRequest({ apiKeyId, userId, endpoint: ENDPOINT, method: 'POST', statusCode, responseTimeMs: Date.now() - startTime, ip, errorMessage })

    const keyTypeError = requireKeyType(auth, 'commission')
    if (keyTypeError) {
        done(403, 'Wrong key type')
        return keyTypeError
    }

    try {
        // Sub-agent eligibility (spec §11 lift, 2026-09-17): unlike data/AFA/results-checker,
        // airtime/mashup carry no sub-agent markup by design (platform decision: no earnings
        // split for parent on airtime/mashup) AND this route is commission-key zero-fee for
        // EVERY role already (quoteAirtimeCommission below) — so there is no pricing wiring
        // needed here, only the eligibility gate (pending/suspended sub, or one whose
        // recruiter is currently ineligible, still cannot transact).
        const subCtx = await resolveSubAgentContext(supabase, userId)
        if (subCtx.isSub && !subCtx.effectiveActive) {
            done(403, 'Sub-agent inactive')
            return apiError(403, subCtx.inactiveReason || 'Your account is not currently active')
        }

        const rl = consumeRateLimit(`v2-airtime-purchase:${apiKeyId}`, 10, 60_000)
        if (!rl.allowed) {
            done(429, 'Rate limited')
            return apiError(429, `Rate limit exceeded (10/min). Retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`)
        }

        let body: any
        try { body = await request.json() } catch {
            done(400, 'Invalid JSON')
            return apiError(400, 'Invalid request body')
        }

        const { network, beneficiary_phone, amount, reference } = body || {}

        if (!network || !VALID_NETWORKS.includes(network)) {
            done(400, 'Invalid network')
            return apiError(400, `Invalid network. Must be one of: ${VALID_NETWORKS.join(', ')}`)
        }
        const cleanPhone = toCanonicalPhone(beneficiary_phone)
        if (!cleanPhone) {
            done(400, 'Invalid phone')
            return apiError(400, 'Invalid beneficiary_phone. Use a Ghana mobile number: 0XXXXXXXXX')
        }
        const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount))
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            done(400, 'Invalid amount')
            return apiError(400, 'amount must be a positive number')
        }
        if (!reference || typeof reference !== 'string' || !/^[A-Za-z0-9._:\-]{3,100}$/.test(reference)) {
            done(400, 'Invalid reference')
            return apiError(400, 'reference is required: 3-100 characters, letters, numbers and . _ : - only. This is your unique transaction ID for idempotency.')
        }
        const referenceCode = `API-${reference}`

        // The key owner must exist and not be suspended. The ROLE used for pricing comes from
        // auth.effectiveRole, which applies dealer/agent expiry (lapsed = customer prices).
        const buyerResult = await loadBuyer(supabase, userId)
        if (!buyerResult.ok) {
            done(buyerResult.status, buyerResult.error)
            return apiError(buyerResult.status, buyerResult.error)
        }
        const userRole = effectiveRole

        try {
            const blocked = await findBlacklistedPhones(supabase, [cleanPhone])
            if (blocked.has(cleanPhone)) {
                done(403, 'Blacklisted number')
                return apiError(403, 'This number cannot receive orders')
            }
        } catch (e) {
            console.error('[API v2 Airtime Purchase] blacklist check failed:', e)
            done(503, 'Blacklist check failed')
            return apiError(503, 'We could not verify this number. Please try again.')
        }

        const { data: settingRows, error: settingsError } = await (supabase.from('admin_settings') as any).select('key, value').in('key', [
            `airtime_enabled_${NETWORK_KEY_MAP[network]}`,
            `airtime_min_amount_customer`, `airtime_min_amount_agent`, `airtime_min_amount_dealer`,
            `airtime_max_amount_customer`, `airtime_max_amount_agent`, `airtime_max_amount_dealer`,
        ])
        if (settingsError) {
            console.error('[API v2 Airtime Purchase] settings lookup failed:', settingsError.message)
            done(503, 'Settings lookup failed')
            return apiError(503, 'Please try again in a moment.')
        }
        const settingsMap: Record<string, string> = {}
        for (const s of (settingRows || [])) settingsMap[(s as any).key] = (s as any).value

        if (settingsMap[`airtime_enabled_${NETWORK_KEY_MAP[network]}`] === 'false') {
            done(400, 'Network disabled')
            return apiError(400, `${network} airtime is currently unavailable`)
        }

        // Limits + fee arithmetic come from lib/airtime-pricing.ts, shared with
        // the dashboard route. This block used to be a line-for-line copy of the
        // dashboard's (review finding I6) — two fee tables that had to be changed
        // in lockstep forever, with the fallback constants the dangerous half.
        const quoted = quoteAirtimeCommission({
            settings: settingsMap,
            network,
            role: userRole,
            amount: parsedAmount,
        })
        if (!quoted.ok) {
            done(400, quoted.reason)
            return apiError(400, quoted.message)
        }
        const { airtimeAmount, feeAmount, totalPaid, feeRate } = quoted.quote

        const placed = await placeAirtimeOrder(supabase, userId, {
            reference_code: referenceCode,
            beneficiary_phone: cleanPhone,
            network,
            type: 'airtime',
            bundle_preference: null,
            airtime_amount: airtimeAmount,
            fee_rate: feeRate,
            fee_amount: feeAmount,
            total_paid: totalPaid,
            use_exact_amount: false,
            user_role: userRole,
            source: 'api',
            api_key_id: apiKeyId,
        })

        if (!placed.ok) {
            switch (placed.code) {
                case 'INSUFFICIENT_BALANCE':
                    done(400, 'Insufficient balance')
                    return apiError(400, 'Insufficient wallet balance')
                case 'RECENT_DUPLICATE':
                    done(409, 'Recent duplicate')
                    return apiError(409, 'The same order was placed moments ago. Wait 30 seconds, or reuse its reference to read it back.')
                case 'REFERENCE_IN_USE':
                    done(409, 'Reference already in use')
                    return apiError(409, 'This reference is already in use. Your wallet was not charged. Choose a different reference.')
                case 'NO_WALLET':
                    done(404, 'Wallet not found')
                    return apiError(404, 'Wallet not found')
                case 'INVALID':
                    done(400, 'Invalid order')
                    return apiError(400, 'Invalid order')
                default:
                    done(500, 'Order failed')
                    return apiError(500, 'Order could not be placed. Your wallet was not charged. Please try again.')
            }
        }

        if (placed.duplicate) {
            done(200)
            return apiSuccess({
                order_id: placed.order.id, reference, status: placed.order.status,
                network: placed.order.network, beneficiary_phone: placed.order.beneficiary_phone,
                airtime_amount: placed.order.airtime_amount, total_paid: placed.order.total_paid,
                is_duplicate: true,
            }, { version: 'v2', message: 'Order already exists with this reference' })
        }

        // Orders start as "pending"; an admin fulfils them from the fulfillment page.
        done(200)
        return apiSuccess({
            order_id: placed.order.id, reference, status: 'pending', network,
            beneficiary_phone: cleanPhone, airtime_amount: airtimeAmount, fee_amount: feeAmount,
            total_paid: totalPaid, new_balance: placed.newBalance,
        }, { version: 'v2' })

    } catch (error: any) {
        console.error('[API v2 Airtime Purchase] Exception:', error.message)
        done(500, error.message)
        return apiError(500, 'Internal server error')
    }
}
