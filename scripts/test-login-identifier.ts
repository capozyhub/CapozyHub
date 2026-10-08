// scripts/test-login-identifier.ts
import { resolveLoginIdentifier } from '../lib/login-identifier'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

assertEqual(resolveLoginIdentifier('user@example.com'), { type: 'email', value: 'user@example.com' }, 'plain email passes through')
assertEqual(resolveLoginIdentifier('  user@example.com  '), { type: 'email', value: 'user@example.com' }, 'email is trimmed')
assertEqual(resolveLoginIdentifier('0241234567'), { type: 'phone', value: '0241234567' }, 'valid MTN phone normalizes')
assertEqual(resolveLoginIdentifier('+233241234567'), { type: 'phone', value: '0241234567' }, 'intl-format phone normalizes to local format')
assertEqual(resolveLoginIdentifier('024 123 4567'), { type: 'phone', value: '0241234567' }, 'spaced phone normalizes')
assertEqual(resolveLoginIdentifier('0991234567'), { type: 'invalid' }, 'unknown network prefix is invalid')
assertEqual(resolveLoginIdentifier('12345'), { type: 'invalid' }, 'too-short digit string is invalid')
assertEqual(resolveLoginIdentifier(''), { type: 'invalid' }, 'empty string is invalid')
assertEqual(resolveLoginIdentifier('   '), { type: 'invalid' }, 'whitespace-only string is invalid')

if (process.exitCode === 1) {
    console.error('\nSome tests FAILED')
} else {
    console.log('\nAll tests PASSED')
}
