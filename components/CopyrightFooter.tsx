'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

interface CopyrightFooterProps {
    variant?: 'platform' | 'shop'
    shopName?: string
    adminSettings?: Record<string, any>
    className?: string
}

export function CopyrightFooter({
    variant = 'platform',
    shopName,
    adminSettings = {},
    className
}: CopyrightFooterProps) {
    const currentYear = new Date().getFullYear()
    
    // Admin settings win; otherwise the platform name with the current year.
    const footerText = adminSettings?.footer_copyright_text || `${currentYear} ${BRAND.name}`
    const brandingText = adminSettings?.footer_branding_text || BRAND.name

    return (
        <footer className={cn(
            "w-full py-8 mt-auto flex flex-col items-center justify-center gap-2 px-4",
            "border-t border-border/60",
            className
        )}>
            <div className="flex flex-col items-center text-center gap-1">
                <p className="text-sm font-medium text-muted-foreground tracking-tight">
                    {variant === 'platform' ? (
                        <>© {footerText}. All rights reserved.</>
                    ) : (
                        <>© {currentYear} {shopName}. All rights reserved.</>
                    )}
                </p>
                {variant === 'shop' ? (
                    <p className="text-xs font-medium text-muted-foreground/70">
                        Powered by {brandingText}
                    </p>
                ) : (
                    <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                        <Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link>
                        <span>•</span>
                        <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link>
                    </div>
                )}
            </div>
            
        </footer>
    )
}
