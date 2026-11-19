import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-practice'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const IDENTIFIER = process.env.QA_IDENTIFIER || ''
const PASSWORD = process.env.QA_PASSWORD || ''

if (!IDENTIFIER || !PASSWORD) {
  console.error('missing QA_IDENTIFIER or QA_PASSWORD')
  process.exit(1)
}

fs.mkdirSync(OUT, { recursive: true })

function scrub(value) {
  const secret = PASSWORD
  if (typeof value === 'string') return secret ? value.split(secret).join('[redacted]') : value
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) out[key] = scrub(val)
    return out
  }
  return value
}

const GENDERS = new Set(['female', 'male', 'other', 'prefer_not_to_say'])

function needsGenderPrompt(user) {
  if (!user) return false
  const value = typeof user.gender === 'string' ? user.gender.trim().toLowerCase() : ''
  return !GENDERS.has(value)
}

const ROUTES = [
  { id: '01-practice', path: '/practice' },
  { id: '02-exam-prep', path: '/exam-prep' },
  { id: '03-progress', path: '/progress' },
  { id: '04-report-card', path: '/report-card' },
  { id: '05-reports', path: '/reports' },
  { id: '06-recall', path: '/recall' },
  { id: '07-recall-review', path: '/recall/review' },
  { id: '08-settings', path: '/settings' },
]

const BLOCK_CLICK = /create assessment|take the retake|\bretake\b|new set|generat|save changes|save as pdf|print report|start the paper|start the drill|^start practice\b|change password|delete account|\bsubscribe\b|\bpay\b|review \d+ card|^(i forgot|almost|got it|too easy)$/i

function assertLocal(url) {
  const u = new URL(url, ORIGIN)
  if (u.protocol !== 'http:' || u.hostname !== 'localhost' || u.port !== '3000') {
    throw new Error('refusing non-local url')
  }
  return u
}

const obs = {
  host: ORIGIN,
  viewport: { width: 1440, height: 900 },
  startedAt: new Date().toISOString(),
  login: null,
  routes: {},
  nav: [],
  unintendedWrites: [],
}

function save() {
  fs.writeFileSync(path.join(OUT, 'observations.json'), JSON.stringify(scrub(obs), null, 2))
}

async function login() {
  assertLocal(ORIGIN + '/api/auth/login')
  const res = await fetch(ORIGIN + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: IDENTIFIER, password: PASSWORD }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.user?.id) {
    console.error('login failed', res.status, data?.error || data?.message || 'no user')
    process.exit(1)
  }
  obs.login = {
    status: res.status,
    role: data.user.role,
    profileComplete: data.user.profileComplete !== false,
    genderPromptExpected: needsGenderPrompt(data.user),
    country: data.user.country || null,
  }
  console.log('login ok', JSON.stringify(obs.login))
  return data.user
}

