// Guard: developer API keys are issued as cs_live_ + 32 hex, and keys issued before the rename
// (cz_live_) still authenticate. Anything else must be refused.
import { API_KEY_PREFIX, API_KEY_SHAPE, isIssuedKeyPrefix } from '../lib/api-key-format'

let failed = 0
function check(name: string, ok: boolean) {
    if (!ok) { failed++; console.error(`FAIL: ${name}`) }
}

const hex = 'a'.repeat(32)

check('new keys start with cs_live_', API_KEY_PREFIX === 'cs_live_')
check('new key shape accepted', API_KEY_SHAPE.test(`cs_live_${hex}`))
check('legacy key shape accepted', API_KEY_SHAPE.test(`cz_live_${hex}`))
check('the stored 16-char prefix keeps its length', `${API_KEY_PREFIX}${hex}`.substring(0, 16).length === 16)

check('wrong marker refused', !API_KEY_SHAPE.test(`ck_live_${hex}`))
check('test-mode style refused', !API_KEY_SHAPE.test(`cs_test_${hex}`))
check('short key refused', !API_KEY_SHAPE.test(`cs_live_${'a'.repeat(31)}`))
check('long key refused', !API_KEY_SHAPE.test(`cs_live_${'a'.repeat(33)}`))
check('uppercase hex refused', !API_KEY_SHAPE.test(`cs_live_${'A'.repeat(32)}`))
check('non-hex refused', !API_KEY_SHAPE.test(`cs_live_${'g'.repeat(32)}`))
check('bearer prefix is not part of the shape', !API_KEY_SHAPE.test(`Bearer cs_live_${hex}`))
check('trailing newline refused', !API_KEY_SHAPE.test(`cs_live_${hex}\n`))

check('stored prefix cs_live_ approvable', isIssuedKeyPrefix('cs_live_ab12cd34'))
check('stored prefix cz_live_ approvable', isIssuedKeyPrefix('cz_live_ab12cd34'))
check('older formats not approvable', !isIssuedKeyPrefix('kf_live_ab12cd34') && !isIssuedKeyPrefix('') && !isIssuedKeyPrefix(null))

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1) }
console.log('api key format: ok')
