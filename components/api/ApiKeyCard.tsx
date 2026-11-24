'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, normalizeWhatsAppNumber } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useSupportContacts } from '@/hooks/use-support-contacts'
import {
    Key, Copy, Check, RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle,
    Eye, EyeOff, ShieldAlert, X, MessageCircle, Sparkles,
} from 'lucide-react'

export interface ApiKeyMeta {
    id: string
    prefix: string
    name: string
    status: 'pending' | 'active' | 'revoked'
    key_type: 'standard'
    last_used_at: string | null
    created_at: string
}

interface NewKeyResponse {
    success: boolean
    message: string
    api_key: {
        key: string
        prefix: string
        name: string
        status: string
        key_type: 'standard'
        created_at: string
    }
    warning?: string
}

const STATUS_CONFIG = {
    pending: {
        icon: Clock,
        color: 'text-foreground',
        bg: 'bg-muted',
        border: 'border-border',
        dot: 'bg-brand-500',
        label: 'Pending Approval',
    },
    active: {
        icon: CheckCircle2,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-500',
        label: 'Active',
    },
    revoked: {
        icon: XCircle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/30',
        dot: 'bg-red-400',
        label: 'Revoked',
    },
}

const KEY_TYPE_LABEL: Record<'standard', string> = {
    standard: 'Standard API Key',
}
const KEY_TYPE_DEFAULT_NAME: Record<'standard', string> = {
    standard: 'My API Key',
}
const KEY_TYPE_ICON: Record<'standard', any> = {
    standard: Key,
}
const KEY_TYPE_BADGE: Record<'standard', string | null> = {
    standard: null,
}
const KEY_TYPE_EMPTY_COPY: Record<'standard', string> = {
    standard: 'Generate your first API key to start building integrations. Keys require admin approval before use.',
}

function CopyButton({ text, className }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try { await navigator.clipboard.writeText(text) }
        catch {
            const el = document.createElement('textarea')
            el.value = text; document.body.appendChild(el); el.select()
            document.execCommand('copy'); document.body.removeChild(el)
        }
        setCopied(true)
        toast.success('Copied to clipboard')
        setTimeout(() => setCopied(false), 2500)
    }
    return (
        <button
            onClick={copy}
            className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                'bg-white/10 hover:bg-white/20 text-silver-100 hover:text-white',
                className
            )}
        >
            {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    )
}

