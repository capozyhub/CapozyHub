// scripts/test-bundleportal-whitelist.ts
import { verifyBundlePortalWhitelist } from '../lib/bundleportal-whitelist'

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

async function run() {
    // No API key configured in this test environment — must fail open (empty
    // results + error), never throw.
    const result = await verifyBundlePortalWhitelist(['0241000001'])
    assertEqual(Array.isArray(result.results), true, 'verifyBundlePortalWhitelist: always returns a results array')
    assertEqual(result.results.length, 0, 'verifyBundlePortalWhitelist: no API key configured -> empty results')
    assertEqual(typeof result.error, 'string', 'verifyBundlePortalWhitelist: no API key configured -> error message present')

    const empty = await verifyBundlePortalWhitelist([])
    assertEqual(empty, { results: [] }, 'verifyBundlePortalWhitelist: empty input -> empty results, no error')
}

run().catch(e => { console.error(e); process.exit(1) })
