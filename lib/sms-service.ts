/**
 * SMS service (provider-neutral seam)
 *
 * Capozy Hub has no SMS provider wired yet. Every send goes through `sendSMS`, which returns a
 * clean "not configured" failure until a transport is registered with `registerSmsTransport`.
 * Callers already treat a failed send as non-fatal, so nothing breaks while SMS is off.
 * There is deliberately no provider fallback chain: one transport, registered once.
 */

export interface SMSOptions {
    recipient: string
    message: string
    sender?: string
}

export interface SMSResult {
    success: boolean
    messageId?: string
    batchId?: string
    error?: string
    provider?: string
}

export interface SMSBatchResult {
    sent: number
    failed: number
    errors: string[]
}

export type SmsTransport = (options: SMSOptions) => Promise<SMSResult>

let transport: SmsTransport | null = null

/** Plug in the one real SMS provider. Call once at startup (e.g. from a provider module). */
export function registerSmsTransport(next: SmsTransport | null) {
    transport = next
}

export function isSmsConfigured(): boolean {
    return transport !== null
}

/** Send a single SMS. Never throws; returns `success: false` when no provider is configured. */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
    if (!transport) return { success: false, error: 'SMS is not configured', provider: 'none' }
    try {
        return await transport(options)
    } catch (e: any) {
        return { success: false, error: e?.message || 'SMS send failed' }
    }
}

/** Send many messages one by one through the registered transport. */
export async function sendSmsBatch(messages: Array<{ phone: string; message: string }>): Promise<SMSBatchResult> {
    let sent = 0, failed = 0
    const errors: string[] = []
    for (const m of messages) {
        const res = await sendSMS({ recipient: m.phone, message: m.message })
        if (res.success) sent++
        else { failed++; errors.push(`${m.phone}: ${res.error}`) }
    }
    return { sent, failed, errors }
}

/**
 * Normalize a Ghanaian phone number to international format: 233XXXXXXXXX
 * Returns null if the number is not recognizable.
 */
export function normalizeGhanaPhone(raw: string): string | null {
    let n = raw.replace(/[\s\-+]/g, '')
    if (n.startsWith('0') && n.length === 10)  n = '233' + n.slice(1)
    if (n.startsWith('233') && n.length === 12) return n
    return null
}

// ==========================================

// SPECIFIC SMS FUNCTIONS
// ==========================================

/**
 * Single source of truth for the order-success SMS template. Exported so
 * credit-metered callers (lib/sms-confirmation-sender.ts) can size segments
 * on the EXACT text this service will send — the two must never drift.
 */
export function buildOrderSuccessMessage(size: string): string {
    return `Your ${size} order has been confirmed and is now processing. Delivery expected very soon. Thank you for your order!`
}

/**
 * Send order success SMS to account holder
 */
export async function sendOrderSuccessSMS(
    accountHolderPhone: string,
    details: {
        network: string
        size: string
        price: number
        recipientNumber: string
        currentBalance: number
        sender?: string
    }
) {
    const message = buildOrderSuccessMessage(details.size)

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({
        recipient: details.recipientNumber,
        message,
        sender: details.sender
    })
}

/**
 * Send status update SMS
 */
export async function sendStatusUpdateSMS(
    phoneNumber: string,
    details: {
        referenceCode: string
        status: string
    }
) {
    // DISABLED AS REQUESTED
    /*
    const message = `Order Update: Your order ${details.referenceCode} is now ${details.status.toUpperCase()}. Check your dashboard for details.`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
    */
    return { success: true, messageId: 'disabled', error: undefined } // Mock success to prevent errors
}

/**
 * Send wallet top-up success SMS
 */
