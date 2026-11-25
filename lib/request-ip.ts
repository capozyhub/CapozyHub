// lib/request-ip.ts
// The caller's IP for rate limiting, from sources the caller cannot forge.
//
// Vercel APPENDS the real connecting IP to X-Forwarded-For rather than replacing the
// header, so the LEFTMOST entry is whatever the client sent. Keying a limiter on it lets
// anyone send a fresh value per request and get unlimited attempts (audit 2026-11-25:
// /api/results-checker/retrieve, which reveals voucher PINs, was brute-forceable this way).
//
// Same trust order as getClientIp in lib/api-auth.ts, but takes a plain Request so it can be
// used from any route handler:
//   1. x-real-ip              set by the Vercel edge to the real client IP
//   2. request.ip             populated by Vercel in some runtimes
//   3. x-forwarded-for, RIGHTMOST hop (the one Vercel appended)
export function getRequestIp(request: Request): string {
    const realIp = request.headers.get('x-real-ip')?.trim()
    if (realIp) return realIp

    const reqIp = (request as { ip?: string }).ip
    if (reqIp) return reqIp

    const xff = request.headers.get('x-forwarded-for')
    if (xff) {
        const hops = xff.split(',').map((h) => h.trim()).filter(Boolean)
        if (hops.length > 0) return hops[hops.length - 1]
    }
    return 'unknown'
}
