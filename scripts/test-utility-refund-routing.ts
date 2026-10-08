// scripts/test-utility-refund-routing.ts
import { isWalletRefundEligible } from '../lib/utility-fulfillment'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

assertEqual(isWalletRefundEligible({ payment_method: 'wallet', shop_id: null, user_id: 'u1' }), true, 'dashboard wallet order -> eligible')
assertEqual(isWalletRefundEligible({ payment_method: 'ussd_wallet', shop_id: null, user_id: 'u1' }), true, 'ussd wallet order -> eligible')
assertEqual(isWalletRefundEligible({ payment_method: 'ussd_momo', shop_id: null, user_id: 'u1' }), true, 'registered non-shop ussd momo -> eligible (per spec)')
assertEqual(isWalletRefundEligible({ payment_method: 'ussd_momo', shop_id: null, user_id: null }), false, 'guest ussd momo -> NOT eligible (no wallet to credit)')
assertEqual(isWalletRefundEligible({ payment_method: 'ussd_momo', shop_id: 'shop1', user_id: 'u1' }), false, 'shop-attributed order -> NOT eligible even if registered')
assertEqual(isWalletRefundEligible({ payment_method: 'hubtel_receive', shop_id: 'shop1', user_id: null }), false, 'storefront guest -> NOT eligible')
assertEqual(isWalletRefundEligible({ payment_method: 'wallet', shop_id: 'shop1', user_id: 'u1' }), false, 'wallet-paid SHOP order -> NOT eligible even though payment_method is wallet (shop must not be bypassed by buyer refund)')
assertEqual(isWalletRefundEligible({ payment_method: 'hubtel_receive', shop_id: null, user_id: 'u1' }), false, 'registered non-shop user paying via hubtel_receive -> NOT eligible (hubtel_receive is not one of the three wallet-style methods, regardless of shop_id/user_id) -> must queue')
