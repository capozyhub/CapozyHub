'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import type { RCOrder } from './meta'

interface ComplaintDialogProps {
    order: RCOrder | null
    onClose: () => void
    onFiled: (orderId: string) => void
}

export function ComplaintDialog({ order, onClose, onFiled }: ComplaintDialogProps) {
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)

    useEffect(() => { if (order) setText('') }, [order])

    const submit = async () => {
        if (!order || !text.trim() || sending) return
        setSending(true)
        try {
            const res = await fetch('/api/results-checker/complaints', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, description: text }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not file the complaint')
            toast.success('Complaint filed. Our team will review it.')
            onFiled(order.id)
            onClose()
        } catch (e: any) {
            toast.error(e.message || 'Could not file the complaint')
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={!!order} onOpenChange={open => { if (!open && !sending) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="gap-0 p-0 sm:max-w-md max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
            >
                <DialogDescription className="sr-only">Describe the problem with this voucher order</DialogDescription>
                <DialogClose disabled={sending} className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>
                <div className="space-y-4 px-6 pb-7 pt-8">
                    <div className="pr-8">
                        <DialogTitle className="font-display text-xl font-semibold">Report a problem</DialogTitle>
                        <p className="break-all font-mono text-xs text-muted-foreground">{order?.reference_code}</p>
                    </div>
                    <Textarea
                        aria-label="What went wrong?"
                        placeholder="For example: the PIN says it was already used."
                        value={text}
                        onChange={e => setText(e.target.value)}
                        rows={4}
                        maxLength={1000}
                    />
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>Cancel</Button>
                        <Button className="flex-1" onClick={submit} disabled={sending || !text.trim()}>
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send report'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}