// ── API Key Card ─────────────────────────────────────────────────────────────
// Owns the generate/regenerate + one-time plaintext reveal flow for the user's API key.
// New keys need admin approval before use (see POST /api/user/api-keys).
export function ApiKeyCard({
    keyType, apiKey, userName, userEmail, userPhone, onGenerated,
}: {
    keyType: 'standard'
    apiKey: ApiKeyMeta | null
    userName: string
    userEmail: string
    userPhone: string
    onGenerated: () => void
}) {
        const [isGenerating, setIsGenerating] = useState(false)
    const [newKey, setNewKey] = useState<string | null>(null)
    const [showKey, setShowKey] = useState(false)
    const [copiedKey, setCopiedKey] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [showWarningModal, setShowWarningModal] = useState(false)
    const [showApprovalModal, setShowApprovalModal] = useState(false)

    const statusCfg = apiKey ? STATUS_CONFIG[apiKey.status] : null
    const TypeIcon = KEY_TYPE_ICON[keyType]
    const badge = KEY_TYPE_BADGE[keyType]

    const handleGenerateKey = async () => {
        setIsGenerating(true)
        setError(null)
        setNewKey(null)
        try {
            const res = await fetch('/api/user/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: KEY_TYPE_DEFAULT_NAME[keyType],
                    key_type: keyType,
                }),
            })
            const json = await res.json()
            if (!res.ok) { setError('We could not generate your key. Try again.'); return }
            const response = json as NewKeyResponse
            setNewKey(response.api_key.key)
            setShowKey(true)
            setShowConfirmDialog(false)
            setShowWarningModal(false)
            setShowApprovalModal(true)
            onGenerated()
        } catch (err: any) {
            setError('We could not generate your key. Try again.')
        } finally {
            setIsGenerating(false)
        }
    }

    const copyNewKey = async () => {
        if (!newKey) return
        try { await navigator.clipboard.writeText(newKey) }
        catch {
            const el = document.createElement('textarea')
            el.value = newKey; document.body.appendChild(el); el.select()
            document.execCommand('copy'); document.body.removeChild(el)
        }
        setCopiedKey(true)
        toast.success('API key copied to clipboard')
        setTimeout(() => setCopiedKey(false), 3000)
    }

    return (
        <div className="neu-raised-sm rounded-3xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <TypeIcon className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                    {KEY_TYPE_LABEL[keyType]}
                </h2>
                {badge && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-900 dark:text-brand-400">
                        {badge}
                    </span>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* New Key Banner */}
                {newKey && (
                    <div className="neu-inset rounded-3xl overflow-hidden">
                        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
                            <AlertTriangle className="w-4 h-4 text-brand-700 dark:text-brand-500 flex-shrink-0" />
                            <p className="text-sm font-semibold text-foreground">
                                Save your API key — it will never be shown again.
                            </p>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Copy and store this key somewhere safe. If you lose it, you must generate a new one, which permanently revokes this key.
                            </p>
                            <div className="neu-night-in flex items-center gap-2 rounded-xl px-4 py-3 font-mono text-sm overflow-x-auto">
                                <code className="flex-1 text-silver-100 break-all text-[13px]">
                                    {showKey ? newKey : '•'.repeat(Math.min(newKey.length, 48))}
                                </code>
                                <button
                                    onClick={() => setShowKey(s => !s)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                                >
                                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={copyNewKey}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                                >
                                    {copiedKey ? <Check className="w-4 h-4 text-brand-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                            <Button
                                onClick={copyNewKey}
                                className="clay-gold w-full min-h-11 rounded-full border-0 font-semibold gap-2"
                            >
                                {copiedKey ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy API Key</>}
                            </Button>
                        </div>
                    </div>
                )}

                {apiKey && statusCfg ? (
                    <div className="space-y-5">
                        {/* Status row */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className={cn(
                                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border',
                                statusCfg.bg, statusCfg.color, statusCfg.border
                            )}>
                                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusCfg.dot,
                                    apiKey.status === 'active' && 'animate-pulse'
                                )} />
                                <statusCfg.icon className="w-4 h-4" />
                                {statusCfg.label}
                            </div>
                            <code className="text-sm font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                                {apiKey.prefix}••••••••
                            </code>
                        </div>

                        {/* Meta grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-xl neu-inset px-4 py-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Created</p>
                                <p className="text-sm font-semibold text-foreground">
                                    {new Date(apiKey.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="rounded-xl neu-inset px-4 py-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Last Used</p>
                                <p className="text-sm font-semibold text-foreground">
                                    {apiKey.last_used_at
                                        ? new Date(apiKey.last_used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : 'Never'}
                                </p>
                            </div>
                        </div>

                        {/* Status-specific notices */}
                        {apiKey.status === 'pending' && (
                            <div className="flex items-start gap-3 rounded-xl neu-inset p-4">
                                <Clock className="w-4 h-4 text-brand-700 dark:text-brand-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-foreground">
                                    <strong>Awaiting approval.</strong> An administrator will review and activate your key. You'll be notified when it's ready.
                                </p>
                            </div>
                        )}
                        {apiKey.status === 'revoked' && (
                            <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4">
                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    <strong>Key revoked.</strong> This key can no longer be used. Generate a new key to restore API access.
                                </p>
                            </div>
                        )}

                        {/* Rotate key */}
                        <div className="pt-2 border-t border-border">
                            {!showConfirmDialog ? (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowWarningModal(true)}
                                    className="gap-2 h-9 text-sm"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Generate New Key
                                </Button>
                            ) : (
                                <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4 space-y-3">
                                    <p className="text-sm text-red-800 dark:text-red-200 font-medium leading-snug">
                                        ⚠️ This will <strong>permanently revoke</strong> your current key. All existing integrations using it will stop working immediately.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleGenerateKey}
                                            disabled={isGenerating}
                                            className="gap-2 h-8 text-xs font-semibold"
                                        >
                                            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                                            {isGenerating ? 'Generating…' : 'Confirm & Revoke'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowConfirmDialog(false)}
                                            className="h-8 text-xs"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* No key yet */
                    <div className="text-center py-10">
                        <div className="clay-gold w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <TypeIcon className="w-7 h-7 text-brand-700 dark:text-brand-500" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-2">
                            No {KEY_TYPE_LABEL[keyType]} Yet
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                            {KEY_TYPE_EMPTY_COPY[keyType]}
                        </p>
                        <Button
                            onClick={() => setShowWarningModal(true)}
                            disabled={isGenerating}
                            className="clay-gold font-semibold gap-2 shadow-lg shadow-violet-500/20 h-10 px-6"
                        >
                            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            {isGenerating ? 'Generating…' : 'Generate API Key'}
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}
            </div>

            {/* Pre-generation Warning Modal */}
            {showWarningModal && (
                <DeveloperWarningModal
                    isGenerating={isGenerating}
                    hasExistingKey={!!apiKey}
                    onConfirm={handleGenerateKey}
                    onClose={() => setShowWarningModal(false)}
                />
            )}

            {/* Post-generation approval modal: new keys need admin approval */}
            {showApprovalModal && newKey && (
                <ApprovalModal
                    userName={userName}
                    userEmail={userEmail}
                    userPhone={userPhone}
                    keyPrefix={apiKey?.prefix || newKey.substring(0, 16)}
                    onClose={() => setShowApprovalModal(false)}
                />
            )}
        </div>
    )
}

// ── Modal: Developer Use Only Warning ────────────────────────────────────────
function DeveloperWarningModal({
    isGenerating, hasExistingKey, onConfirm, onClose,
}: {
    isGenerating: boolean
    hasExistingKey: boolean
    onConfirm: () => void
    onClose: () => void
}) {
    const [acknowledged, setAcknowledged] = useState(false)
    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-neu rounded-2xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden my-auto">
                {/* Close */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-border">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl clay-gold flex items-center justify-center flex-shrink-0">
                            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                                For Developer Use Only
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                Please read carefully before generating a key.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 space-y-4 text-sm text-foreground/80">
                    <p>
                        The Developer API is intended for <strong>software developers integrating Capozy Hub into their own apps or platforms</strong> — not for casual use or for resale of unmodified Capozy Hub services.
                    </p>

                    <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4 space-y-2">
                        <p className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            Anti-abuse policy
                        </p>
                        <ul className="text-xs sm:text-sm text-red-800 dark:text-red-200 space-y-1.5 list-disc pl-5 leading-relaxed">
                            <li>Do <strong>not</strong> generate keys you don't intend to use.</li>
                            <li>Do <strong>not</strong> share your key with third parties. You are responsible for every request made with it.</li>
                            <li>Abuse, brute-forcing, or fraudulent use will result in <strong>permanent revocation</strong> and account suspension.</li>
                            <li>Each generation request is logged and reviewed by an administrator.</li>
                        </ul>
                    </div>

                    {hasExistingKey && (
                        <div className="rounded-xl neu-inset p-3 text-xs sm:text-sm text-foreground">
                            <strong>⚠ This will permanently revoke your current key.</strong> Any app currently using it will stop working immediately.
                        </div>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                        <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={e => setAcknowledged(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-border accent-black dark:accent-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm text-foreground/80 leading-snug">
                            I understand this is a developer-only feature and I will not abuse the API. I accept that violating the anti-abuse policy may permanently disable my account.
                        </span>
                    </label>
                </div>

                {/* Footer */}
                <div className="px-5 sm:px-6 py-4 neu-inset border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="flex-1 h-10 text-sm font-semibold order-2 sm:order-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={!acknowledged || isGenerating}
                        className={cn(
                            'flex-1 h-10 text-sm font-semibold gap-2 order-1 sm:order-2 clay-gold shadow-lg shadow-violet-500/20',
                            !acknowledged && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                        {isGenerating ? 'Generating…' : 'I Agree — Generate Key'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ── Modal: Post-generation Approval / WhatsApp Admin ─────────────────────────
function ApprovalModal({
    userName, userEmail, userPhone, keyPrefix, onClose,
}: {
    userName: string
    userEmail: string
    userPhone: string
    keyPrefix: string
    onClose: () => void
}) {
    // The admin's WhatsApp number comes from Admin > Settings, so changing it there takes effect here.
    const { contacts, loading } = useSupportContacts()
    const adminWhatsapp = normalizeWhatsAppNumber(contacts?.whatsapp || '')
    const message = [
        `Hello Admin, please approve my Developer API key.`,
        ``,
        `Name: ${userName}`,
        `Email: ${userEmail}`,
        `Phone: ${userPhone}`,
        `Key prefix: ${keyPrefix}`,
        ``,
        `Thank you.`,
    ].join('\n')
    const waUrl = adminWhatsapp ? `https://wa.me/${adminWhatsapp}?text=${encodeURIComponent(message)}` : null

    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-neu rounded-2xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden my-auto">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-border">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl clay-gold flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                                Key Generated — One Step Left
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                {waUrl
                                    ? 'Your API key is pending admin approval. Message the admin on WhatsApp to fast-track activation.'
                                    : 'Your API key is pending admin approval. You will get a notification once it is active.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 space-y-4">
                    <div className="rounded-xl neu-inset p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                            <strong>Save your key first</strong> — it's shown in the page above and won't appear again.{waUrl ? ' After saving, tap the WhatsApp button to notify the admin for approval.' : ''}
                        </p>
                    </div>

                    {/* Shown only when an admin WhatsApp number is set in Admin > Settings. */}
                    {waUrl ? (
                        <>
                            <div className="rounded-xl neu-inset border border-border p-3 sm:p-4 space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground">Message Preview</p>
                                <pre className="text-[11px] sm:text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{message}</pre>
                            </div>

                            <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2.5 w-full h-11 sm:h-12 rounded-xl bg-[#25D366] hover:bg-[#1fb955] text-white font-semibold text-sm sm:text-base shadow-lg shadow-emerald-500/20 transition-colors"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Message Admin on WhatsApp
                            </a>
                        </>
                    ) : loading ? null : (
                        <p className="rounded-xl neu-inset border border-border p-3 text-xs text-muted-foreground">
                            Admins review pending keys regularly. Keep an eye on your notifications.
                        </p>
                    )}

                    <p className="text-[11px] text-center text-muted-foreground">
                        {waUrl ? 'Or wait: admins review pending keys regularly. ' : ''}You'll get a notification once it is approved.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-5 sm:px-6 py-3 neu-inset border-t border-border">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="w-full h-9 text-xs sm:text-sm font-semibold"
                    >
                        Got it — close
                    </Button>
                </div>
            </div>
        </div>
    )
}
