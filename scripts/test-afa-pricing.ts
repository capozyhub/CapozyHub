// scripts/test-afa-pricing.ts
import { resolveAfaPrice } from '../lib/afa-pricing'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
        console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

const ALL_SET = { afa_price_customer: '14', afa_price_agent: '13.5', afa_price_dealer: '13' }

// dealer with all three set -> dealer price
assertEqual(resolveAfaPrice(ALL_SET, 'dealer'), 13, 'dealer with all three set -> dealer price')

// agent with all three set -> agent price
assertEqual(resolveAfaPrice(ALL_SET, 'agent'), 13.5, 'agent with all three set -> agent price')

// customer/undefined/null/unknown role -> customer price
assertEqual(resolveAfaPrice(ALL_SET, 'customer'), 14, 'customer role -> customer price')
assertEqual(resolveAfaPrice(ALL_SET, undefined), 14, 'undefined role -> customer price')
assertEqual(resolveAfaPrice(ALL_SET, null), 14, 'null role -> customer price')
assertEqual(resolveAfaPrice(ALL_SET, 'sub_dealer'), 14, 'unknown role -> customer price')

// dealer with afa_price_dealer missing -> customer price (not free, not null)
{
    const settings = { afa_price_customer: '14', afa_price_agent: '13.5' }
    assertEqual(resolveAfaPrice(settings, 'dealer'), 14, 'dealer with afa_price_dealer missing -> customer price')
}

// dealer with afa_price_dealer = '0' -> customer price (zero is invalid, not free)
{
    const settings = { afa_price_customer: '14', afa_price_agent: '13.5', afa_price_dealer: '0' }
    assertEqual(resolveAfaPrice(settings, 'dealer'), 14, "dealer with afa_price_dealer = '0' -> customer price")
}

// dealer with afa_price_dealer = '' -> customer price
{
    const settings = { afa_price_customer: '14', afa_price_agent: '13.5', afa_price_dealer: '' }
    assertEqual(resolveAfaPrice(settings, 'dealer'), 14, "dealer with afa_price_dealer = '' -> customer price")
}

// agent with afa_price_agent missing -> customer price
{
    const settings = { afa_price_customer: '14', afa_price_dealer: '13' }
    assertEqual(resolveAfaPrice(settings, 'agent'), 14, 'agent with afa_price_agent missing -> customer price')
}

// all missing -> null
{
    assertEqual(resolveAfaPrice({}, 'dealer'), null, 'all missing -> null (dealer)')
    assertEqual(resolveAfaPrice({}, 'agent'), null, 'all missing -> null (agent)')
    assertEqual(resolveAfaPrice({}, 'customer'), null, 'all missing -> null (customer)')
}

// values arriving as numbers rather than strings still resolve (jsonb can yield either)
{
    const settings = { afa_price_customer: 14, afa_price_agent: 13.5, afa_price_dealer: 13 }
    assertEqual(resolveAfaPrice(settings, 'dealer'), 13, 'numeric dealer value resolves')
    assertEqual(resolveAfaPrice(settings, 'agent'), 13.5, 'numeric agent value resolves')
    assertEqual(resolveAfaPrice(settings, 'customer'), 14, 'numeric customer value resolves')
}

// the live-shaped case: {customer:'14', agent:'13.5', dealer:'13'} -> dealer 13, agent 13.5, customer 14
{
    const live = { afa_price_customer: '14', afa_price_agent: '13.5', afa_price_dealer: '13' }
    assertEqual(resolveAfaPrice(live, 'dealer'), 13, 'live-shaped: dealer gets 13')
    assertEqual(resolveAfaPrice(live, 'agent'), 13.5, 'live-shaped: agent gets 13.5')
    assertEqual(resolveAfaPrice(live, 'customer'), 14, 'live-shaped: customer gets 14')
}

// dealer price present but negative -> invalid, falls back to customer
{
    const settings = { afa_price_customer: '14', afa_price_dealer: '-5' }
    assertEqual(resolveAfaPrice(settings, 'dealer'), 14, 'negative dealer price -> customer price')
}

// dealer price non-numeric string -> invalid, falls back to customer
{
    const settings = { afa_price_customer: '14', afa_price_dealer: 'abc' }
    assertEqual(resolveAfaPrice(settings, 'dealer'), 14, 'non-numeric dealer price -> customer price')
}

console.log(process.exitCode ? '\nSome tests FAILED' : '\nAll tests PASSED')
