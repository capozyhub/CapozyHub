'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Plus, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { ClayButton, Notice, TextAreaField, TextField } from '@/components/auth/fields'
import { CtaFieldGroup } from './CtaFieldGroup'
import { AnnouncementPreview } from './AnnouncementPreview'

const TITLE_MAX = 80
const MESSAGE_MAX = 1000
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

export type EditingAnnouncement = {
    id?: string
    title?: string
    message?: string
    visible_on?: string | null
    status?: string | null
    scheduled_at?: string | null
    cta_primary_label?: string | null
    cta_primary_url?: string | null
    cta_secondary_label?: string | null
    cta_secondary_url?: string | null
} | null

type VisibleOn = 'main_site' | 'storefronts' | 'both'
type Mode = 'draft' | 'publish' | 'schedule'
type When = 'now' | 'later'

const AUDIENCES: { value: VisibleOn; label: string; hint: string }[] = [
    { value: 'main_site', label: 'Members', hint: 'Pops up on the dashboard after sign-in.' },
    { value: 'storefronts', label: 'Shop visitors', hint: 'Pops up on every shop storefront.' },
    { value: 'both', label: 'Everyone', hint: 'Members and shop visitors.' },
]

/** ISO timestamp → value for <input type="datetime-local"> in the user's local wall-clock. */
function toLocalDatetimeInput(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
}

/** A group of radio-style cards: the chosen one sits pressed in, the others stand raised. */
function ChoiceGroup<T extends string>({ legend, name, value, onChange, options, columns }: {
    legend: string
    name: string
    value: T
    onChange: (v: T) => void
    options: { value: T; label: string; hint?: string }[]
    columns: string
}) {
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">{legend}</legend>
            <div className={cn('grid gap-2', columns)}>
                {options.map(o => {
                    const checked = value === o.value
                    return (
                        <label
                            key={o.value}
                            className={cn(
                                'flex cursor-pointer flex-col gap-0.5 rounded-2xl p-3.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 dark:focus-within:outline-brand-500',
                                checked ? 'neu-inset' : 'neu-raised-sm neu-press',
                            )}
                        >
                            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
                            <span className={cn('text-sm font-semibold', checked ? 'text-foreground' : 'text-foreground/90')}>{o.label}</span>
                            {o.hint && <span className="text-xs leading-snug text-muted-foreground">{o.hint}</span>}
                        </label>
                    )
                })}
            </div>
        </fieldset>
    )
}

