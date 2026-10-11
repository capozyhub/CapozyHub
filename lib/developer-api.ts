// lib/developer-api.ts
// Path helpers for the public developer API (https://api.capozygh.com/api/...).
// Kept pure and dependency-free so middleware.ts (Edge runtime) and any
// route/lib code can both import it, and so it's unit-testable without
// mocking NextRequest.
//
// The developer API shares the /api/ namespace with the internal routes, so a
// path is public ONLY if it matches one of the patterns below. This matters
// for security: public paths get open CORS and skip cookie/session handling in
// middleware, so an internal route must never match. Add a route here when you
// add it to the developer API, and nowhere else.

export const DEV_API_HOST = 'api.capozygh.com'
export const DEV_API_BASE_URL = `https://${DEV_API_HOST}/api`

// One path segment (a reference or id), never empty and never containing a slash.
const SEG = '[^/]+'

const DEV_API_PATTERNS: RegExp[] = [
    /^\/api\/packages$/,
    /^\/api\/account\/role$/,
    /^\/api\/wallet\/(balance|topup)$/,
    new RegExp(`^/api/orders/(?!(purchase|bulk-purchase|confirm-received|retry)$)${SEG}$`),
    /^\/api\/data\/(purchase|bulk)$/,
    new RegExp(`^/api/afa/(register|orders|orders/${SEG})$`),
    new RegExp(`^/api/airtime/(purchase|orders|orders/${SEG})$`),
    new RegExp(`^/api/resultschecker/(purchase|types|orders|orders/${SEG})$`),
    new RegExp(`^/api/sms/(balance|campaigns|send|senders|messages/${SEG})$`),
    new RegExp(`^/api/utilities/(billers|lookup|pay|orders/${SEG})$`),
]

export function isDevApiPath(pathname: string): boolean {
    return DEV_API_PATTERNS.some(re => re.test(pathname))
}