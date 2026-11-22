// Rexamart supplier integration — data bundles, AFA registrations, beneficiary
// verification and delivery disputes. See docs attached by the owner
// (rexamart-api-docs.pdf) for the full contract; this file implements every
// endpoint that document describes.
//
// Config (see .env.example):
//   REXAMART_API_KEY       required — every call fails closed without it.
//   REXAMART_BASE_URL      optional — defaults to https://api.rexamart.com.
//   REXAMART_WEBHOOK_SECRET  used by app/api/webhooks/rexamart, not here.

const DEFAULT_BASE_URL = 'https://api.rexamart.com'

function baseUrl(): string {
    return process.env.REXAMART_BASE_URL || DEFAULT_BASE_URL
}

function apiKey(): string | null {
    return process.env.REXAMART_API_KEY || null
}

export function isRexamartConfigured(): boolean {
    return !!apiKey()
}

/**
 * Capozy's internal network names → Rexamart's. Capozy has no "MTN Express"
 * product distinction (that was the prior operator's DataKazina express
 * line, deliberately not carried forward) — only the four networks Capozy
 * actually sells are mapped.
 */
const NETWORK_MAP: Record<string, string> = {
    'MTN': 'MTN',
    'Telecel': 'Telecel',
    'AT-iShare': 'AT Ishare',
    'AT-BigTime': 'AT Bigtime',
}

export function rexamartNetworkName(capozyNetwork: string): string | null {
    return NETWORK_MAP[capozyNetwork] ?? null
}

export const REXAMART_SUPPORTED_NETWORKS = Object.keys(NETWORK_MAP)

/** "1GB" / "2 GB" / "10gb" -> "1" / "2" / "10". Rexamart's `plan` is the bare GB digit string. */
export function planFromSize(size: string): string | null {
    const match = String(size || '').match(/(\d+(?:\.\d+)?)/)
    if (!match) return null
    const n = Number(match[1])
    if (!Number.isFinite(n) || n <= 0) return null
    // Rexamart's plan values are whole-GB strings ("1", "2", ...) per the docs' examples.
    return String(Number.isInteger(n) ? n : match[1])
}

interface RexamartEnvelope<T> {
    success: boolean
    data?: T
    error?: string
    error_code?: string
    [key: string]: any
}

