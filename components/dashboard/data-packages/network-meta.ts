export const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const
export type NetworkName = (typeof NETWORKS)[number]

export const NETWORK_LABEL: Record<string, string> = {
    MTN: 'MTN',
    Telecel: 'Telecel',
    'AT-iShare': 'AT iShare',
    'AT-BigTime': 'AT BigTime',
}

/** Each network's own brand colour, used as a thin accent (never as a card background). */
export const NETWORK_COLOR: Record<string, string> = {
    MTN: '#FFCC00',
    Telecel: '#E60000',
    'AT-iShare': '#0057B8',
    'AT-BigTime': '#7C3AED',
}

export function networkLabel(network: string): string {
    return NETWORK_LABEL[network] ?? network
}

/** The carrier family a package's numbers belong to, as phone-validation names them. */
export function carrierFamily(network: string): string {
    return network.startsWith('AT') ? 'AirtelTigo' : network
}

/**
 * The `.clay clay-*` class pair (see app/globals.css) that renders this network's own colour
 * as a clay surface — gold for MTN, red for Telecel, blue for AT iShare, purple for AT
 * BigTime. For a price badge or CTA that belongs to one specific bundle, so it reads as that
 * network's own colour rather than the generic gold used for page-level actions (tabs, "Buy").
 */
export function networkClayClass(network: string): string {
    switch (network) {
        case 'MTN': return 'clay clay-yellow'
        case 'Telecel': return 'clay clay-red'
        case 'AT-iShare': return 'clay clay-blue'
        case 'AT-BigTime': return 'clay clay-purple'
        default: return 'clay-gold'
    }
}
