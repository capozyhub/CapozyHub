import { waitUntil } from '@vercel/functions'
import { createServerClient } from './supabase'
import { creditShopProfit, creditShopOrderProfits } from './shop-service'
import { sendShopConfirmationSMS, resolveShopSenderFromRow } from './sms-confirmation-sender'
import { getAdminOOSNetworks, mergeOOS, isNetworkOOS } from '@/lib/network-stock'
import { resolveOwnerCost } from '@/lib/pricing/cost-basis'
import { roleFeeSettingKeys, resolveRoleFeeSetting } from '@/lib/pricing/shop-fee-resolver'
import { resolveSubAgentContext } from '@/lib/sub-agent-account'
import { resolveSubAgentDataCost } from '@/lib/sub-agent-data-pricing'
import { recordPendingSubAgentEarning } from '@/lib/sub-agent-earnings'
import { repairSubAgentEarning } from '@/lib/sub-agent-earning-repair'
import { resolveMashupShopFee } from '@/lib/shop-checkout'

/**
 * A customer has PAID but the order cannot be created. Persist a durable security_events
 * row (so it shows up for admin refund follow-up) — several of these early returns used to
 * tell the customer "your payment will be refunded" while leaving no record at all.
 */
async function recordPaidButUnfulfilled(
    db: any, eventType: string, reference: string,
    metadata: { shop_id?: string; guest_phone?: string; network?: string; order_type?: string },
    paidAmountPesewas: number, reason: string,
) {
    try {
        await db.from('security_events').insert({
            event_type: eventType,
            reference,
            shop_id: metadata.shop_id ?? null,
            paid_amount: paidAmountPesewas,
            guest_phone: metadata.guest_phone ?? null,
            network: metadata.network ?? null,
            order_type: metadata.order_type || 'data',
            detail: { reason, needs_refund: true },
            created_at: new Date().toISOString(),
        })
    } catch (e) {
        console.error('[Shop Order Processor] failed to record paid-but-unfulfilled event:', e)
    }
}

// In-memory lock to prevent race conditions between frontend verification and Paystack webhooks
const processingLocks = new Set<string>();

/**
 * Shared logic for processing a successful shop storefront payment.
 * Handles idempotency, security amount validation, order creation, profit credit, and fulfillment.
 */
