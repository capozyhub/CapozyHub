// Payout destinations the withdrawal flow supports. Payouts run on Paystack Transfers
// (MoMo) or are paid manually by an admin (bank accounts).
export const PAYOUT_NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Bank'] as const
export type PayoutNetwork = (typeof PAYOUT_NETWORKS)[number]

export function isPayoutNetwork(network: unknown): network is PayoutNetwork {
    return typeof network === 'string' && (PAYOUT_NETWORKS as readonly string[]).includes(network)
}