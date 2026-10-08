// scripts/test-mtn-whitelist-server-check.ts
// Pure tests for the per-server cache/live stitching. No network. Needs --env-file=.env.local
// because the module imports the Supabase client at load time.
import { combineCachedAndLive, isWhitelistServer } from '../lib/mtn-whitelist-server-check'

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

assertEqual(isWhitelistServer(1), true, 'isWhitelistServer: 1')
assertEqual(isWhitelistServer(2), true, 'isWhitelistServer: 2')
assertEqual(isWhitelistServer(3), false, 'isWhitelistServer: 3 rejected')
assertEqual(isWhitelistServer('1'), false, 'isWhitelistServer: string "1" rejected')

assertEqual(
    combineCachedAndLive(['0241000001'], new Set(['0241000001']), []),
    [{ input: '0241000001', normalized: '0241000001', allowed: true }],
    'cache hit -> allowed without any live row',
)

assertEqual(
    combineCachedAndLive(['0241000002'], new Set(), [{ input: '0241000002', normalized: '0241000002', allowed: false }]),
    [{ input: '0241000002', normalized: '0241000002', allowed: false }],
    'live blocked -> blocked (never cached, passed through)',
)

assertEqual(
    combineCachedAndLive(['0241000003'], new Set(), [{ input: '+233241000003', normalized: '233241000003', allowed: true }]),
    [{ input: '0241000003', normalized: '0241000003', allowed: true }],
    'supplier echo in international form is re-keyed to our canonical number',
)

assertEqual(
    combineCachedAndLive(['0241000008'], new Set(), [{ input: '0241000099', normalized: '0241000099', allowed: true }]),
    [],
    'a row for a number we never sent is ignored (cannot poison the allow-cache)',
)

assertEqual(
    combineCachedAndLive(['0241000009'], new Set(), [{ input: '0241000009', normalized: '0241000098', allowed: true }]),
    [{ input: '0241000009', normalized: '0241000009', allowed: true }],
    'input that matches a sent number wins over a mismatched normalized field',
)

assertEqual(
    combineCachedAndLive(['0241000004'], new Set(), []),
    [],
    'no cache and no live row -> dropped, never guessed',
)

assertEqual(
    combineCachedAndLive(
        ['0241000005', '0241000006', '0241000007'],
        new Set(['0241000006']),
        [{ input: '0241000005', normalized: '0241000005', allowed: false }, { input: '0241000007', normalized: '0241000007', allowed: true }],
    ).map(r => r.normalized),
    ['0241000005', '0241000006', '0241000007'],
    'mixed cache + live results come back in input order',
)
