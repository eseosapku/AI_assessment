import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-practice'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const IDENTIFIER = process.env.QA_IDENTIFIER || ''
const PASSWORD = process.env.QA_PASSWORD || ''
if (!IDENTIFIER || !PASSWORD) process.exit(1)
const res = await fetch(ORIGIN + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: IDENTIFIER, password: PASSWORD }),
})
const data = await res.json()
if (!data?.user?.id) process.exit(1)

const dir = path.join(OUT, 'chrome-profile-probe')
fs.rmSync(dir, { recursive: true, force: true })
const context = await chromium.launchPersistentContext(dir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  args: ['--disable-extensions', '--no-first-run', '--window-size=1440,900'],
})
await context.addInitScript((json) => {
  try {
    if (location.hostname === 'localhost') {
      localStorage.setItem('user', json)
      for (const id of ['home', 'practice', 'learnspace', 'gapmap', 'progress', 'recall']) {
        localStorage.setItem('ss-tour-seen-' + id, '1')
      }
    }
  } catch { /* ignore */ }
}, JSON.stringify(data.user))
const page = context.pages()[0] || await context.newPage()
const out = { console: [], requests: [] }
page.on('console', (msg) => { if (msg.type() === 'error') out.console.push(msg.text().slice(0, 240)) })
page.on('pageerror', (err) => out.console.push('pageerror ' + String(err.message || err).slice(0, 240)))
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('/progress') || url.includes('/recall') || url.includes('/studylab') || url.includes('/results/')) {
    out.requests.push(req.method() + ' ' + url.replace(ORIGIN, '').slice(0, 120))
  }
})

try {
  await page.goto(ORIGIN + '/reports', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1000)
  const before = out.requests.length
  await page.locator('nav[aria-label="Main"] a[href="/progress"]').first().click()
  await page.waitForTimeout(2500)
  out.progressClick = { url: new URL(page.url()).pathname, newRequests: out.requests.slice(before) }

  await page.goto(ORIGIN + '/recall/review', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('link', { name: 'Recall' }).first().waitFor({ timeout: 20000 })
  out.recallLink = await page.evaluate(() => {
    const el = document.querySelector('#main-content a[href="/recall"]')
    if (!el) return { missing: true }
    const cs = getComputedStyle(el)
    return {
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      pointer: cs.pointerEvents,
      href: el.getAttribute('href'),
    }
  })
  const mark = out.requests.length
  await page.getByRole('link', { name: 'Recall' }).first().click()
  await page.waitForTimeout(2500)
  out.recallClick = { url: new URL(page.url()).pathname, newRequests: out.requests.slice(mark) }

  await page.goto(ORIGIN + '/progress', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('link', { name: 'Study this' }).first().waitFor({ timeout: 20000 })
  const mark2 = out.requests.length
  await page.getByRole('link', { name: 'Study this' }).first().click()
  await page.waitForTimeout(2500)
  out.study = { url: new URL(page.url()).pathname, newRequests: out.requests.slice(mark2) }
  await page.goto(ORIGIN + '/progress', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('#main-content a[href^="/results/"]').first().waitFor({ timeout: 20000 })
  await page.evaluate(() => { const m = document.getElementById('main-content'); if (m) m.scrollTop = m.scrollHeight })
  const mark3 = out.requests.length
  await page.locator('#main-content a[href^="/results/"]').first().click({ position: { x: 24, y: 16 } })
  await page.waitForTimeout(2500)
  out.result = { url: new URL(page.url()).pathname, newRequests: out.requests.slice(mark3) }
} catch (err) {
  out.error = String(err).slice(0, 400)
} finally {
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(out, null, 2))
  await context.close().catch(() => {})
}
console.log(JSON.stringify({
  progress: out.progressClick,
  recall: out.recallClick,
  recallLink: out.recallLink,
  study: out.study,
  result: out.result,
  error: out.error,
  console: out.console,
}, null, 2))
