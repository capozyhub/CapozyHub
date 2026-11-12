const PAGE = 1000 // Supabase/PostgREST returns at most 1000 rows per request

/**
 * Reads past the 1000-row cap by paging. `build` must return a freshly ordered query
 * (order by a unique column last so pages never overlap or skip rows).
 * Stops at `maxRows` and reports `truncated` so callers can say the figures are partial.
 */
export async function fetchAllRows<T = any>(
    build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }> },
    maxRows = 10000,
): Promise<{ rows: T[]; truncated: boolean; failed: boolean }> {
    const rows: T[] = []
    for (let from = 0; from < maxRows; from += PAGE) {
        const { data, error } = await build().range(from, Math.min(from + PAGE, maxRows) - 1)
        if (error) return { rows, truncated: rows.length > 0, failed: true }
        const batch = data ?? []
        rows.push(...batch)
        if (batch.length < PAGE) return { rows, truncated: false, failed: false }
    }
    return { rows, truncated: true, failed: false }
}