export async function sendWalletTopupSuccessSMS(
    phoneNumber: string,
    details: {
        amount: number
        newBalance: number
    }
) {
    const message = `Your top-up was successful! GHS ${details.amount.toFixed(2)} has been added to your Capozy Wallet. New balance: GHS ${details.newBalance.toFixed(2)}. Thank you!`

    // ROUTE: Moolre
    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send welcome SMS to new users
 * Optimized for MTN delivery - uses stealth keywords to bypass content filters
 */
export async function sendWelcomeSMS(
    phoneNumber: string,
    firstName: string
) {
    // DISABLED AS REQUESTED
    /*
    const message = `Hello! Welcome to Capozy Hub. All we do here is instant Delivery (PA-TU-PA) start ordering your package now. Chat us on WhatsApp:578065809`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
    */
    return { success: true, messageId: 'disabled', error: undefined }
}
/**
 * Send Agent upgrade success SMS
 */
/**
 * Send Agent upgrade success SMS
 * Updated Template: "Congratulations! Your Agent membership has been upgraded until [Remaining_days]"
 */
export async function sendAgentUpgradeSuccessSMS(
    phoneNumber: string,
    firstName: string,
    planDays: string,
    remainingDays: number,
    expiryDate: string
) {
    const message = `Congratulations ${firstName}! Your Agent membership is now active for ${planDays}, giving you access to our lowest Agent prices. Login to start ordering!`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Send SMS notification when an agent upgrades to the permanent plan
 */
export async function sendPermanentAgentUpgradeSuccessSMS(
    phoneNumber: string
) {
    const message = `Congratulations! Your Agent membership is now PERMANENT, giving you lifetime access to our best Agent benefits and pricing. Thank you!`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Send Agent Extend/Renewal Success SMS
 * Template: "Congratulations! Your Agent membership has been extended until [Formatted_Date]"
 */
export async function sendAgentExtensionSuccessSMS(
    phoneNumber: string,
    expiryDate: string | Date
) {
    const date = new Date(expiryDate)
    const day = date.getDate()
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()

    const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]

    const formattedDate = `${month} ${day}${suffix}, ${year}`

    const message = `Your Agent membership has been successfully extended until ${formattedDate}. Thank you for staying with us!`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send Admin Alert for New Agent Order
 * Template: "NEW AGENT ORDER"
 */
export async function sendAdminAgentOrderAlert() {
    // DISABLED AS REQUESTED
    /*
    // Strictly use the requested number for agent orders: 0551617309
    const targetNumber = '0551617309'

    return sendSMS({
        recipient: targetNumber,
        message: 'NEW AGENT ORDER'
    })
    */
    return { success: true, messageId: 'disabled', error: undefined } // Mock success to prevent errors
}

/**
 * Send Dealer activation success SMS
 * Template mirrors agent activation — "activated for 6 months, expires [date]"
 */
export async function sendDealerActivationSuccessSMS(
    phoneNumber: string,
    firstName: string,
    expiryDate: string | Date
) {
    const date = new Date(expiryDate)
    const day = date.getDate()
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()
    const suffix = ['th', 'st', 'nd', 'rd'][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]
    const formattedDate = `${month} ${day}${suffix}, ${year}`

    const message = `Congratulations ${firstName}! Your Dealer membership is now active for 6 months, until ${formattedDate}. Login to start ordering!`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Send Dealer extension/renewal success SMS
 * Template mirrors agent extension — "extended until [date]"
 */
export async function sendDealerExtensionSuccessSMS(
    phoneNumber: string,
    expiryDate: string | Date
) {
    const date = new Date(expiryDate)
    const day = date.getDate()
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()
    const suffix = ['th', 'st', 'nd', 'rd'][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]
    const formattedDate = `${month} ${day}${suffix}, ${year}`

    const message = `Your Dealer membership has been successfully extended until ${formattedDate}. Thank you for staying with us!`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Send Agent renewal reminder SMS (less than 48 hours left)
 */
export async function sendAgentRenewalReminderSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `Hi ${firstName}, your Agent plan expires in under 48hrs. Enable Auto-Upgrade in Settings so your Capozy Wallet covers renewal, or renew at capozygh.com`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send Dealer renewal reminder SMS (less than 48 hours left)
 */
export async function sendDealerRenewalReminderSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `Hi ${firstName}, your Dealer plan expires in under 48hrs. Enable Auto-Upgrade in Settings so your Capozy Wallet covers renewal, or renew at capozygh.com`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send SMS notification when agent subscription expires
 */
export async function sendAgentExpiryNotificationSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `Hi ${firstName}, your Agent membership has expired. You can renew anytime from your dashboard to continue enjoying Agent prices. Thank you!`

    // ROUTE: Moolre
    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send SMS notification when an order is refunded
 */
export async function sendOrderRefundSMS(
    phoneNumber: string,
    recipientNumber: string,
    refundAmount: number,
    newBalance: number
) {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

/**
 * Refund of a shop (storefront/USSD) order settles to the SHOP OWNER's wallet, not the
 * guest's — so without this, the guest beneficiary has no way to know their order was
 * refunded at all. Tells them to message the seller directly to actually receive it, with
 * a 6hr WhatsApp escalation to us as a last resort. Kept at/under 160 chars, no emojis
 * (single SMS segment). `network` is accepted (and still required by the caller's gating
 * check in lib/refund-service.ts) but deliberately NOT interpolated into the text — the
 * SMS goes straight to the beneficiary, who already knows their own network.
 *
 * WORDING: leads with "Your {size} wasn't completed; refunded" — not "was refunded" — so
 * guests don't read the SMS as "money already in hand." Says "WhatsApp (not a call)
 * <number> to receive", never "Contact <number>": the old copy read as a number to dial,
 * and guests were calling sellers and WhatsApp'ing support instead, the exact opposite of
 * what we want. Naming the action before the number, and saying "not a call" right next to
 * it, is what stops the calls (2026-09-24: escalation window also tightened 24h -> 6h so
 * the "report it" path fires sooner for guests who never hear back from the seller).
 *
 * LENGTH: an SMS over 160 chars silently splits into two BILLED segments, on every
 * refund, forever — so wording is bounded, not free. Current worst realistic case —
 * Telecel + "GHS 500.00 Mashup Bundle" + a +233 number — is 153 chars.
 * scripts/test-refund-sms-copy.ts enforces the ceiling; run it before adding any word.
 */
export function buildShopGuestRefundMessage(details: {
    network: string
    size: string
    ownerPhone: string
}): string {
    return `Your ${details.size} wasn't completed; refunded. WhatsApp (not a call) ${details.ownerPhone} to receive. Not resolved in 6h? Report: WhatsApp 0578065809`
}

/**
 * AFA sibling of buildShopGuestRefundMessage — same WhatsApp-not-a-call wording,
 * same 160-char discipline, no size (an AFA order has none). See that function's
 * doc comment for the full rationale; nothing here deviates from it.
 */
export function buildAfaGuestRefundMessage(details: {
    ownerPhone: string
}): string {
    return `Your AFA registration wasn't completed; refunded. WhatsApp (not a call) ${details.ownerPhone} to receive. Not resolved in 6h? Report: WhatsApp 0578065809`
}

export async function sendShopGuestRefundSMS(
    recipientNumber: string,
    details: {
        network: string
        size: string
        ownerPhone: string
    }
) {
    const message = buildShopGuestRefundMessage(details)

    return sendSMS({
        recipient: recipientNumber,
        message,
    })
}

// ==========================================
// SHOP ALERT SMS FUNCTIONS
// ==========================================

/**
 * Alert 3 · Pricing Approved — SMS to shop owner
 */
export async function sendShopPricingApprovedSMS(
    phoneNumber: string,
    firstName: string
) {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

/**
 * Alert 4 · Pricing Rejected — SMS to shop owner
 */
export async function sendShopPricingRejectedSMS(
    phoneNumber: string,
    firstName: string,
    reason: string
) {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

/**
 * Alert 5 · Shop Profile Approved — SMS to shop owner
 */
export async function sendShopProfileApprovedSMS(
    phoneNumber: string,
    shopName: string
) {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

/**
 * Alert 6 · Shop Profile Rejected — SMS to shop owner
 */
export async function sendShopProfileRejectedSMS(
    phoneNumber: string,
    firstName: string,
    reason: string
) {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

/**
 * Alert 7 · Withdrawal Processed (Paid) — SMS to shop owner
 */
export async function sendShopWithdrawalProcessedSMS(
    phoneNumber: string,
    firstName: string,
    netAmount: number,
    network: string,
    momoNumber: string
) {
    const isBank = ['BANK', 'BANK TRANSFER', 'FIDELITY', 'ECOBANK', 'GCB'].includes(network.toUpperCase())
    const accountType = isBank ? 'Bank' : 'MoMo'

    const message = `Hi ${firstName}, your Net Payout of GHS ${netAmount.toFixed(2)} has been sent to your ${accountType} number ${momoNumber}. Thank you!`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 7b · Withdrawal Rejected — SMS to shop owner
 */
export async function sendShopWithdrawalRejectedSMS(
    phoneNumber: string,
    firstName: string
) {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

// ==========================================
// AIRTIME FUNCTIONS
// ==========================================

/**
 * Send beneficiary confirmation SMS when airtime order is placed
 * Triggered immediately after successful wallet deduction
 */
export async function sendAirtimeBeneficiarySMS(
    beneficiaryPhone: string,
    airtimeAmount: number
): Promise<SMSResult> {
    // DISABLED AS REQUESTED
    return { success: true, messageId: 'disabled', error: undefined }
}

/**
 * Send admin alert when a new airtime or mashup order is placed (both shop and main site)
 * Sent only to admins, excluding sub-admins.
 * For mashup orders: title changes to "NEW MASHUP ORDER" and short preference code is appended
 * (B Focus / D Focus / V Focus) to avoid SMS carrier content filtering.
 */
export async function sendAdminAirtimeAlertSMS(
    adminPhones: string[],
    details: {
        source: string
        receiver: string
        amount: number | string
        network: string
        type?: 'airtime' | 'mashup'
        bundle_preference?: 'balanced' | 'data' | 'voice' | null
    }
): Promise<void> {
    const amountNum = typeof details.amount === 'string' ? parseFloat(details.amount) : details.amount;
    const isMashup = details.type === 'mashup'
    
    let networkInitial = details.network.charAt(0).toUpperCase()
    const netUpper = details.network.toUpperCase()
    if (netUpper.includes('MTN')) networkInitial = 'M'
    else if (netUpper.includes('TELECEL') || netUpper.includes('VODA')) networkInitial = 'T'
    else if (netUpper.includes('AIRTEL') || netUpper === 'AT') networkInitial = 'A'

    // Short preference abbreviation for mashup to avoid SMS flag/block
    let prefLine = ''
    if (isMashup && details.bundle_preference) {
        const prefMap: Record<string, string> = {
            balanced: 'B Focus',
            data: 'D Focus',
            voice: 'V Focus',
        }
        prefLine = `\nPref: ${prefMap[details.bundle_preference] || 'B Focus'}`
    }

    const orderLabel = isMashup ? 'NEW MASHUP ORDER' : 'NEW AIRTIME ORDER'

    const message = `${orderLabel}:\nSource : ${details.source}\nReceiver : ${details.receiver}\nAmount: GH ${amountNum.toFixed(2)}\nNet: ${networkInitial}${prefLine}`

    // Send to all provided admins in parallel
    const promises = adminPhones.map(phone => sendSMS({ recipient: phone, message }))
    await Promise.allSettled(promises)
}

/**
 * Send alert when a main site or shop airtime order is marked as completed
 */
export async function sendAirtimeCompletedSMS(
    beneficiaryPhone: string,
    details: {
        amount: number
        sender?: string
    }
): Promise<void> {
    const message = `Your airtime top-up of GHS ${details.amount.toFixed(2)} has been credited successfully. Dial *124# to check your balance. Thank you!`

    await sendSMS({
        recipient: beneficiaryPhone,
        message,
        sender: details.sender
    })
}

/**
 * Send alert when a main site or shop mashup order is marked as completed.
 * Uses the MTN Mashup shortcode *567*1*6# instead of the standard airtime *124#.
 */
export async function sendMashupCompletedSMS(
    beneficiaryPhone: string,
    details: {
        amount: number
        sender?: string
    }
): Promise<void> {
    const message = `Your mashup order of GHS ${details.amount.toFixed(2)} has been credited successfully. Dial *567*1*6# to check your balance. Thank you!`

    await sendSMS({
        recipient: beneficiaryPhone,
        message,
        sender: details.sender
    })
}

// ==========================================
// RESULTS CHECKER FUNCTIONS
// ==========================================

/**
 * Send voucher delivery SMS to customer after RC purchase.
 * Single voucher: compact format. Multiple: numbered list.
 */
export async function sendResultsCheckerDeliverySMS(
    phoneNumber: string,
    details: {
        typeName: string
        quantity: number
        vouchers: Array<{ pin: string; serial_number: string }>
        referenceCode: string
        sender?: string
    }
): Promise<SMSResult> {
    const { typeName, quantity, vouchers, sender } = details

    const upperTypeName = typeName.toUpperCase()
    let url = 'Please contact your exam board on how to print your results.'
    if (upperTypeName.includes('BECE')) {
        url = 'eresults.waecgh.org'
    } else if (upperTypeName.includes('WAEC') || upperTypeName.includes('WASSCE')) {
        url = 'ghana.waecdirect.org'
    }

    if (quantity === 1 && vouchers.length === 1) {
        const v = vouchers[0]
        const message = `Your ${typeName} PIN is ready!\nPIN: ${v.pin}\nSerial: ${v.serial_number}\n\nPlease visit ${url} to print your results.`
        return sendSMS({ recipient: phoneNumber, message, sender })
    }

    const voucherLines = vouchers
        .map((v) => `PIN: ${v.pin}\nSerial: ${v.serial_number}`)
        .join('\n\n')

    const message = `Your ${quantity}x ${typeName} vouchers:\n\n${voucherLines}\n\nPlease visit ${url} to print your results.`
    return sendSMS({ recipient: phoneNumber, message, sender })
}

/**
 * Send admin alert when a new RC order is placed.
 */
export async function sendAdminRCOrderAlertSMS(
    adminPhones: string[],
    details: {
        quantity: number
        typeName: string
        referenceCode: string
        source: string
        totalPaid: number
    }
): Promise<void> {
    const { quantity, typeName, referenceCode, source, totalPaid } = details
    const message = `NEW RC ORDER:\nType: ${typeName}\nQty: ${quantity}\nTotal: GH${totalPaid.toFixed(2)}\nSource: ${source}\nRef: ${referenceCode}`
    const promises = adminPhones.map(phone => sendSMS({ recipient: phone, message }))
    await Promise.allSettled(promises)
}

// ==========================================
// AUTO-UPGRADE SMS FUNCTIONS
// ==========================================

/**
 * Send SMS when auto-upgrade succeeds — wallet had sufficient funds.
 * Template: "Hi [Name]! Your [plan] was auto-renewed from your Capozy Wallet.
 *            Active until [date]. Balance: GHS[balance]."
 */
export async function sendAutoUpgradeSuccessSMS(
    phoneNumber: string,
    firstName: string,
    planLabel: string,
    expiryDate: Date,
    newBalance: number
): Promise<SMSResult> {
    const day = expiryDate.getDate()
    const month = expiryDate.toLocaleString('default', { month: 'long' })
    const year = expiryDate.getFullYear()
    const suffix = ['th', 'st', 'nd', 'rd'][
        (day % 100 > 10 && day % 100 < 20) ? 0 : (day % 10 < 4 ? day % 10 : 0)
    ]
    const formattedDate = `${month} ${day}${suffix}, ${year}`

    const message = `Hi ${firstName}! Your ${planLabel} was auto-renewed from your Capozy Wallet. Active until ${formattedDate}. Balance: GHS ${newBalance.toFixed(2)}.`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Send SMS when auto-upgrade FAILS due to insufficient wallet balance.
 * Template: "Hi [Name], auto-renewal for [plan] failed. Capozy Wallet: GHS[balance],
 *            needed GHS[required]. Top up to continue: capozygh.com"
 */
export async function sendAutoUpgradeFailedSMS(
    phoneNumber: string,
    firstName: string,
    planLabel: string,
    currentBalance: number,
    requiredAmount: number
): Promise<SMSResult> {
    const shortfall = (requiredAmount - currentBalance).toFixed(2)

    const message = `Hi ${firstName}, auto-renewal for your ${planLabel} failed. Capozy Wallet: GHS ${currentBalance.toFixed(2)}, needed GHS ${requiredAmount.toFixed(2)}. Top up to continue: capozygh.com`

    return sendSMS({ recipient: phoneNumber, message })
}
