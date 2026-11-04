// Headless behaviour checks for the Gap Map. Every /api/** call is stubbed, so no click can save a real result.
// node scripts/dev/check-gap-map.mjs <scenario> [width height]
//   scenarios: bars | closed | other | flight | plates | teach | deeplink | scrollback | chevrons | phone
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CHROME = 'C:/Users/Stephen/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
const BASE = process.env.GAP_MAP_BASE || 'http://localhost:3107'
const [scenario, W = '1440', H = '900'] = process.argv.slice(2)
const shots = resolve(root, '.superpowers/gap-art/shots')
mkdirSync(shots, { recursive: true })

const base = JSON.parse(readFileSync(resolve(root, 'lib/studylab/rack.fixture.json'), 'utf8'))
const arts = readdirSync(resolve(root, 'public/gap-art')).filter((f) => f.endsWith('.svg')).sort()
const makeFixture = (mutate) => {
  const f = JSON.parse(JSON.stringify(base))
  let n = 0
  for (const b of f.data.textbooks) for (const t of b.topics || []) if (!String(t.name).startsWith('An unusually')) t.art = `/gap-art/${arts[(n++ * 37 + 5) % arts.length]}`
  f.data.unlinked_results = { count: 2, average: 40, last: null }
  mutate?.(f)
  return f
}

export async function open({ reduced = false, width = +W, height = +H, mutate, query = '', before = null, hover = true, init = null } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: !hover, isMobile: !hover })
  const state = { fixture: makeFixture(mutate), calls: [] }
  await ctx.addInitScript((before) => {
    if (!localStorage.getItem('user')) {
      localStorage.setItem('user', JSON.stringify({ id: 'shoot-user', name: 'Test Student', email: 'shoot@example.com', class: 'Form 3', country: 'RW', gender: 'female', role: 'student', profileComplete: true }))
      for (const id of ['home', 'gapmap', 'lesson', 'progress', 'recall']) localStorage.setItem(`ss-tour-seen-${id}`, '1')
      localStorage.setItem('ss-product-tour-seen', '1')
      localStorage.setItem('theme', 'light')
    }
    if (before && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('gapRackBefore', before); sessionStorage.setItem('seeded', '1') }
  }, before)
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  await page.route('**/api/**', (route) => {
    const req = route.request()
    if (req.method() !== 'GET') state.calls.push({ url: new URL(req.url()).pathname, method: req.method() })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/api/studylab/gap-map?*', (route) => route.fulfill({ status: state.fail ? 500 : 200, contentType: 'application/json', body: JSON.stringify(state.fail ? { error: 'Boom' } : state.fixture) }))
  await page.route('**/api/studylab/gap-map/lost-marks*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }))
  await page.route('**/api/studylab', (route) => route.request().method() === 'POST'
    ? (state.calls.push({ url: '/api/studylab', method: 'POST' }), route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'stub-space' } }) }))
    : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/gap-art/**', (route) => {
    const file = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop())
    try { return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(resolve(root, 'public/gap-art', file)) }) } catch { return route.fulfill({ status: 404, body: '' }) }
  })
  await page.goto(`${BASE}/studylab/gap-map${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForSelector('.ss-rack', { timeout: 180000 })
  await page.waitForTimeout(1500)
  return { browser, ctx, page, state }
}

export const visibleBars = () => [...document.querySelectorAll('*')].concat([document.documentElement]).filter((el) => {
  const cs = getComputedStyle(el)
  const oy = cs.overflowY
  if (!(oy === 'auto' || oy === 'scroll')) return false
  if (el.scrollHeight <= el.clientHeight) return false
  if (cs.display === 'none') return false
  // headless Chrome draws overlay bars, so ask whether a bar would be drawn: not hidden by scrollbar-width or ::-webkit-scrollbar
  if (cs.scrollbarWidth === 'none') return false
  if (getComputedStyle(el, '::-webkit-scrollbar').display === 'none') return false
  return true
}).map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`)

const log = (...a) => console.log(...a)

export { log, resolve, shots }
