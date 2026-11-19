import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-impatient'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const userDataDir = path.join(OUT, 'chrome-profile')

const obs = { startedAt: new Date().toISOString(), writes: [] }

function save() {
  fs.writeFileSync(path.join(OUT, 'followup.json'), JSON.stringify(obs, null, 2))
}

function bodySummary(postData) {
  if (!postData) return { bytes: 0 }
  if (/password/i.test(postData)) return { redacted: true, bytes: Buffer.byteLength(postData) }
  const hash = crypto.createHash('sha256').update(postData).digest('hex').slice(0, 12)
  let keys = []
  try {
    const data = JSON.parse(postData)
    if (data && typeof data === 'object' && !Array.isArray(data)) keys = Object.keys(data)
  } catch {
    keys = []
  }
  return { bytes: Buffer.byteLength(postData), hash, keys }
}

async function shot(page, name) {
  const file = path.join(OUT, name + '.png')
  await page.screenshot({ path: file, fullPage: false })
  return file
}

async function probe(page) {
  return page.evaluate(() => {
    const spinners = [...document.querySelectorAll('.animate-spin')].map((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const shown = r.width > 8 && r.height > 8 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0
      return { w: Math.round(r.width), h: Math.round(r.height), shown }
    }).filter((s) => s.shown)
    let signedIn = false
    let email = null
    try {
      const raw = localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        signedIn = !!(u && u.id)
        email = u.email || null
      }
    } catch {
      signedIn = false
    }
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      href: location.href,
      path: location.pathname,
      signedIn,
      email,
      spinners,
      text: text.slice(0, 500),
      builder: /Build your quiz|New assessment/i.test(text),
      tour: /Skip the tour/i.test(text),
      signIn: [...document.querySelectorAll('button')].some((b) => /^sign in$/i.test((b.innerText || '').trim())),
    }
  })
}

function stuck(sample) {
  if (!sample) return false
  const big = (sample.spinners || []).some((s) => s.w >= 32 && s.h >= 32)
  const short = (sample.text || '').length < 80
  return big && short
}

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-features=PasswordManagerOnboarding,AutofillServerCommunication',
  ],
})

const page = context.pages()[0] || (await context.newPage())
await page.route('**/*', (route) => {
  const req = route.request()
  let pathName = ''
  let host = ''
  try {
    const u = new URL(req.url())
    pathName = u.pathname
    host = u.hostname
  } catch {
    return route.continue()
  }
  const method = req.method()
  if (host === 'localhost' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && /\/api\/(generate-assessment|studylab$|payments|checkout|billing)/.test(pathName)) {
    obs.blocked = obs.blocked || []
    obs.blocked.push({ t: Date.now(), method, path: pathName })
    return route.abort()
  }
  return route.continue()
})

page.on('request', (req) => {
  const method = req.method()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return
  let url
  try { url = new URL(req.url()) } catch { return }
  if (url.hostname !== 'localhost') return
  obs.writes.push({ t: Date.now(), phase: obs.phase || '?', method, path: url.pathname, ...bodySummary(req.postData()) })
})
page.on('response', (res) => {
  const method = res.request().method()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return
  let url
  try { url = new URL(res.url()) } catch { return }
  if (url.hostname !== 'localhost') return
  const hit = [...obs.writes].reverse().find((w) => w.path === url.pathname && w.method === method && w.status == null)
  if (hit) hit.status = res.status()
})

