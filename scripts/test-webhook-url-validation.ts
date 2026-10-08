// scripts/test-webhook-url-validation.ts
//
// Guards the SSRF check on api_keys.webhook_url. That column is developer-set,
// so validateWebhookUrl is the last thing standing between a developer-supplied
// string and an outbound POST from our infrastructure. See finding C1 in
// .superpowers/sdd/2026-08-24-api-v2-new-products/phase2a-final-review.md.
import { validateWebhookUrl } from '@/lib/api-webhook'

function assertAllowed(url: string) {
    const result = validateWebhookUrl(url)
    if (!result.ok) throw new Error(`expected ${url} to be ALLOWED, but it was rejected: ${result.reason}`)
}

function assertBlocked(url: string, label: string) {
    const result = validateWebhookUrl(url)
    if (result.ok) throw new Error(`expected ${url} to be BLOCKED (${label}), but it was allowed`)
}

// ── Allowed ─────────────────────────────────────────────────────────────────
assertAllowed('https://hooks.example.com/kft')
assertAllowed('https://api.customer.com.gh/webhooks/kingflexy?src=kft')
// A non-default port is fine — plenty of legitimate endpoints use one, and the
// port tells us nothing about whether the host is internal.
assertAllowed('https://hooks.example.com:8443/kft')

// ── Blocked: scheme ─────────────────────────────────────────────────────────
assertBlocked('http://hooks.example.com/kft', 'plaintext http')
assertBlocked('file:///etc/passwd', 'file scheme')
assertBlocked('gopher://hooks.example.com/x', 'gopher scheme')
assertBlocked('data:text/plain,hello', 'data scheme')
assertBlocked('not-a-url', 'unparseable')

// ── Blocked: IP literals (the cloud-metadata class) ─────────────────────────
assertBlocked('https://127.0.0.1/x', 'IPv4 loopback')
assertBlocked('https://169.254.169.254/latest/meta-data', 'IPv4 link-local metadata')
assertBlocked('https://10.0.0.5/x', 'IPv4 private range')
assertBlocked('https://[::1]/x', 'IPv6 loopback')
assertBlocked('https://[::ffff:169.254.169.254]/x', 'IPv4-mapped IPv6 metadata')

// ── Blocked: internal hostnames ─────────────────────────────────────────────
assertBlocked('https://localhost/x', 'localhost')
assertBlocked('https://foo.localhost/x', '.localhost suffix')
assertBlocked('https://db.local/x', '.local suffix')
assertBlocked('https://vault.internal/x', '.internal suffix')
assertBlocked('https://internal/x', 'bare hostname with no dot')
assertBlocked('https://LOCALHOST/x', 'uppercase localhost')
assertBlocked('HTTPS://localhost/x', 'uppercase scheme')

// ── Blocked: trailing-dot (FQDN) forms. These are REGRESSION TESTS — both of ─
//    these got through the first version of the guard. A trailing dot resolves
//    identically to the name without it, but it breaks naive equality/suffix
//    checks AND makes includes('.') pass a bare hostname off as a domain.
assertBlocked('https://localhost./x', 'trailing-dot localhost')
assertBlocked('https://internal./x', 'trailing-dot bare host')
assertBlocked('https://vault.internal./x', 'trailing-dot .internal')
assertBlocked('https://127.0.0.1./x', 'trailing-dot IP literal')

// ── Blocked: encoded IPv4. Handled by the WHATWG URL parser normalising these ─
//    to dotted quad before the IP-literal check runs — asserted so that a
//    future refactor away from `new URL()` cannot silently reopen them.
assertBlocked('https://2130706433/x', 'decimal IPv4 (127.0.0.1)')
assertBlocked('https://0x7f000001/x', 'hex IPv4 (127.0.0.1)')
assertBlocked('https://127.1/x', 'short-form IPv4 (127.0.0.1)')

// ── Blocked: embedded credentials ───────────────────────────────────────────
assertBlocked('https://user:pass@example.com/x', 'credentials in URL')

console.log('All webhook-url-validation tests passed.')
