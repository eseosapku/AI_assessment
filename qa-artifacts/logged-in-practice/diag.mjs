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

const dir = path.join(OUT, 'chrome-profile-diag')
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
const consoleErrors = []
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)) })

function hit(selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { missing: true }
    const r = el.getBoundingClientRect()
    const x = Math.round(r.left + r.width / 2)
    const y = Math.round(r.top + Math.min(r.height / 2, 12))
    const stack = document.elementsFromPoint(x, y).slice(0, 5).map((node) => ({
      tag: node.tagName,
      text: (node.innerText || node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      href: node.getAttribute?.('href') || null,
    }))
    return { x, y, w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), stack }
  }, selector)
}

async function clickAndWatch(label, clicker) {
  const urls = [new URL(page.url()).pathname]
  await clicker()
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(400)
    const pathName = new URL(page.url()).pathname
    if (urls.at(-1) !== pathName) urls.push(pathName)
  }
  urls.push(new URL(page.url()).pathname)
  console.log(label, urls.join(' -> '))
  return urls
}

try {
  await page.goto(ORIGIN + '/practice', { waitUntil: 'domcontentloaded', timeout: 90000 })
  let skips = 0
  for (let i = 0; i < 16; i++) {
    skips = await page.getByRole('button', { name: 'Skip the tour' }).count()
    if (skips) break
    await page.waitForTimeout(500)
  }
  out.tour = await page.evaluate(() => ({
    dialogs: [...document.querySelectorAll('[role="dialog"]')].length,
    titles: [...document.querySelectorAll('[role="dialog"]')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70)),
  }))
  out.tour.skips = skips
  await page.screenshot({ path: path.join(OUT, 'diag-tours.png') })
  if (skips) {
    await page.getByRole('button', { name: 'Skip the tour' }).first().click()
    await page.waitForTimeout(400)
    out.tour.afterOneSkip = await page.locator('[role="dialog"]').count()
    if (await page.getByRole('button', { name: 'Skip the tour' }).count()) {
      await page.getByRole('button', { name: 'Skip the tour' }).first().click()
      await page.waitForTimeout(400)
    }
    out.tour.afterTwoSkips = await page.locator('[role="dialog"]').count()
  }
  console.log('tour', JSON.stringify(out.tour))

  await page.evaluate(() => {
    for (const id of ['home', 'practice', 'learnspace', 'gapmap', 'progress', 'recall']) localStorage.setItem('ss-tour-seen-' + id, '1')
  })

  await page.goto(ORIGIN + '/reports', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)
  out.reportsHit = await hit('nav[aria-label="Main"] a[href="/progress"]')
  out.reportsHomeHit = await hit('nav[aria-label="Main"] a[href="/dashboard"]')
  out.reportsProgress = await clickAndWatch('reports-progress', () => page.locator('nav[aria-label="Main"] a[href="/progress"]').first().click())
  if (new URL(page.url()).pathname === '/reports') {
    out.reportsHome = await clickAndWatch('reports-home', () => page.locator('nav[aria-label="Main"] a[href="/dashboard"]').first().click())
  }

  await page.goto(ORIGIN + '/recall/review', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)
  out.reviewHit = await hit('#main-content a[href="/recall"]')
  out.reviewBack = await clickAndWatch('review-back', () => page.locator('#main-content a[href="/recall"]').first().click())

  await page.goto(ORIGIN + '/progress', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2000)
  out.chips = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    if (!main) return null
    const mr = main.getBoundingClientRect()
    return {
      mainSW: main.scrollWidth,
      mainCW: main.clientWidth,
      docSW: document.documentElement.scrollWidth,
      chips: [...main.querySelectorAll('button')].map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50),
          past: r.right > mr.right + 1,
          clipped: el.scrollWidth > el.clientWidth + 6,
        }
      }).filter((c) => c.text && (c.past || c.clipped)).slice(0, 12),
    }
  })
  const study = page.locator('#main-content a[href^="/studylab"]').first()
  if (await study.count()) {
    out.study = await clickAndWatch('study', () => study.click())
  }
  await page.goto(ORIGIN + '/progress', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const m = document.getElementById('main-content'); if (m) m.scrollTop = m.scrollHeight })
  const review = page.locator('#main-content a[href^="/results/"]').first()
  if (await review.count()) out.result = await clickAndWatch('result', () => review.click({ position: { x: 28, y: 16 } }))

  await page.goto(ORIGIN + '/report-card', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(2500)
  out.report = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    if (!main) return null
    const clipped = [...main.querySelectorAll('span,button,p')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 24 && r.bottom > 0 && r.top < innerHeight && el.scrollWidth > el.clientWidth + 10 && (el.innerText || '').trim().length > 8
    }).slice(0, 10).map((el) => ({
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      sw: el.scrollWidth,
      cw: el.clientWidth,
      right: Math.round(el.getBoundingClientRect().right),
    }))
    return { mainSW: main.scrollWidth, mainCW: main.clientWidth, docSW: document.documentElement.scrollWidth, vw: innerWidth, clipped }
  })
} catch (err) {
  out.error = String(err).slice(0, 300)
  console.log('err', out.error)
} finally {
  out.consoleErrors = [...new Set(consoleErrors)].slice(0, 10)
  fs.writeFileSync(path.join(OUT, 'diag.json'), JSON.stringify(out, null, 2))
  await context.close().catch(() => {})
}
console.log('diag saved')
