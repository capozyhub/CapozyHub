'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }).catch(() => { /* clipboard blocked: nothing to confirm */ })
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="neu-night flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white transition-colors hover:text-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
            {copied ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> Copied</> : <><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy</>}
        </button>
    )
}
