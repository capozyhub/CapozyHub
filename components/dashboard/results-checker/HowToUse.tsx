import { ExternalLink } from 'lucide-react'
import { portalHost } from './meta'

/** Three plain steps for using a voucher, with a link straight to the right website. */
export function HowToUse({ typeName }: { typeName: string }) {
    const host = portalHost(typeName)
    return (
        <div className="neu-inset rounded-2xl p-4">
            <p className="text-sm font-semibold">How to check your results</p>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>1. Open {host ? <span className="font-medium text-foreground">{host}</span> : 'your exam board’s results website'}.</li>
                <li>2. Enter the serial number and PIN from your voucher.</li>
                <li>3. Add your index number and exam year, then submit.</li>
            </ol>
            {host && (
                <a
                    href={`https://${host}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Open {host} <ExternalLink className="h-3.5 w-3.5" />
                </a>
            )}
        </div>
    )
}