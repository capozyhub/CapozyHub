export type PoolResult<R> =
    | { state: 'done'; value: R }
    | { state: 'error'; error: unknown }
    | { state: 'not-started' }

/**
 * Runs `fn` over `items` with at most `limit` in flight, in order, and never throws: each item
 * comes back as done, errored, or not-started. Once `deadline` (epoch ms) has passed no NEW
 * item is started, so a function with a hard time limit can stop cleanly and report exactly
 * which items it never reached instead of being killed halfway through the list.
 */
export async function mapWithLimit<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
    deadline: number = Infinity,
): Promise<PoolResult<R>[]> {
    const results: PoolResult<R>[] = items.map(() => ({ state: 'not-started' }))
    let next = 0

    const worker = async () => {
        while (next < items.length) {
            if (Date.now() >= deadline) return
            const i = next++
            try {
                results[i] = { state: 'done', value: await fn(items[i], i) }
            } catch (error) {
                results[i] = { state: 'error', error }
            }
        }
    }

    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
    return results
}
