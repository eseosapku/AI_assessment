import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = path.dirname(fileURLToPath(import.meta.url))
const shotDir = path.join(root, 'screenshots')
const profileDir = path.join(root, 'chrome-profile-classrooms-d')
const base = 'http://localhost:3000'
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const user = JSON.parse(await readFile(path.join(root, 'session-user-full.json'), 'utf8'))

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
const api = []
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) trail.push(frame.url())
})
page.on('response', (response) => {
  if (!response.url().includes('/api/classrooms')) return
  api.push({ status: response.status(), at: new Date().toISOString() })
})

await context.addInitScript((json) => {
  try {
    if (sessionStorage.getItem('qa-session-seeded') === '1') return
    localStorage.setItem('user', json)
    sessionStorage.setItem('qa-session-seeded', '1')
  } catch {
    // blank document has no storage
  }
}, JSON.stringify(user))

async function readPage() {
  try {
    return await page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    let sessionName = null
    try {
      sessionName = JSON.parse(localStorage.getItem('user') || 'null')?.name || null
    } catch {
      sessionName = 'parse-error'
    }
    return {
      href: location.href,
      sessionName,
      welcome: /Welcome back/i.test(text),
      heading: /Your classrooms/i.test(text),
      empty: /No classes yet/i.test(text),
      marketing: /Get started free|Stuck on something\?/i.test(text),
      appError: /Application error|Internal Server Error|client-side exception/i.test(text),
      spinner: Boolean(document.querySelector('.animate-spin')),
      grade5: text.includes('Grade 5 - Science'),
      grade6: text.includes('Grade 6 - Science'),
      text: text.slice(0, 600),
    }
  })
  } catch (error) {
    return { href: page.url(), navigationError: String(error?.message || error).slice(0, 180), sessionName: null, welcome: false, heading: false, empty: false, marketing: false, appError: false, spinner: false, grade5: false, grade6: false, text: '' }
  }
}

const open = await page.goto(`${base}/classrooms`, { waitUntil: 'domcontentloaded', timeout: 90000 })
const start = Date.now()
let view = null
while (Date.now() - start < 20000) {
  view = await readPage()
  if (view.marketing || view.appError) break
  if (view.heading && !view.spinner && (view.grade5 || view.empty) && api.length > 0) break
  await page.waitForTimeout(300)
}
const before = api.length
const reload = await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
const refreshStart = Date.now()
let refreshed = null
let seenApi = before
let lastApiAt = 0
while (Date.now() - refreshStart < 30000) {
  refreshed = await readPage()
  if (api.length > seenApi) {
    seenApi = api.length
    lastApiAt = Date.now()
  }
  if (refreshed.marketing || refreshed.appError) break
  if (refreshed.grade5 || refreshed.grade6) {
    await page.waitForTimeout(500)
    refreshed = await readPage()
    break
  }
  const compiling = /Compiling/i.test(refreshed.text || '')
  const apiSettled = seenApi > before && lastApiAt > 0 && Date.now() - lastApiAt > 8000 && !compiling && !refreshed.spinner
  if (refreshed.heading && refreshed.empty && apiSettled) break
  await page.waitForTimeout(400)
}
const freshApi = api.slice(before)
const expectedNames = true
const showedList = Boolean(refreshed?.grade5 || refreshed?.grade6)
const failed = !refreshed || refreshed.marketing || refreshed.appError || (reload && reload.status() >= 500) || freshApi.some((entry) => entry.status >= 500) || !showedList || refreshed.empty
let evidence = null
if (failed) {
  evidence = path.join(shotDir, 'classrooms-refresh-failed.png')
  await page.screenshot({ path: evidence, fullPage: true })
}
const result = {
  openStatus: open?.status() ?? null,
  refreshStatus: reload?.status() ?? null,
  before: view && { heading: view.heading, empty: view.empty, grade5: view.grade5, grade6: view.grade6, sessionName: view.sessionName },
  refreshed: refreshed && {
    href: refreshed.href,
    sessionName: refreshed.sessionName,
    welcome: refreshed.welcome,
    heading: refreshed.heading,
    empty: refreshed.empty,
    grade5: refreshed.grade5,
    grade6: refreshed.grade6,
    marketing: refreshed.marketing,
    appError: refreshed.appError,
    spinner: refreshed.spinner,
    text: refreshed.text,
  },
  api: freshApi,
  trail,
  evidence,
  failed,
}
await writeFile(path.join(root, 'classrooms-result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify({
  refreshStatus: result.refreshStatus,
  sessionName: refreshed?.sessionName,
  empty: refreshed?.empty,
  grade5: refreshed?.grade5,
  grade6: refreshed?.grade6,
  marketing: refreshed?.marketing,
  api: freshApi,
  failed,
}))
await context.close()
