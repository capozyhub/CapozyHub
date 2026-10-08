import { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
    title: `Privacy Policy | ${BRAND.name}`,
    description: `What ${BRAND.name} collects, why, who it is shared with, and the choices you have.`,
}

const UPDATED = 'October 8, 2026'

const list = (items: string[]) => (
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {items.map((i) => <li key={i}>{i}</li>)}
    </ul>
)

// First-draft policy for launch: have it reviewed by a lawyer, and keep it in step with
// what the product really stores (see the users, wallets, orders and api_logs tables).
const SECTIONS: LegalSection[] = [
    {
        id: 'collect',
        title: 'What we collect',
        body: (
            <>
                <p>When you sign up we collect your name, email address and mobile number. As you use {BRAND.name} we also record:</p>
                {list([
                    'your orders, including the recipient numbers you enter',
                    'your wallet top-ups, spending and payouts',
                    'shop details, if you open a shop',
                    'technical data such as your IP address and device type, used to keep accounts secure and to limit abuse',
                ])}
                <p className="mt-3">Your mobile number is not verified with a code, so please keep it accurate.</p>
            </>
        ),
    },
    {
        id: 'use',
        title: 'How we use it',
        body: (
            <>
                <p>We use your information to:</p>
                {list([
                    'create your account and keep it secure',
                    'process and deliver your orders',
                    'run your wallet, shop, agent plan and sub-agent features',
                    'send emails about your account and orders, such as password resets and receipts',
                    'look into complaints, fraud and misuse',
                ])}
                <p className="mt-3">We do not use your data to sell you to advertisers.</p>
            </>
        ),
    },
    {
        id: 'sharing',
        title: 'Who we share it with',
        body: (
            <>
                <p>We do not sell your personal data. We share only what is needed with:</p>
                {list([
                    'mobile networks and our suppliers, to deliver the orders you place',
                    'Paystack, which processes card and Mobile Money payments and payouts',
                    'service providers that host our systems and send our emails',
                    'authorities, when the law requires it',
                ])}
            </>
        ),
    },
    {
        id: 'protection',
        title: 'How we protect it',
        body: (
            <p>
                Passwords are stored hashed, never in plain text, and connections to {BRAND.name} are encrypted. Card details go straight to Paystack and are never stored on our servers. No system is perfectly secure, so use a strong password and keep it to yourself.
            </p>
        ),
    },
    {
        id: 'cookies',
        title: 'Cookies and storage',
        body: (
            <p>
                We use cookies and similar browser storage to keep you signed in and to remember basic preferences such as light or dark mode. We do not use them to track you across other websites.
            </p>
        ),
    },
    {
        id: 'keeping',
        title: 'How long we keep it',
        body: (
            <p>
                We keep your account and order records for as long as your account is open, and afterwards for as long as we need them to settle disputes, prevent fraud and meet legal and accounting duties.
            </p>
        ),
    },
    {
        id: 'rights',
        title: 'Your choices',
        body: (
            <>
                <p>You can:</p>
                {list([
                    'see and update your name and mobile number from your profile',
                    'ask for a copy of the personal data we hold about you',
                    'ask us to correct it, or to delete your account',
                ])}
                <p className="mt-3">
                    We handle personal data in line with Ghana&apos;s Data Protection Act, 2012 (Act 843). To make a request, contact support using the details in your dashboard.
                </p>
            </>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: <p>If we change this policy we will update the date at the top of this page, and tell you about significant changes in your dashboard or by email.</p>,
    },
]

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            lead={`What ${BRAND.name} collects, why we collect it, and the choices you have.`}
            updated={UPDATED}
            otherPage={{ href: '/terms', label: 'Terms of Service' }}
            sections={SECTIONS}
        />
    )
}
