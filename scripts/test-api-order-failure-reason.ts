import { categorizeFailure, autoRefundApiOrderOnFailure } from '../lib/api-order-failure'

let failures = 0
function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('FAIL:', msg); failures++ }
    else console.log('PASS:', msg)
}

async function main() {
    // categorizeFailure
    assert(categorizeFailure('permanent_failure').code === 'invalid_request', 'permanent_failure -> invalid_request')
    assert(categorizeFailure('failed').code === 'provider_rejected', 'failed -> provider_rejected')
    assert(categorizeFailure('status_check_failed').code === 'provider_rejected', 'status_check_failed -> provider_rejected')
    assert(categorizeFailure('permanent_failure').message === 'The request was rejected as invalid (e.g. unsupported destination or amount).', 'invalid_request message matches')
    assert(categorizeFailure('failed').message === 'The transaction could not be completed by the payment provider.', 'provider_rejected message matches')

    // autoRefundApiOrderOnFailure -- source gating, no live DB needed
    const throwingSupabase = { rpc: () => { throw new Error('rpc must not be called for a non-api source') } }
    const resultWeb = await autoRefundApiOrderOnFailure(throwingSupabase as any, {
        product: 'airtime', orderId: 'fake-id', source: 'web', reasonCode: 'provider_rejected', reasonMessage: 'x',
    })
    assert(resultWeb.refunded === false, 'source=web never calls rpc, returns refunded:false')

    const resultShop = await autoRefundApiOrderOnFailure(throwingSupabase as any, {
        product: 'utilities', orderId: 'fake-id', source: 'shop', reasonCode: 'provider_rejected', reasonMessage: 'x',
    })
    assert(resultShop.refunded === false, 'source=shop never calls rpc, returns refunded:false')

    const resultNull = await autoRefundApiOrderOnFailure(throwingSupabase as any, {
        product: 'airtime', orderId: 'fake-id', source: null, reasonCode: 'provider_rejected', reasonMessage: 'x',
    })
    assert(resultNull.refunded === false, 'source=null never calls rpc, returns refunded:false')

    if (failures > 0) {
        console.error(`${failures} failure(s).`)
        process.exit(1)
    }
    console.log('All api-order-failure-reason tests passed.')
}

main()