export async function processShopOrder(
    reference: string,
    metadata: {
        shop_id: string;
        package_id: string;
        guest_phone: string;
        network: string;
        package_size: string;
        fulfillment_mode?: string;
        order_type?: string;
        airtime_amount?: number;
        selling_price?: number;
        cost_price?: number;
        profit?: number;
        use_exact_amount?: boolean;
        original_amount?: number;
        bundle_preference?: string;
    },
    paidAmountPesewas: number,
    slug?: string
): Promise<{ success: boolean; error?: string; orderId?: string; isDuplicate?: boolean }> {
    const supabase = createServerClient()
    const db = supabase as any

    try {
        console.log(`[Shop Order Processor] Processing Ref: ${reference}, Amount: ${paidAmountPesewas} pesewas`)

        // 0. High-Speed Memory Lock (prevents exact-millisecond race conditions on same Vercel lambda)
        if (processingLocks.has(reference)) {
            console.log(`[Shop Order Processor] Active lock found for ${reference}. Skipping duplicate execution.`);
            return { success: true, isDuplicate: true }
        }
        processingLocks.add(reference);

        // 1. Idempotency Check
        const { data: existingOrder } = await db
            .from('shop_orders')
            .select('id, status')
            .eq('paystack_reference', reference)
            .single()

        if (existingOrder) {
            // STRICT IDEMPOTENCY: If the order exists, another process handles/handled it.
            // Do NOT re-trigger fulfillment if it's pending to prevent a double charge.
            // 'refunded'/'failed' are terminal — reprocessing must NOT re-credit (an unauth
            // charge-status replay could otherwise re-run SMS + profit credit on a voided sale).
            if (['pending', 'queued', 'processing', 'completed', 'delivered', 'refunded', 'failed'].includes(existingOrder.status)) {
                console.log(`[Shop Order Processor] Idempotency: Order exists with status: ${existingOrder.status}. Skipping duplicate fulfillment.`)

                if (!['refunded', 'failed'].includes(existingOrder.status)) {
                    await repairSubAgentEarning(db, existingOrder.id, reference, metadata)
                        .catch((e: any) => console.error('[Shop Order Processor] replay repair threw:', e))
                }

                processingLocks.delete(reference);
                return { success: true, orderId: existingOrder.id, isDuplicate: true }
            }
        }

        // 2. Security: Verify Amount Against DB Prices
        // A1 — Added airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at to select
        const { data: shopProfile } = await db
            .from('shop_profiles')
            .select('owner_id, shop_name, paystack_fee_percent, fulfillment_mode, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at, mashup_fee_percent, sms_order_confirmation_enabled, sms_sender_id, sms_sender_status')
            .eq('id', metadata.shop_id)
            .single()

        if (!shopProfile) return { success: false, error: 'Shop profile not found' }

        let expectedTotalPesewas = 0
        let verifiedSellingPrice = 0
        let verifiedCostPrice = 0
        let verifiedProfit = 0
        let adminCostAtTime = 0
        // Sub-agent attribution — re-derived from the DB here (never trusted from metadata)
        let verifiedParentShopId: string | null = null
        let verifiedParentProfit: number | null = null
        // Recruiter's pending earning on this sale (set only for a sub-agent order); hoisted to
        // this scope so it is visible at the recordPendingSubAgentEarning call site further down.
        let recruiterMargin: { recruiterId: string; amount: number } | null = null
        // True whenever this sale is a sub-agent storefront sale, regardless of whether a
        // recruiter markup applies (a zero-markup sub sale is still a sub sale for the
        // underwater-guard's purposes below).
        let isSubSale = false

        const { data: ownerProfile } = await db
            .from('users')
            .select('role, dealer_expires_at, agent_expires_at')
            .eq('id', shopProfile?.owner_id)
            .single()
            
        const ownerRole = ownerProfile?.role || 'customer'

        // Hoisted so the airtime_orders insert can split totalFeeAmount into admin vs shop portions
        let airtimeShopFeeRate  = 0
        let airtimeAdminFeeRate = 0

        if (metadata.order_type === 'airtime' || metadata.order_type === 'mashup') {
            const feePrefix = metadata.order_type === 'mashup' ? 'mashup' : 'airtime'
            const { data: settingsRows } = await db.from('admin_settings').select('key, value').in('key', [
                `${feePrefix}_fee_${metadata.network.toLowerCase()}_customer`,
                `${feePrefix}_fee_${metadata.network.toLowerCase()}_agent`,
                `${feePrefix}_fee_${metadata.network.toLowerCase()}_dealer`,
            ])
            const settingsMap = (settingsRows || []).reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {})

            // Use mashup_fee_percent for mashup shop markup, airtime_fee_X for airtime shop markup
            const shopFeeKey = `airtime_fee_${metadata.network.toLowerCase()}`
            const shopFee = metadata.order_type === 'mashup'
                ? resolveMashupShopFee((shopProfile as any).mashup_fee_percent)
                : parseFloat((shopProfile as any)[shopFeeKey] || 0)
            const adminFee = parseFloat(settingsMap[`${feePrefix}_fee_${metadata.network.toLowerCase()}_${ownerRole}`] || '0')

            // Store rates so we can split fee_amount in the airtime_orders insert below
            airtimeShopFeeRate  = shopFee
            airtimeAdminFeeRate = adminFee
            
            const originalAmount = parseFloat((metadata.original_amount || metadata.airtime_amount || metadata.selling_price || '0') as any)
            
            const totalFeeMultiplier = (shopFee + adminFee) / 100
            const feeAmount = originalAmount * totalFeeMultiplier
            
            let actualAirtimeAmount = originalAmount
            const exactFlag = metadata.use_exact_amount
            const isExact = exactFlag === true || String(exactFlag) === 'true'
            
            if (isExact || exactFlag === undefined) {
                // If it's an old pending order without the flag, it behaves like exact mode
                expectedTotalPesewas = Math.round((originalAmount + feeAmount) * 100)
            } else {
                expectedTotalPesewas = Math.round(originalAmount * 100)
                actualAirtimeAmount = Math.max(0, originalAmount - feeAmount)
            }
            
            verifiedSellingPrice = actualAirtimeAmount
            verifiedCostPrice = actualAirtimeAmount
            verifiedProfit = actualAirtimeAmount > 0 ? actualAirtimeAmount * (shopFee / 100) : 0
            adminCostAtTime = actualAirtimeAmount
        } else {
            // --- Role-Aware Paystack Fee Resolution ---
            // Priority: per-shop override → role-specific global → (subagent only)
            // customer-tagged global → legacy global → hardcoded default. See
            // lib/pricing/shop-fee-resolver.ts for the shared resolver — this used to be
            // a local copy of that logic (5 other copies existed across the codebase,
            // and had drifted: none of them fell back to the customer rate for a
            // sub-agent with no `_subagent`-tagged global row of their own).
            // A per-shop override of exactly 0 means "deliberately free for this shop".
            // Only null means "inherit from global".
            const { data: paystackSettingsRows } = await db
                .from('shop_global_settings')
                .select('key, value')
                .in('key', roleFeeSettingKeys(ownerRole, 'shop_paystack_fee_percent'))
            const paystackSettingsMap: Record<string, string> = {}
            for (const row of (paystackSettingsRows || [])) {
                paystackSettingsMap[row.key] = row.value
            }

            const paystackFeePercent = resolveRoleFeeSetting(
                paystackSettingsMap, ownerRole, 'shop_paystack_fee_percent', 1.95, shopProfile?.paystack_fee_percent
            )

            const { data: pkg } = await db.from('data_packages').select('price, agent_price, dealer_price, cost_price, network, size').eq('id', metadata.package_id).single()
            const { data: shopPrice } = await db.from('shop_pricing').select('selling_price').eq('shop_id', metadata.shop_id).eq('package_id', metadata.package_id).maybeSingle()

            if (!pkg) {
                await recordPaidButUnfulfilled(db, 'shop_paid_unfulfilled', reference, metadata, paidAmountPesewas, 'package_missing')
                return { success: false, error: 'Price configuration missing' }
            }

            // What gets fulfilled must come from the package row, not from echoed metadata.
            if (pkg.network && pkg.size) {
                metadata = { ...metadata, network: pkg.network, package_size: pkg.size }
            }

            // Sub-agent shop? Re-derive from the DB — metadata hints are never trusted (spec §11).
            const subCtx = await resolveSubAgentContext(db, shopProfile.owner_id)

            // FAIL CLOSED on a chain that stopped being eligible between checkout and now
            // (security review 2026-08-17, finding H1 — preserved from the retired engine).
            // computeShopCheckout gates on effectiveActive, but that only blocks sales from
            // STARTING; a suspension landing while the customer is mid-payment leaves an
            // in-flight order this webhook must also reject, not silently credit.
            if (subCtx.isSub && !subCtx.effectiveActive) {
                console.error(`[Shop Order Processor] 🚨 INELIGIBLE SUB blocked: Ref ${reference}, shop ${metadata.shop_id} — went inactive between checkout and payment confirmation. Flagging for refund.`)
                try {
                    await db.from('security_events').insert({
                        event_type: 'shop_ineligible_sub_chain_blocked',
                        reference,
                        shop_id: metadata.shop_id,
                        paid_amount: paidAmountPesewas,
                        guest_phone: metadata.guest_phone,
                        network: metadata.network,
                        order_type: metadata.order_type || 'data',
                        created_at: new Date().toISOString(),
                    })
                } catch (auditErr) {
                    console.warn('[Shop Order Processor] ineligible-sub audit log failed:', auditErr)
                }
                return { success: false, error: 'This order cannot be completed. Your payment will be refunded.' }
            }

            let dbSubCost: number | null = null
            if (subCtx.isSub) {
                isSubSale = true
                const resolved = await resolveSubAgentDataCost(db, shopProfile.owner_id, metadata.package_id, pkg, 'data')
                if (!resolved.ok) {
                    console.error(`[Shop Order Processor] 🚨 sub cost unresolvable: ${resolved.reason} (Ref ${reference})`)
                    await recordPaidButUnfulfilled(db, 'shop_paid_unfulfilled', reference, metadata, paidAmountPesewas, 'sub_cost_unresolvable')
                    return { success: false, error: 'Pricing changed and this order cannot be completed. Your payment will be refunded.' }
                }
                dbSubCost = resolved.subCost
                if (resolved.recruiterEarns > 0 && resolved.recruiterId) {
                    recruiterMargin = { recruiterId: resolved.recruiterId, amount: resolved.recruiterEarns }
                }
            }

            if (!shopPrice && dbSubCost == null) {
                await recordPaidButUnfulfilled(db, 'shop_paid_unfulfilled', reference, metadata, paidAmountPesewas, 'shop_price_missing')
                return { success: false, error: 'Price configuration missing' }
            }

            const adminOOS = await getAdminOOSNetworks(db)
            const { data: shopStock } = await db.from('shop_profiles').select('oos_networks').eq('id', metadata.shop_id).maybeSingle()
            if (isNetworkOOS(mergeOOS(adminOOS, shopStock?.oos_networks), metadata.network)) {
                await recordPaidButUnfulfilled(db, 'shop_paid_unfulfilled', reference, metadata, paidAmountPesewas, 'network_out_of_stock')
                return { success: false, error: `${metadata.network} is out of stock at the moment` }
            }

            const dbSellingPrice = shopPrice ? parseFloat(shopPrice.selling_price) : (dbSubCost as number)
            const paystackFee = Math.round(dbSellingPrice * (paystackFeePercent / 100) * 100) / 100
            expectedTotalPesewas = Math.round((dbSellingPrice + paystackFee) * 100)

            verifiedSellingPrice = dbSellingPrice
            adminCostAtTime = parseFloat(pkg?.cost_price) || 0

            if (subCtx.isSub && dbSubCost != null) {
                verifiedCostPrice = dbSubCost
                verifiedProfit = dbSellingPrice - dbSubCost
            } else {
                // Not a sub sale: process as a NORMAL single-party sale rather than stranding a
                // paid order. Mirrors the checkout-time computation so the webhook re-verify
                // agrees. (Spec D17.)
                verifiedCostPrice = resolveOwnerCost(pkg, {
                    role: ownerRole,
                    agent_expires_at: ownerProfile?.agent_expires_at,
                    dealer_expires_at: ownerProfile?.dealer_expires_at,
                })
                verifiedProfit = dbSellingPrice - verifiedCostPrice
            }
        }

        const amountDifference = Math.abs(paidAmountPesewas - expectedTotalPesewas)

        // A2 — SECURITY: Amount validation runs BEFORE any order creation
        if (amountDifference > 5) {
            console.error(`[Shop Order Processor] 🚨 AMOUNT MISMATCH: Ref: ${reference}, Paid: ${paidAmountPesewas}, Expected: ${expectedTotalPesewas}`)

            // B5 — Audit trail: persist mismatch for fraud monitoring
            try {
                await db.from('security_events').insert({
                    event_type: 'airtime_amount_mismatch',
                    reference,
                    shop_id: metadata.shop_id,
                    paid_amount: paidAmountPesewas,
                    expected_amount: expectedTotalPesewas,
                    guest_phone: metadata.guest_phone,
                    network: metadata.network,
                    order_type: metadata.order_type || 'data',
                    created_at: new Date().toISOString()
                })
            } catch (auditErr) {
                // Non-fatal — log but continue returning the error
                console.warn('[Shop Order Processor] Audit log failed:', auditErr)
            }

            // A5 — Safety net: if an existingOrder record was found (already in DB), update all tables to failed
            if (existingOrder?.id) {
                await db.from('shop_orders').update({ status: 'failed' }).eq('id', existingOrder.id)
                await db.from('orders').update({ status: 'failed' }).eq('shop_order_id', existingOrder.id)
                await db.from('airtime_orders')
                    .update({ status: 'failed' })
                    .eq('reference_code', `SHOP-${reference.slice(-10)}`)
            }

            return { success: false, error: 'Payment amount mismatch' }
        }

        // FIX D (spec §7.5): re-enforce the profit floor here. computeShopCheckout rejects
        // profit<=0, but a role downgrade BETWEEN checkout and this webhook can raise the
        // owner cost and flip a valid sale underwater — and previously the order was still
        // inserted (and later credited a NEGATIVE profit, debiting the owner). Block it,
        // flag for refund. Data orders only (airtime/mashup profit is fee-based, always >=0).
        // Sub-agent orders: zero sub-markup is LEGAL (no-markup default), so the floor is
        // strictly-negative for a sub sale; normal shops keep profit > 0.
        const isDataOrder = !(metadata.order_type === 'airtime' || metadata.order_type === 'mashup')
        const underwater = isSubSale ? verifiedProfit < 0 : verifiedProfit <= 0
        if (isDataOrder && underwater) {
            console.error(`[Shop Order Processor] 🚨 UNDERWATER ORDER blocked: Ref ${reference}, selling ${verifiedSellingPrice}, cost ${verifiedCostPrice}, profit ${verifiedProfit} — likely a role-downgrade race. Flagging for refund.`)
            try {
                await db.from('security_events').insert({
                    event_type: 'shop_underwater_order_blocked',
                    reference,
                    shop_id: metadata.shop_id,
                    paid_amount: paidAmountPesewas,
                    expected_amount: expectedTotalPesewas,
                    guest_phone: metadata.guest_phone,
                    network: metadata.network,
                    order_type: metadata.order_type || 'data',
                    created_at: new Date().toISOString(),
                })
            } catch (auditErr) {
                console.warn('[Shop Order Processor] underwater audit log failed:', auditErr)
            }
            return { success: false, error: 'Pricing changed and this order cannot be completed. Your payment will be refunded.' }
        }

        // 3. Create Order Records (only runs after amount validation passes)
        let orderId = existingOrder?.id
        let airtimeOrderId: string | null = null
        const fulfillmentMode = shopProfile?.fulfillment_mode || metadata.fulfillment_mode || 'auto'

        if (!existingOrder) {
            const payload = {
                shop_id: metadata.shop_id,
                package_id: metadata.package_id || null, // null for airtime
                guest_phone: metadata.guest_phone,
                network: metadata.network,
                package_size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                selling_price: verifiedSellingPrice,
                cost_price: verifiedCostPrice,
                profit: verifiedProfit,
                admin_cost_at_time: adminCostAtTime,
                owner_role_at_time: ownerRole,
                // Sub-agent split snapshot (DB-verified above; both immutable from here)
                parent_shop_id: verifiedParentShopId,
                parent_profit: verifiedParentProfit,
                paystack_reference: reference,
                status: 'pending'
            }

            const { data: newOrder, error: createError } = await db
                .from('shop_orders')
                .insert(payload)
                .select('id')
                .single()

            if (createError) {
                // Cross-lambda race: the UNIQUE(paystack_reference) constraint rejected this
                // duplicate insert because another instance (or the webhook) already created the
                // order. Treat as an idempotent duplicate, not a failure — the winner fulfills.
                if ((createError as any).code === '23505') {
                    console.log(`[Shop Order Processor] Idempotency: duplicate insert for ${reference} (unique violation). Skipping.`)
                    processingLocks.delete(reference)
                    return { success: true, isDuplicate: true }
                }
                console.error('[Shop Order Processor] Failed to create shop order:', createError)
                return { success: false, error: 'Order creation failed' }
            }
            orderId = newOrder?.id

            // Record the recruiter's pending earning (spec §3.2) via the shared ledger helper.
            // recordPendingSubAgentEarning's insert is naturally idempotent (a replayed call
            // with the same order_reference hits 23505 and returns success without writing
            // twice) — the trigger built in Plan 1 does the actual wallet crediting once the
            // order's status reaches completed.
            if (orderId && recruiterMargin) {
                await recordPendingSubAgentEarning(db, {
                    orderReference: reference,
                    orderTable: 'shop_orders',
                    recruiterId: recruiterMargin.recruiterId,
                    subUserId: shopProfile.owner_id,
                    amount: recruiterMargin.amount,
                }).catch((e) => console.error('[Shop Order Processor] recordPendingSubAgentEarning threw:', e))
            }

            await db.from('orders').insert({
                user_id: shopProfile?.owner_id,
                phone_number: metadata.guest_phone,
                network: metadata.network,
                size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                price: verifiedSellingPrice,
                cost_price_at_time: verifiedCostPrice,
                role_at_time: ownerRole,
                status: 'pending',
                payment_status: 'paid',
                reference_code: `SHOP-${reference.slice(-10)}`,
                fulfillment_method: 'auto',
                shop_name: shopProfile?.shop_name || slug,
                shop_order_id: orderId
            })

            // Mirror airtime orders to the primary airtime_orders ledger
            // so admins can view and fulfill them in the Airtime Intelligence page
            if (metadata.order_type === 'airtime' || metadata.order_type === 'mashup') {
                // A3 — Use actual paid amount (paidAmountPesewas), NOT expectedTotalPesewas
                const totalPaidGHS = paidAmountPesewas / 100
                const totalFeeAmount = Math.max(0, totalPaidGHS - verifiedSellingPrice)
                const totalFeeRate = verifiedSellingPrice > 0 ? (totalFeeAmount / verifiedSellingPrice) * 100 : 0

                // Split fee into admin vs shop portions for transparent profit tracking
                const totalFeeRate2 = airtimeShopFeeRate + airtimeAdminFeeRate
                const adminFeeAmount = totalFeeRate2 > 0
                    ? totalFeeAmount * (airtimeAdminFeeRate / totalFeeRate2)
                    : totalFeeAmount
                const shopFeeAmount = totalFeeRate2 > 0
                    ? totalFeeAmount * (airtimeShopFeeRate / totalFeeRate2)
                    : 0

                // A4 — Read use_exact_amount from metadata instead of hardcoding false
                const useExactAmountFlag = metadata.use_exact_amount === true || String(metadata.use_exact_amount) === 'true'

                const { data: newAirtimeOrder, error: airtimeInsertError } = await db.from('airtime_orders').insert({
                    user_id: shopProfile?.owner_id,
                    user_role: ownerRole,
                    beneficiary_phone: metadata.guest_phone,
                    network: metadata.network,
                    airtime_amount: verifiedSellingPrice,
                    fee_rate: totalFeeRate,
                    fee_amount: totalFeeAmount,
                    admin_fee_amount: adminFeeAmount,
                    shop_fee_amount: shopFeeAmount,
                    total_paid: totalPaidGHS,
                    use_exact_amount: useExactAmountFlag,
                    status: 'pending',
                    // Explicit: the column's DEFAULT is 'web', which would mislabel every
                    // storefront order. See 20260826_airtime_source_default.sql.
                    source: 'shop',
                    reference_code: `SHOP-${reference.slice(-10)}`,
                    shop_id: metadata.shop_id,
                    shop_name: shopProfile?.shop_name || slug,
                    type: metadata.order_type,
                    bundle_preference: metadata.bundle_preference || null
                }).select('id').single()
                if (airtimeInsertError) {
                    console.error('[ShopOrder] Failed to capture airtime order id:', airtimeInsertError)
                }
                // Hubtel airtime dispatch is for plain airtime only — never mashup
                airtimeOrderId = metadata.order_type === 'airtime' ? (newAirtimeOrder?.id ?? null) : null
            }
        }

        // 4. Process Valid Order — SMS, Profit Credit, Fulfillment
        // Customer confirmation SMS is opt-out per shop (defaults to enabled).
        // Task F3: suppress-until-sender + credit-metered — a shop with no
        // APPROVED sms_sender_id sends NOTHING (no free platform-sender
        // fallback); an approved shop pays 1 SMS credit/confirmation via
        // debit_sms_credits (with atomic refund-on-send-failure). The sender
        // is pre-resolved from the shopProfile row already SELECTed above so
        // sendShopConfirmationSMS doesn't re-query shop_profiles.
        if (metadata.guest_phone && (shopProfile as any)?.sms_order_confirmation_enabled !== false) {
            waitUntil(sendShopConfirmationSMS(db, metadata.shop_id, metadata.guest_phone, {
                network: metadata.network,
                size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                price: verifiedSellingPrice,
            }, {
                sender: resolveShopSenderFromRow(shopProfile as any),
            }).catch((err: Error) => console.error('[Shop Order Processor] Confirmation SMS error:', err)))
        }

        // 4.2 Credit Profit — under the new single-recruiter engine every shop order,
        // sub-agent or not, is a single-party sale for crediting purposes: `verifiedParentShopId`
        // is always null now (Finding 1 fix), so this always takes the `creditShopProfit` path.
        // `creditShopOrderProfits` (the OLD chain-aware crediting RPC, credits the retired
        // `shop_wallets` chain-split system) is intentionally left dispatchable below as
        // dead-but-harmless code rather than deleted, so a future re-introduction of
        // `verifiedParentShopId` doesn't silently resurrect it without review. Recruiter
        // crediting for sub-agent sales is handled entirely separately — recorded here via
        // recordPendingSubAgentEarning above, then actually credited to the NEW
        // `commission_wallets` system by a database trigger (from Plan 1) once the order
        // reaches completed. Firing both paths for the same order would double-credit, which
        // is exactly what this dispatch must never do.
        try {
            if (verifiedParentShopId) {
                await creditShopOrderProfits(orderId!)
            } else {
                await creditShopProfit(orderId!)
            }
        } catch (profitErr) {
            console.error('[Shop Order Processor] Profit credit error:', profitErr)
        }

        // 4.3 Trigger Fulfillment
        try {
            const fulfillmentPayload = (metadata.order_type === 'airtime' || metadata.order_type === 'mashup')
               ? { amount: metadata.airtime_amount || verifiedSellingPrice }
               : { size: metadata.package_size }

            await triggerShopFulfillment(orderId!, metadata.network, metadata.guest_phone, db, {
                referenceCode: `SHOP-${reference.slice(-10)}`,
                price: verifiedSellingPrice,
                customerName: 'Shop Guest',
                customerEmail: 'N/A',
                shopName: shopProfile?.shop_name || slug || shopProfile?.shop_name,
                fulfillmentMode,
                orderType: metadata.order_type || 'data',
                airtimeOrderId: airtimeOrderId ?? undefined,
                ...fulfillmentPayload
            })
        } catch (fulfillErr) {
            console.error('[Shop Order Processor] Fulfillment error:', fulfillErr)
        }
        return { success: true, orderId }

    } catch (error) {
        console.error('[Shop Order Processor] Critical error:', error)
        return { success: false, error: 'Internal processor error' }
    } finally {
        // Clear lock after processing completes or fails
        processingLocks.delete(reference);
    }
}