function attach(page, bucket) {
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return
    const text = scrub(msg.text()).slice(0, 400)
    if (/favicon|Download the React DevTools|chrome-extension/i.test(text)) return
    bucket.consoleErrors.push(text)
  }
  const onPageError = (err) => {
    bucket.pageErrors.push(scrub(String(err && err.message ? err.message : err)).slice(0, 400))
  }
  const onResponse = (res) => {
    const status = res.status()
    if (status < 400) return
    let url
    try { url = new URL(res.url()) } catch { return }
    if (url.hostname !== 'localhost') {
      bucket.failedNet.push({ status, url: url.origin + url.pathname })
      return
    }
    bucket.failedNet.push({ status, url: url.pathname + url.search.slice(0, 80) })
  }
  const onRequest = (req) => {
    const method = req.method()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return
    let url
    try { url = new URL(req.url()) } catch { return }
    if (url.hostname !== 'localhost') return
    const entry = { method, path: url.pathname, status: null }
    bucket.writes.push(entry)
    req.response().then((res) => { if (res) entry.status = res.status() }).catch(() => {})
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)
  page.on('request', onRequest)
  return () => {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('response', onResponse)
    page.off('request', onRequest)
  }
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
  await page.waitForFunction(() => {
    const text = document.body?.innerText || ''
    const spinning = [...document.querySelectorAll('.animate-spin')].some((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width >= 28 && r.height >= 28 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.1
    })
    if (/Loading your report card/i.test(text)) return false
    if (spinning && text.length < 400) return false
    return text.length > 40 || !!document.querySelector('[role="dialog"]') || !!document.querySelector('h1')
  }, { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
  const started = Date.now()
  while (Date.now() - started < 10000) {
    const spinning = await page.evaluate(() => [...document.querySelectorAll('.animate-spin')].some((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width >= 28 && r.height >= 28 && cs.display !== 'none' && Number(cs.opacity) > 0.1
    }))
    if (!spinning) break
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(1200)
}

async function audit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const main = document.getElementById('main-content')
    const mainRect = main ? main.getBoundingClientRect() : null
    const clipped = []
    const overflowers = []
    const brokenImages = []
    const links = []
    const buttons = []

    for (const img of document.images) {
      const r = img.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      if (img.complete && img.naturalWidth === 0) {
        brokenImages.push((img.currentSrc || img.src || '').slice(0, 180))
      }
    }

    const nodes = document.querySelectorAll('h1,h2,h3,p,a,button,span,label,li,dt,dd')
    let seen = 0
    for (const el of nodes) {
      if (seen++ > 900) break
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 6) continue
      if (r.bottom < 0 || r.top > vh) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      const lineClamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none'
      const ellipsis = cs.textOverflow === 'ellipsis'
      const clipsX = el.scrollWidth > el.clientWidth + 8 && ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowX)
      const clipsY = el.scrollHeight > el.clientHeight + 8 && ['hidden', 'clip'].includes(cs.overflowY) && !lineClamp
      const intentionalChip = ellipsis && el.clientHeight <= 32 && el.clientWidth <= 260
      if ((clipsX || clipsY) && !lineClamp && !intentionalChip && el.childElementCount <= 4 && text.length < 220) {
        clipped.push({
          tag: el.tagName,
          text: text.slice(0, 110),
          clipsX,
          clipsY,
          sw: el.scrollWidth,
          cw: el.clientWidth,
          sh: el.scrollHeight,
          ch: el.clientHeight,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        })
      }
      if ((r.right > vw + 6 || r.left < -6) && r.width < vw) {
        overflowers.push({
          tag: el.tagName,
          text: text.slice(0, 90),
          left: Math.round(r.left),
          right: Math.round(r.right),
          top: Math.round(r.top),
        })
      }
    }

    for (const el of document.querySelectorAll('a,button')) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2 || r.bottom < -20 || r.top > vh + 40) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const text = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 90)
      if (el.tagName === 'A') links.push({ text, href: el.getAttribute('href') })
      else buttons.push({ text, type: el.getAttribute('type') || '', disabled: !!el.disabled })
    }

    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map((el) =>
      (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    )
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    let signedIn = false
    let role = null
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null')
      signedIn = !!(user && user.id)
      role = user?.role || null
    } catch { signedIn = false }

    return {
      href: location.href,
      path: location.pathname + location.search,
      title: document.title,
      h1: (document.querySelector('h1')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140),
      signedIn,
      role,
      horizontalScroll: document.documentElement.scrollWidth > vw + 2,
      docScrollWidth: document.documentElement.scrollWidth,
      mainCanScroll: !!(main && main.scrollHeight > main.clientHeight + 24),
      mainScrollTop: main ? Math.round(main.scrollTop) : 0,
      mainScrollHeight: main ? main.scrollHeight : 0,
      mainClientHeight: main ? main.clientHeight : 0,
      mainBottom: mainRect ? Math.round(mainRect.bottom) : null,
      vw,
      vh,
      clipped: clipped.slice(0, 20),
      overflowers: overflowers.slice(0, 12),
      brokenImages: [...new Set(brokenImages)].slice(0, 8),
      links: links.slice(0, 50),
      buttons: buttons.slice(0, 40),
      dialogs,
      appError: /Application error|Unhandled Runtime Error|This page could not be found/i.test(bodyText),
      bodyText: bodyText.slice(0, 700),
    }
  })
}

