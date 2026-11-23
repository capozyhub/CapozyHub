import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/api-auth'

const otpRateLimit = new Map<string, { count: number; resetTime: number }>()
function otpCleanup() { const now = Date.now(); for (const [k, v] of otpRateLimit.entries()) if (v.resetTime < now) otpRateLimit.delete(k) }

export async function POST(request: NextRequest) {
    try {
        otpCleanup()
        const ip = getClientIp(request) || 'unknown'
        const rl = otpRateLimit.get(ip) || { count: 0, resetTime: Date.now() + 60000 }
        if (rl.count >= 10 && rl.resetTime > Date.now()) {
            return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 })
        }
        rl.count++; otpRateLimit.set(ip, rl)

        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }
        const { reference, otp } = body
        if (!reference || typeof reference !== 'string' || !/^(SHOP-|RC-|SHOPAFA-)[A-Za-z0-9-]{1,90}$/.test(reference) || reference.length > 100) {
            return NextResponse.json({ error: 'Invalid reference' }, { status: 400 })
        }
        if (!otp || typeof otp !== 'string' || otp.trim() === '' || otp.length > 12) {
            return NextResponse.json({ error: 'OTP is required' }, { status: 400 })
        }

        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 })
        }

        const res = await fetch('https://api.paystack.co/charge/submit_otp', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, otp }),
        })
        const data = await res.json()
        if (!data.status || !data.data) {
            console.error('[Shop ChargeOTP] OTP submission failed:', data)
            const safeMessage = typeof data.message === 'string' && data.message.length > 0 && data.message.length < 200
                ? data.message
                : 'OTP submission failed'
            return NextResponse.json({ error: safeMessage }, { status: 502 })
        }
        return NextResponse.json({
            status: data.data.status,
            display_text: data.data.display_text || data.data.message || '',
        })
    } catch (error) {
        console.error('[Shop ChargeOTP] Unhandled error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
