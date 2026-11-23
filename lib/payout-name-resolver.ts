import { resolveNameSingle } from '@/lib/momo-verify'
import { normalizeGhanaPhone } from '@/lib/sms-service'

// One resolver for "who owns this payout account?", shared by /api/shop/validate-account
// (the page's Verify button) and /api/shop/withdraw (the server-side re-check on submit).
// They previously used different providers, so a name could verify on the page and then
// fail on submit. MoMo goes through the Paystack resolver; Ghana bank accounts have no
// automatic lookup, so the client falls back to a typed name that an admin confirms.

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
        return { success: false, name: null, error: 'Bank account names cannot be checked automatically. Enter the account name and an admin will confirm it before payout.' }
    }

    const normalized = normalizeGhanaPhone(number)
    if (!normalized) return { success: false, name: null, error: UNRESOLVED }

    const resolved = await resolveNameSingle(normalized, network)
    const name = resolved?.fullName?.trim()
    return name
        ? { success: true, name }
        : { success: false, name: null, error: UNRESOLVED }
}
