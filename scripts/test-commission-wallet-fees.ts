import { computeCommissionWithdrawalFee, getCommissionMinWithdrawal, isCommissionTransferEnabled } from '../lib/commission-wallet'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// Default fee (2% + 0 flat) on GHS 100 -> fee 2, net 98
assertEqual(computeCommissionWithdrawalFee(100, {}), { fee: 2, netAmount: 98 }, 'default fee on 100')

// Custom percent + flat: 5% + 1 flat on GHS 50 -> fee 3.5, net 46.5
assertEqual(
    computeCommissionWithdrawalFee(50, { commission_withdrawal_fee_percent: '5', commission_withdrawal_fee_flat: '1' }),
    { fee: 3.5, netAmount: 46.5 },
    'custom percent + flat',
)

// Default min withdrawal is 20
assertEqual(getCommissionMinWithdrawal({}), 20, 'default min withdrawal')
assertEqual(getCommissionMinWithdrawal({ commission_min_withdrawal_amount: '50' }), 50, 'custom min withdrawal')

// Transfer enabled defaults true; explicit 'false' string disables it
assertEqual(isCommissionTransferEnabled({}), true, 'transfer enabled by default')
assertEqual(isCommissionTransferEnabled({ commission_transfer_enabled: 'false' }), false, 'transfer disabled via setting')

if (process.exitCode !== 1) console.log('\nAll commission-wallet-fees tests passed.')
