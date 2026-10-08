// scripts/test-cookie-domain.ts
// Pure-logic test, run with: npx tsx scripts/test-cookie-domain.ts
import assert from 'node:assert'

async function run() {
    const { getAuthCookieDomain, getAuthCookieOptions } = await import('../lib/cookie-domain')

    // 1. Unset env → undefined (previews/local must be a no-op)
    delete process.env.NEXT_PUBLIC_COOKIE_DOMAIN
    assert.strictEqual(getAuthCookieDomain(), undefined, 'unset env must yield undefined')
    assert.strictEqual(getAuthCookieOptions(), undefined, 'unset env must yield undefined options')

    // 2. Empty / whitespace env → undefined (a blank Vercel var must not emit Domain=)
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN = ''
    assert.strictEqual(getAuthCookieDomain(), undefined, 'empty env must yield undefined')
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN = '   '
    assert.strictEqual(getAuthCookieDomain(), undefined, 'whitespace env must yield undefined')

    // 3. Real value → passed through verbatim
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN = '.kingflexygh.com'
    assert.strictEqual(getAuthCookieDomain(), '.kingflexygh.com')
    assert.deepStrictEqual(getAuthCookieOptions(), { domain: '.kingflexygh.com' })

    console.log('ALL PASS — cookie-domain helper')
}

run().catch((e) => { console.error(e); process.exit(1) })
