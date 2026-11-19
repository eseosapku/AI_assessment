import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const PROFILE = path.join(OUT, 'chrome-profile-c')
const password = process.env.SS_LOGIN_PASSWORD
const res = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'b.sumba@alustudent.com', password }),
})
const json = await res.json()
if (!res.ok) throw new Error('login failed')
const user = json.user
delete user.password

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--no-first-run', '--disable-sync', '--disable-extensions'],
})
await context.addInitScript((userJson) => {
  localStorage.setItem('user', userJson)
  localStorage.setItem('ss-tour-seen-home', '1')
}, JSON.stringify(user))
const page = context.pages()[0] || await context.newPage()
page.on('response', (r) => {
  if (r.url().includes('/api/dashboard/student')) console.log('header', r.status(), 'at', Date.now())
})
const t0 = Date.now()
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000)
  const snap = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/dashboard/student'))
    return {
      links: document.querySelectorAll('a[href^="/results/"]').length,
      empty: (document.body.innerText || '').includes('Nothing to review yet'),
      noQuizzes: (document.body.innerText || '').includes('No quizzes yet'),
      resources: res.map((e) => ({
        dur: Math.round(e.duration),
        transfer: e.transferSize,
        decoded: e.decodedBodySize,
        end: Math.round(e.responseEnd),
      })),
    }
  })
  console.log('t', Date.now() - t0, JSON.stringify(snap))
  if (snap.links > 0) break
}
await page.screenshot({ path: path.join(OUT, 'debug-timing.png') })
await context.close()
