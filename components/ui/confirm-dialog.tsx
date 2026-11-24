'use client'

import { useCallback, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Styles the confirm button as a dangerous action (delete, void, refund). */
    destructive?: boolean
}

/**
 * In-page replacement for window.confirm(), which silently does nothing in some installed
 * web apps (iOS home-screen PWAs). Usage:
 *
 *   const { ask, dialog } = useConfirm()
 *   if (!(await ask({ title: 'Delete this package?', destructive: true }))) return
 *   ...
 *   return <>{page}{dialog}</>
 */
export function useConfirm() {
    const [options, setOptions] = useState<ConfirmOptions | null>(null)
    const resolver = useRef<((ok: boolean) => void) | null>(null)

    const ask = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => {
        // A second ask() while one is open cancels the first rather than leaving it hanging.
        resolver.current?.(false)
        resolver.current = resolve
        setOptions(opts)
    }), [])

    const settle = (ok: boolean) => {
        resolver.current?.(ok)
        resolver.current = null
        setOptions(null)
    }

    const dialog = (
        <Dialog open={!!options} onOpenChange={(open) => { if (!open) settle(false) }}>
            <DialogContent className="max-w-sm rounded-[2rem]" aria-describedby={options?.description ? 'confirm-dialog-desc' : undefined}>
                <DialogHeader>
                    <DialogTitle className="font-display">{options?.title}</DialogTitle>
                    {options?.description && <DialogDescription id="confirm-dialog-desc">{options.description}</DialogDescription>}
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <button
                        type="button"
                        onClick={() => settle(false)}
                        className="clay-silver min-h-11 rounded-full px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-brand-500"
                    >
                        {options?.cancelLabel ?? 'Cancel'}
                    </button>
                    <button
                        type="button"
                        autoFocus
                        onClick={() => settle(true)}
                        className={cn(
                            'min-h-11 rounded-full px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-brand-500',
                            options?.destructive ? 'clay-red' : 'clay-gold',
                        )}
                    >
                        {options?.confirmLabel ?? 'Confirm'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

    return { ask, dialog }
}
