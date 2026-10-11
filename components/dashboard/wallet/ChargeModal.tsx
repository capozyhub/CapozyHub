'use client'

import { AlertTriangle, CheckCircle2, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PATIENT_POLLS, type ChargeStep } from './meta'

interface ChargeModalProps {
    step: ChargeStep
    displayText: string
    phone: string
    otpValue: string
    onOtpChange: (v: string) => void
    pollCount: number
    checkingPaid: boolean
    onSubmitOtp: () => void
    onIHavePaid: () => void
    onCancel: () => void
    onRetry: () => void
}

/** The charge flow lives in a focus-trapped, non-dismissible modal so it stays put
 * while the member switches to their MoMo app to approve the prompt and comes back.
 * Closing is driven only by the in-modal buttons, never Esc / outside-click. */
export function ChargeModal({ step, displayText, phone, otpValue, onOtpChange, pollCount, checkingPaid, onSubmitOtp, onIHavePaid, onCancel, onRetry }: ChargeModalProps) {
    return (
        <Dialog open={step !== 'idle'}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                onInteractOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
                className="sm:max-w-md"
            >
                <DialogTitle className="sr-only">Wallet top-up payment</DialogTitle>

                {step === 'charging' && (
                    <div className="flex flex-col items-center gap-4 py-10">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                        <p className="font-display text-base font-semibold">Starting your payment…</p>
                    </div>
                )}

                {step === 'otp_required' && (
                    <div className="space-y-4">
                        <p className="text-center text-sm font-medium">{displayText || 'Enter the OTP sent to your phone'}</p>
                        <Input
                            placeholder="Enter OTP"
                            value={otpValue}
                            onChange={e => onOtpChange(e.target.value.replace(/\D/g, ''))}
                            className="h-12 text-center text-xl font-mono tracking-widest"
                            maxLength={6}
                        />
                        <Button onClick={onSubmitOtp} className="h-12 w-full text-base" disabled={!otpValue}>Submit OTP</Button>
                        <button type="button" onClick={onCancel} className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline">
                            Cancel
                        </button>
                    </div>
                )}

                {step === 'pending' && (
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                        <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full">
                            <Smartphone className="h-8 w-8" />
                        </span>
                        <div className="space-y-1">
                            <p className="font-display text-lg font-semibold">Check your phone</p>
                            <p className="text-sm text-muted-foreground">
                                We sent a prompt to <span className="font-semibold text-foreground">{phone}</span>. Enter your MoMo PIN to approve.
                            </p>
                        </div>

                        <Button onClick={onIHavePaid} disabled={checkingPaid} className="h-12 w-full text-base">
                            {checkingPaid ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> I&apos;ve paid — check now</>}
                        </Button>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>
                                {pollCount >= PATIENT_POLLS
                                    ? 'Taking longer than usual — once you approve, you’ll be credited automatically.'
                                    : 'Waiting for your approval…'}
                            </span>
                        </div>

                        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                            Cancel
                        </button>
                    </div>
                )}

                {step === 'verifying' && (
                    <div className="flex flex-col items-center gap-4 py-10">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                        <p className="font-display text-base font-semibold">Confirming your payment…</p>
                    </div>
                )}

                {step === 'failed' && (
                    <div className="flex flex-col items-center gap-4 py-10">
                        <AlertTriangle className="h-10 w-10 text-red-500" />
                        <p className="text-center font-display text-base font-semibold">That payment didn&apos;t go through</p>
                        <Button onClick={onRetry} variant="outline">Try again</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
