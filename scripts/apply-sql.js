#!/usr/bin/env node
/**
 * Apply one or more SQL files to a Postgres database, each inside a single
 * transaction (all or nothing).
 *
 *   node scripts/apply-sql.js supabase/migrations/00000000000000_baseline.sql supabase/migrations/00000000000001_auth_bootstrap.sql
 *
 * The connection string is read from the CAPOZY_DB_URL environment variable, or from
 * a line `CAPOZY_DB_URL=...` in .env.db at the repo root (gitignored via `.env*`).
 * It is never printed. Requires the `pg` package (npm i --no-save pg).
 *
 * Refuses to run against the old KiNG FLEXY production project.
 */
const fs = require('fs')
const path = require('path')

const OLD_PROD_REF = 'ubvjtacdmwynqcxuposj'

function loadUrl() {
    if (process.env.CAPOZY_DB_URL) return process.env.CAPOZY_DB_URL.trim()
    const file = path.join(__dirname, '..', '.env.db')
    if (!fs.existsSync(file)) return ''
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*CAPOZY_DB_URL\s*=\s*(.*)\s*$/)
        if (m) return m[1].replace(/^["']|["']$/g, '').trim()
    }
    return ''
}

async function main() {
    const files = process.argv.slice(2)
    if (!files.length) {
        console.error('usage: node scripts/apply-sql.js <file.sql> [more.sql ...]')
        process.exit(2)
    }
    const url = loadUrl()
    if (!url) {
        console.error('CAPOZY_DB_URL is not set (env var or .env.db).')
        process.exit(2)
    }
    if (url.includes(OLD_PROD_REF)) {
        console.error('Refusing to run: connection string points at the old KiNG FLEXY production project.')
        process.exit(3)
    }

    const { Client } = require('pg')
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
        const who = await client.query('select current_database() as db, current_user as usr')
        const existing = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'")
        console.log(`connected: db=${who.rows[0].db} user=${who.rows[0].usr}, existing public tables=${existing.rows[0].n}`)

        const available = new Set((await client.query('select name from pg_available_extensions')).rows.map((r) => r.name))

        for (const f of files) {
            let sql = fs.readFileSync(f, 'utf8')
            // Skip extensions this project cannot provide (e.g. hypopg / index_advisor are dev tools only).
            sql = sql.replace(/^CREATE EXTENSION IF NOT EXISTS "([^"]+)"[^;]*;\s*$/gm, (line, name) => {
                if (available.has(name)) return line
                console.log(`  skipping unavailable extension: ${name}`)
                return `-- skipped (unavailable): ${name}`
            })
            console.log(`applying ${f} (${Math.round(sql.length / 1024)} KB) ...`)
            await client.query('BEGIN')
            try {
                await client.query(sql)
                await client.query('COMMIT')
                console.log('  ok')
            } catch (e) {
                await client.query('ROLLBACK')
                console.error(`  FAILED and rolled back: ${e.message}`)
                if (e.position) {
                    const pos = parseInt(e.position, 10)
                    const line = sql.slice(0, pos).split('\n').length
                    console.error(`  near line ${line} of ${f}`)
                }
                process.exit(1)
            }
        }
        const after = await client.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'")
        console.log(`done: public tables=${after.rows[0].n}`)
    } finally {
        await client.end()
    }
}

main().catch((e) => {
    console.error(e.message)
    process.exit(1)
})
