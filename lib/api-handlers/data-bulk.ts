// ============================================================================
// lib/api-handlers/data-bulk.ts
// Handler for POST /api/v2/data/bulk.
// See lib/api-handlers/packages.ts for why handlers live here.
//
// Place up to MAX_BULK_ORDERS data orders in one batch via the API:
//   validate every row → resolve packages → price each row → pay and create ALL orders in
//   one database call (place_data_orders) → fulfil in the background.
//
// All-or-nothing: if anything in the batch is invalid the whole batch is rejected and nothing is
// charged; if the batch is accepted it is charged once and every order exists. A reused reference
// can never charge twice.
// ============================================================================
import { NextRequest } from 'next/server'
import {
    validateApiKey,
    isApiError,
    apiSuccess,
    apiError,
    logApiRequest,
    getClientIp,
} from '@/lib/api-auth'
import { generateReferenceCode } from '@/lib/utils'
import { waitUntil } from '@vercel/functions'
import { getAdminOOSNetworks, isNetworkOOS } from '@/lib/network-stock'
import { triggerFulfillment } from '@/lib/fulfillment-trigger'
import { versionMeta } from '@/lib/api-version'
import { resolveSubAgentContext } from '@/lib/sub-agent-account'
import { resolveSubAgentDataCost } from '@/lib/sub-agent-data-pricing'
import { hasSubAgentPricingConfigured } from '@/lib/sub-agent-pricing'
import { recordPendingSubAgentEarning } from '@/lib/sub-agent-earnings'
import { tierCost } from '@/lib/pricing/cost-basis'
import { toCanonicalPhone } from '@/lib/data-orders/phone'
import { findBlacklistedPhones } from '@/lib/data-orders/guards'
import { placeDataOrders, type PlaceItem } from '@/lib/data-orders/place'

const VALID_NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const MAX_BULK_ORDERS = 100
// Developer-chosen references: short, URL-safe, no free text.
const REFERENCE_PATTERN = /^[A-Za-z0-9._:\-]{3,100}$/

interface BulkOrderInput {
    network: string
    volume_gb: number
    recipient: string
    reference?: string
}

