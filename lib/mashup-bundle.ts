export type BundlePreference = 'balanced' | 'data' | 'voice'

export interface MashupBundle {
    data: string
    voice: string
    /** False below GHS 10, where the figures are estimated ranges (the network sets the real values). */
    exact: boolean
}

/** What an MTN Mashup purchase of `amount` is expected to give, for the chosen data/voice lean. */
export function calcMashupBundle(amount: number, pref: BundlePreference): MashupBundle {
    const round1 = (n: number) => Math.round(n * 10) / 10
    if (amount <= 0) return { data: '0', voice: '0', exact: false }

    // From GHS 10 the rates are fixed.
    if (amount >= 10) {
        const BASE_DATA = 18     // MB per GHS
        const BASE_VOICE = 17.3  // minutes per GHS
        let dataMult = BASE_DATA, voiceMult = BASE_VOICE
        if (pref === 'data') { dataMult = BASE_DATA * 1.25; voiceMult = BASE_VOICE * 0.6 }
        if (pref === 'voice') { dataMult = BASE_DATA * 0.6; voiceMult = BASE_VOICE * 1.25 }
        return {
            data: round1(amount * dataMult).toFixed(1) + ' MB',
            voice: round1(amount * voiceMult).toFixed(1) + ' Mins',
            exact: true,
        }
    }

    // Below GHS 10 the rate varies by tier: show a range.
    let dataLow: number, dataHigh: number, voiceLow: number, voiceHigh: number
    if (amount <= 2) { dataLow = 15; dataHigh = 16; voiceLow = 15; voiceHigh = 16 }
    else if (amount <= 5) { dataLow = 15; dataHigh = 17.5; voiceLow = 15; voiceHigh = 17 }
    else { dataLow = 17; dataHigh = 18; voiceLow = 16.5; voiceHigh = 17.5 }

    if (pref === 'data') { dataHigh *= 1.2; voiceLow *= 0.7; voiceHigh *= 0.8 }
    if (pref === 'voice') { voiceHigh *= 1.2; dataLow *= 0.7; dataHigh *= 0.8 }

    return {
        data: `${round1(amount * dataLow).toFixed(0)}–${round1(amount * dataHigh).toFixed(0)} MB`,
        voice: `${round1(amount * voiceLow).toFixed(0)}–${round1(amount * voiceHigh).toFixed(0)} Mins`,
        exact: false,
    }
}
