import { validateGhanaianPhone } from '@/lib/phone-validation'

export interface ParsedLine {
    lineNumber: number
    phoneNumber: string
    volume: number
}

export interface SkippedLine {
    lineNumber: number
    text: string
    reason: string
}

export interface ParseOutcome {
    lines: ParsedLine[]
    /** Lines that could not be read at all. Shown to the member so nothing is dropped silently. */
    skipped: SkippedLine[]
}

const MAX_VOLUME_GB = 1000

/**
 * Excel stores a phone number as a number, which drops the leading zero: 0241234567 becomes
 * 241234567. If a 9-digit value starts with a real Ghana mobile prefix, put the zero back.
 * Anything else is returned unchanged for the normal validation to judge.
 */
export function restoreLeadingZero(raw: string): string {
    const digits = raw.replace(/[\s\-()]/g, '')
    if (/^\d{9}$/.test(digits) && validateGhanaianPhone(`0${digits}`).isValid) return `0${digits}`
    return raw
}

/** "5", "5GB", "5 gb", "2.5g" -> the number of GB. Null if it isn't a plain positive volume. */
export function parseVolume(raw: string): number | null {
    const m = raw.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:gb|g)?$/)
    if (!m) return null
    const n = Number(m[1])
    return Number.isFinite(n) && n > 0 && n <= MAX_VOLUME_GB ? n : null
}

function isHeader(text: string): boolean {
    return /phone|volume|number/i.test(text) && !/\d{6,}/.test(text)
}

/**
 * One order per line: "<phone> <GB>". The volume is the LAST item on the line and the phone is
 * everything before it, so a phone typed with spaces ("024 123 4567 5") still reads correctly.
 * Space, tab, comma and semicolon all separate. Blank lines and a header row are ignored; any
 * other line that can't be read is returned in `skipped` with the reason.
 */
export function parseBulkText(text: string): ParseOutcome {
    const lines: ParsedLine[] = []
    const skipped: SkippedLine[] = []

    text.split(/\r?\n/).forEach((rawLine, index) => {
        const lineNumber = index + 1
        // "5 GB" -> "5GB", so the unit is not mistaken for a separate item.
        const line = rawLine.trim().replace(/(\d)\s+(gb|g)\b/gi, '$1$2')
        if (!line || isHeader(line)) return

        const tokens = line.split(/[\s,;]+/).filter(Boolean)
        if (tokens.length < 2) {
            skipped.push({ lineNumber, text: line, reason: 'Needs a phone number and a volume' })
            return
        }

        const volume = parseVolume(tokens[tokens.length - 1])
        if (volume === null) {
            skipped.push({ lineNumber, text: line, reason: 'The volume at the end is not a number of GB' })
            return
        }

        const phone = tokens.slice(0, -1).join('')
        if (!/^\+?[\d\-()]+$/.test(phone)) {
            skipped.push({ lineNumber, text: line, reason: 'The phone number has unexpected characters' })
            return
        }
        lines.push({ lineNumber, phoneNumber: restoreLeadingZero(phone), volume })
    })

    return { lines, skipped }
}

/**
 * Spreadsheet rows (column 1 phone, column 2 volume) -> the same shape as pasted text. Cells
 * may be numbers, so the phone is read as a string and given its leading zero back.
 */
export function parseBulkRows(rows: unknown[][]): ParseOutcome {
    const lines: ParsedLine[] = []
    const skipped: SkippedLine[] = []

    rows.forEach((row, index) => {
        const lineNumber = index + 1
        const phoneCell = String(row?.[0] ?? '').trim()
        const volumeCell = String(row?.[1] ?? '').trim()
        if (!phoneCell && !volumeCell) return
        if (isHeader(`${phoneCell} ${volumeCell}`)) return

        const shown = [phoneCell, volumeCell].filter(Boolean).join(' ')
        const volume = parseVolume(volumeCell)
        if (volume === null) {
            skipped.push({ lineNumber, text: shown, reason: 'The volume is not a number of GB' })
            return
        }
        const phone = phoneCell.replace(/\s+/g, '')
        if (!/^\+?[\d\-()]+$/.test(phone)) {
            skipped.push({ lineNumber, text: shown, reason: 'The phone number has unexpected characters' })
            return
        }
        lines.push({ lineNumber, phoneNumber: restoreLeadingZero(phone), volume })
    })

    return { lines, skipped }
}

/**
 * Marks the second and later copies of the same phone + volume. They are still valid (buying
 * the same bundle twice can be deliberate) but the member is told, because it is far more
 * often a pasted line repeated by mistake.
 */
export function findDuplicates(entries: Array<{ phoneNumber: string; volume: number; lineNumber: number }>): Map<number, number> {
    const firstSeen = new Map<string, number>()
    const duplicateOf = new Map<number, number>()
    for (const e of entries) {
        const phone = validateGhanaianPhone(e.phoneNumber)
        if (!phone.isValid) continue
        const key = `${phone.normalizedNumber}|${e.volume}`
        const first = firstSeen.get(key)
        if (first === undefined) firstSeen.set(key, e.lineNumber)
        else duplicateOf.set(e.lineNumber, first)
    }
    return duplicateOf
}