export async function handleDataBulk(request: NextRequest) {
    const startTime = Date.now()
    const ip = getClientIp(request)
    const endpoint = request.nextUrl.pathname
    const meta = versionMeta(endpoint)

    const auth = await validateApiKey(request)
    if (isApiError(auth)) {
        logApiRequest({
            apiKeyId: null, userId: null,
            endpoint, method: 'POST',
            statusCode: auth.status, responseTimeMs: Date.now() - startTime,
            ip, errorMessage: 'Authentication failed',
        })
        return auth
    }

    const { userId, apiKeyId, effectiveRole, supabase } = auth
    const done = (statusCode: number, errorMessage?: string) =>
        logApiRequest({ apiKeyId, userId, endpoint, method: 'POST', statusCode, responseTimeMs: Date.now() - startTime, ip, errorMessage })

    try {
        // A sub-agent can buy here: each row is priced from their recruiter's configuration below.
        // A pending or suspended sub, or one whose recruiter is currently ineligible, cannot.
        const subCtx = await resolveSubAgentContext(supabase, userId)
        if (subCtx.isSub && !subCtx.effectiveActive) {
            done(403, 'Sub-agent inactive')
            return apiError(403, subCtx.inactiveReason || 'Your account is not currently active')
        }

        let body: any
        try {
            body = await request.json()
        } catch {
            done(400, 'Invalid JSON')
            return apiError(400, 'Invalid request body')
        }

        const { orders } = body
        if (!Array.isArray(orders) || orders.length === 0) {
            done(400, 'No orders')
            return apiError(400, 'orders array is required and must not be empty')
        }
        if (orders.length > MAX_BULK_ORDERS) {
            done(400, 'Too many orders')
            return apiError(400, `Maximum ${MAX_BULK_ORDERS} orders per batch`)
        }

        // ── Validate every row ────────────────────────────────────────────
        const errors: string[] = []
        const rows: Array<{ input: BulkOrderInput; recipient: string; reference: string | null }> = []
        const seenReferences = new Set<string>()

        for (let i = 0; i < orders.length; i++) {
            const o = (orders[i] ?? {}) as BulkOrderInput
            const label = `Order ${i + 1}`
            if (!o.network || !VALID_NETWORKS.includes(o.network)) errors.push(`${label}: invalid network "${String(o.network).slice(0, 30)}"`)
            if (!o.volume_gb || typeof o.volume_gb !== 'number' || !Number.isFinite(o.volume_gb) || o.volume_gb <= 0) errors.push(`${label}: invalid volume_gb`)
            const recipient = toCanonicalPhone(o.recipient)
            if (!recipient) errors.push(`${label}: invalid recipient phone number`)
            let reference: string | null = null
            if (o.reference !== undefined && o.reference !== null) {
                if (typeof o.reference !== 'string' || !REFERENCE_PATTERN.test(o.reference)) {
                    errors.push(`${label}: reference must be 3-100 characters: letters, numbers and . _ : - only`)
                } else if (seenReferences.has(o.reference)) {
                    errors.push(`${label}: reference "${o.reference}" is used twice in this batch`)
                } else {
                    seenReferences.add(o.reference)
                    reference = o.reference
                }
            }
            if (recipient) rows.push({ input: o, recipient, reference })
        }
        if (errors.length > 0) {
            done(400, errors.slice(0, 5).join('; '))
            return apiError(400, errors.slice(0, 10).join('; ') + (errors.length > 10 ? ` (+${errors.length - 10} more)` : ''))
        }

        // ── Resolve packages, stock and price per row ─────────────────────
        const { data: allPackages, error: pkgsError } = await (supabase.from('data_packages') as any)
            .select('*')
            .eq('is_available', true)
            .neq('category', 'mtn_mashup')
        if (pkgsError || !allPackages) {
            done(500, 'Failed to load packages')
            return apiError(500, 'Failed to load packages')
        }
        const pkgMap = new Map<string, any>()
        for (const p of allPackages as any[]) pkgMap.set(`${p.network}|${p.size}`, p)

        const adminOOS = await getAdminOOSNetworks(supabase)

        const problems: string[] = []
        const priced: Array<{ row: typeof rows[number]; pkg: any; price: number; recruiterAmount: number }> = []

        for (let i = 0; i < rows.length; i++) {
            const { input } = rows[i]
            const size = `${input.volume_gb}GB`
            const pkg = pkgMap.get(`${input.network}|${size}`)
            if (!pkg) { problems.push(`Order ${i + 1}: ${input.network} ${size} not found`); continue }
            if (isNetworkOOS(adminOOS, pkg.network)) { problems.push(`Order ${i + 1}: ${pkg.network} is out of stock at the moment`); continue }

            let price: number
            let recruiterAmount = 0
            if (subCtx.isSub) {
                // "Unconfigured = unbuyable", the same server-side rule as every other sub-agent surface.
                if (subCtx.recruiterId && !(await hasSubAgentPricingConfigured(supabase, subCtx.recruiterId, userId, 'data', pkg.id))) {
                    problems.push(`Order ${i + 1}: pricing is not available for ${input.network} ${size} right now`)
                    continue
                }
                const resolved = await resolveSubAgentDataCost(supabase, userId, pkg.id, pkg, pkg.category)
                if (!resolved.ok) {
                    console.error(`[API Data Bulk] sub cost unresolvable for pkg ${pkg.id} (user ${userId}): ${resolved.reason}`)
                    problems.push(`Order ${i + 1}: pricing is not available for ${input.network} ${size} right now`)
                    continue
                }
                price = resolved.subCost
                if (resolved.recruiterEarns > 0 && resolved.recruiterId) recruiterAmount = resolved.recruiterEarns
            } else {
                // effectiveRole already accounts for expiry, so tierCost (which does not) is correct here.
                price = tierCost(pkg, effectiveRole)
            }

            price = Math.round(price * 100) / 100
            if (!Number.isFinite(price) || price <= 0) {
                console.error(`[API Data Bulk] Invalid price ${price} for pkg ${pkg.id} (user ${userId}), blocked`)
                problems.push(`Order ${i + 1}: ${input.network} ${size} is temporarily unavailable`)
                continue
            }
            priced.push({ row: rows[i], pkg, price, recruiterAmount })
        }
        if (problems.length > 0) {
            done(404, problems.slice(0, 5).join('; '))
            return apiError(404, problems.slice(0, 10).join('; ') + (problems.length > 10 ? ` (+${problems.length - 10} more)` : ''))
        }

        // ── Blacklist (every recipient, fails closed) ─────────────────────
        let blocked: Set<string>
        try {
            blocked = await findBlacklistedPhones(supabase, priced.map(p => p.row.recipient))
        } catch (e) {
            console.error('[API Data Bulk] blacklist check unavailable:', e)
            done(503, 'Blacklist check unavailable')
            return apiError(503, 'Could not verify the recipients right now. Please try again.')
        }
        if (blocked.size > 0) {
            done(400, 'Recipient blacklisted')
            // Generic: do not confirm which numbers are on a blacklist.
            return apiError(400, 'Order cannot be processed for one or more recipients')
        }

        // ── Pay and create every order in one database call ───────────────
        const referenceCodes = priced.map(p => `API-${p.row.reference ?? generateReferenceCode()}`)
        const items: PlaceItem[] = priced.map((p, i) => ({
            reference_code: referenceCodes[i],
            phone_number: p.row.recipient,
            network: p.pkg.network,
            size: p.pkg.size,
            price: p.price,
            cost_price: Number(p.pkg.cost_price) || 0,
            role_at_time: effectiveRole,
            status: 'pending',
            fulfillment_method: 'auto',
            category: p.pkg.category || 'data',
            source: 'api',
            api_key_id: apiKeyId,
        }))

        const placed = await placeDataOrders(supabase, userId, items)

        if (!placed.ok) {
            if (placed.code === 'INSUFFICIENT_BALANCE') {
                const total = items.reduce((s, i) => s + i.price, 0)
                done(400, 'Insufficient balance')
                return apiError(400, `Insufficient wallet balance. Need GHS ${total.toFixed(2)}`)
            }
            if (placed.code === 'REFERENCE_IN_USE') {
                // orders.reference_code is globally unique and references are developer-chosen, so one
                // colliding reference (possibly another account's) rejects the whole batch. Nothing was charged.
                done(409, 'Reference already in use')
                return apiError(409, 'One or more references in this batch are already in use. Your wallet was not charged. Use fresh references and retry.')
            }
            done(500, placed.message)
            return apiError(500, 'Orders could not be placed. Your wallet was not charged. Please try again.')
        }

        if (placed.duplicate) {
            // Same account, same references: this batch was already placed. Return what exists.
            const { data: existing } = await (supabase.from('orders') as any)
                .select('id, reference_code, status, network, size, phone_number, price')
                .eq('user_id', userId)
                .in('reference_code', referenceCodes)
            done(200)
            return apiSuccess({
                orders_placed: 0,
                is_duplicate: true,
                orders: ((existing ?? []) as any[]).map(o => ({
                    order_id: o.id,
                    reference: String(o.reference_code).replace(/^API-/, ''),
                    status: o.status,
                    network: o.network,
                    size: o.size,
                    recipient: o.phone_number,
                    price: parseFloat(String(o.price)),
                })),
            }, { ...meta, message: 'These orders already exist' })
        }

        // Sub-agent: credit the direct recruiter's margin per item as a pending row, released by a
        // trigger when each order completes. Never blocks the batch: the buyer has paid.
        if (subCtx.isSub && subCtx.recruiterId) {
            const recruiterId = subCtx.recruiterId
            await Promise.all(priced.map((p, i) =>
                p.recruiterAmount > 0
                    ? recordPendingSubAgentEarning(supabase, {
                        orderReference: referenceCodes[i],
                        orderTable: 'orders',
                        recruiterId,
                        subUserId: userId,
                        amount: p.recruiterAmount,
                    }).catch((e) => console.error(`[API Data Bulk] recordPendingSubAgentEarning threw for ${referenceCodes[i]}:`, e))
                    : Promise.resolve(),
            ))
        }

        // ── Fulfil in the background ──────────────────────────────────────
        waitUntil((async () => {
            try {
                const { data: userData } = await supabase.from('users').select('email, first_name, last_name').eq('id', userId).single()
                const name = `${(userData as any)?.first_name || ''} ${(userData as any)?.last_name || ''}`.trim() || 'Customer'
                const email = (userData as any)?.email || 'Unknown'
                for (const created of placed.orders) {
                    try {
                        await triggerFulfillment(created.id, created.network, { email, name })
                    } catch (err) {
                        console.error(`[API Bulk] Fulfillment error for ${created.id}:`, err)
                    }
                }
            } catch (bgError) {
                console.error('[API Bulk] Background fulfillment error:', bgError)
            }
        })())

        done(200)

        return apiSuccess({
            orders_placed: placed.orders.length,
            total_cost: placed.total,
            new_balance: placed.newBalance,
            orders: placed.orders.map((o, i) => ({
                order_id: o.id,
                // Strip the internal "API-" prefix so developers see the reference they sent.
                reference: o.reference_code.replace(/^API-/, ''),
                status: 'pending',
                network: o.network,
                size: o.size,
                recipient: o.phone_number,
                price: items[i].price,
            })),
        }, meta)
    } catch (error: any) {
        console.error('[API Bulk] Exception:', error.message)
        done(500, error.message)
        return apiError(500, 'Internal server error')
    }
}
