'use client'
import { useMemo, useState } from 'react'
import { ArrowRight, Search, WifiOff } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { NetworkIcon } from '@/components/network-icon'
import { ServiceChargeSheet, type ChargeDescriptor } from './ServiceChargeSheet'

export interface StorefrontPackage { id: string; network: string; size: string; description: string | null; selling_price: number }

const NETWORK_ORDER = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'AT']
const NETWORK_LABEL: Record<string, string> = { 'AT-iShare': 'AT iShare', 'AT-BigTime': 'AT BigTime' }

export function StorefrontDataTab({ shopSlug, packages, oosNetworks = [], brandName }: { shopSlug: string; packages: StorefrontPackage[]; oosNetworks?: string[]; brandName: string }) {
    // Only show the known Ghana networks. A package whose network is outside this set is a
    // data error and has no fulfillment supplier (it would charge then sit stuck pending),
    // so it must not be sellable on the storefront.
    const networks = NETWORK_ORDER.filter(n => packages.some(p => p.network === n))

    const [network, setNetwork] = useState(networks[0] || '')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<StorefrontPackage | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const filtered = useMemo(() => packages
        .filter(p => p.network === network)
        .filter(p => !search || `${p.size} ${p.description ?? ''}`.toLowerCase().includes(search.toLowerCase())),
        [packages, network, search])

    const openCheckout = (pkg: StorefrontPackage) => {
        setSelected(pkg); setSheetOpen(true)
    }

    // Memoized so its identity is STABLE across parent re-renders (e.g. the storefront's
    // visibilitychange/bfcache router.refresh()). A fresh object each render would re-fire the
    // sheet's reset effect and wipe an in-progress checkout when the guest returns from
    // approving the MoMo prompt. Only rebuild when the selected package or shop changes.
    const dataDescriptor: ChargeDescriptor | null = useMemo(() => selected ? {
        title: `${NETWORK_LABEL[selected.network] ?? selected.network} · ${selected.size}`,
        network: selected.network,
        amountLabel: formatCurrency(selected.selling_price),
        chargeUrl: '/api/shop/charge',
        statusUrl: '/api/shop/charge/status',
        beneficiary: { label: 'Who gets the data?', hint: '(their number)' },
        email: { hint: '(for a receipt, optional)' },
        successText: ({ beneficiary, momoPhone }) => `${selected.size} of ${NETWORK_LABEL[selected.network] ?? selected.network} data is on its way to ${beneficiary || momoPhone}.`,
        buildBody: ({ beneficiary, momoPhone, provider, email }) => ({
            shopSlug, packageId: selected.id, guestPhone: beneficiary, guestEmail: email, momoPhone, momoProvider: provider,
        }),
    } : null, [selected, shopSlug])

    if (networks.length === 0) {
        return (
            <div className="neu-inset flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
                <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="font-display text-lg font-bold text-foreground">No bundles on the shelf yet</p>
                <p className="text-sm text-muted-foreground">This shop has not listed any data bundles. Check back soon.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div role="radiogroup" aria-label="Network" className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {networks.map(n => {
                    const on = network === n
                    return (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setNetwork(n)}
                            className={cn(
                                'flex h-12 shrink-0 items-center gap-2.5 rounded-full px-4 text-sm font-semibold text-foreground transition-shadow motion-reduce:transition-none',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500',
                                on ? 'neu-inset ring-2 ring-[var(--shop-accent,#F6C30F)]' : 'neu-raised-sm neu-press'
                            )}
                        >
                            <NetworkIcon network={n} size={24} />
                            {NETWORK_LABEL[n] ?? n}
                        </button>
                    )
                })}
            </div>

            <label className="neu-inset flex h-12 items-center gap-3 rounded-full px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Search bundles</span>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by size, e.g. 5GB"
                    className="h-full w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70"
                />
            </label>

            {oosNetworks.includes(network) ? (
                <div className="neu-inset flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
                    <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <p className="font-display text-lg font-bold text-foreground">{NETWORK_LABEL[network] ?? network} is sold out right now</p>
                    <p className="text-sm text-muted-foreground">Try another network, or check back a little later.</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="neu-inset rounded-2xl px-6 py-12 text-center">
                    <p className="font-display text-lg font-bold text-foreground">Nothing matches that</p>
                    <p className="mt-1 text-sm text-muted-foreground">Clear the search to see every {NETWORK_LABEL[network] ?? network} bundle.</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {filtered.map(pkg => (
                        <li key={pkg.id}>
                            <button
                                type="button"
                                onClick={() => openCheckout(pkg)}
                                className="neu-raised-sm neu-press group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block font-display text-2xl font-bold leading-none tracking-tight text-foreground">{pkg.size}</span>
                                    {pkg.description && pkg.description !== 'Instant Delivery' && (
                                        <span className="mt-1.5 block truncate text-xs text-muted-foreground">{pkg.description}</span>
                                    )}
                                </span>
                                <span className="font-display text-lg font-bold tabular-nums text-foreground">{formatCurrency(pkg.selling_price)}</span>
                                <span className="clay-gold flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold" aria-hidden="true">
                                    Buy <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                                </span>
                                <span className="sr-only">Buy {pkg.size} for {formatCurrency(pkg.selling_price)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <ServiceChargeSheet
                open={sheetOpen} onClose={() => setSheetOpen(false)}
                descriptor={dataDescriptor}
                brandName={brandName}
            />
        </div>
    )
}
