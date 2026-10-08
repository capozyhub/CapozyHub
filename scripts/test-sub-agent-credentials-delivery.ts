// scripts/test-sub-agent-credentials-delivery.ts
import { deliverSubAgentCredentials } from '../lib/sub-agent-credentials-delivery'

function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else { console.log('PASS:', msg) }
}

function fakeDeps() {
    const smsCalls: any[] = []
    const emailCalls: any[] = []
    return {
        deps: {
            sendSms: async (o: any) => { smsCalls.push(o); return { success: true } },
            sendEmail: async (o: any) => { emailCalls.push(o); return { success: true } },
        },
        smsCalls,
        emailCalls,
    }
}

async function testOnboardingIncludesDomain() {
    const { deps, smsCalls, emailCalls } = fakeDeps()
    const result = await deliverSubAgentCredentials(
        'onboarding',
        { phone: '0241234567', email: 'sub@example.com', firstName: 'Kofi' },
        'ABCD-EFGH-JKLM',
        deps,
    )
    assert(result.smsDelivered === true, 'onboarding: sms delivered')
    assert(result.emailDelivered === true, 'onboarding: email delivered')
    assert(smsCalls[0].message.includes('agent.kingflexygh.com'), 'onboarding sms includes login domain')
    assert(emailCalls[0].htmlContent.includes('agent.kingflexygh.com'), 'onboarding email includes login domain')
    assert(smsCalls[0].message.includes('ABCD-EFGH-JKLM'), 'onboarding sms includes the key')
    assert(!JSON.stringify(result).includes('ABCD-EFGH-JKLM'), 'plaintext key never in the returned result')
}

async function testResetOmitsDomainReminder() {
    const { deps, smsCalls } = fakeDeps()
    await deliverSubAgentCredentials(
        'reset',
        { phone: '0241234567', email: 'sub@example.com', firstName: 'Kofi' },
        'WXYZ-1234-5678',
        deps,
    )
    assert(smsCalls[0].message.includes('WXYZ-1234-5678'), 'reset sms includes the new key')
}

async function testMissingContactSkipsChannel() {
    const { deps, smsCalls, emailCalls } = fakeDeps()
    const result = await deliverSubAgentCredentials(
        'onboarding',
        { phone: null, email: 'sub@example.com', firstName: null },
        'ABCD-EFGH-JKLM',
        deps,
    )
    assert(result.smsDelivered === false, 'no phone on file -> sms not delivered')
    assert(result.emailDelivered === true, 'email still delivered')
    assert(smsCalls.length === 0, 'sendSms never called without a phone')
    assert(emailCalls.length === 1, 'sendEmail still called')
}

function captureConsoleErrors() {
    const original = console.error
    const calls: any[][] = []
    console.error = (...args: any[]) => { calls.push(args) }
    return { calls, restore: () => { console.error = original } }
}

async function testLogsMissingContactInfo() {
    const { calls, restore } = captureConsoleErrors()
    try {
        await deliverSubAgentCredentials(
            'reset',
            { phone: null, email: null, firstName: null },
            'ABCD-EFGH-JKLM',
            fakeDeps().deps,
        )
    } finally {
        restore()
    }
    const flat = calls.map((c) => c.join(' ')).join('\n')
    assert(/reset sms:.*no contact info on file/.test(flat), 'logs "no contact info" for missing phone (reset)')
    assert(/reset email:.*no contact info on file/.test(flat), 'logs "no contact info" for missing email (reset)')
    assert(!flat.includes('ABCD-EFGH-JKLM'), 'missing-contact-info log never includes the plaintext key')
}

async function testLogsResolvedFailureWithErrorDetail() {
    const { calls, restore } = captureConsoleErrors()
    const deps = {
        sendSms: async () => ({ success: false, error: 'provider down' }),
        sendEmail: async () => ({ success: true }),
    }
    try {
        await deliverSubAgentCredentials(
            'reset',
            { phone: '0241234567', email: 'sub@example.com', firstName: 'Kofi' },
            'ABCD-EFGH-JKLM',
            deps,
        )
    } finally {
        restore()
    }
    const flat = calls.map((c) => c.join(' ')).join('\n')
    assert(/reset sms delivery failed for 0241234567/.test(flat), 'logs resolved-false sms delivery with recipient')
    assert(flat.includes('provider down'), 'logs the resolved error detail')
    assert(!flat.includes('ABCD-EFGH-JKLM'), 'resolved-failure log never includes the plaintext key')
}

async function testLogsThrownRejection() {
    const { calls, restore } = captureConsoleErrors()
    const deps = {
        sendSms: async () => { throw new Error('network blew up') },
        sendEmail: async () => ({ success: true }),
    }
    let result: any
    try {
        result = await deliverSubAgentCredentials(
            'onboarding',
            { phone: '0241234567', email: 'sub@example.com', firstName: 'Kofi' },
            'ABCD-EFGH-JKLM',
            deps,
        )
    } finally {
        restore()
    }
    assert(result.smsDelivered === false, 'a thrown sendSms resolves to smsDelivered: false, never throws through')
    const flat = calls.map((c) => c.join(' ')).join('\n')
    assert(/onboarding sms delivery threw for 0241234567/.test(flat), 'logs the thrown/rejected case distinctly from a resolved failure')
    assert(flat.includes('network blew up'), 'logs the rejection reason')
}

async function main() {
    await testOnboardingIncludesDomain()
    await testResetOmitsDomainReminder()
    await testMissingContactSkipsChannel()
    await testLogsMissingContactInfo()
    await testLogsResolvedFailureWithErrorDetail()
    await testLogsThrownRejection()
    process.exit(process.exitCode || 0)
}

main()
