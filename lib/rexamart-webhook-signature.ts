import crypto from 'crypto'

const MAX_CLOCK_SKEW_SECONDS = 5 * 60

/**
 * Verifies a Rexamart webhook delivery: HMAC-SHA256(secret, "{timestamp}.{raw body}"),
 * hex-encoded, compared against the X-Rexamart-Signature header (the "sha256=" prefix is
 * optional on the wire — both are accepted). Rejects a timestamp older than 5 minutes
 * (replay protection) as its own failure reason, distinct from a bad signature, so the
 * caller can log which one actually failed.
 *
 * `timingSafeEqual` requires equal-length buffers — a length mismatch (e.g. a truncated
 * or garbage header) is treated as present-but-wrong, never as a thrown exception.
 */
export function verifyRexamartSignature(
    rawBody: string,
    timestampHeader: string | null,
    signatureHeader: string | null,
    secret: string
): { ok: true } | { ok: false; reason: 'missing_timestamp' | 'missing_signature' | 'stale_timestamp' | 'bad_signature' } {
    if (!timestampHeader) return { ok: false, reason: 'missing_timestamp' }
    if (!signatureHeader) return { ok: false, reason: 'missing_signature' }

    const timestamp = Number(timestampHeader)
    if (!Number.isFinite(timestamp)) return { ok: false, reason: 'missing_timestamp' }
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
        return { ok: false, reason: 'stale_timestamp' }
    }

    const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(`${timestampHeader}.${rawBody}`)
        .digest('hex')

    const received = signatureHeader.replace(/^sha256=/, '').trim()
    const expectedBuf = Buffer.from(expectedHex, 'hex')
    const receivedBuf = Buffer.from(received, 'hex')

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
        return { ok: false, reason: 'bad_signature' }
    }
    return { ok: true }
}