function bounceOf(requested, snap) {
  const path = (snap?.path || '').split('?')[0]
  if (path === '/login' || path.startsWith('/login')) return 'login'
  if (path === '/' && requested !== '/') return 'marketing-home'
  if (snap && !snap.signedIn) return 'signed-out'
  return null
}

async function dismissTours(page) {
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: 'Skip the tour' }).first()
    if (!(await skip.isVisible().catch(() => false))) break
    await skip.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
}

async function safeClick(locator) {
  const text = ((await locator.innerText().catch(() => '')) || (await locator.getAttribute('aria-label').catch(() => '')) || '').replace(/\s+/g, ' ').trim()
  if (BLOCK_CLICK.test(text)) {
    return { refused: true, text: text.slice(0, 80) }
  }
  await locator.click({ timeout: 6000 })
  return { refused: false, text: text.slice(0, 80) }
}

async function navCheck(page, fromPath, description, locator, expectPrefix) {
  const count = await locator.count().catch(() => 0)
  if (!count) {
    const row = { from: fromPath, control: description, result: 'missing' }
    obs.nav.push(row)
    return row
  }
  const target = locator.first()
  const visible = await target.isVisible().catch(() => false)
  if (!visible) {
    const row = { from: fromPath, control: description, result: 'hidden' }
    obs.nav.push(row)
    return row
  }
  let click
  try {
    click = await safeClick(target)
  } catch (err) {
    const row = { from: fromPath, control: description, result: 'click-failed', error: scrub(String(err)).slice(0, 200) }
    obs.nav.push(row)
    await page.screenshot({ path: path.join(OUT, `bug-nav-${obs.nav.length}.png`) }).catch(() => {})
    row.screenshot = `bug-nav-${obs.nav.length}.png`
    return row
  }
  if (click.refused) {
    const row = { from: fromPath, control: description, result: 'refused', text: click.text }
    obs.nav.push(row)
    return row
  }
  await page.waitForTimeout(900)
  const actual = new URL(page.url()).pathname
  const pass = actual.startsWith(expectPrefix)
  const row = {
    from: fromPath,
    control: description,
    text: click.text,
    expected: expectPrefix,
    actual,
    pass,
  }
  obs.nav.push(row)
  if (!pass) {
    await page.screenshot({ path: path.join(OUT, `bug-nav-${obs.nav.length}.png`) }).catch(() => {})
    row.screenshot = `bug-nav-${obs.nav.length}.png`
  }
  if (actual !== fromPath) {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
      await page.goto(ORIGIN + fromPath, { waitUntil: 'domcontentloaded', timeout: 20000 })
    })
    await page.waitForTimeout(700)
  }
  return row
}

const user = await login()
const userDataDir = path.join(OUT, 'chrome-profile')
fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

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
    '--disable-component-update',
    '--force-color-profile=srgb',
    '--window-size=1440,900',
  ],
})

await context.addInitScript((userJson) => {
  try {
    if (location.hostname === 'localhost' && location.port === '3000') {
      localStorage.setItem('user', userJson)
    }
  } catch {
    // about:blank has no usable storage
  }
}, JSON.stringify(user))

const page = context.pages()[0] || await context.newPage()
const bucket = { consoleErrors: [], pageErrors: [], failedNet: [], writes: [] }
const detach = attach(page, bucket)

