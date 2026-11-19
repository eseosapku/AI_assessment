import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-practice'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const IDENTIFIER = process.env.QA_IDENTIFIER || ''
const PASSWORD = process.env.QA_PASSWORD || ''
if (!IDENTIFIER || !PASSWORD) {
  console.error('missing credentials')
  process.exit(1)
}

function scrub(value) {
  if (typeof value === 'string') return PASSWORD ? value.split(PASSWORD).join('[redacted]') : value
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = scrub(v)
    return out
  }
  return value
}

const BLOCK_CLICK = /create assessment|take the retake|\bretake\b|new set|generat|save changes|save as pdf|print report|start the paper|start the drill|^start practice\b|change password|delete|subscribe|\bpay\b|review \d+ card|^(i forgot|almost|got it|too easy)$/i

const ROUTES = [
  '/practice',
  '/exam-prep',
  '/progress',
  '/report-card',
  '/reports',
  '/recall',
  '/recall/review',
  '/settings',
]

const obs = { startedAt: new Date().toISOString(), routes: {}, nav: [], skip: null }

function save() {
  fs.writeFileSync(path.join(OUT, 'pass2.json'), JSON.stringify(scrub(obs), null, 2))
}

const res = await fetch(ORIGIN + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: IDENTIFIER, password: PASSWORD }),
})
const data = await res.json().catch(() => ({}))
if (!res.ok || !data?.user?.id) {
  console.error('login failed', res.status)
  process.exit(1)
}
console.log('login ok', data.user.role)

const userDataDir = path.join(OUT, 'chrome-profile-pass2')
fs.rmSync(userDataDir, { recursive: true, force: true })
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--window-size=1440,900',
  ],
})
await context.addInitScript((userJson) => {
  try {
    if (location.hostname === 'localhost' && location.port === '3000') {
      localStorage.setItem('user', userJson)
    }
  } catch { /* ignore */ }
}, JSON.stringify(data.user))

const page = context.pages()[0] || await context.newPage()
const consoleErrors = []
const pageErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(scrub(msg.text()).slice(0, 300))
})
page.on('pageerror', (err) => pageErrors.push(scrub(String(err?.message || err)).slice(0, 300)))

async function gotoPath(urlPath) {
  let last = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(ORIGIN + urlPath, { waitUntil: 'domcontentloaded', timeout: 90000 })
      return
    } catch (err) {
      last = err
      console.log('goto retry', urlPath, attempt, String(err).slice(0, 140))
      await page.waitForTimeout(1500)
    }
  }
  throw last
}

async function waitReady(urlPath) {
  await page.waitForFunction(() => {
    const text = document.body?.innerText || ''
    const shell = text.includes('StudySquare') || text.includes('Report Card') || text.includes('Loading assessments') || text.includes('Loading your report card')
    return shell || text.length > 80
  }, { timeout: 30000 }).catch(() => {})
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const spinning = await page.evaluate(() => [...document.querySelectorAll('.animate-spin')].some((el) => {
      const r = el.getBoundingClientRect()
      return r.width >= 24 && r.height >= 24
    }))
    const text = await page.evaluate(() => document.body?.innerText || '')
    const progressWaiting = urlPath === '/progress' && /Total tests/.test(text) && /—\s*Total tests|Total tests\s*—/.test(text.replace(/\s+/g, ' '))
    const recallWaiting = urlPath === '/recall' && spinning
    const reportWaiting = urlPath === '/report-card' && (/Loading your report card|Loading assessments/.test(text) || (spinning && !text.includes('Report Card')))
    if (!spinning && !progressWaiting && !recallWaiting && !reportWaiting && text.length > 30) break
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(600)
}

