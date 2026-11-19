import { chromium } from 'playwright-core'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const PROFILE = path.join(OUT, 'chrome-profile-g')
const password = process.env.SS_LOGIN_PASSWORD
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'b.sumba@alustudent.com', password }),
})
const loginJson = await loginRes.json()
const user = loginJson.user
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
async function shot(name) {
  await page.screenshot({ path: path.join(OUT, name) })
  console.log('shot', name)
}
async function reveal(text) {
  await page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
}

await page.goto(`${BASE}/results/c54c0e9c-7085-4aaf-b397-6e75b796a09e`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.getByText('What to work on next').waitFor({ timeout: 60000 })
await reveal('What to work on next')
await shot('23-assignment-score-panel.png')
await reveal('Which of the following is NOT an elementary row operation')
await shot('24-assignment-q2.png')
await reveal('Long form - 6 marks')
await shot('25-assignment-q4.png')

await page.goto(`${BASE}/classrooms/036417bd-7688-49a1-bfa3-de47956b7d09`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.getByText('oklsdn').waitFor({ timeout: 60000 })
await reveal('oklsdn')
await shot('26-grade6-oklsdn.png')
await reveal('Deadline passed')
await shot('27-grade6-deadline.png')
await context.close()
