import { resolveNameSingle } from '@/lib/momo-verify'
import { normalizeGhanaPhone } from '@/lib/sms-service'
import { validateAccountName, MOOLRE_CHANNEL_MAP } from '@/lib/moolre-transfer-service'

// One resolver for "who owns this payout account?", shared by /api/shop/validate-account
// (the page's Verify button) and /api/shop/withdraw (the server-side re-check on submit).
// They previously used different providers, so a name could verify on the page and then
// fail on submit. MoMo goes through the multi-provider resolver (Paystack first); bank
// accounts have no Paystack equivalent and stay Moolre-only.

export interface PayoutNameResult {
    success: boolean
    name: string | null
    error?: string
}

const UNRESOLVED = 'Could not verify account name. Please check the number and try again.'

export async function resolvePayoutAccountName(params: {
    network: string
    number: string
    bankId?: string
}): Promise<PayoutNameResult> {
    const { network, number, bankId } = params

    if (network === 'Bank') {
        return validateAccountName(number, MOOLRE_CHANNEL_MAP.Bank, bankId)
    }

    const normalized = normalizeGhanaPhone(number)
    if (!normalized) return { success: false, name: null, error: UNRESOLVED }

    const resolved = await resolveNameSingle(normalized, network)
    const name = resolved?.fullName?.trim()
    return name
        ? { success: true, name }
        : { success: false, name: null, error: UNRESOLVED }
}