async function call<T = any>(
    path: string,
    init: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<{ ok: boolean; status: number; body: RexamartEnvelope<T> | null; error?: string }> {
    const key = apiKey()
    if (!key) return { ok: false, status: 0, body: null, error: 'Rexamart is not configured (REXAMART_API_KEY unset)' }

    const headers: Record<string, string> = { 'X-API-Key': key }
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'
    if (init.idempotencyKey) headers['X-Idempotency-Key'] = init.idempotencyKey

    try {
        const res = await fetch(`${baseUrl()}${path}`, {
            method: init.method || (init.body !== undefined ? 'POST' : 'GET'),
            headers,
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        })
        const json = await res.json().catch(() => null)
        return { ok: res.ok, status: res.status, body: json }
    } catch (e: any) {
        console.error('[Rexamart] Network/transport error:', e)
        return { ok: false, status: 0, body: null, error: e?.message || 'Network error' }
    }
}

// ─── Data bundle orders ───────────────────────────────────────────────────

export interface RexamartFulfillResult {
    success: boolean
    error?: string
    errorCode?: string
    /** Rexamart's own order id. */
    rexamartOrderId?: string
    /** Rexamart's transaction_reference — the identifier most useful for a later dispute lookup. */
    transactionReference?: string
    remainingBalance?: number
    /** A transport-level failure (timeout, 5xx, network drop) — the order MAY already be
     *  queued on Rexamart's side even though this call reports failure. Never treat as a
     *  definite rejection: see every dispatch call site's ambiguous-handling branch. */
    ambiguous?: boolean
}

/**
 * Dispatches one data bundle order. `dispatchKey` (defaults to orderId) is sent as
 * X-Idempotency-Key so a retry of the same attempt — same key within 24h — returns the
 * original result instead of placing a second order.
 */
export async function fulfillOrder(
    network: string,
    phoneNumber: string,
    size: string,
    orderId: string,
    dispatchKey?: string
): Promise<RexamartFulfillResult> {
    const rxNetwork = rexamartNetworkName(network)
    if (!rxNetwork) return { success: false, error: `Rexamart cannot serve network "${network}"` }
    const plan = planFromSize(size)
    if (!plan) return { success: false, error: `Unparseable data size "${size}"` }

    const result = await call('/orders', {
        body: { phone_number: phoneNumber, network: rxNetwork, plan, reference: orderId },
        idempotencyKey: dispatchKey ?? orderId,
    })

    if (result.body?.success) {
        return {
            success: true,
            rexamartOrderId: result.body.data?.order_id,
            transactionReference: result.body.data?.transaction_reference,
            remainingBalance: result.body.data?.remaining_balance,
        }
    }
    // A transport failure (no parsed body / network error) is ambiguous — Rexamart's own
    // idempotency key means a retry is safe, but THIS call can't tell if the first attempt
    // landed before the connection dropped.
    if (!result.body) {
        return { success: false, error: result.error || 'Rexamart request failed', ambiguous: true }
    }
    return { success: false, error: result.body.error || 'Rexamart order failed', errorCode: result.body.error_code }
}

export interface OrderToFulfill {
    id: string
    phone_number: string
    network: string
    size: string
    shop_order_id?: string | null
    reference_code?: string | null
    price?: number
}

export interface BulkOrderResult {
    orderId: string
    success: boolean
    error?: string
    rexamartOrderId?: string
    ambiguous?: boolean
}

/** Dispatches up to 50 orders per Rexamart batch call; chunks larger sets automatically. */
export async function fulfillOrdersBulk(orders: OrderToFulfill[]): Promise<BulkOrderResult[]> {
    const results: BulkOrderResult[] = []
    const CHUNK = 50

    for (let i = 0; i < orders.length; i += CHUNK) {
        const chunk = orders.slice(i, i + CHUNK)
        const payload = chunk.map(o => {
            const rxNetwork = rexamartNetworkName(o.network)
            const plan = planFromSize(o.size)
            return { phone_number: o.phone_number, network: rxNetwork || o.network, plan: plan || '', reference: o.id }
        })

        // Pre-validate — an order whose network/size we can't map is never sent to Rexamart
        // (it would either error the whole batch or silently consume a slot).
        const invalidIds = new Set<string>()
        chunk.forEach((o, idx) => {
            if (!rexamartNetworkName(o.network)) invalidIds.add(o.id)
            else if (!planFromSize(o.size)) invalidIds.add(o.id)
        })
        const sendable = chunk.filter(o => !invalidIds.has(o.id))
        invalidIds.forEach(id => {
            const o = chunk.find(c => c.id === id)!
            results.push({ orderId: id, success: false, error: !rexamartNetworkName(o.network) ? `Rexamart cannot serve network "${o.network}"` : `Unparseable data size "${o.size}"` })
        })
        if (sendable.length === 0) continue

        const sendablePayload = sendable.map(o => ({
            phone_number: o.phone_number,
            network: rexamartNetworkName(o.network),
            plan: planFromSize(o.size),
            reference: o.id,
        }))

        const result = await call('/orders/batch', { body: { orders: sendablePayload } })

        if (!result.body) {
            // Whole-batch transport failure — ambiguous for every order in it.
            sendable.forEach(o => results.push({ orderId: o.id, success: false, error: result.error || 'Rexamart batch request failed', ambiguous: true }))
            continue
        }
        if (!result.body.success) {
            sendable.forEach(o => results.push({ orderId: o.id, success: false, error: result.body!.error || 'Rexamart batch failed' }))
            continue
        }

        const batchResults: Array<{ index: number; success: boolean; order_id?: string; error?: string }> = result.body.data?.results || []
        batchResults.forEach(r => {
            const order = sendable[r.index]
            if (!order) return
            results.push({
                orderId: order.id,
                success: !!r.success,
                error: r.error,
                rexamartOrderId: r.order_id,
            })
        })
    }

    return results
}

export async function fetchBalance(): Promise<{ success: true; balance: number; currency: string } | { success: false; error: string }> {
    const result = await call('/orders/balance', { method: 'GET' })
    if (result.body?.success) {
        return { success: true, balance: result.body.data?.balance ?? 0, currency: result.body.data?.currency || 'GHS' }
    }
    return { success: false, error: result.body?.error || result.error || 'Failed to fetch balance' }
}

// ─── Beneficiary verification (MTN numbers, free, max 40/request) ─────────

export interface BeneficiaryCheckResult {
    number: string
    verified: boolean
    status: 'verified' | 'not_verified' | 'check_failed' | 'invalid_number'
    message?: string
}

export async function checkBeneficiaries(numbers: string[]): Promise<
    { success: true; results: BeneficiaryCheckResult[] } | { success: false; error: string }
> {
    if (numbers.length === 0) return { success: true, results: [] }
    if (numbers.length > 40) return { success: false, error: 'At most 40 numbers per request' }

    const result = await call('/orders/beneficiary/check', { body: { numbers } })
    if (result.body?.success) {
        return { success: true, results: result.body.results || [] }
    }
    return { success: false, error: result.body?.error || result.error || 'Beneficiary check failed' }
}

// ─── AFA (Ghana Card) registration orders ─────────────────────────────────

export interface RexamartAfaResult {
    success: boolean
    error?: string
    rexamartAfaOrderId?: string
    reference?: string
    remainingBalance?: number
    ambiguous?: boolean
}

export async function fulfillAfaOrder(params: {
    customerName: string
    customerPhone: string
    region: string
    occupation: string
    cardId: string
    orderId: string
}): Promise<RexamartAfaResult> {
    const result = await call('/orders/afa', {
        body: {
            customer_name: params.customerName,
            customer_phone: params.customerPhone,
            region: params.region,
            occupation: params.occupation || 'N/A',
            // Capozy only collects Ghana Card today (lib/afa-validation.ts VALID_ID_TYPES).
            card_type: 'gha-card',
            card_id: params.cardId,
        },
        idempotencyKey: params.orderId,
    })

    if (result.body?.success) {
        return {
            success: true,
            rexamartAfaOrderId: result.body.data?.afa_order_id,
            reference: result.body.data?.reference,
            remainingBalance: result.body.data?.remaining_balance,
        }
    }
    if (!result.body) {
        return { success: false, error: result.error || 'Rexamart request failed', ambiguous: true }
    }
    return { success: false, error: result.body.error || 'Rexamart AFA order failed' }
}

// ─── Order status + disputes ──────────────────────────────────────────────

export async function checkOrderStatus(orderIdOrReference: string): Promise<
    { success: true; status: string; statusCode: number; message?: string } | { success: false; error: string }
> {
    const result = await call(`/orders/status/${encodeURIComponent(orderIdOrReference)}`, { method: 'GET' })
    if (result.body?.success) {
        return { success: true, status: result.body.status, statusCode: result.body.status_code, message: result.body.message }
    }
    return { success: false, error: result.body?.error || result.error || 'Status check failed' }
}

export type RexamartProductKind = 'data' | 'msp' | 'bmi' | 'afa'

export async function fileDispute(
    orderIdOrReference: string,
    description: string,
    productKind: RexamartProductKind = 'data'
): Promise<{ success: true; created: boolean; reportReference: string; disputeStatus: string } | { success: false; error: string; errorCode?: string }> {
    const result = await call(`/orders/${encodeURIComponent(orderIdOrReference)}/not-received`, {
        body: { description, product_kind: productKind },
    })
    if (result.body?.success) {
        return { success: true, created: !!result.body.created, reportReference: result.body.reportReference, disputeStatus: result.body.disputeStatus }
    }
    return { success: false, error: result.body?.error || result.error || 'Failed to file dispute', errorCode: result.body?.error_code }
}

export interface RexamartDispute {
    reportReference: string
    orderId: string
    productKind: string
    productLabel?: string
    phoneNumber?: string
    amount?: number
    disputeStatus: string
    resolution?: string
    refundStatus?: string
    message?: string
    resolvedAt?: string
    createdAt: string
}

export async function checkDispute(orderIdOrReference: string): Promise<{ success: true; dispute: RexamartDispute } | { success: false; error: string }> {
    const result = await call(`/orders/${encodeURIComponent(orderIdOrReference)}/not-received`, { method: 'GET' })
    if (result.body?.success) {
        return {
            success: true,
            dispute: {
                reportReference: result.body.reportReference,
                orderId: result.body.order_id,
                productKind: result.body.product_kind,
                productLabel: result.body.product_label,
                phoneNumber: result.body.phone_number,
                amount: result.body.amount,
                disputeStatus: result.body.disputeStatus,
                resolution: result.body.resolution,
                refundStatus: result.body.refund_status,
                message: result.body.message,
                resolvedAt: result.body.resolved_at,
                createdAt: result.body.created_at,
            },
        }
    }
    return { success: false, error: result.body?.error || result.error || 'Dispute not found' }
}

export async function listDisputes(status?: string, limit = 50, offset = 0): Promise<
    { success: true; disputes: RexamartDispute[] } | { success: false; error: string }
> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (status) params.set('status', status)
    const result = await call(`/orders/not-received?${params.toString()}`, { method: 'GET' })
    if (result.body?.success) {
        const raw = (result.body as any).disputes || (result.body as any).data || []
        const disputes: RexamartDispute[] = (Array.isArray(raw) ? raw : []).map((d: any) => ({
            reportReference: d.reportReference,
            orderId: d.order_id,
            productKind: d.product_kind,
            productLabel: d.product_label,
            phoneNumber: d.phone_number,
            amount: d.amount,
            disputeStatus: d.disputeStatus,
            resolution: d.resolution,
            refundStatus: d.refund_status,
            message: d.message,
            resolvedAt: d.resolved_at,
            createdAt: d.created_at,
        }))
        return { success: true, disputes }
    }
    return { success: false, error: result.body?.error || result.error || 'Failed to list disputes' }
}
