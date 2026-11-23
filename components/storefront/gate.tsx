import { Hammer, Hourglass } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { normalizeWhatsAppNumber } from '@/lib/utils'
import { StorefrontPageFrame } from './page-frame'

type GateKind = 'maintenance' | 'review'

const COPY: Record<GateKind, { title: string; body: string; Icon: typeof Hammer }> = {
    maintenance: {
        title: 'Back shortly',
        body: 'This shop is offline for maintenance. Orders are paused until it is back.',
        Icon: Hammer,
    },
    review: {
        title: 'Opening soon',
        body: 'This shop is waiting for approval before it can take orders.',
        Icon: Hourglass,
    },
}

/**
 * Shown instead of a storefront that cannot take orders yet (offline, or not approved).
 * Server-safe, so both storefront routes render the same screen. The shop's own colour and
 * logo come through the frame; the WhatsApp button appears only if the shop set a number.
 */
export function StorefrontGate({ kind, shop }: {
    kind: GateKind
    shop: { shop_name: string; logo_url?: string | null; brand_color?: string | null; whatsapp_number?: string | null }
}) {
    const { title, body, Icon } = COPY[kind]
    const wa = normalizeWhatsAppNumber(shop.whatsapp_number || '')
    return (
        <StorefrontPageFrame name={shop.shop_name} logoUrl={shop.logo_url} brandColor={shop.brand_color} backHref="/" backLabel="Home">
            <section className="neu-raised space-y-5 rounded-[2rem] p-6 text-center sm:p-8" aria-labelledby="gate-title">
                <span className="clay-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="space-y-2">
                    <h1 id="gate-title" className="font-display text-2xl font-bold tracking-tight text-balance">{title}</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
                {wa && (
                    <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clay-black inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-6 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                        <WhatsAppIcon className="h-5 w-5" /> Message the shop
                    </a>
                )}
            </section>
        </StorefrontPageFrame>
    )
}
