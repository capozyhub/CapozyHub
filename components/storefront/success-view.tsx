import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Clock, MessageCircle, RefreshCw, ShoppingCart, XCircle, type LucideIcon } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/app/shop/[shopSlug]/success/copy-button'
import { SuccessAutoRefresh } from '@/app/shop/[shopSlug]/success/SuccessAutoRefresh'
import { StorefrontPageFrame } from './page-frame'

export async function successMetadata(shopSlug: string): Promise<Metadata> {
    const supabase = createServerClient()
    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name')
        .eq('shop_slug', shopSlug)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .single() as any)
    return { title: shop?.shop_name ? `Order update | ${shop.shop_name}` : 'Order update' }
}

type Tone = 'good' | 'wait' | 'bad'

/**
 * Order confirmation, shared by /shop/[slug]/success and the shop-domain route.
 * `basePath` is '/shop' on the apex and '' on shop.* hosts (links must not carry the prefix there).
 */
export async function StorefrontSuccess({ shopSlug, reference, basePath }: { shopSlug: string; reference?: string; basePath: '/shop' | '' }) {
    const ref = reference
    const supabase = createServerClient()

    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name, logo_url, brand_color, whatsapp_number')
        .eq('shop_slug', shopSlug)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .single() as any)

    // SHOPAFA- references are AFA registrations (afa_orders); everything else is shop_orders.
    const isAfaRef = !!ref && ref.startsWith('SHOPAFA-')
    let order: any = null
    if (ref && isAfaRef) {
        const { data } = await (supabase
            .from('afa_orders')
            .select('guest_phone, selling_price, status, full_name')
            .eq('paystack_reference', ref)
            .single() as any)
        order = data
    } else if (ref) {
        const { data } = await (supabase
            .from('shop_orders')
            .select('guest_phone, network, package_size, selling_price, status, package_id')
            .eq('paystack_reference', ref)
            .single() as any)
        order = data
    }
    const isAfa = isAfaRef && !!order

    const isAirtime = !isAfa && order?.package_id == null && !!order && !order?.package_size?.toLowerCase().includes('mashup')
    const isMashup = !isAfa && order?.package_id == null && !!order && order?.package_size?.toLowerCase().includes('mashup')
    const orderStatus: string = order?.status || 'pending'
    // AFA uses 'cancelled' (never 'failed') for the same "went wrong" outcome.
    const isFailed = orderStatus === 'failed' || (isAfa && orderStatus === 'cancelled')
    const isQueued = orderStatus === 'queued'
    const isPending = orderStatus === 'pending' || orderStatus === 'processing'

    // The URL is shareable, so show only the last 4 digits. The AFA applicant's name and
    // Ghana Card number are never rendered here.
    const maskedPhone = order?.guest_phone ? `••••••${order.guest_phone.slice(-4)}` : '••••••••••'

    const kind = isAfa ? 'AFA registration' : isMashup ? 'mashup' : isAirtime ? 'airtime' : 'data'

    const hero: { tone: Tone; Icon: LucideIcon; title: string; body: string; note?: string } = (() => {
        if (isFailed) {
            return {
                tone: 'bad', Icon: XCircle, title: 'Something went wrong',
                body: isAfa
                    ? 'Your payment reached us, but the registration could not be finished.'
                    : `Your payment reached us, but the ${kind} order could not be completed.`,
                note: 'Message the shop with your reference below before you try again. Buying twice could mean paying twice.',
            }
        }
        if (isAfa) {
            const done = orderStatus === 'completed'
            return {
                tone: done ? 'good' : 'wait', Icon: done ? CheckCircle2 : Clock,
                title: done ? 'You are registered' : 'We have your registration',
                body: done ? 'Your AFA registration is complete.' : 'An agent will process it, usually within 24 to 48 hours.',
                note: done ? undefined : 'If it takes longer than that, message the shop with your reference.',
            }
        }
        if (isAirtime || isMashup) {
            return {
                tone: 'wait', Icon: Clock, title: 'Order received',
                body: `The shop team will send your ${kind} shortly.`,
                note: 'These are sent by hand, so allow a few minutes up to an hour. If it takes longer, message the shop.',
            }
        }
        if (isQueued) {
            return { tone: 'wait', Icon: Clock, title: 'Almost there', body: 'We are registering the number with the network. Your bundle goes out on its own once that clears.' }
        }
        if (isPending) {
            return { tone: 'good', Icon: CheckCircle2, title: 'Payment received', body: 'Your bundle is being sent and should arrive shortly.' }
        }
        return { tone: 'good', Icon: CheckCircle2, title: 'Delivered', body: 'Your bundle has been sent.' }
    })()

    const whatsappText = isFailed
        ? `Hi! I had an issue with my ${kind} order. Reference: ${ref || ''}. Please help.`
        : `Hi! I just ${isAfa ? 'registered for AFA' : `bought ${kind}`} from your shop. Reference: ${ref || ''}`

    const home = basePath ? `${basePath}/${shopSlug}` : `/${shopSlug}`
    const { Icon } = hero

    const rows: [string, React.ReactNode][] = order ? [
        [isAfa ? 'For' : 'Item', isAfa ? 'AFA registration' : isAirtime ? `${order.network} airtime` : isMashup ? order.package_size : `${order.network} ${order.package_size}`],
        [isAfa ? 'Contact' : 'Sent to', <span key="p" className="font-mono">{maskedPhone}</span>],
        [isAirtime || isMashup ? 'Value' : 'Paid', `GHS ${parseFloat(order.selling_price).toFixed(2)}`],
        ['Status', <span key="s" className="capitalize">{orderStatus}</span>],
    ] : []

    return (
        <StorefrontPageFrame name={shop?.shop_name || shopSlug} logoUrl={shop?.logo_url} brandColor={shop?.brand_color} backHref={home} backLabel="Back to shop">
            {/* Live-refresh while the order is still settling (display only) */}
            <SuccessAutoRefresh active={!order || orderStatus === 'pending'} />

            <div className="flex flex-col items-center text-center" role="status">
                <span className={cn('flex h-16 w-16 items-center justify-center rounded-full', hero.tone === 'bad' ? 'neu-inset text-red-600 dark:text-red-400' : hero.tone === 'wait' ? 'neu-inset text-foreground' : 'clay-gold')}>
                    <Icon className="h-8 w-8" aria-hidden="true" />
                </span>
                <h1 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-foreground">{hero.title}</h1>
                <p className="mt-2 max-w-sm text-base leading-relaxed text-muted-foreground">{hero.body}</p>
            </div>

            {hero.note && (
                <p className="neu-inset mt-6 rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-foreground">{hero.note}</p>
            )}

            {order && (
                <div className="mt-6 rounded-3xl bg-black p-5 text-white">
                    <dl className="space-y-3 text-sm">
                        {rows.map(([k, v]) => (
                            <div key={k} className="flex items-baseline justify-between gap-4">
                                <dt className="text-silver-200">{k}</dt>
                                <dd className="text-right font-semibold">{v}</dd>
                            </div>
                        ))}
                    </dl>
                    {ref && (
                        <div className="mt-4 border-t border-white/15 pt-4">
                            <p className="text-xs text-silver-200">Reference</p>
                            <div className="mt-1.5 flex items-center justify-between gap-3">
                                <span className="break-all font-mono text-xs text-white">{ref}</span>
                                <CopyButton text={ref} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
                {isFailed ? (
                    <Link href={home} className="neu-raised-sm neu-press flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full text-base font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Back to the shop
                    </Link>
                ) : (
                    <Link href={home} className="clay-gold flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                        <ShoppingCart className="h-4 w-4" aria-hidden="true" /> {isAfa ? 'Back to the shop' : `Buy more ${kind}`}
                    </Link>
                )}
                {shop?.whatsapp_number && (
                    <a
                        href={`https://wa.me/${shop.whatsapp_number}?text=${encodeURIComponent(whatsappText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600', isFailed ? 'clay-gold' : 'neu-raised-sm neu-press text-foreground')}
                    >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> {isFailed ? 'Message the shop for help' : 'Message the shop'}
                    </a>
                )}
            </div>
        </StorefrontPageFrame>
    )
}
