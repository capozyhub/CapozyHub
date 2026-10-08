'use client'

import { useEffect, useState } from 'react'

/** A thin gold line at the top of the viewport that fills as you read down the page. */
export function ReadingProgress() {
    const [p, setP] = useState(0)

    useEffect(() => {
        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight
            setP(max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max)))
        }
        update()
        window.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [])

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
            <div className="clay-gold h-full origin-left rounded-r-full" style={{ transform: `scaleX(${p})` }} />
        </div>
    )
}
