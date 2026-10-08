// scripts/test-middleware-auth-exceptions.ts
// Regression guard for the "redirect authenticated users away from /auth/*"
// block in middleware.ts. Any /auth/* page that needs an active session to
// complete its own action (not just render marketing copy) MUST be listed in
// authExceptions, or an authenticated user hitting it gets bounced straight
// back to /dashboard by this block.
//
// Originally written 2026-09-29 for an infinite-redirect-loop root cause
// (app/dashboard/layout.tsx redirected a must-change-password sub-agent to
// /auth/change-password-required, which was missing from this list). That
// automatic redirect was removed 2026-09-30 (owner decision — see
// app/dashboard/layout.tsx), so this is no longer a redirect-loop risk, but
// the page itself still exists for voluntary use, so it stays exempted and
// this guard stays in place to keep it reachable rather than bounced away.
//
// Reads the source rather than importing it: middleware.ts pulls in
// Edge-runtime and env-dependent modules that cannot load in a plain node
// process (same constraint as scripts/test-ratelimit-prefixes.ts).
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const mwSource = readFileSync(join(root, 'middleware.ts'), 'utf8')

const m = mwSource.match(/const authExceptions = \[([\s\S]*?)\]/)
if (!m) {
    throw new Error('Could not find `authExceptions` array in middleware.ts — did it move or get renamed?')
}
const authExceptions: string[] = Array.from(m[1].matchAll(/'([^']+)'/g)).map(x => x[1])

// Any page under app/auth/** whose own redirect target it is (i.e. something
// else in the app redirects an authenticated user TO it) must be exempted,
// or that page is unreachable — hard loop, not just inconvenience. Verified
// directly by checking known redirect-target call sites rather than a
// generic heuristic, since not every /auth/* page is a redirect target.
const REQUIRED_EXCEPTIONS = [
    '/auth/change-password-required', // voluntary self-service page — kept reachable, no longer an automatic redirect target
]

let failed = false
for (const path of REQUIRED_EXCEPTIONS) {
    const covered = authExceptions.some(p => path.startsWith(p))
    if (!covered) {
        failed = true
        console.error(`FAIL: '${path}' is a redirect target but is not in middleware.ts's authExceptions — this is an infinite redirect loop, not just a bug.`)
    } else {
        console.log(`PASS: '${path}' is covered by authExceptions`)
    }
}

if (failed) process.exit(1)
console.log(`All ${REQUIRED_EXCEPTIONS.length} required auth-exception redirect targets are covered.`)
