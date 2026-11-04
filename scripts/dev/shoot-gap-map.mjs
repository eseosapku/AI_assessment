// Screenshot check for the Gap Map. Every /api/** call is stubbed, so no click can save a real result.
// node scripts/dev/shoot-gap-map.mjs <name> <width> <height> "<query>" [--dark] [--no-art] [--full]
//   [--fixture=<json>] [--before=<json>]   (a different API body; a gapRackBefore snapshot to seed)
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CHROME = 'C:/Users/Stephen/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
const BASE = process.env.GAP_MAP_BASE || 'http://localhost:3107'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const [name, w, h, query = ''] = args.filter((a) => !a.startsWith('--'))
const opt = (k) => flags.find((f) => f.startsWith(`--${k}=`))?.slice(k.length + 3)
const dark = flags.includes('--dark'), noArt = flags.includes('--no-art'), full = flags.includes('--full')

const fixture = JSON.parse(readFileSync(resolve(root, opt('fixture') || 'lib/studylab/rack.fixture.json'), 'utf8'))
const before = opt('before') ? readFileSync(resolve(root, opt('before')), 'utf8') : null
const arts = readdirSync(resolve(root, 'public/gap-art')).filter((f) => f.endsWith('.svg')).sort()
let n = 0
for (const b of fixture.data.textbooks) for (const t of b.topics || []) if (!String(t.name).startsWith('An unusually')) t.art = `/gap-art/${arts[(n++ * 37 + 5) % arts.length]}`

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: dark ? 'dark' : 'light' })
const calls = []
await ctx.addInitScript(({ dark, before }) => {
  localStorage.setItem('user', JSON.stringify({ id: 'shoot-user', name: 'Test Student', email: 'shoot@example.com', class: 'Form 3', country: 'RW', gender: 'female', role: 'student', profileComplete: true }))
  for (const id of ['home', 'gapmap', 'lesson', 'progress', 'recall']) localStorage.setItem(`ss-tour-seen-${id}`, '1')
  localStorage.setItem('ss-product-tour-seen', '1')
  localStorage.setItem('theme', dark ? 'dark' : 'light')
  if (before) sessionStorage.setItem('gapRackBefore', before)
}, { dark, before })
const page = await ctx.newPage()
const failedArt = []
page.on('response', (r) => { if (r.url().includes('/gap-art/') && r.status() >= 400) failedArt.push(r.url().slice(-60)) })
page.on('requestfailed', (r) => { if (process.env.DBG) console.error('REQFAIL', r.url(), r.failure()?.errorText) })
page.on('console', (m) => { if (process.env.DBG && m.type() === 'error') console.error('CONSOLE', m.text().slice(0, 200)) })
await page.route('**/api/**', (route) => {
  const req = route.request()
  if (req.method() !== 'GET') calls.push({ url: new URL(req.url()).pathname, body: req.postData() })
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
})
await page.route('**/api/studylab/gap-map*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }))
// The dev .env points figures at a CDN that has no gap-art yet, so serve the kept drawings from public/ whatever the host.
await page.route('**/gap-art/**', (route) => {
  if (noArt) return route.abort()
  const file = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop())
  try { return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(resolve(root, 'public/gap-art', file)) }) } catch { return route.fulfill({ status: 404, body: '' }) }
})

await page.goto(`${BASE}/studylab/gap-map${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
await page.waitForSelector('.ss-rack', { timeout: 180000 })
await page.waitForTimeout(1500)
if (flags.includes('--bottom')) { await page.evaluate(() => { const c = document.querySelector('[data-tour="gapmap-canvas"]'); c.scrollTop = c.scrollHeight; document.querySelectorAll('main').forEach((m) => { m.scrollTop = m.scrollHeight }) }); await page.waitForTimeout(400) }
mkdirSync(resolve(root, '.superpowers/gap-art/shots'), { recursive: true })
const file = resolve(root, `.superpowers/gap-art/shots/${name}.png`)
await page.screenshot({ path: file, fullPage: full })

const out = await page.evaluate(() => {
  const de = document.documentElement
  const r = (el) => el.getBoundingClientRect()
  const o = { overflow: de.scrollWidth - de.clientWidth, brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !/\.svg(\?|$)/.test(i.src)).length, images: document.images.length }
  const path = document.querySelector('.ss-rack-path'), sheet = document.querySelector('.ss-rack-sheet')
  if (path) {
    const p = r(path)
    const stops = [...document.querySelectorAll('.ss-rack-stop')]
    o.stops = stops.length
    o.stopsInFull = stops.filter((s) => { const b = r(s.querySelector('.ss-rack-plate')); return b.top >= p.top - 1 && b.bottom <= p.bottom + 1 }).length
    o.pathBottom = Math.round(p.bottom)
    const pl = stops[0] && stops[0].querySelector('.ss-rack-plate')
    if (pl) o.plateW = Math.round(r(pl).width)
    o.labelBreaks = stops.filter((s) => { const b = s.querySelector('.ss-rack-lb b'); if (!b) return false; const rg = document.createRange(); const words = b.textContent.split(/\s+/); let lines = new Set(); const t = b.firstChild; if (!t || t.nodeType !== 3) return false; let i = 0; for (const w of words) { rg.setStart(t, b.textContent.indexOf(w, i)); rg.setEnd(t, b.textContent.indexOf(w, i) + w.length); i = b.textContent.indexOf(w, i) + w.length; const rects = [...rg.getClientRects()]; if (new Set(rects.map((x) => Math.round(x.top))).size > 1) return true } return false }).length
  }
  if (sheet) {
    const s = r(sheet)
    o.sheetTop = Math.round(s.top)
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    if (nav && getComputedStyle(nav).display !== 'none') o.sheetAboveNav = Math.round(r(nav).top - s.bottom)
    if (path) o.sheetGap = Math.round(s.top - r(path).bottom)
    const kp = document.querySelector('.ss-rack-on-plate')
    if (kp) { o.kanaBottom = Math.round(r(kp).bottom); o.kanaAboveSheet = Math.round(s.top - r(kp).bottom) }
  }
  return o
})
out.failedArt = failedArt
out.calls = calls
out.file = file
if (process.env.DBG) out.dbg = await page.evaluate(() => { const c = document.querySelector('[data-tour="gapmap-canvas"]'); const q = [...document.querySelectorAll('.ss-rack-quiet p')].map(e => [e.textContent.slice(0,30), Math.round(e.getBoundingClientRect().bottom)]); let p = c, anc = []; while (p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowY !== 'visible') anc.push([p.tagName, p.className.toString().slice(0,40), s.overflowY, Math.round(p.getBoundingClientRect().bottom)]) } return { canvas: [Math.round(c.getBoundingClientRect().top), Math.round(c.getBoundingClientRect().bottom), c.scrollHeight, c.clientHeight], q, anc, win: [innerHeight, document.documentElement.scrollHeight] } })
console.log(JSON.stringify(out))
await browser.close()
