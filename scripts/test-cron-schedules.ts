// Guard: every Vercel schedule in vercel.json points at a real cron route that exports GET
// and checks CRON_SECRET first. Also lists cron routes that are deliberately NOT scheduled,
// so a new route has to be classified instead of being forgotten.
import * as fs from 'fs'
import * as path from 'path'

// Routes held back on purpose (owner decision pending, see
// docs/security-audits/2026-11-25-money-db-residue-sweep.md "Crons").
const UNSCHEDULED = new Set([
    'delete-old-orders',       // hard-deletes every order older than 90 days
    'delete-old-complaints',   // deletes complaints after 30 days regardless of status
    'auto-complete-data',      // marks stuck data orders completed with no delivery proof
    'daily-greeting',          // daily marketing push to every subscriber
])

let failures = 0
const fail = (msg: string) => { console.error(`FAIL: ${msg}`); failures++ }
const pass = (msg: string) => console.log(`PASS: ${msg}`)

const root = path.join(__dirname, '..')
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))

if ((config as any).crons) fail('vercel.json must not also declare legacy "crons" (routes would run twice)')

const schedules: Record<string, any> = config.schedules ?? {}
const cronDir = path.join(root, 'app', 'api', 'cron')
const routes = fs.readdirSync(cronDir).filter((d) => fs.existsSync(path.join(cronDir, d, 'route.ts')))
const scheduledRoutes = new Set<string>()

for (const [name, s] of Object.entries(schedules)) {
    const m = /^\/api\/cron\/([a-z0-9-]+)$/.exec(s.path ?? '')
    if (!m) { fail(`${name}: path must be /api/cron/<route>`); continue }
    const route = m[1]
    scheduledRoutes.add(route)
    if (s.requestMethod !== 'GET') fail(`${name}: requestMethod must be GET (path schedules default to POST)`)
    const file = path.join(cronDir, route, 'route.ts')
    if (!fs.existsSync(file)) { fail(`${name}: ${file} does not exist`); continue }
    const src = fs.readFileSync(file, 'utf8')
    if (!/export (async function|const) GET\b/.test(src)) fail(`${name}: route does not export GET`)
    if (!src.includes('validateCronAuth(')) fail(`${name}: route does not call validateCronAuth`)
    if (UNSCHEDULED.has(route)) fail(`${name}: ${route} is on the UNSCHEDULED list`)
    // Hobby's minimum interval is 15 minutes (jitter is fixed at 15 there).
    const minute = String(s.schedule).split(' ')[0]
    if (minute === '*' || /^\*\/([1-9]|1[0-4])$/.test(minute)) fail(`${name}: runs more often than every 15 minutes`)
}
pass(`${Object.keys(schedules).length} schedules checked`)

for (const r of routes) {
    if (!scheduledRoutes.has(r) && !UNSCHEDULED.has(r)) fail(`cron route ${r} is neither scheduled nor on the UNSCHEDULED list`)
}
pass(`${routes.length} cron routes classified`)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll tests PASSED')