async function snapshot(urlPath, file) {
  const info = await page.evaluate(() => {
    const main = document.getElementById('main-content')
    const vw = innerWidth
    const vh = innerHeight
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160))
    const clipped = []
    for (const el of document.querySelectorAll('h1,h2,h3,p,button,a,label,span')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > vh) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (!text || text.length > 180) continue
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none'
      const ellipsis = cs.textOverflow === 'ellipsis' && el.clientHeight <= 32
      const clipsY = !clamp && el.scrollHeight > el.clientHeight + 10 && ['hidden', 'clip'].includes(cs.overflowY)
      const clipsX = !ellipsis && !clamp && el.scrollWidth > el.clientWidth + 12 && ['hidden', 'clip'].includes(cs.overflowX)
      if ((clipsX || clipsY) && el.childElementCount <= 3) {
        clipped.push({ text: text.slice(0, 100), clipsX, clipsY, sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth })
      }
    }
    const brokenImages = []
    for (const img of document.images) {
      const r = img.getBoundingClientRect()
      if (r.width > 8 && img.complete && img.naturalWidth === 0) brokenImages.push((img.currentSrc || img.src || '').slice(0, 140))
    }
    const buttons = [...document.querySelectorAll('button')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 2 && r.height > 2 && r.top < vh + 20 && r.bottom > 0
    }).map((el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80))
    let signedIn = false
    try { signedIn = !!JSON.parse(localStorage.getItem('user') || 'null')?.id } catch { signedIn = false }
    return {
      href: location.href,
      path: location.pathname,
      h1: (document.querySelector('h1')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      signedIn,
      dialogs,
      clipped: clipped.slice(0, 12),
      brokenImages: [...new Set(brokenImages)].slice(0, 6),
      buttons: [...new Set(buttons)].slice(0, 30),
      horizontalScroll: document.documentElement.scrollWidth > vw + 2,
      mainCanScroll: !!(main && main.scrollHeight > main.clientHeight + 40),
      body: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 900),
    }
  })
  await page.screenshot({ path: path.join(OUT, file), fullPage: false })
  let bottom = null
  if (info.mainCanScroll) {
    await page.evaluate(() => {
      const main = document.getElementById('main-content')
      if (main) main.scrollTop = main.scrollHeight
    })
    await page.waitForTimeout(350)
    const bottomFile = file.replace('.png', '-bottom.png')
    await page.screenshot({ path: path.join(OUT, bottomFile), fullPage: false })
    bottom = bottomFile
    await page.evaluate(() => {
      const main = document.getElementById('main-content')
      if (main) main.scrollTop = 0
    })
  }
  const mark = obs._err || 0
  return { ...info, screenshot: file, bottom, consoleErrors: consoleErrors.slice(mark) }
}

async function dismissTours() {
  let clicks = 0
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: 'Skip the tour' }).first()
    if (!(await skip.isVisible().catch(() => false))) break
    await skip.click({ timeout: 4000 })
    clicks += 1
    await page.waitForTimeout(300)
  }
  const left = await page.getByRole('button', { name: 'Skip the tour' }).count().catch(() => 0)
  return { clicks, left }
}

async function navCheck(fromPath, description, locator, expectPrefix) {
  if (!(await locator.count().catch(() => 0))) {
    const row = { from: fromPath, control: description, result: 'missing' }
    obs.nav.push(row)
    console.log('nav missing', description)
    return
  }
  const target = locator.first()
  if (!(await target.isVisible().catch(() => false))) {
    obs.nav.push({ from: fromPath, control: description, result: 'hidden' })
    console.log('nav hidden', description)
    return
  }
  const text = ((await target.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (BLOCK_CLICK.test(text)) {
    obs.nav.push({ from: fromPath, control: description, result: 'refused', text })
    console.log('nav refused', description)
    return
  }
  try {
    await target.click({ timeout: 8000 })
  } catch (err) {
    obs.nav.push({ from: fromPath, control: description, result: 'click-failed', text, error: scrub(String(err)).slice(0, 180) })
    console.log('nav click failed', description)
    return
  }
  await page.waitForTimeout(1200)
  const actual = new URL(page.url()).pathname
  const row = { from: fromPath, control: description, text, expected: expectPrefix, actual, pass: actual.startsWith(expectPrefix) }
  obs.nav.push(row)
  console.log('nav', description, row.pass ? 'ok' : 'FAIL', actual)
  if (!row.pass) await page.screenshot({ path: path.join(OUT, `bug-nav-${obs.nav.length}.png`) }).catch(() => {})
  if (actual !== fromPath) {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
      await gotoPath(fromPath)
    })
    await page.waitForTimeout(500)
  }
}

