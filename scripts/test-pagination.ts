// scripts/test-pagination.ts
//
// Pure-logic tests for lib/pagination.ts — the page<->range math and the
// LIKE-wildcard escaping used before search input reaches the server-side
// ilike queries on /dashboard/my-orders and /dashboard/shop/orders.
import { pageToRange, totalPages, pageRangeLabel, escapeLikePattern, ORDER_HISTORY_PAGE_SIZE } from '../lib/pagination'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

assertEqual(ORDER_HISTORY_PAGE_SIZE, 20, 'fixed page size is 20')

assertEqual(pageToRange(1, 20), { from: 0, to: 19 }, 'page 1 → rows 0-19')
assertEqual(pageToRange(2, 20), { from: 20, to: 39 }, 'page 2 → rows 20-39')
assertEqual(pageToRange(3, 10), { from: 20, to: 29 }, 'page 3 with pageSize 10 → rows 20-29')
assertEqual(pageToRange(0, 20), { from: 0, to: 19 }, 'page 0 clamps to page 1')
assertEqual(pageToRange(-5, 20), { from: 0, to: 19 }, 'negative page clamps to page 1')
assertEqual(pageToRange(1.9, 20), { from: 0, to: 19 }, 'fractional page floors before ranging')

assertEqual(totalPages(0, 20), 1, 'zero rows → 1 page (so "Page 1 of 1" renders)')
assertEqual(totalPages(20, 20), 1, 'exactly one page of rows → 1 page')
assertEqual(totalPages(21, 20), 2, 'one row over a page boundary → 2 pages')
assertEqual(totalPages(5021, 20), 252, '5021 rows at pageSize 20 → 252 pages')
assertEqual(totalPages(-3, 20), 1, 'negative count clamps to 1 page')

assertEqual(pageRangeLabel(1, 20, 5021), { from: 1, to: 20 }, 'page 1 label → "1-20"')
assertEqual(pageRangeLabel(252, 20, 5021), { from: 5021, to: 5021 }, 'last (partial) page label clamps to total count')
assertEqual(pageRangeLabel(1, 20, 0), { from: 0, to: 0 }, 'zero rows → "0-0" label')
assertEqual(pageRangeLabel(1, 20, 15), { from: 1, to: 15 }, 'a single partial page label clamps to the true count')

assertEqual(escapeLikePattern('0244123456'), '0244123456', 'plain phone number is unchanged')
assertEqual(escapeLikePattern('50%'), '50\\%', 'percent sign is escaped')
assertEqual(escapeLikePattern('a_b'), 'a\\_b', 'underscore is escaped')
assertEqual(escapeLikePattern('a\\b'), 'a\\\\b', 'literal backslash is escaped')
assertEqual(escapeLikePattern('%_\\'), '\\%\\_\\\\', 'all three special characters escaped together')

if (process.exitCode === 1) {
    console.error('Some pagination tests FAILED')
} else {
    console.log('All pagination tests passed.')
}
