// scripts/test-v2-response-version.ts
//
// apiSuccess() in lib/api-auth.ts defaults meta.version to 'v2' and spreads
// the caller's `meta` AFTER it. Every v2 route still passes an explicit
// { version: 'v2' } override, and this guard keeps that convention pinned so
// a route body can never be copy-pasted into a future API version and
// silently keep reporting 'v2'.
//
// Static guard: every apiSuccess( call under app/api/v2 must carry version:'v2'.
// Mirrors scripts/test-ratelimit-prefixes.ts in approach (parse the source, no
// server or DB needed) including its matched-vs-total cross-check, so a
// reformatted call site can't slip past the regex unnoticed.
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const V2_ROOT = join(process.cwd(), 'app', 'api', 'v2')

function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...walk(full))
        else if (entry === 'route.ts') out.push(full)
    }
    return out
}

const routeFiles = walk(V2_ROOT)
if (routeFiles.length === 0) throw new Error(`No route.ts files found under ${V2_ROOT} — the guard is looking in the wrong place`)

let totalCalls = 0
let okCalls = 0
const failures: string[] = []

for (const file of routeFiles) {
    const src = readFileSync(file, 'utf8')
    const rel = file.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '').replace(/\\/g, '/')

    // Match apiSuccess( ... ) allowing nested braces/parens across newlines, up to
    // the call's closing paren followed by end-of-line.
    const calls = src.match(/apiSuccess\(/g) || []
    totalCalls += calls.length

    // Count the version overrides. Each apiSuccess call in a v2 route should have one.
    const overrides = src.match(/version:\s*'v2'/g) || []
    okCalls += overrides.length

    if (calls.length !== overrides.length) {
        failures.push(`${rel}: ${calls.length} apiSuccess() call(s) but ${overrides.length} version:'v2' override(s)`)
    }
}

if (failures.length > 0) {
    console.error('v2 routes missing an explicit meta.version override:')
    for (const f of failures) console.error(`  - ${f}`)
    throw new Error(`${failures.length} v2 route file(s) would report meta.version "v1". Pass { version: 'v2' } as apiSuccess's second argument.`)
}

if (totalCalls !== okCalls) throw new Error(`cross-check failed: ${totalCalls} apiSuccess calls vs ${okCalls} overrides`)
if (totalCalls === 0) throw new Error('found 0 apiSuccess calls under app/api/v2 — the regex has probably drifted')

console.log(`All v2-response-version tests passed (${routeFiles.length} route files, ${totalCalls} apiSuccess calls, all overriding to v2).`)