export function ComposeTab({ editing, onSaved, onCancelEdit, savedButtons = [] }: {
    editing: EditingAnnouncement
    onSaved: () => void
    onCancelEdit: () => void
    savedButtons?: { label: string; url: string }[]
}) {
    const isEditing = !!editing?.id

    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [visibleOn, setVisibleOn] = useState<VisibleOn>('main_site')
    const [cta1Label, setCta1Label] = useState('')
    const [cta1Url, setCta1Url] = useState('')
    const [cta2Label, setCta2Label] = useState('')
    const [cta2Url, setCta2Url] = useState('')
    const [showSecond, setShowSecond] = useState(false)
    const [sendPush, setSendPush] = useState(true)
    const [when, setWhen] = useState<When>('now')
    const [scheduledAt, setScheduledAt] = useState('')
    const [submitting, setSubmitting] = useState<Mode | null>(null)
    const [formError, setFormError] = useState('')
    const [titleError, setTitleError] = useState('')
    const [messageError, setMessageError] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)

    // Fill the form from the notice being edited or duplicated.
    useEffect(() => {
        setTitle(editing?.title ?? '')
        setMessage(editing?.message ?? '')
        setVisibleOn((editing?.visible_on as VisibleOn) ?? 'main_site')
        setCta1Label(editing?.cta_primary_label ?? '')
        setCta1Url(editing?.cta_primary_url ?? '')
        setCta2Label(editing?.cta_secondary_label ?? '')
        setCta2Url(editing?.cta_secondary_url ?? '')
        setShowSecond(!!(editing?.cta_secondary_label || editing?.cta_secondary_url))
        // Keep an existing schedule when editing a scheduled notice, so a quick text edit
        // does not silently drop the publish time.
        const isScheduled = editing?.status === 'scheduled' && !!editing?.scheduled_at
        setWhen(isScheduled ? 'later' : 'now')
        setScheduledAt(isScheduled ? toLocalDatetimeInput(editing!.scheduled_at!) : '')
        setFormError(''); setTitleError(''); setMessageError('')
    }, [editing])

    const draft = {
        title, message,
        cta_primary_label: cta1Label, cta_primary_url: cta1Url,
        cta_secondary_label: showSecond ? cta2Label : null,
        cta_secondary_url: showSecond ? cta2Url : null,
    }

    function resetForm() {
        setTitle(''); setMessage(''); setVisibleOn('main_site')
        setCta1Label(''); setCta1Url(''); setCta2Label(''); setCta2Url('')
        setShowSecond(false); setSendPush(true); setWhen('now'); setScheduledAt('')
        setFormError(''); setTitleError(''); setMessageError('')
    }

    // Run before the confirm step, so a missing field is flagged without opening a dialog.
    function validate(mode: Mode): boolean {
        setFormError(''); setTitleError(''); setMessageError('')
        let ok = true
        if (!title.trim()) { setTitleError('Add a title.'); ok = false }
        if (!message.trim()) { setMessageError('Write the message.'); ok = false }
        if (mode === 'schedule') {
            if (!scheduledAt) { setFormError('Pick the date and time to publish.'); ok = false }
            else if (new Date(scheduledAt).getTime() <= Date.now()) { setFormError('Pick a time in the future.'); ok = false }
        }
        return ok
    }

    async function submit(mode: Mode) {
        if (submitting) return
        setConfirmOpen(false)
        if (!validate(mode)) return

        const payload = {
            title: title.trim(),
            message: message.trim(),
            visibleOn,
            mode,
            scheduledAt: mode === 'schedule' ? new Date(scheduledAt).toISOString() : undefined,
            ctaPrimaryLabel: cta1Label.trim() || undefined,
            ctaPrimaryUrl: cta1Url.trim() || undefined,
            ctaSecondaryLabel: showSecond ? (cta2Label.trim() || undefined) : undefined,
            ctaSecondaryUrl: showSecond ? (cta2Url.trim() || undefined) : undefined,
            sendPush,
        }

        setSubmitting(mode)
        try {
            const url = isEditing ? `/api/admin/announcements/${editing!.id}` : '/api/admin/announcements'
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isEditing ? { action: 'update', ...payload } : payload),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) {
                setFormError(json.error || 'Could not save the announcement. Try again.')
                return
            }
            toast.success(
                mode === 'publish' ? 'The announcement is live'
                    : mode === 'schedule' ? 'Scheduled. It goes live at the time you chose'
                        : 'Draft saved'
            )
            resetForm()
            onSaved()
        } catch {
            setFormError('Could not reach the server. Check your connection and try again.')
        } finally {
            setSubmitting(null)
        }
    }

    const busy = !!submitting
    const wasLive = isEditing && editing?.status === 'published'

    return (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            {/* ── The form ── */}
            <form
                className="neu-raised space-y-6 rounded-[2rem] p-5 sm:p-7"
                // Enter inside a field must never publish. Going live is the button below, behind a confirm.
                onSubmit={e => e.preventDefault()}
            >
                {isEditing && (
                    <Notice tone="info">
                        You are editing an existing announcement.{' '}
                        <button type="button" onClick={() => { resetForm(); onCancelEdit() }} className={cn('rounded font-semibold underline underline-offset-4', FOCUS)}>
                            Start a new one instead
                        </button>
                    </Notice>
                )}
                {formError && <Notice>{formError}</Notice>}

                <div className="space-y-5">
                    <TextField
                        id="ann-title"
                        label="Title"
                        value={title}
                        onChange={v => { setTitle(v.slice(0, TITLE_MAX)); setTitleError('') }}
                        placeholder="Data prices have changed"
                        hint={`${title.length} of ${TITLE_MAX}`}
                        error={titleError}
                        required={false}
                    />
                    <TextAreaField
                        id="ann-message"
                        label="Message"
                        value={message}
                        onChange={v => { setMessage(v.slice(0, MESSAGE_MAX)); setMessageError('') }}
                        error={messageError}
                        placeholder="Say it plainly. Line breaks are kept."
                        rows={6}
                        maxLength={MESSAGE_MAX}
                    />
                </div>

                <div className="space-y-2">
                    <ChoiceGroup
                        legend="Who sees it"
                        name="ann-audience"
                        value={visibleOn}
                        onChange={setVisibleOn}
                        options={AUDIENCES}
                        columns="sm:grid-cols-3"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Only one notice shows per audience, so publishing this one switches off the current one.
                        {visibleOn !== 'main_site' && ' Shop owners’ own notices are switched off while it is live.'}
                    </p>
                </div>

                <div className="space-y-3">
                    <CtaFieldGroup index={1} label={cta1Label} url={cta1Url} onLabel={setCta1Label} onUrl={setCta1Url} savedButtons={savedButtons} />
                    {showSecond ? (
                        <div className="space-y-2">
                            <CtaFieldGroup index={2} label={cta2Label} url={cta2Url} onLabel={setCta2Label} onUrl={setCta2Url} savedButtons={savedButtons} />
                            <button
                                type="button"
                                onClick={() => { setShowSecond(false); setCta2Label(''); setCta2Url('') }}
                                className={cn('flex items-center gap-1.5 rounded text-sm font-semibold text-muted-foreground hover:text-foreground', FOCUS)}
                            >
                                <X className="h-4 w-4" aria-hidden="true" /> Remove the second button
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowSecond(true)}
                            className={cn('neu-raised-sm neu-press flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-foreground', FOCUS)}
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" /> Add a second button
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    <ChoiceGroup
                        legend="When it goes live"
                        name="ann-when"
                        value={when}
                        onChange={setWhen}
                        options={[
                            { value: 'now', label: 'Right away' },
                            { value: 'later', label: 'At a set time' },
                        ]}
                        columns="grid-cols-2"
                    />
                    {when === 'later' && (
                        <div className="space-y-2">
                            <Label htmlFor="ann-at" className="text-sm font-semibold text-foreground">Publish at</Label>
                            <div className="neu-inset rounded-xl">
                                <input
                                    id="ann-at"
                                    type="datetime-local"
                                    value={scheduledAt}
                                    onChange={e => setScheduledAt(e.target.value)}
                                    className="h-12 w-full rounded-xl border-0 bg-transparent px-4 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-brand-500"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Uses your device&rsquo;s time.</p>
                        </div>
                    )}

                    <div className="neu-inset flex items-center justify-between gap-4 rounded-2xl p-4">
                        <div className="min-w-0">
                            <Label htmlFor="ann-push" className="text-sm font-semibold text-foreground">Send a push notification</Label>
                            <p className="mt-0.5 text-xs text-muted-foreground">Sent when it goes live. Turn it off to show the popup only.</p>
                        </div>
                        <Switch id="ann-push" checked={sendPush} onCheckedChange={setSendPush} />
                    </div>
                </div>

                <div className="space-y-3 pt-1">
                    <ClayButton
                        type="button"
                        loading={submitting === 'publish' || submitting === 'schedule'}
                        disabled={busy}
                        onClick={() => {
                            if (when === 'later') { void submit('schedule'); return }
                            if (validate('publish')) setConfirmOpen(true)
                        }}
                    >
                        {when === 'later' ? 'Schedule it' : isEditing ? 'Save and publish' : 'Publish now'}
                    </ClayButton>
                    <button
                        type="button"
                        onClick={() => void submit('draft')}
                        disabled={busy}
                        className={cn('neu-raised-sm neu-press flex min-h-[3rem] w-full items-center justify-center rounded-full text-sm font-semibold text-foreground disabled:opacity-60', FOCUS)}
                    >
                        {submitting === 'draft' ? 'Saving…' : 'Save as a draft'}
                    </button>
                    {wasLive && <p className="text-center text-xs text-muted-foreground">Saving this live notice as a draft switches it off.</p>}
                </div>
            </form>

            {confirmOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape') setConfirmOpen(false) }}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} aria-hidden="true" />
                    <div role="alertdialog" aria-modal="true" aria-labelledby="ann-pub-title" aria-describedby="ann-pub-body" className="neu-raised relative w-full max-w-sm space-y-5 rounded-[2rem] bg-neu p-6">
                        <div>
                            <h3 id="ann-pub-title" className="font-display text-xl font-bold text-foreground">
                                Publish to {AUDIENCES.find(a => a.value === visibleOn)?.label.toLowerCase()} now?
                            </h3>
                            <p id="ann-pub-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                It goes live straight away{sendPush ? ' and a push notification is sent' : ''}. It also switches off the notice that is showing to the same people.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <ClayButton type="button" autoFocus onClick={() => void submit('publish')}>Publish now</ClayButton>
                            <button type="button" onClick={() => setConfirmOpen(false)} className={cn('neu-raised-sm neu-press flex min-h-[3rem] items-center justify-center rounded-full text-sm font-semibold text-foreground', FOCUS)}>
                                Not yet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── What people will see ── */}
            <div className="space-y-3 lg:sticky lg:top-24">
                <p className="text-sm font-semibold text-foreground">What people will see</p>
                <AnnouncementPreview draft={draft} />
            </div>
        </div>
    )
}