try {
  for (const route of ROUTES) {
    const local = {
      consoleErrors: [],
      pageErrors: [],
      failedNet: [],
      writes: [],
    }
    const mark = {
      console: bucket.consoleErrors.length,
      page: bucket.pageErrors.length,
      net: bucket.failedNet.length,
      writes: bucket.writes.length,
    }
    assertLocal(ORIGIN + route.path)
    console.log('visit', route.path)
    await page.goto(ORIGIN + route.path, { waitUntil: 'domcontentloaded', timeout: 40000 })
    await waitSettled(page)
    const top = await audit(page)
    const topFile = path.join(OUT, `${route.id}.png`)
    await page.screenshot({ path: topFile, fullPage: false })
    let bottom = null
    if (top.mainCanScroll) {
      await page.evaluate(() => {
        const main = document.getElementById('main-content')
        if (main) main.scrollTop = main.scrollHeight
      })
      await page.waitForTimeout(400)
      bottom = await audit(page)
      await page.screenshot({ path: path.join(OUT, `${route.id}-bottom.png`), fullPage: false })
      await page.evaluate(() => {
        const main = document.getElementById('main-content')
        if (main) main.scrollTop = 0
      })
    }
    local.consoleErrors = bucket.consoleErrors.slice(mark.console)
    local.pageErrors = bucket.pageErrors.slice(mark.page)
    local.failedNet = bucket.failedNet.slice(mark.net)
    local.writes = bucket.writes.slice(mark.writes)
    const genderBlocked = (top.dialogs || []).some((d) => /One quick question/i.test(d))
    obs.routes[route.path] = {
      requested: route.path,
      finalUrl: top.href,
      bounce: bounceOf(route.path, top),
      h1: top.h1,
      signedIn: top.signedIn,
      role: top.role,
      appError: top.appError,
      horizontalScroll: top.horizontalScroll || !!(bottom && bottom.horizontalScroll),
      dialogs: top.dialogs,
      genderBlocked,
      clippedTop: top.clipped,
      clippedBottom: bottom?.clipped || [],
      overflowersTop: top.overflowers,
      overflowersBottom: bottom?.overflowers || [],
      brokenImages: [...new Set([...(top.brokenImages || []), ...(bottom?.brokenImages || [])])],
      links: top.links,
      buttons: top.buttons,
      bottomButtons: bottom?.buttons || [],
      mainCanScroll: top.mainCanScroll,
      consoleErrors: [...new Set(local.consoleErrors)],
      pageErrors: [...new Set(local.pageErrors)],
      failedNet: local.failedNet,
      writes: local.writes,
      bodyText: top.bodyText,
      bottomText: bottom?.bodyText || null,
      screenshots: [`${route.id}.png`, ...(bottom ? [`${route.id}-bottom.png`] : [])],
    }
    save()
    console.log('settled', route.path, '->', top.path, 'bounce', obs.routes[route.path].bounce, 'dialogs', top.dialogs.length)
  }

  console.log('navigation checks')
  for (const route of ROUTES) {
    const info = obs.routes[route.path]
    if (info?.genderBlocked || info?.bounce) {
      obs.nav.push({ from: route.path, control: '(all)', result: info?.bounce ? 'skipped-bounced' : 'skipped-gender-prompt' })
      continue
    }
    await page.goto(ORIGIN + route.path, { waitUntil: 'domcontentloaded', timeout: 40000 })
    await waitSettled(page)
    const gender = await page.getByRole('dialog').filter({ hasText: 'One quick question' }).isVisible().catch(() => false)
    if (gender) {
      obs.nav.push({ from: route.path, control: '(all)', result: 'skipped-gender-prompt' })
      continue
    }
    await dismissTours(page)

    if (route.path === '/practice') {
      await navCheck(page, route.path, 'Open Recall', page.locator('#main-content a[href="/recall"]'), '/recall')
      await dismissTours(page)
      await navCheck(page, route.path, 'Open exam prep', page.locator('#main-content a[href="/exam-prep"]'), '/exam-prep')
      await dismissTours(page)
      await navCheck(page, route.path, 'Open classes', page.locator('#main-content a[href="/classrooms"]'), '/classrooms')
      await dismissTours(page)
      await navCheck(page, route.path, 'Sidebar Progress', page.locator('nav[aria-label="Main"] a[href="/progress"]'), '/progress')
    } else if (route.path === '/exam-prep') {
      await navCheck(page, route.path, 'Back to Practice', page.locator('#main-content a[href="/practice"]'), '/practice')
    } else if (route.path === '/progress') {
      await navCheck(page, route.path, 'Build report card', page.locator('#main-content a[href="/report-card"]'), '/report-card')
      await dismissTours(page)
      const study = page.locator('#main-content a[href^="/studylab"]')
      if (await study.count()) {
        await navCheck(page, route.path, 'Study this', study, '/studylab')
        await dismissTours(page)
      }
      const results = page.locator('#main-content a[href^="/results/"]')
      if (await results.count()) {
        const link = results.first()
        const text = ((await link.getAttribute('aria-label')) || 'results').slice(0, 80)
        if (!BLOCK_CLICK.test(text)) {
          const before = new URL(page.url()).pathname
          await link.click({ position: { x: 24, y: 16 }, timeout: 6000 }).catch((err) => {
            obs.nav.push({ from: route.path, control: 'Review result', result: 'click-failed', error: String(err).slice(0, 180) })
          })
          await page.waitForTimeout(1000)
          const actual = new URL(page.url()).pathname
          if (actual !== before) {
            const pass = actual.startsWith('/results/')
            const row = { from: route.path, control: 'Review result', text, expected: '/results/', actual, pass }
            obs.nav.push(row)
            if (!pass || /\/assessment/.test(actual)) {
              await page.screenshot({ path: path.join(OUT, 'bug-nav-results.png') }).catch(() => {})
              row.screenshot = 'bug-nav-results.png'
            }
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
              await page.goto(ORIGIN + route.path, { waitUntil: 'domcontentloaded' })
            })
            await page.waitForTimeout(600)
          }
        }
      }
      const start = page.locator('#main-content a[href="/practice"]')
      if (await start.count()) {
        await navCheck(page, route.path, 'Start practicing', start, '/practice')
      }
    } else if (route.path === '/report-card') {
      await navCheck(page, route.path, 'Sidebar Practice', page.locator('nav[aria-label="Main"] a[href="/practice"]'), '/practice')
    } else if (route.path === '/reports') {
      await navCheck(page, route.path, 'Sidebar Progress', page.locator('nav[aria-label="Main"] a[href="/progress"]'), '/progress')
    } else if (route.path === '/recall') {
      await navCheck(page, route.path, 'Back to Practice', page.locator('#main-content a[href="/practice"]'), '/practice')
    } else if (route.path === '/recall/review') {
      const back = page.locator('#main-content a[href="/recall"]')
      if (await back.count()) {
        await navCheck(page, route.path, 'Back to Recall', back, '/recall')
      } else {
        obs.nav.push({ from: route.path, control: 'Back to Recall', result: 'missing' })
      }
    } else if (route.path === '/settings') {
      await navCheck(page, route.path, 'Sidebar Practice', page.locator('nav[aria-label="Main"] a[href="/practice"]'), '/practice')
      await page.goto(ORIGIN + '/settings', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await waitSettled(page)
      await dismissTours(page)
      const around = page.locator('#main-content button', { hasText: 'Show me around again' })
      if (await around.count()) {
        await around.first().scrollIntoViewIfNeeded().catch(() => {})
        await navCheck(page, '/settings', 'Show me around again', around, '/dashboard')
      }
    }
    save()
  }
} finally {
  detach()
  obs.finishedAt = new Date().toISOString()
  const bad = /\/api\/recall\/review|\/api\/auth\/update-profile|\/api\/auth\/gender|\/api\/payments|generate/i
  for (const [routePath, info] of Object.entries(obs.routes)) {
    for (const write of info.writes || []) {
      if (bad.test(write.path)) obs.unintendedWrites.push({ route: routePath, ...write })
    }
  }
  save()
  await context.close().catch(() => {})
}

console.log('done', OUT)
