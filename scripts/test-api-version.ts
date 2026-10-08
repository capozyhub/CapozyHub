// scripts/test-api-version.ts
import {
    isV2Path,
    apiVersionFromPath,
    versionMeta,
    API_V2_BASE_URL,
} from '@/lib/api-version'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
}

// isV2Path
assertEqual(isV2Path('/api/v2/data/purchase'), true, 'isV2Path: v2 path')
assertEqual(isV2Path('/api/admin/orders'), false, 'isV2Path: unrelated path')
assertEqual(isV2Path('/api/v2'), false, 'isV2Path: no trailing slash')

// Prefix-confusion guards — this helper gates CORS + the auth-skip fast path
// in middleware.ts, so a false positive here is a security bug. The trailing
// slash in API_V2_PREFIX is what makes these fail correctly.
assertEqual(isV2Path('/api/v2x/data'), false, 'isV2Path: v2x is not v2')
assertEqual(isV2Path('/api/v20/data'), false, 'isV2Path: v20 is not v2')
assertEqual(isV2Path('/api/admin/api/v2/foo'), false, 'isV2Path: prefix must be at position 0')

// apiVersionFromPath / versionMeta — always 'v2' now that v1 is gone. Kept as
// functions (rather than inlined at call sites) so every lib/api-handlers/*
// caller stays unchanged.
assertEqual(apiVersionFromPath('/api/v2/packages'), 'v2', 'apiVersionFromPath: v2')
assertEqual(apiVersionFromPath('/api/webhooks/paystack'), 'v2', 'apiVersionFromPath: unrelated path')
assertEqual(versionMeta('/api/v2/packages').version, 'v2', 'versionMeta: v2')

// Constant sanity
assertEqual(API_V2_BASE_URL, 'https://api.kingflexygh.com/api/v2', 'API_V2_BASE_URL value')

console.log('All api-version tests passed.')
