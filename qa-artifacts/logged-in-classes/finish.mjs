import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const PROFILE = path.join(OUT, 'chrome-profile-f')
const password = process.env.SS_LOGIN_PASSWORD
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'b.sumba@alustudent.com', password }),
})
const loginJson = await loginRes.json()
if (!loginRes.ok) throw new Error('login failed')
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
  localStorage.setItem('ss-product-tour-seen', '1')
}, JSON.stringify(user))
const page = context.pages()[0] || await context.newPage()
page.on('pageerror', (err) => console.log('pageerror', String(err).slice(0, 240)))
page.on('response', (r) => {
  if (r.url().includes('/api/assignments/student') || r.url().includes('/api/results/')) {
    console.log('net', r.status(), r.url().slice(0, 140))
  }
})

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, name) })
  console.log('shot', name, page.url())
}
async function reveal(sel) {
  const loc = page.locator(sel).first()
  await loc.scrollIntoViewIfNeeded({ timeout: 20000 })
  await page.waitForTimeout(200)
}

await page.goto(`${BASE}/classrooms/036417bd-7688-49a1-bfa3-de47956b7d09`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.getByRole('button', { name: 'View feedback' }).first().waitFor({ timeout: 90000 })
await page.waitForTimeout(400)
await shot('16-grade6-loaded.png')
await reveal('text=Open assignments')
await shot('17-grade6-open-loaded.png')
await reveal('text=Finished assignments')
await shot('18-grade6-finished-loaded.png')
const classText = await page.locator('#main-content').innerText()
fs.writeFileSync(path.join(OUT, 'grade6-text.txt'), classText)

const counts = await page.evaluate(() => {
  const main = document.getElementById('main-content')?.innerText || ''
  return main.slice(0, 2500)
})
console.log('CLASS\n' + counts.slice(0, 1500))

await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')]
  const btn = buttons.find((b) => (b.textContent || '').trim() === 'View feedback' && (b.parentElement?.innerText || '').includes('Learners Book 6'))
    || buttons.find((b) => (b.textContent || '').trim() === 'View feedback')
  btn?.click()
})
try {
  await page.waitForURL(/\/results\//, { timeout: 20000 })
} catch {
  console.log('feedback click did not navigate; opening the saved science result')
  await page.goto(`${BASE}/results/8329ba87-4e7b-4aa8-b34c-9551f82413e4`, { waitUntil: 'domcontentloaded', timeout: 60000 })
}
await page.getByText(/Every question|Result not found|Assessment review/i).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(800)
await shot('19-assignment-result.png')
const q = page.locator('#question-1')
if (await q.count()) {
  await reveal('#question-1')
  await shot('20-assignment-question.png')
}
fs.writeFileSync(path.join(OUT, 'assignment-page-text.txt'), await page.locator('#main-content').innerText())

await page.goto(`${BASE}/results/4995d5f1-2a25-418b-93ce-19bb0effe26c`, { waitUntil: 'commit', timeout: 60000 })
await page.getByText(/Every question|Result not found|Assessment review/i).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(1000)
await shot('21-quiz-result-top.png')
const review = await page.evaluate(() => {
  const questions = [...document.querySelectorAll('[id^="question-"]')].map((el) => ({
    id: el.id,
    text: (el.innerText || '').slice(0, 1600),
    katex: [...el.querySelectorAll('.katex-error')].map((k) => (k.textContent || '').slice(0, 160)),
    imgs: [...el.querySelectorAll('img')].map((img) => ({
      src: img.getAttribute('src'),
      w: img.naturalWidth,
      complete: img.complete,
    })),
  }))
  return { h1: document.querySelector('h1')?.innerText || '', questions }
})
fs.writeFileSync(path.join(OUT, 'quiz-review.json'), JSON.stringify(review, null, 2))
console.log('h1', review.h1, 'n', review.questions.length)
for (const item of review.questions) {
  await reveal('#' + item.id)
  await shot('22-' + item.id + '.png')
}
await context.close()
