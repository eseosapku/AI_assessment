// Headless check for the Trail. Every /api/** call is stubbed; nothing real is read or written.
// node scripts/dev/shoot-trail.mjs <case> <width> <height> [--dark]
// cases: station | new | error | homework | old | montessori | short | long | norecipe
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CHROME = 'C:/Users/Stephen/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
const BASE = process.env.TRAIL_BASE || 'http://localhost:3107'
const args = process.argv.slice(2)
const dark = args.includes('--dark')
const [kase, w, h] = args.filter((a) => !a.startsWith('--'))
const out = resolve(root, '.superpowers/trail-shots')
mkdirSync(out, { recursive: true })

const step = (i, status = 'pending', over = {}) => ({ id: `s${i}`, title: `Station ${i + 1}: ${['Cells', 'Membranes', 'Osmosis', 'Diffusion', 'Transport'][i % 5]}`, goal: 'g', status, cardIds: [`c${i}`], ...over })
const card = (i) => ({ id: `c${i}`, type: 'concept', position: { x: i * 600, y: 0 }, source: 'lesson', data: { kind: 'concept', title: `Idea ${i + 1}`, body: 'A cell is the smallest unit of life. It has a membrane around it.', step: i } })
const stations = (n, statuses = []) => Array.from({ length: n }, (_, i) => step(i, statuses[i] ?? (i === 0 ? 'teaching' : 'pending')))
const run = (n, over = {}) => ({ phase: 'teaching', pace: 'step', recipe: 'station', currentStep: 0, beats: 0, awaiting: false, steps: stations(n), ...over })
const canvas = (n) => ({ nodes: Array.from({ length: n }, (_, i) => card(i)), edges: [], viewport: { x: 0, y: 0, zoom: 1 } })
const msgs = [{ role: 'user', content: 'Teach me about cells' }, { role: 'assistant', content: 'Let us start with the cell.' }]

const CASES = {
  station: { lesson_run: run(5), canvas_state: canvas(3), messages: msgs },
  new: { lesson_run: { phase: 'planning', pace: 'step', currentStep: -1, beats: 0, awaiting: false, steps: [] }, canvas_state: { nodes: [], edges: [] }, messages: [] },
  error: { lesson_run: { phase: 'planning', pace: 'step', currentStep: -1, beats: 0, awaiting: false, steps: [] }, canvas_state: { nodes: [], edges: [] }, messages: [] },
  homework: { lesson_run: run(4, { steps: stations(4).map((s) => ({ ...s, homework: { label: 'Q1', answer: null, rubric: null, attempt: null } })) }), canvas_state: canvas(3), messages: msgs, origin: 'homework' },
  old: { lesson_run: null, canvas_state: canvas(3), messages: msgs },
  montessori: { lesson_run: run(5, { mode: 'montessori' }), canvas_state: canvas(3), messages: msgs },
  short: { lesson_run: run(2), canvas_state: canvas(2), messages: msgs },
  long: { lesson_run: run(12), canvas_state: canvas(3), messages: msgs },
  norecipe: { lesson_run: run(5, { recipe: undefined, pace: 'run' }), canvas_state: canvas(3), messages: msgs },
}
const c = CASES[kase]
if (!c) throw new Error(`unknown case ${kase}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: dark ? 'dark' : 'light' })
await ctx.addInitScript(({ dark }) => {
  localStorage.setItem('user', JSON.stringify({ id: 'shoot-user', name: 'Test Student', email: 'shoot@example.com', class: 'Form 3', country: 'RW', gender: 'female', role: 'student', profileComplete: true }))
  for (const id of ['home', 'gapmap', 'lesson', 'progress', 'recall', 'learnspace', 'practice']) localStorage.setItem(`ss-tour-seen-${id}`, '1')
  localStorage.setItem('ss-product-tour-seen', '1')
  localStorage.setItem('ss-studylab-demo-seen', '1')
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}, { dark })
const page = await ctx.newPage()
const posts = []
const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`))
await page.route('**/api/**', (route) => {
  const req = route.request()
  const path = new URL(req.url()).pathname
  if (req.method() !== 'GET') posts.push({ path, body: req.postData() })
  if (path === '/api/studylab/shoot-lesson' && req.method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'shoot-lesson', title: 'How cells work', subject: 'Biology', current_step: 0, origin: c.origin ?? 'scratch', canvas_state: c.canvas_state }, lesson_run: c.lesson_run, messages: c.messages }) })
  }
  if (path === '/api/studylab/tutor' && req.method() === 'POST') {
    if (kase === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) })
    return new Promise(() => {}) // never answers: the opening stays as a first paint
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
})
await page.goto(`${BASE}/studylab/shoot-lesson`, { waitUntil: 'domcontentloaded', timeout: 180000 })
await page.waitForTimeout(kase === 'error' ? 6000 : 5000)
const text = await page.evaluate(() => document.body.innerText)
const report = {
  case: kase, size: `${w}x${h}`, dark,
  trail: await page.locator('.ss-trail').count() > 0,
  boardEmpty: /Your board is empty/i.test(text),
  inky: /\binky\b/i.test(text),
  tryAgain: await page.getByRole('button', { name: /try again/i }).count(),
  kana: await page.locator('svg').count() > 0,
}
if (kase === 'error') {
  const before = posts.filter((p) => p.path === '/api/studylab/tutor').length
  const btn = page.getByRole('button', { name: /try again/i }).first()
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(3000) }
  report.tutorPostsBefore = before
  report.tutorPostsAfter = posts.filter((p) => p.path === '/api/studylab/tutor').length
  report.errorMessageShown = /something went wrong|try again/i.test(await page.evaluate(() => document.body.innerText))
}
report.problems = problems
await page.screenshot({ path: resolve(out, `${kase}-${w}x${h}${dark ? '-dark' : ''}.png`) })
console.log(JSON.stringify(report))
await browser.close()