try {
  consoleErrors.length = 0
  await gotoPath('/practice')
  await waitReady('/practice')
  const beforeSkip = await page.getByRole('button', { name: 'Skip the tour' }).count()
  const first = await dismissTours()
  obs.skip = { skipButtonsBefore: beforeSkip, ...first, dialogsAfter: await page.locator('[role="dialog"]').count() }
  console.log('skip', JSON.stringify(obs.skip))
  await page.evaluate(() => {
    for (const id of ['home', 'practice', 'learnspace', 'gapmap', 'progress', 'recall']) {
      localStorage.setItem('ss-tour-seen-' + id, '1')
    }
  })

  for (const urlPath of ROUTES) {
    consoleErrors.length = 0
    pageErrors.length = 0
    obs._err = 0
    console.log('clear', urlPath)
    const slug = urlPath.replace(/\//g, '-').replace(/^-/, '')
    try {
      await gotoPath(urlPath)
      await waitReady(urlPath)
      await dismissTours()
      const shot = await snapshot(urlPath, `clear-${slug}.png`)
      const pathName = new URL(shot.href).pathname
      const bounce = pathName === '/login' ? 'login' : pathName === '/' ? 'marketing-home' : !shot.signedIn ? 'signed-out' : null
      obs.routes[urlPath] = {
        finalUrl: shot.href,
        bounce,
        h1: shot.h1,
        dialogs: shot.dialogs,
        clipped: shot.clipped,
        brokenImages: shot.brokenImages,
        buttons: shot.buttons,
        horizontalScroll: shot.horizontalScroll,
        mainCanScroll: shot.mainCanScroll,
        consoleErrors: [...new Set(shot.consoleErrors.concat(consoleErrors))],
        pageErrors: [...new Set(pageErrors)],
        body: shot.body,
        screenshot: shot.screenshot,
        bottom: shot.bottom,
      }
    } catch (err) {
      obs.routes[urlPath] = { error: scrub(String(err)).slice(0, 240) }
      console.log('route failed', urlPath)
    }
    save()
  }

  console.log('nav checks')
  await gotoPath('/practice')
  await waitReady('/practice')
  await dismissTours()
  await navCheck('/practice', 'Open Recall', page.locator('#main-content a[href="/recall"]'), '/recall')
  await navCheck('/practice', 'Open exam prep', page.locator('#main-content a[href="/exam-prep"]'), '/exam-prep')
  await navCheck('/practice', 'Open classes', page.locator('#main-content a[href="/classrooms"]'), '/classrooms')
  await navCheck('/practice', 'Sidebar Progress', page.locator('nav[aria-label="Main"] a[href="/progress"]'), '/progress')

  await gotoPath('/exam-prep')
  await waitReady('/exam-prep')
  await navCheck('/exam-prep', 'Back to Practice', page.locator('#main-content a[href="/practice"]'), '/practice')

  await gotoPath('/progress')
  await waitReady('/progress')
  await navCheck('/progress', 'Build report card', page.locator('#main-content a[href="/report-card"]'), '/report-card')
  if (await page.locator('#main-content a[href^="/studylab"]').count()) {
    await gotoPath('/progress')
    await waitReady('/progress')
    await navCheck('/progress', 'Study this', page.locator('#main-content a[href^="/studylab"]'), '/studylab')
  }
  if (await page.locator('#main-content a[href^="/results/"]').count()) {
    await gotoPath('/progress')
    await waitReady('/progress')
    const link = page.locator('#main-content a[href^="/results/"]').first()
    const before = '/progress'
    await link.click({ position: { x: 24, y: 16 }, timeout: 8000 }).catch((err) => {
      obs.nav.push({ from: before, control: 'Review result', result: 'click-failed', error: String(err).slice(0, 160) })
    })
    await page.waitForTimeout(1200)
    const actual = new URL(page.url()).pathname
    obs.nav.push({ from: before, control: 'Review result', expected: '/results/', actual, pass: actual.startsWith('/results/') })
    console.log('nav review', actual)
    if (!actual.startsWith('/results/')) await page.screenshot({ path: path.join(OUT, 'bug-nav-results.png') }).catch(() => {})
  }
  if (await page.locator('#main-content a[href="/practice"]').count()) {
    await gotoPath('/progress')
    await waitReady('/progress')
    await navCheck('/progress', 'Start practicing', page.locator('#main-content a[href="/practice"]'), '/practice')
  }

  await gotoPath('/report-card')
  await waitReady('/report-card')
  await navCheck('/report-card', 'Sidebar Practice', page.locator('nav[aria-label="Main"] a[href="/practice"]'), '/practice')

  await gotoPath('/reports')
  await waitReady('/reports')
  await navCheck('/reports', 'Sidebar Progress', page.locator('nav[aria-label="Main"] a[href="/progress"]'), '/progress')

  await gotoPath('/recall')
  await waitReady('/recall')
  await navCheck('/recall', 'Back to Practice', page.locator('#main-content a[href="/practice"]'), '/practice')

  await gotoPath('/recall/review')
  await waitReady('/recall/review')
  await navCheck('/recall/review', 'Back to Recall', page.locator('#main-content a[href="/recall"]'), '/recall')

  await gotoPath('/settings')
  await waitReady('/settings')
  await navCheck('/settings', 'Sidebar Practice', page.locator('nav[aria-label="Main"] a[href="/practice"]'), '/practice')
  await gotoPath('/settings')
  await waitReady('/settings')
  const around = page.locator('#main-content button', { hasText: 'Show me around again' })
  if (await around.count()) {
    await around.first().scrollIntoViewIfNeeded().catch(() => {})
    await navCheck('/settings', 'Show me around again', around, '/dashboard')
  }
  save()
} finally {
  obs.finishedAt = new Date().toISOString()
  save()
  await context.close().catch(() => {})
}
console.log('pass2 done')
