// scripts/test-verify-number-endpoint.ts
// The three verify-number handlers (merged, server-1, server-2) must share ONE rate-limit
// bucket per API key (each call can submit an unregistered number for registration), and that
// prefix must not collide with any other literal consumeRateLimit(`prefix:...`) call site.
// scripts/test-ratelimit-prefixes.ts only covers Upstash `new Ratelimit` instances, not
// consumeRateLimit, so this covers the prefix owned by this handler file.
import fs from 'node:fs'
import path from 'node:path'

const HANDLER = 'lib/api-handlers/verify-number.ts'
const source = fs.readFileSync(HANDLER, 'utf8')

function fail(message: string) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
}

const prefixMatch = source.match(/const RATE_LIMIT_PREFIX = '([a-z0-9_-]+)'/)
const handlerCount = (source.match(/=\s*createVerifyNumberHandler\(\{/g) || []).length
const sharedUses = (source.match(/rateLimitPrefix: RATE_LIMIT_PREFIX/g) || []).length

if (!prefixMatch) {
    fail(`could not find RATE_LIMIT_PREFIX in ${HANDLER}`)
} else if (handlerCount !== 3 || sharedUses !== 3) {
    fail(`expected 3 handlers all using the shared RATE_LIMIT_PREFIX, found ${handlerCount} handlers / ${sharedUses} uses`)
} else {
    console.log(`PASS: all 3 handlers share one rate-limit prefix ("${prefixMatch[1]}")`)
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.tsx?$/.test(entry.name)) out.push(full)
    }
    return out
}

if (prefixMatch) {
    const handlerAbs = path.resolve(HANDLER)
    const collisions: string[] = []
    for (const file of [...walk('lib'), ...walk('app')]) {
        if (path.resolve(file) === handlerAbs) continue
        for (const m of fs.readFileSync(file, 'utf8').matchAll(/consumeRateLimit\(`([a-z0-9_-]+):/g)) {
            if (m[1] === prefixMatch[1]) collisions.push(file)
        }
    }
    if (collisions.length > 0) fail(`"${prefixMatch[1]}" prefix collides with: ${collisions.join(', ')}`)
    else console.log('PASS: no other consumeRateLimit call site uses this prefix')
}
