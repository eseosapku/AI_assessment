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

const dir = path.join(OUT, 'chrome-profile-diag2')
fs.rmSync(dir, { recursive: true, force: true })
const context = await chromium.launchPersistentContext(dir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  args: ['--disable-extensions', '--no-first-run', '--window-size=1440,900'],
})
await context.addInitScript((json) => {
  try { if (location.hostname === 'localhost') localStorage.setItem('user', json) } catch { /* ignore */ }
}, JSON.stringify(data.user))
const page = context.pages()[0] || await context.newPage()
const out = {}

async function watch(label, click) {
  const seen = [new URL(page.url()).pathname]
  await click()
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400)
    const pathName = new URL(page.url()).pathname
    if (seen.at(-1) !== pathName) seen.push(pathName)
  }
  if (seen.at(-1) !== new URL(page.url()).pathname) seen.push(new URL(page.url()).pathname)
  console.log(label, seen.join(' -> '))
  return seen
}

function hit(selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { missing: true }
    const r = el.getBoundingClientRect()
    const x = Math.round(r.left + Math.min(Math.max(r.width / 2, 8), r.width - 4))
    const y = Math.round(r.top + Math.min(Math.max(r.height / 2, 6), r.height - 4))
    const stack = document.elementsFromPoint(x, y).slice(0, 6).map((node) => ({
      tag: node.tagName,
      id: node.id || '',
      text: (node.innerText || node.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      href: node.getAttribute?.('href') || null,
    }))
    return { x, y, w: Math.round(r.width), h: Math.round(r.height), stack }
  }, selector)
}

try {
  await page.goto(ORIGIN + '/practice', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('button', { name: 'Skip the tour' }).last().waitFor({ timeout: 15000 })
  out.dialogs = await page.locator('[role="dialog"]').count()
  await page.getByRole('button', { name: 'Skip the tour' }).last().click({ timeout: 8000 })
  await page.waitForTimeout(400)
  out.afterTopSkip = await page.locator('[role="dialog"]').count()
  if (await page.getByRole('button', { name: 'Skip the tour' }).count()) {
    await page.getByRole('button', { name: 'Skip the tour' }).last().click({ timeout: 8000 })
    await page.waitForTimeout(400)
  }
  out.afterSecondSkip = await page.locator('[role="dialog"]').count()
  console.log('skips', out.dialogs, out.afterTopSkip, out.afterSecondSkip)

  await page.goto(ORIGIN + '/reports', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  out.reportsHit = await hit('nav[aria-label="Main"] a[href="/progress"]')
  out.reportsProgress = await watch('reports-progress', () => page.locator('nav[aria-label="Main"] a[href="/progress"]').first().click())
  if (new URL(page.url()).pathname === '/reports') {
    out.reportsHome = await watch('reports-home', () => page.locator('nav[aria-label="Main"] a[href="/dashboard"]').first().click())
  }

  await page.goto(ORIGIN + '/recall/review', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  out.reviewHit = await hit('#main-content a[href="/recall"]')
  out.reviewBack = await watch('review-back', () => page.locator('#main-content a[href="/recall"]').first().click())

  await page.goto(ORIGIN + '/progress', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)
  const study = page.locator('#main-content a[href^="/studylab"]').first()
  out.studyCount = await study.count()
  if (out.studyCount) out.study = await watch('study', () => study.click())

  await page.goto(ORIGIN + '/progress', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const m = document.getElementById('main-content'); if (m) m.scrollTop = m.scrollHeight })
  await page.waitForTimeout(300)
  const result = page.locator('#main-content a[href^="/results/"]').first()
  out.resultCount = await result.count()
  if (out.resultCount) out.result = await watch('result', () => result.click({ position: { x: 28, y: 16 } }))

  await page.goto(ORIGIN + '/report-card', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('text=Report Card', { timeout: 20000 })
  await page.waitForTimeout(1000)
  out.report = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    const clipped = [...main.querySelectorAll('span,p,button,a')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 30 && r.height > 8 && r.top < innerHeight && r.bottom > 0 && el.scrollWidth > el.clientWidth + 12
    }).slice(0, 8).map((el) => ({
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70),
      sw: el.scrollWidth,
      cw: el.clientWidth,
      right: Math.round(el.getBoundingClientRect().right),
      vw: innerWidth,
    }))
    return { mainSW: main.scrollWidth, mainCW: main.clientWidth, docSW: document.documentElement.scrollWidth, vw: innerWidth, clipped }
  })
} catch (err) {
  out.error = String(err).slice(0, 400)
  console.log('err', out.error)
} finally {
  fs.writeFileSync(path.join(OUT, 'diag2.json'), JSON.stringify(out, null, 2))
  await context.close().catch(() => {})
}
console.log('diag2 saved')
