// A shop owner's brand colour only ever tints small accents on the storefront (logo ring,
// selected states, the rule under the shop name). The frame itself stays Capozy black/clay/gold.
// Those accents sit on both the near-black stage and the light sheet, so a colour that is too
// dark or too pale to read on either falls back to the Capozy gold instead of being used as-is.
export const FALLBACK_ACCENT = '#F6C30F'

const HEX = /^#([0-9a-fA-F]{6})$/

function luminance(hex: string): number {
    const n = parseInt(hex.slice(1), 16)
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Mid-tones only: >= ~3:1 against black needs l >= 0.1; >= ~3:1 against #E8E8E8 needs l <= 0.28.
const MIN_L = 0.1
const MAX_L = 0.28

function mix(hex: string, target: 0 | 255, t: number): string {
    const n = parseInt(hex.slice(1), 16)
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v + (target - v) * t))
    return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * Returns a 6-digit hex that has usable contrast on both black and the light sheet. A colour
 * outside the readable range keeps its hue and is deepened (too light) or lightened (too dark)
 * just enough to fit, so green still reads as green. Only an invalid value falls back to gold.
 */
export function resolveAccent(color: string | null | undefined): string {
    const c = (color || '').trim()
    if (!HEX.test(c)) return FALLBACK_ACCENT
    if (c.toUpperCase() === FALLBACK_ACCENT) return FALLBACK_ACCENT
    const l = luminance(c)
    if (l >= MIN_L && l <= MAX_L) return c

    const tooLight = l > MAX_L
    const target = tooLight ? 0 : 255
    let lo = 0, hi = 1
    for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        const ok = tooLight ? luminance(mix(c, target, mid)) <= MAX_L - 0.02 : luminance(mix(c, target, mid)) >= MIN_L + 0.01
        if (ok) hi = mid; else lo = mid
    }
    return mix(c, target, hi)
}
