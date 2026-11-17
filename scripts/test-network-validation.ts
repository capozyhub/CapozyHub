// scripts/test-network-validation.ts
//
// Recipient / MoMo-wallet network rules shared by the storefront, dashboard and charge routes:
//  - a prefix on no Ghana network (MTN, Telecel, AT) is always rejected;
//  - a valid prefix on another network is rejected unless the buyer confirmed it was ported.
import { checkRecipientNetwork } from '@/lib/phone-validation'
import { resolveMomoWallet } from '@/lib/momo-wallet'
import { checkUssdRecipient } from '@/lib/ussd-number-check'

function check(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const code = (r: any) => (r.ok ? 'ok' : r.code)

// Prefixes per network
for (const p of ['024', '025', '053', '054', '055', '059']) check(code(checkRecipientNetwork(`${p}1234567`, 'MTN')), 'ok', `${p} is MTN`)
for (const p of ['020', '050']) check(code(checkRecipientNetwork(`${p}1234567`, 'Telecel')), 'ok', `${p} is Telecel`)
for (const p of ['026', '027', '056', '057']) check(code(checkRecipientNetwork(`${p}1234567`, 'AT')), 'ok', `${p} is AT`)
check(code(checkRecipientNetwork('0261234567', 'AT-iShare')), 'ok', 'AT-iShare label maps to AirtelTigo')

// Prefixes that belong to nobody are always rejected, ported or not
for (const p of ['098', '028', '058', '023', '030', '010', '000']) {
    check(code(checkRecipientNetwork(`${p}1234567`, 'MTN', { portedConfirmed: true })), 'INVALID_PREFIX', `${p} rejected even if "ported"`)
}
check(code(checkRecipientNetwork('098123456', 'MTN')), 'INVALID_PREFIX', 'too short')
check(code(checkRecipientNetwork('0981234567', 'AT-BigTime')), 'INVALID_PREFIX', 'BigTime needs a real prefix')
check(code(checkRecipientNetwork('0571234567', 'AT-BigTime')), 'ok', 'BigTime on AT prefix')

// Mismatch needs the ported confirmation
check(code(checkRecipientNetwork('0241234567', 'Telecel')), 'NETWORK_MISMATCH', 'MTN number, Telecel product')
check(code(checkRecipientNetwork('0241234567', 'Telecel', { portedConfirmed: true })), 'ok', 'ported MTN prefix -> Telecel')
check(code(checkRecipientNetwork('0241234567', 'AT-BigTime')), 'NETWORK_MISMATCH', 'BigTime on MTN prefix')
check(code(checkRecipientNetwork('0241234567', 'AT-BigTime', { portedConfirmed: true })), 'ok', 'BigTime on ported MTN prefix')
check(code(checkRecipientNetwork('+233 24 123 4567', 'MTN')), 'ok', '+233 spelling')

// MoMo wallet
const w = (phone: string, sel?: string, ported?: boolean) => resolveMomoWallet(phone, sel, ported)
check(w('0241234567').ok, true, 'detected from prefix')
check((w('0201234567') as any).provider, 'VOD', 'Telecel detected as VOD')
check(w('0241234567', 'MTN').ok, true, 'selection agrees')
check(w('0241234567', 'VOD').ok, false, 'selection contradicts prefix')
check((w('0241234567', 'Telecel') as any).code, 'NETWORK_MISMATCH', 'mismatch code')
check((w('0241234567', 'Telecel', true) as any).provider, 'VOD', 'ported wallet charges the selected provider')
check((w('0981234567', 'MTN', true) as any).code, 'INVALID_PREFIX', 'bad wallet prefix rejected even if ported')
check(w(undefined as any).ok, false, 'non-string rejected')

// USSD helper
const u = (i: string, n: string | null, p?: boolean) => checkUssdRecipient(i, n, { portedConfirmed: p })
check(u('0241234567', 'MTN').status, 'ok', 'ussd ok')
check((u('233241234567', 'MTN') as any).phone, '0241234567', 'ussd normalises')
check(u('0981234567', 'MTN', true).status, 'invalid', 'ussd bad prefix never passes')
check(u('0241234567', 'AT-BigTime').status, 'confirm', 'ussd mismatch asks')
check(u('0241234567', 'AT-BigTime', true).status, 'ok', 'ussd ported ok')
check(u('0981234567', null).status, 'invalid', 'ussd RC bad prefix')
check(u('0241234567', null).status, 'ok', 'ussd RC any real prefix')
check(u('12345', 'MTN').status, 'invalid', 'ussd too short')

console.log('network validation: all checks passed')
