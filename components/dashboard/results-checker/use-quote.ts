'use client'

import { useEffect, useState } from 'react'

export type QuoteState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ok'; typeId: string; quantity: number; unitPrice: number; total: number; bulkApplied: boolean }
    | { status: 'error'; message: string }

/**
 * The exact price for this exam and quantity, asked of the server (which prices it with the same
 * code the purchase uses). Debounced, and a slow answer for an old quantity can never overwrite a
 * newer one. `refreshKey` forces a fresh quote, for example after "the price just changed".
 */
export function useQuote(typeId: string, quantity: number | null, refreshKey = 0): QuoteState {
    const [state, setState] = useState<QuoteState>({ status: 'idle' })

    useEffect(() => {
        if (!typeId || !quantity) { setState({ status: 'idle' }); return }
        setState({ status: 'loading' })
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/results-checker/quote?typeId=${encodeURIComponent(typeId)}&quantity=${quantity}`, { cache: 'no-store', signal: controller.signal })
                const json = await res.json().catch(() => ({}))
                if (controller.signal.aborted) return
                if (!res.ok || !json.quote) { setState({ status: 'error', message: json.error || 'Could not get the price' }); return }
                const q = json.quote
                setState({ status: 'ok', typeId: q.typeId, quantity: q.quantity, unitPrice: Number(q.unitPrice), total: Number(q.total), bulkApplied: !!q.bulkApplied })
            } catch (e: any) {
                if (e?.name !== 'AbortError') setState({ status: 'error', message: 'Could not get the price. Check your connection.' })
            }
        }, 250)
        return () => { clearTimeout(timer); controller.abort() }
    }, [typeId, quantity, refreshKey])

    return state
}