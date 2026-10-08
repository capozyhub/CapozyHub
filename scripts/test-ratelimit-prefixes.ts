// scripts/test-ratelimit-prefixes.ts
// Static guard for rate limiters, both kinds used in this repo.
//
// PART 1 — Upstash (`new Ratelimit`): keys are `prefix:identifier` and do NOT
// encode which limiter issued the call, so two limiters sharing a prefix
// silently share one sliding window, each judging that shared counter against
// its own threshold. EVERY instance must declare an explicit `prefix`; no two
// may share one. Limiters in middleware.ts additionally must be named
// `kfg:<propertyName>`.
//
// PART 2 — in-memory (`consumeRateLimit`, lib/simple-rate-limit.ts): keys the
// WHOLE interpolated string as one Map entry, so a shared literal PREFIX only
// actually collides when two call sites also draw identifiers from the same
// space (e.g. both `${user.id}`) — unlike Upstash, same-prefix-different-space
// (e.g. `${apiKeyId}` vs `${shopId}`) never collides in practice. Still: every
// call site must use a prefix found nowhere else in the repo, full stop — a
// coincidental identifier-space match later (a refactor that starts keying by
// user.id where it used to key by something else) must never silently merge
// two unrelated limits. New violations fail the build; pre-existing ones found
// when this guard was added are tracked in KNOWN_SHARED_PREFIXES with the
// reason it's believed safe today — don't add to that list for new code.
//
// Reads the source rather than importing it: middleware.ts pulls in
// Edge-runtime and env-dependent modules that cannot load in a plain node
// process. Deliberately dependency-free so it needs no --env-file.
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const RATELIMIT_CALL = /new Ratelimit\(/g
const ENTRY = /new Ratelimit\(\{([\s\S]*?)\}\)/g
const NAMED_ENTRY = /(\w+):\s*new Ratelimit\(\{([\s\S]*?)\}\)/g

/** prefix -> "file:owner", for global uniqueness across every source file. */
const seen = new Map<string, string>()

function claimPrefix(prefix: string, owner: string) {
    const existing = seen.get(prefix)
    if (existing) {
        throw new Error(
            `Prefix '${prefix}' is used by BOTH ${existing} and ${owner}. ` +
            `Two limiters sharing a prefix share one sliding window.`
        )
    }
    seen.set(prefix, owner)
}

function readPrefix(args: string, owner: string): string {
    const m = args.match(/prefix:\s*['"`]([^'"`]*)['"`]/)
    if (!m) {
        throw new Error(
            `${owner} has no prefix. Every Ratelimit needs an explicit prefix — ` +
            `without one it falls back to Upstash's shared default keyspace and ` +
            `collides with every other unprefixed limiter called with the same identifier.`
        )
    }
    return m[1]
}

function countCalls(src: string): number {
    return (src.match(RATELIMIT_CALL) || []).length
}

// ── middleware.ts: named entries, must be kfg:<propertyName> ────────────────
const mwSource = readFileSync(join(root, 'middleware.ts'), 'utf8')
const mwTotal = countCalls(mwSource)
if (mwTotal === 0) {
    throw new Error('Found no Ratelimit instances in middleware.ts — did the file move or change shape?')
}

let mwMatched = 0
let m: RegExpExecArray | null
NAMED_ENTRY.lastIndex = 0
while ((m = NAMED_ENTRY.exec(mwSource)) !== null) {
    mwMatched++
    const [, name, args] = m
    const owner = `middleware.ts:${name}`
    const prefix = readPrefix(args, owner)
    const expected = `kfg:${name}`
    if (prefix !== expected) {
        throw new Error(`${owner} has prefix '${prefix}', expected '${expected}'.`)
    }
    claimPrefix(prefix, owner)
}

// Guards against the regex silently skipping a reformatted entry, which would
// make the assertions above vacuously pass.
if (mwMatched !== mwTotal) {
    throw new Error(
        `Parsed ${mwMatched} named Ratelimit entries in middleware.ts but found ${mwTotal} ` +
        `'new Ratelimit(' occurrences. An entry is formatted in a way this test cannot read — ` +
        `fix the test, do not ignore this.`
    )
}

// ── lib/*.ts: any shape, prefix required, naming free ───────────────────────
let libMatched = 0
for (const file of readdirSync(join(root, 'lib')).filter(f => f.endsWith('.ts'))) {
    const src = readFileSync(join(root, 'lib', file), 'utf8')
    const total = countCalls(src)
    if (total === 0) continue

    let matched = 0
    let e: RegExpExecArray | null
    ENTRY.lastIndex = 0
    while ((e = ENTRY.exec(src)) !== null) {
        matched++
        const owner = `lib/${file}#${matched}`
        claimPrefix(readPrefix(e[1], owner), owner)
    }
    if (matched !== total) {
        throw new Error(
            `Parsed ${matched} Ratelimit entries in lib/${file} but found ${total} ` +
            `'new Ratelimit(' occurrences — an entry is formatted in a way this test cannot read.`
        )
    }
    libMatched += matched
}

console.log(
    `All ${mwMatched + libMatched} Ratelimit instances have explicit, globally-unique prefixes ` +
    `(${mwMatched} in middleware.ts as kfg:<name>, ${libMatched} in lib/).`
)

// ── consumeRateLimit: every literal prefix must be unique repo-wide ─────────
// Pre-existing sharing found when this guard was added (2026-09-29), not yet fixed. Each entry
// names every owner so a THIRD call site reusing the prefix still fails loudly.
const KNOWN_SHARED_PREFIXES: Record<string, string> = {
    'util-lookup': 'lib/api-handlers/utilities-lookup.ts (apiKeyId) + app/api/utilities/lookup/route.ts (authUser.id) — different identifier spaces, no live collision.',
    'sms-send': 'lib/api-handlers/sms-send.ts (apiKeyId) + app/api/shop/sms/send/route.ts (sid) — different identifier spaces, no live collision.',
    'announce-write': 'app/api/admin/announcements/route.ts + app/api/admin/announcements/[id]/route.ts — appears to be a deliberate combined create/update/delete quota per admin, not an accident.',
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.tsx?$/.test(entry.name)) out.push(full)
    }
    return out
}

