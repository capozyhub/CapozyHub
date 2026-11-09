// Shared settings/fee helpers for the commission wallet feature — used by
// both the user-facing withdraw/transfer routes (Tasks 6, 7) and the admin
// settings route (Task 10). Mirrors app/api/shop/withdraw/route.ts's
// resolveWithdrawalFee fee-calc shape, scoped to the commission wallet's own
// dedicated (non-role-keyed) settings.
import { parseSettingNumber } from '@/lib/paystack-fees'

export function computeCommissionWithdrawalFee(
    amount: number,
    settings: { commission_withdrawal_fee_percent?: any; commission_withdrawal_fee_flat?: any },
): { fee: number; netAmount: number } {
    const feePercent = parseSettingNumber(settings.commission_withdrawal_fee_percent, 2)
    const feeFlat = parseSettingNumber(settings.commission_withdrawal_fee_flat, 0)
    const fee = Math.round((amount * feePercent / 100 + feeFlat) * 100) / 100
    const netAmount = Math.round((amount - fee) * 100) / 100
    return { fee, netAmount }
}

/** The raw fee settings (percent, flat) the withdraw route charges with, defaults included. */
export function getCommissionWithdrawalFeeRates(
    settings: { commission_withdrawal_fee_percent?: any; commission_withdrawal_fee_flat?: any },
): { percent: number; flat: number } {
    return {
        percent: parseSettingNumber(settings.commission_withdrawal_fee_percent, 2),
        flat: parseSettingNumber(settings.commission_withdrawal_fee_flat, 0),
    }
}

export function getCommissionMinWithdrawal(settings: Record<string, any>): number {
    return parseSettingNumber(settings.commission_min_withdrawal_amount, 20)
}

export function isCommissionTransferEnabled(settings: Record<string, any>): boolean {
    return settings.commission_transfer_enabled !== 'false' && settings.commission_transfer_enabled !== false
}
