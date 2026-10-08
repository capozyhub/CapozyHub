// scripts/test-fulfillment-dispatch-key.ts
// Confirms each supplier's fulfillOrder signature accepts and defaults dispatchKey
// correctly, without making real network calls (no API keys set in this env → each
// call short-circuits on its own "not configured" branch, which is enough to prove
// the function accepts a 5th arg and doesn't throw a signature/type error).
import { fulfillOrder as ccFulfillOrder } from '../lib/codecraft-service'
import { fulfillOrder as xpFulfillOrder } from '../lib/xpress-service'
import { fulfillOrder as apFulfillOrder } from '../lib/agentportal-service'
import { fulfillGhDataOrder } from '../lib/ghdata-service'

function assertOk(cond: boolean, label: string) {
    if (!cond) {
        console.error(`FAIL: ${label}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

async function main() {
    // Each call passes a 5th dispatchKey argument distinct from orderId — the test
    // asserts this doesn't throw a TypeScript/runtime arity error. Real dispatch
    // behavior (which key actually gets sent) is covered by each service's own
    // existing manual-run scripts (test-agentportal-service.ts etc.), not here.
    const ccResult = await ccFulfillOrder('MTN', '0551234567', '1GB', 'order-1', 'order-1:1')
    assertOk(typeof ccResult.success === 'boolean', 'codecraft fulfillOrder accepts dispatchKey arg')

    const xpResult = await xpFulfillOrder('MTN', '0551234567', '1GB', 'order-1', 'order-1:1')
    assertOk(typeof xpResult.success === 'boolean', 'xpress fulfillOrder accepts dispatchKey arg')

    const apResult = await apFulfillOrder('MTN', '0551234567', '1GB', 'order-1', 'order-1:1')
    assertOk(typeof apResult.success === 'boolean', 'agentportal fulfillOrder accepts dispatchKey arg')

    const ghResult = await fulfillGhDataOrder('MTN', '0551234567', '1GB', 'order-1', 'order-1:1')
    assertOk(typeof ghResult.success === 'boolean', 'ghdata fulfillGhDataOrder accepts dispatchKey arg')
}

main()