async function triggerShopFulfillment(
    orderId: string,
    network: string,
    phone: string,
    db: any,
    extra: {
        referenceCode: string
        price: number
        customerName: string
        customerEmail: string
        shopName: string
        fulfillmentMode: string
        orderType: string
        amount?: number
        size?: string
        airtimeOrderId?: string
    }
) {
    // Refund guard (defense-in-depth): never fulfill a shop order that was refunded — or has a
    // Paystack refund IN PROGRESS (refund_method='paystack', finalized by the refund webhook) —
    // between payment and this dispatch.
    const { data: statusRow } = await db.from('shop_orders').select('status, refund_method').eq('id', orderId).maybeSingle()
    const _rm = (statusRow as any)?.refund_method
    if ((statusRow as any)?.status === 'refunded' || _rm === 'paystack' || _rm === 'paystack_attention') {
        console.log(`[Shop Order Processor] Skipping fulfillment for refunded/refunding shop order ${orderId}`)
        return
    }

    const { sendAdminNewOrderAlert } = await import('./email-service')

    const alertDetails = {
        referenceCode: extra.referenceCode,
        phoneNumber: phone,
        network: network,
        size: extra.size || `${extra.amount} Airtime`,
        price: extra.price,
        customerName: extra.customerName,
        customerEmail: extra.customerEmail,
        source: 'shop_storefront' as const,
        shopName: extra.shopName
    }

    if (extra.fulfillmentMode !== 'auto' || extra.orderType === 'airtime') {
        console.log(`[Shop Order Processor] Manual fulfillment required - sending alert`)
        
        if (extra.orderType === 'airtime') {
            const { sendAdminAirtimeOrderEmail } = await import('./email-service')
            await sendAdminAirtimeOrderEmail({
                referenceCode: extra.referenceCode,
                userName: extra.customerName,
                userEmail: extra.customerEmail,
                userRole: 'Guest',
                beneficiaryPhone: phone,
                network: network,
                airtimeAmount: extra.amount || extra.price,
                totalPaid: extra.price,
                useExactAmount: false,
                source: `Shop Storefront (${extra.shopName})`
            }).catch(e => console.error('[Shop Order Processor] Admin Airtime Email Error:', e))
            
            // Admin SMS alert disabled for airtime — it auto-fulfills via Hubtel now (admins still get the
            // email above + a web-push on auto-fulfillment failure). Mashup uses sendAdminNewOrderAlert below.

            // ── Auto-dispatch via Hubtel Commission Services (no-op when kill-switch off) ──
            // Fallback: admin alerts above already fired; if auto is OFF the order stays pending
            // for manual fulfillment — today's behavior preserved.
            if (extra.airtimeOrderId) {
                try {
                    const { dispatchAirtimeFulfillment } = await import('@/lib/airtime-fulfillment')
                    await dispatchAirtimeFulfillment(extra.airtimeOrderId)
                } catch (e) {
                    console.error('[ShopOrder] airtime auto-dispatch failed:', e)
                }
            }
        } else {
            await sendAdminNewOrderAlert({
                ...alertDetails,
                reason: 'Manual fulfillment mode enabled for this shop'
            }).catch(e => console.error('[Shop Order Processor] Admin Alert Error:', e))
        }

        return
    }

    // No supplier is wired up yet (Capozy — see docs/stage-1-5-scope-down.md, "Suppliers").
    // Every auto-mode order is left `pending` for manual fulfillment from
    // /admin/fulfillment, with one admin alert. The claim/dispatch machinery this used
    // to call, and the per-supplier services it dispatched to, have been removed —
    // re-adding a real supplier means writing a new dispatch branch here.
    console.log(`[Shop Order Processor] No active supplier configured — order ${orderId} kept pending for manual fulfillment.`)
    await sendAdminNewOrderAlert({
        ...alertDetails,
        reason: `No active supplier configured for network: ${network}`,
    }).catch(e => console.error('[Shop Order Processor] Admin Alert Error:', e))
}