const CONSUME_CALL = /consumeRateLimit\(`([a-z0-9_-]+):/g
const prefixOwners = new Map<string, string[]>()

for (const file of [...walk(join(root, 'app')), ...walk(join(root, 'lib'))]) {
    const relPath = file.slice(root.length + 1).replace(/\\/g, '/')
    const src = readFileSync(file, 'utf8')
    CONSUME_CALL.lastIndex = 0
    let cm: RegExpExecArray | null
    while ((cm = CONSUME_CALL.exec(src)) !== null) {
        const prefix = cm[1]
        const owners = prefixOwners.get(prefix) ?? []
        owners.push(relPath)
        prefixOwners.set(prefix, owners)
    }
}

let consumeTotal = 0
const unexpectedCollisions: string[] = []
for (const [prefix, owners] of prefixOwners) {
    consumeTotal += owners.length
    const uniqueOwners = [...new Set(owners)]
    if (uniqueOwners.length <= 1) continue // same prefix reused within one file (e.g. a shared constant) is fine

    if (!(prefix in KNOWN_SHARED_PREFIXES)) {
        unexpectedCollisions.push(
            `NEW collision: consumeRateLimit prefix '${prefix}' used in ${uniqueOwners.join(', ')}. ` +
            `If these draw identifiers from the same space (e.g. both user.id), they silently share one ` +
            `bucket. Give the new call site its own prefix, or add it to KNOWN_SHARED_PREFIXES with a ` +
            `justification if the sharing is deliberate.`
        )
    } else if (uniqueOwners.length > 2) {
        unexpectedCollisions.push(
            `Prefix '${prefix}' now has a THIRD owner (${uniqueOwners.join(', ')}) beyond the two tracked ` +
            `in KNOWN_SHARED_PREFIXES — re-examine whether this is still safe to share.`
        )
    }
}

if (unexpectedCollisions.length > 0) {
    throw new Error(unexpectedCollisions.join('\n'))
}

console.log(
    `All ${consumeTotal} consumeRateLimit call sites checked — no new prefix collisions ` +
    `(${Object.keys(KNOWN_SHARED_PREFIXES).length} pre-existing ones tracked, unchanged).`
)
