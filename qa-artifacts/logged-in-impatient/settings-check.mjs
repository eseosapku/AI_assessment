import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = path.dirname(fileURLToPath(import.meta.url))
const shotDir = path.join(root, 'screenshots')
const profileDir = path.join(root, 'chrome-profile-settings-b')
const base = 'http://localhost:3000'
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function redact(value) {
  return String(value ?? '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
}

const user = JSON.parse(await readFile(path.join(root, 'session-user-full.json'), 'utf8'))
const firstName = String(user.name || '').split(' ')[0]
await mkdir(shotDir, { recursive: true })
await mkdir(profileDir, { recursive: true })

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: chromePath,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
})
context.setDefaultNavigationTimeout(90000)
const page = context.pages()[0] || (await context.newPage())
const trail = []
const writes = []

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) trail.push({ event: 'navigate', url: frame.url() })
})
page.on('response', (response) => {
  const method = response.request().method()
  if (method !== 'GET' && method !== 'HEAD') {
    writes.push({ method, status: response.status(), url: redact(response.url().split('?')[0]) })
  }
})
page.on('pageerror', (error) => {
  trail.push({ event: 'pageerror', url: redact(error?.message || error).slice(0, 300) })
})

const stored = JSON.stringify(user)
await context.addInitScript((json) => {
  try {
    if (sessionStorage.getItem('qa-session-seeded') === '1') return
    localStorage.setItem('user', json)
    sessionStorage.setItem('qa-session-seeded', '1')
  } catch {
    // origin storage can be unavailable on the initial blank document
  }
}, stored)

async function snap() {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    let sessionName = null
    let present = false
    try {
      const raw = localStorage.getItem('user')
      present = Boolean(raw)
      sessionName = raw ? JSON.parse(raw).name : null
    } catch {
      sessionName = 'parse-error'
    }
    let portalText = ''
    try {
      portalText = document.querySelector('nextjs-portal')?.shadowRoot?.textContent || ''
    } catch {
      portalText = ''
    }
    return {
      href: location.href,
      text: text.slice(0, 500),
      welcome: /Welcome back/i.test(text),
      settings: /Profile\s*&\s*security/i.test(text),
      sumba: text.includes('Sumba'),
      marketing: /Get started free|We'll build you a way through it|Stuck on something\?/i.test(text),
      appError: /Application error|client-side exception|Internal Server Error|Unhandled Runtime Error/i.test(`${text}\n${portalText}`),
      portalText: portalText.replace(/\s+/g, ' ').trim().slice(0, 240),
      spinner: Boolean(document.querySelector('.animate-spin')),
      present,
      sessionName,
    }
  })
}

async function waitReady(predicate, timeout) {
  const start = Date.now()
  let snapshot = null
  while (Date.now() - start < timeout) {
    snapshot = await snap()
    if (snapshot.marketing || snapshot.appError || predicate(snapshot)) {
      await page.waitForTimeout(600)
      return snap()
    }
    await page.waitForTimeout(250)
  }
  return snapshot
}

const dashResponse = await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 })
const dashboard = await waitReady((snapshot) => snapshot.welcome && snapshot.sumba && snapshot.sessionName === user.name && snapshot.href.includes('/dashboard'), 45000)
console.log('dashboard', JSON.stringify({ status: dashResponse?.status(), href: dashboard?.href, welcome: dashboard?.welcome, sessionName: dashboard?.sessionName, marketing: dashboard?.marketing }))

const openResponse = await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded', timeout: 90000 })
const opened = await waitReady((snapshot) => snapshot.settings && snapshot.welcome && snapshot.sessionName === user.name, 45000)
console.log('settings-open', JSON.stringify({ status: openResponse?.status(), href: opened?.href, settings: opened?.settings, welcome: opened?.welcome, sessionName: opened?.sessionName, marketing: opened?.marketing, appError: opened?.appError }))

const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
const refreshed = await waitReady((snapshot) => snapshot.settings && snapshot.welcome && snapshot.sessionName === user.name && snapshot.href.includes('/settings'), 45000)
console.log('settings-refresh', JSON.stringify({ status: reloadResponse?.status(), href: refreshed?.href, settings: refreshed?.settings, welcome: refreshed?.welcome, sessionName: refreshed?.sessionName, marketing: refreshed?.marketing, appError: refreshed?.appError, sumba: refreshed?.sumba }))

const failed = !refreshed
  || refreshed.marketing
  || refreshed.appError
  || !refreshed.settings
  || refreshed.sessionName !== user.name
  || !String(refreshed.href).includes('/settings')
  || !opened
  || opened.marketing
  || !opened.settings
let evidence = null
if (failed) {
  evidence = path.join(shotDir, 'settings-refresh-failed.png')
  await page.screenshot({ path: evidence, fullPage: true })
}

const result = {
  dashboardStatus: dashResponse ? dashResponse.status() : null,
  openStatus: openResponse ? openResponse.status() : null,
  refreshStatus: reloadResponse ? reloadResponse.status() : null,
  dashboard: dashboard && { href: dashboard.href, welcome: dashboard.welcome, marketing: dashboard.marketing, sessionName: dashboard.sessionName },
  opened: opened && { href: opened.href, settings: opened.settings, welcome: opened.welcome, marketing: opened.marketing, appError: opened.appError, sessionName: opened.sessionName, present: opened.present, text: redact(opened.text) },
  refreshed: refreshed && { href: refreshed.href, settings: refreshed.settings, welcome: refreshed.welcome, marketing: refreshed.marketing, appError: refreshed.appError, portalText: refreshed.portalText, sessionName: refreshed.sessionName, present: refreshed.present, sumba: refreshed.sumba, text: redact(refreshed.text) },
  writes,
  trail: trail.slice(-30),
  evidence,
  failed,
}
await writeFile(path.join(root, 'settings-result.json'), JSON.stringify(result, null, 2))
console.log('FAILED', failed, 'WRITES', writes.length)
await context.close()
