/**
 * The JSON body of a response, or {} when there isn't one. A gateway timeout or a 502 comes
 * back as an HTML page, and res.json() on that would surface "Unexpected token <" to the member.
 */
export async function readJson(res: Response): Promise<any> {
    try {
        return await res.json()
    } catch {
        return {}
    }
}

/** The server's message, or a plain fallback that still says whether it was us or them. */
export function errorMessage(res: Response, data: any, fallback: string): string {
    if (typeof data?.error === 'string' && data.error) return data.error
    return res.status >= 500 ? `${fallback} (server problem, please try again)` : fallback
}

/** The server refused because the price moved since the member saw it. */
export function isPriceChanged(res: Response, data: any): boolean {
    return res.status === 409 && data?.code === 'PRICE_CHANGED'
}
