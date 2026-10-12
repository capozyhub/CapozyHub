// scripts/test-bulk-parse.ts
//
// A bulk batch is pasted or uploaded by hand, so the parser has to read the ways people really
// write it and, above all, never drop a line without saying so: a member who pastes 40 lines
// and sees 37 orders needs to know why.
import { findDuplicates, parseBulkRows, parseBulkText, parseVolume, restoreLeadingZero } from '@/lib/data-orders/bulk-parse'

function check(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
}

// ── Volume ──────────────────────────────────────────────────────────────────
check(parseVolume('5'), 5, '5')
check(parseVolume('5GB'), 5, '5GB')
check(parseVolume('2.5 gb'), 2.5, '2.5 gb')
check(parseVolume('10g'), 10, '10g')
check(parseVolume('0'), null, 'zero')
check(parseVolume('-3'), null, 'negative')
check(parseVolume('abc'), null, 'text')
check(parseVolume('5MB'), null, 'MB is not GB')
check(parseVolume('1001'), null, 'absurd volume')
check(parseVolume(''), null, 'empty')

// ── The leading zero Excel removes ─────────────────────────────────────────
check(restoreLeadingZero('241234567'), '0241234567', 'MTN 9 digits')
check(restoreLeadingZero('201234567'), '0201234567', 'Telecel 9 digits')
check(restoreLeadingZero('0241234567'), '0241234567', 'already fine')
check(restoreLeadingZero('233241234567'), '233241234567', 'international untouched')
check(restoreLeadingZero('991234567'), '991234567', 'not a real prefix: left for validation to reject')

// ── Pasted text ─────────────────────────────────────────────────────────────
const plain = parseBulkText('0241234567 5\n0551234567 10GB\n0201234567 1')
check(plain.lines.map(l => [l.phoneNumber, l.volume]), [['0241234567', 5], ['0551234567', 10], ['0201234567', 1]], 'plain lines')
check(plain.skipped.length, 0, 'nothing skipped')

check(parseBulkText('0241234567 5 GB').lines.map(l => l.volume), [5], 'space before unit')
check(parseBulkText('0241234567,5').lines.map(l => [l.phoneNumber, l.volume]), [['0241234567', 5]], 'comma separated')
check(parseBulkText('0241234567;5').lines.length, 1, 'semicolon separated')
check(parseBulkText('0241234567\t5').lines.length, 1, 'tab separated')
check(parseBulkText('024 123 4567 5').lines.map(l => [l.phoneNumber, l.volume]), [['0241234567', 5]], 'phone typed with spaces')
check(parseBulkText('+233 24 123 4567 5').lines.map(l => [l.phoneNumber, l.volume]), [['+233241234567', 5]], 'international with spaces')
check(parseBulkText('241234567 5').lines.map(l => l.phoneNumber), ['0241234567'], 'missing leading zero restored')
check(parseBulkText('0241234567 5\r\n0551234567 10\r\n').lines.length, 2, 'windows line endings')
check(parseBulkText('\n\n0241234567 5\n\n').lines[0].lineNumber, 3, 'line numbers count blank lines')

// Header rows are ignored silently; anything else unreadable is reported.
check(parseBulkText('Phone Volume (GB)\n0241234567 5').skipped.length, 0, 'header not reported')
const bad = parseBulkText('0241234567\n0551234567 lots\n0201234567 5\nhello world')
check(bad.lines.length, 1, 'only the good line parses')
check(bad.skipped.map(s => s.lineNumber), [1, 2, 4], 'every unreadable line is reported')
check(bad.skipped.every(s => s.reason.length > 0), true, 'each has a reason')
check(parseBulkText('02412x4567 5').skipped.length, 1, 'letters in a phone are reported')

// ── Spreadsheet rows ────────────────────────────────────────────────────────
const sheet = parseBulkRows([
    ['Phone', 'Volume (GB)'],
    [241234567, 5],            // Excel dropped the zero and stored a number
    ['0551234567', '10'],
    ['0201234567', 'abc'],
    [],
    ['0261234567', 2.5],
])
check(sheet.lines.map(l => [l.phoneNumber, l.volume]), [['0241234567', 5], ['0551234567', 10], ['0261234567', 2.5]], 'sheet rows')
check(sheet.skipped.map(s => s.lineNumber), [4], 'bad sheet row reported, header and blank row are not')

// ── Duplicates ──────────────────────────────────────────────────────────────
const dupes = findDuplicates([
    { lineNumber: 1, phoneNumber: '0241234567', volume: 5 },
    { lineNumber: 2, phoneNumber: '0551234567', volume: 5 },
    { lineNumber: 3, phoneNumber: '+233241234567', volume: 5 },   // same number, other spelling
    { lineNumber: 4, phoneNumber: '0241234567', volume: 10 },     // same number, other bundle: fine
    { lineNumber: 5, phoneNumber: '0241234567', volume: 5 },
    { lineNumber: 6, phoneNumber: 'garbage', volume: 5 },
])
check([...dupes.entries()], [[3, 1], [5, 1]], 'duplicates point at the first occurrence')

console.log('bulk parse: ok')