try {
  obs.phase = 'open'
  await page.goto(ORIGIN + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1200)
  const skip = page.getByRole('button', { name: 'Skip the tour' })
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 5000 })
    await page.waitForTimeout(400)
  }
  obs.opened = await probe(page)
  obs.opened.screenshot = await shot(page, '05-dashboard-ready')

  obs.phase = 'to-progress'
  const progress = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' })
  await progress.click({ timeout: 8000 })
  await page.waitForURL('**/progress', { timeout: 15000 })
  obs.arrivedProgress = { url: page.url(), ...(await probe(page)) }
  obs.arrivedProgress.screenshot = await shot(page, '06-progress')

  obs.phase = 'back'
  await page.waitForTimeout(200)
  await page.goBack({ waitUntil: 'commit', timeout: 15000 })
  obs.immediateBack = { url: page.url(), ...(await probe(page)) }
  await page.waitForTimeout(250)

  obs.phase = 'forward'
  await page.goForward({ waitUntil: 'commit', timeout: 15000 })
  obs.immediateForward = { url: page.url(), ...(await probe(page)) }

  const samples = []
  const marks = [500, 2000, 5000, 10000]
  let waited = 0
  const t0 = Date.now()
  for (const mark of marks) {
    await page.waitForTimeout(mark - waited)
    waited = mark
    samples.push({ atMs: Date.now() - t0, ...(await probe(page)) })
  }
  obs.historySamples = samples
  obs.historyShot = await shot(page, '07-after-forward')
  const last = samples[samples.length - 1]
  obs.history = {
    backUrl: obs.immediateBack.url,
    forwardUrl: obs.immediateForward.url,
    settledPath: last.path,
    spinnerNeverEnded: stuck(last),
    loggedOut: !last.signedIn || last.signIn,
  }
  save()

  obs.phase = 'double-click'
  const home = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' })
  if (!page.url().includes('/dashboard')) {
    await home.click({ timeout: 8000 })
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.waitForTimeout(600)
  }
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 5000 })
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => {
    window.__qaClicks = []
    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('button, a') : e.target
      const text = ((el && (el.innerText || el.getAttribute('aria-label'))) || '').replace(/\s+/g, ' ').trim().slice(0, 90)
      window.__qaClicks.push({ tag: el ? el.tagName : '', text, t: Date.now() })
    }, true)
  })
  const hero = page.locator('[data-tour="hero-cta"]')
  await hero.waitFor({ state: 'visible', timeout: 8000 })
  const box = await hero.boundingBox()
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    const button = el && el.closest ? el.closest('button') : null
    return {
      tag: el ? el.tagName : null,
      text: ((button || el)?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tour: button ? button.getAttribute('data-tour') : null,
    }
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  obs.hitTarget = hit
  const writeStart = obs.writes.length
  const tClick = Date.now()
  if (hit.tour === 'hero-cta' && /create assessment/i.test(hit.text) && !/generate|study|retake|pay|delete/i.test(hit.text)) {
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 70 })
    obs.doubleClicked = true
  } else {
    obs.doubleClicked = false
    obs.skipReason = 'primary button was not the uncovered Create assessment control'
  }
  await page.waitForTimeout(2500)
  obs.clicks = await page.evaluate(() => window.__qaClicks || [])
  const caused = obs.writes.slice(writeStart).filter((w) => w.t >= tClick - 50)
  const groups = {}
  for (const w of caused) {
    const key = w.method + ' ' + w.path + ' ' + (w.hash || (w.redacted ? 'redacted' : ''))
    groups[key] = (groups[key] || 0) + 1
  }
  obs.doubleClick = {
    caused,
    duplicateWrites: Object.entries(groups).filter(([, n]) => n > 1).map(([key, n]) => ({ key, n })),
    after: await probe(page),
  }
  obs.doubleClick.screenshot = await shot(page, '08-double-click')
  obs.doubleClick.loggedOut = !obs.doubleClick.after.signedIn || obs.doubleClick.after.signIn
  obs.doubleClick.spinnerNeverEnded = stuck(obs.doubleClick.after)

  if (obs.doubleClick.after.builder) {
    const close = page.getByRole('button', { name: 'Close the quiz builder' })
    if (await close.isVisible().catch(() => false)) await close.click({ timeout: 3000 }).catch(() => {})
    const leave = page.getByRole('button', { name: 'Leave' })
    if (await leave.isVisible().catch(() => false)) await leave.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(400)
    obs.afterClose = await probe(page)
  }
  save()
  console.log(JSON.stringify({
    back: obs.history.backUrl,
    forward: obs.history.forwardUrl,
    settled: obs.history.settledPath,
    spin: obs.history.spinnerNeverEnded,
    out: obs.history.loggedOut,
    clicked: obs.doubleClicked,
    hit: obs.hitTarget,
    clicks: obs.clicks,
    dup: obs.doubleClick.duplicateWrites,
    caused: obs.doubleClick.caused,
    builder: obs.doubleClick.after.builder,
    blocked: obs.blocked || [],
    loggedOut: obs.doubleClick.loggedOut,
  }))
} finally {
  await context.close().catch(() => {})
}
