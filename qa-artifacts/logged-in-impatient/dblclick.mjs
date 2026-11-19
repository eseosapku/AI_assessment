import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-impatient'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const userDataDir = path.join(OUT, 'chrome-profile')
const obs = { startedAt: new Date().toISOString(), writes: [], blocked: [] }

function save() {
  fs.writeFileSync(path.join(OUT, 'dblclick.json'), JSON.stringify(obs, null, 2))
}

function bodySummary(postData) {
  if (!postData) return { bytes: 0 }
  if (/password/i.test(postData)) return { redacted: true, bytes: Buffer.byteLength(postData) }
  const hash = crypto.createHash('sha256').update(postData).digest('hex').slice(0, 12)
  let keys = []
  try {
    const data = JSON.parse(postData)
    if (data && typeof data === 'object' && !Array.isArray(data)) keys = Object.keys(data)
  } catch { keys = [] }
  return { bytes: Buffer.byteLength(postData), hash, keys }
}

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync'],
})
const page = context.pages()[0] || (await context.newPage())

await page.route('**/*', (route) => {
  let pathName = ''
  let host = ''
  try {
    const u = new URL(route.request().url())
    pathName = u.pathname
    host = u.hostname
  } catch {
    return route.continue()
  }
  const method = route.request().method()
  if (host === 'localhost' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && /\/api\/(generate-assessment|studylab$|payments|checkout|billing)/.test(pathName)) {
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
  obs.writes.push({ t: Date.now(), method, path: url.pathname, ...bodySummary(req.postData()) })
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

async function dismissTours() {
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: 'Skip the tour' }).last()
    if (!(await skip.isVisible().catch(() => false))) break
    await skip.click({ timeout: 4000 })
    await page.waitForTimeout(350)
  }
}

try {
  await page.goto(ORIGIN + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)
  await dismissTours()
  await page.locator('[data-tour="hero-cta"]').waitFor({ state: 'visible', timeout: 15000 })
  await dismissTours()
  await page.evaluate(() => {
    window.__qaClicks = []
    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('button, a') : e.target
      const text = ((el && (el.innerText || el.getAttribute('aria-label'))) || '').replace(/\s+/g, ' ').trim().slice(0, 90)
      window.__qaClicks.push({ tag: el ? el.tagName : '', text })
    }, true)
  })
  const hero = page.locator('[data-tour="hero-cta"]')
  const box = await hero.boundingBox()
  obs.hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    const button = el && el.closest ? el.closest('button') : null
    return {
      tag: el ? el.tagName : null,
      text: ((button || el)?.innerText || el?.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tour: button ? button.getAttribute('data-tour') : null,
    }
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })

  const before = obs.writes.length
  const tClick = Date.now()
  if (obs.hit.tour === 'hero-cta' && /^create assessment$/i.test(obs.hit.text)) {
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 80 })
    obs.doubleClicked = true
  } else {
    obs.doubleClicked = false
  }
  await page.waitForTimeout(2000)
  obs.clicks = await page.evaluate(() => window.__qaClicks || [])
  const caused = obs.writes.slice(before).filter((w) => w.t >= tClick - 50)
  const groups = {}
  for (const w of caused) {
    const key = `${w.method} ${w.path} ${w.hash || (w.redacted ? 'redacted' : '')}`
    groups[key] = (groups[key] || 0) + 1
  }
  obs.caused = caused
  obs.duplicateWrites = Object.entries(groups).filter(([, n]) => n > 1).map(([key, n]) => ({ key, n }))
  obs.after = await page.evaluate(() => ({
    href: location.href,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    builder: /Build your quiz|New assessment/i.test(document.body.innerText || ''),
    signedIn: !!localStorage.getItem('user'),
  }))
  obs.screenshot = path.join(OUT, '08-double-click.png')
  await page.screenshot({ path: obs.screenshot, fullPage: false })
  if (obs.after.builder) {
    const close = page.getByRole('button', { name: 'Close the quiz builder' })
    if (await close.isVisible().catch(() => false)) await close.click({ timeout: 3000 }).catch(() => {})
    const leave = page.getByRole('button', { name: /^Leave$/ })
    if (await leave.isVisible().catch(() => false)) await leave.click({ timeout: 3000 }).catch(() => {})
  }
  save()
  console.log(JSON.stringify({
    clicked: obs.doubleClicked,
    hit: obs.hit,
    clicks: obs.clicks,
    dup: obs.duplicateWrites,
    caused: obs.caused,
    builder: obs.after.builder,
    href: obs.after.href,
    signedIn: obs.after.signedIn,
    blocked: obs.blocked,
    text: obs.after.text.slice(0, 180),
  }))
} catch (err) {
  obs.error = String(err && err.message ? err.message : err).slice(0, 400)
  try { await page.screenshot({ path: path.join(OUT, '08-double-click.png'), fullPage: false }) } catch { /* ignore */ }
  save()
  console.log(JSON.stringify({ error: obs.error }))
  process.exitCode = 1
} finally {
  await context.close().catch(() => {})
}
