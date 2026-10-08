/**
 * Regenerates every logo/icon derived from the master logo.
 *
 *   node scripts/generate-brand-assets.js
 *
 * Master:  brand/capozy-logo-source.jpg  (square, mark on a pure-black background)
 * Needs:   sharp (installed with Next.js; `npm i -D sharp` if it is missing)
 *
 * Why padding: the in-app BrandLogo crops the logo into a circle and the PWA
 * manifest marks icons "maskable" (safe zone = centred circle of 80% diameter).
 * The mark's farthest point from centre is ~0.51 of the image width, so it is
 * scaled to 0.78 for those assets (0.78 * 0.51 ~= 0.40, exactly the safe radius).
 * Favicons are not masked and are tiny, so they use a larger mark (0.92).
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'brand', 'capozy-logo-source.jpg')
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 }

const PNG_OPTS = { compressionLevel: 9, effort: 10, palette: true, quality: 95, dither: 1.0 }

/** Mark scaled to `scale` of the canvas, centred on solid black. */
async function render(size, scale) {
    const inner = Math.round(size * scale)
    const pad = size - inner
    const before = Math.floor(pad / 2)
    const after = pad - before
    return sharp(SOURCE)
        .resize(inner, inner, { kernel: 'lanczos3' })
        .extend({ top: before, bottom: after, left: before, right: after, background: BLACK })
        .flatten({ background: BLACK })
}

/** Multi-size .ico built from embedded PNGs (supported by every current browser). */
function buildIco(pngs) {
    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0) // reserved
    header.writeUInt16LE(1, 2) // type: icon
    header.writeUInt16LE(pngs.length, 4)
    const entries = []
    let offset = 6 + 16 * pngs.length
    for (const { size, data } of pngs) {
        const e = Buffer.alloc(16)
        e.writeUInt8(size >= 256 ? 0 : size, 0)
        e.writeUInt8(size >= 256 ? 0 : size, 1)
        e.writeUInt8(0, 2) // palette
        e.writeUInt8(0, 3) // reserved
        e.writeUInt16LE(1, 4) // colour planes
        e.writeUInt16LE(32, 6) // bits per pixel
        e.writeUInt32LE(data.length, 8)
        e.writeUInt32LE(offset, 12)
        offset += data.length
        entries.push(e)
    }
    return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)])
}

async function writePng(rel, size, scale) {
    const dest = path.join(ROOT, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    await (await render(size, scale)).png(PNG_OPTS).toFile(dest)
    console.log(`${rel.padEnd(36)} ${size}x${size}  ${(fs.statSync(dest).size / 1024).toFixed(1)} KB`)
}

async function main() {
    if (!fs.existsSync(SOURCE)) throw new Error(`Master logo not found: ${SOURCE}`)

    // In-app logo, PWA / push icons, Apple icons (padded: circle crop + maskable safe zone)
    await writePng('public/logo.png', 512, 0.78)
    await writePng('public/icons/icon-192x192.png', 192, 0.78)
    await writePng('public/icons/icon-512x512.png', 512, 0.78)
    await writePng('public/icons/apple-touch-icon.png', 180, 0.78)
    await writePng('app/apple-icon.png', 180, 0.78)

    // Browser-tab icon (not masked, shown tiny: larger mark)
    await writePng('app/icon.png', 512, 0.92)

    const icoSizes = [16, 32, 48]
    const pngs = []
    for (const size of icoSizes) {
        const data = await (await render(size, 0.92)).png({ compressionLevel: 9 }).toBuffer()
        pngs.push({ size, data })
    }
    const ico = buildIco(pngs)
    fs.writeFileSync(path.join(ROOT, 'app', 'favicon.ico'), ico)
    console.log(`${'app/favicon.ico'.padEnd(36)} ${icoSizes.join('/')}  ${(ico.length / 1024).toFixed(1)} KB`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
