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
if (!res.ok || !data?.user?.id) {
  console.error('login failed', res.status)
  process.exit(1)
}

const dir = path.join(OUT, 'chrome-profile-retest')
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
    if (location.hostname === 'localhost') localStorage.setItem('user', json)
  } catch { /* ignore */ }
}, JSON.stringify(data.user))
const page = context.pages()[0] || await context.newPage()
const out = {}

async function go(urlPath) {
  await page.goto(ORIGIN + urlPath, { waitUntil: 'domcontentloaded', timeout: 90000 })
}

try {
  await go('/practice')
  await page.waitForTimeout(2500)
  const tours = await page.evaluate(() => ({
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    skips: [...document.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === 'Skip the tour').length,
  }))
  out.toursBefore = tours
  await page.screenshot({ path: path.join(OUT, 'retest-tours.png') })
  const skip = page.getByRole('button', { name: 'Skip the tour' })
  if (await skip.count()) {
    await skip.first().click()
    await page.waitForTimeout(400)
  }
  out.toursAfterOneSkip = await page.locator('[role="dialog"]').count()
  if (await skip.count()) {
    await skip.first().click()
    await page.waitForTimeout(400)
  }
  out.toursAfterTwoSkips = await page.locator('[role="dialog"]').count()

  await page.evaluate(() => {
    for (const id of ['home', 'practice', 'learnspace', 'gapmap', 'progress', 'recall']) {
      localStorage.setItem('ss-tour-seen-' + id, '1')
    }
  })

  await go('/recall')
  const recallSamples = []
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(4000)
    const sample = await page.evaluate(async () => {
      const user = JSON.parse(localStorage.getItem('user'))
      const text = (document.body.innerText || '').replace(/\s+/g, ' ')
      const spinning = [...document.querySelectorAll('.animate-spin')].some((el) => el.getBoundingClientRect().width >= 16)
      let summary = null
      let dueCount = null
      try {
        const s = await fetch('/api/recall/summary?user_id=' + encodeURIComponent(user.id))
        const sj = await s.json()
        summary = { status: s.status, due: sj?.due_today ?? null, total: sj?.total_cards ?? null, decks: Array.isArray(sj?.decks) ? sj.decks.length : null }
      } catch (err) {
        summary = { error: String(err).slice(0, 80) }
      }
      try {
        const d = await fetch('/api/recall/due?user_id=' + encodeURIComponent(user.id))
        const dj = await d.json()
        dueCount = { status: d.status, cards: Array.isArray(dj?.cards) ? dj.cards.length : null }
      } catch (err) {
        dueCount = { error: String(err).slice(0, 80) }
      }
      const hero = text.match(/DUE TODAY.{0,80}/)?.[0] || ''
      return { spinning, hero, hasReviewLink: !!document.querySelector('a[href="/recall/review"]'), summary, dueCount }
    })
    recallSamples.push({ t: (i + 1) * 4, ...sample })
    console.log('recall', JSON.stringify(recallSamples.at(-1)))
    if (!sample.spinning && sample.summary && sample.summary.due != null && sample.hero && !/—/.test(sample.hero)) break
  }
  out.recallSamples = recallSamples
  await page.screenshot({ path: path.join(OUT, 'retest-recall.png') })

  await go('/recall/review')
  await page.waitForTimeout(1500)
  const before = page.url()
  const back = page.locator('#main-content a[href="/recall"]').first()
  out.reviewBack = { visible: await back.isVisible().catch(() => false), count: await back.count() }
  if (out.reviewBack.visible) {
    await back.click()
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500)
      if (new URL(page.url()).pathname === '/recall') break
    }
  }
  out.reviewBack.after = new URL(page.url()).pathname
  out.reviewBack.before = new URL(before).pathname
  console.log('back', out.reviewBack.before, '->', out.reviewBack.after)

  async function sidebar(from, href, expectPath) {
    await go(from)
    await page.waitForSelector('nav[aria-label="Main"] a[href="' + href + '"]', { timeout: 20000 })
    await page.waitForTimeout(1500)
    const link = page.locator('nav[aria-label="Main"] a[href="' + href + '"]').first()
    const meta = await link.evaluate((el) => ({ text: el.innerText.trim(), href: el.getAttribute('href') }))
    await link.click()
    let actual = new URL(page.url()).pathname
    for (let i = 0; i < 16 && actual !== expectPath; i++) {
      await page.waitForTimeout(500)
      actual = new URL(page.url()).pathname
    }
    console.log('sidebar', from, meta.text, '->', actual)
    return { from, meta, actual, pass: actual === expectPath }
  }
  out.sidebarReportCard = await sidebar('/report-card', '/practice', '/practice')
  out.sidebarReports = await sidebar('/reports', '/progress', '/progress')

  await go('/progress')
  await page.waitForTimeout(2000)
  out.progressOverflow = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    const mr = main.getBoundingClientRect()
    const chips = [...main.querySelectorAll('button')].map((el) => {
      const r = el.getBoundingClientRect()
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        right: Math.round(r.right),
        mainRight: Math.round(mr.right),
        past: r.right > mr.right + 1,
        clipped: el.scrollWidth > el.clientWidth + 4,
      }
    }).filter((c) => c.text)
    return {
      mainScrollWidth: main.scrollWidth,
      mainClient: main.clientWidth,
      doc: document.documentElement.scrollWidth,
      vw: innerWidth,
      chips: chips.slice(0, 20),
    }
  })
  const study = page.locator('#main-content a[href^="/studylab"]').first()
  if (await study.count()) {
    await study.click()
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500)
      if (new URL(page.url()).pathname.startsWith('/studylab')) break
    }
    out.studyThis = new URL(page.url()).pathname
    console.log('study', out.studyThis)
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  } else out.studyThis = 'missing'

  await go('/progress')
  await page.waitForTimeout(1500)
  await page.evaluate(() => { document.getElementById('main-content').scrollTop = document.getElementById('main-content').scrollHeight })
  await page.waitForTimeout(400)
  const review = page.locator('#main-content a[href^="/results/"]').first()
  if (await review.count()) {
    await review.click({ position: { x: 30, y: 18 } })
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500)
      if (new URL(page.url()).pathname.startsWith('/results/')) break
    }
    out.reviewResult = new URL(page.url()).pathname
    console.log('result', out.reviewResult)
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  } else out.reviewResult = 'missing'

  await go('/report-card')
  await page.waitForTimeout(2500)
  out.reportCardBox = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    const grid = [...main.querySelectorAll('.grid')].map((el) => {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), right: Math.round(r.right), sw: el.scrollWidth, cw: el.clientWidth, left: Math.round(r.left) }
    }).slice(0, 6)
    const clippedNames = [...main.querySelectorAll('span,p,button')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 20 && el.scrollWidth > el.clientWidth + 8 && (el.innerText || '').length > 12
    }).slice(0, 8).map((el) => ({
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70),
      sw: el.scrollWidth,
      cw: el.clientWidth,
    }))
    return {
      mainSW: main.scrollWidth,
      mainCW: main.clientWidth,
      docSW: document.documentElement.scrollWidth,
      vw: innerWidth,
      grid,
      clippedNames,
    }
  })
  await page.evaluate(() => { const m = document.getElementById('main-content'); m.scrollTop = m.scrollHeight })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(OUT, 'retest-report-card-bottom.png') })
  out.reportCardBottom = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    return { scrollLeft: main.scrollLeft, sw: main.scrollWidth, cw: main.clientWidth, doc: document.documentElement.scrollWidth }
  })

  fs.writeFileSync(path.join(OUT, 'retest.json'), JSON.stringify(out, null, 2))
  console.log('wrote retest.json')
} finally {
  await context.close().catch(() => {})
}
