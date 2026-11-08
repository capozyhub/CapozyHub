'use client'

import { Check, Crown, ShoppingBag } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

interface CongratsModalProps {
    onClose: () => void
    onBrowsePackages: () => void
}

const BENEFITS = [
    'Wholesale bundle prices',
    'Faster order processing',
    'Bulk order import',
    'Your own shop storefront',
    'Developer API key',
    'Priority support',
]

export default function CongratsModal({ onClose, onBrowsePackages }: CongratsModalProps) {
    return (
        <Dialog open onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent
                aria-describedby={undefined}
                className="gap-0 overflow-hidden p-0 sm:max-w-md max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
            >
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-brand-500" />
                <DialogDescription className="sr-only">Your membership is active</DialogDescription>

                <div className="space-y-5 px-6 pb-6 pt-10">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full">
                            <Crown className="h-8 w-8" />
                        </span>
                        <DialogTitle className="font-display text-2xl font-bold tracking-tight">Membership active</DialogTitle>
                        <p className="text-sm text-muted-foreground">Your new prices and tools are on. Here is what you now have.</p>
                    </div>

                    <ul className="well space-y-2.5 rounded-2xl p-4">
                        {BENEFITS.map(b => (
                            <li key={b} className="flex items-center gap-2.5 text-sm">
                                <span className="clay-gold flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"><Check className="h-3 w-3" /></span>
                                {b}
                            </li>
                        ))}
                    </ul>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="well h-12 flex-1 rounded-2xl text-sm font-bold text-muted-foreground hover:text-foreground"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={onBrowsePackages}
                            className="clay-gold inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl text-sm font-bold"
                        >
                            <ShoppingBag className="h-4 w-4" /> Browse bundles
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
