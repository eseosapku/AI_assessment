/**
 * Scrolls the studio main column (the window itself does not scroll)
 * and opens one finished assignment plus one dashboard result.
 * Does not click Start, Continue, Retry, Retake, New set, or Submit.
 */
import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const PROFILE = path.join(OUT, 'chrome-profile-e')
const CLASS_ID = '036417bd-7688-49a1-bfa3-de47956b7d09'
const QUIZ = '/results/4995d5f1-2a25-418b-93ce-19bb0effe26c'

const password = process.env.SS_LOGIN_PASSWORD
if (!password) throw new Error('missing password env')
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'b.sumba@alustudent.com', password }),
})
const loginJson = await loginRes.json()
if (!loginRes.ok || !loginJson.user) throw new Error('login failed')
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
const notes = []
const note = (m) => { notes.push(m); console.log(m) }

async function shot(name) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file })
  note('shot ' + name + ' ' + page.url())
}

async function reveal(locator) {
  await locator.first().scrollIntoViewIfNeeded({ timeout: 15000 })
  await page.waitForTimeout(250)
}

await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
const marry = page.locator('a[aria-label="View results for Cambridge-IGCSE-Biology-MARRY-JONES-4th-Ed"]')
await marry.waitFor({ state: 'attached', timeout: 90000 })
await reveal(marry)
await shot('14-dashboard-quiz-cards.png')

const cards = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href^="/results/"]')].map((a) => {
    const card = a.parentElement
    const title = card?.querySelector('h3')
    const r = title?.getBoundingClientRect()
    return {
      href: a.getAttribute('href'),
      label: a.getAttribute('aria-label'),
      title: title?.innerText || '',
      titleScroll: title ? title.scrollWidth : 0,
      titleClient: title ? title.clientWidth : 0,
      cardText: (card?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    }
  })
})
fs.writeFileSync(path.join(OUT, 'dashboard-cards.json'), JSON.stringify(cards, null, 2))

const subjects = page.getByText('How each subject is going')
await reveal(subjects)
await shot('15-dashboard-subjects.png')

await page.goto(`${BASE}/classrooms/${CLASS_ID}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.getByText(/Finished assignments|Open assignments|View feedback|Continue|Deadline passed/i).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(600)
await shot('16-grade6-top.png')
const openHead = page.getByText('Open assignments', { exact: true })
if (await openHead.count()) {
  await reveal(openHead)
  await shot('17-grade6-open.png')
}
const finHead = page.getByText('Finished assignments', { exact: true })
if (await finHead.count()) {
  await reveal(finHead)
  await shot('18-grade6-finished.png')
}
const classText = await page.locator('#main-content').innerText()
fs.writeFileSync(path.join(OUT, 'grade6-text.txt'), classText.slice(0, 12000))

const clicked = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')]
  const btn = buttons.find((b) => (b.textContent || '').trim() === 'View feedback' && (b.closest('div')?.innerText || '').includes('Learners Book 6'))
  if (!btn) return false
  btn.click()
  return true
})
note('clicked science view feedback ' + clicked)
if (clicked) {
  await page.waitForURL(/\/results\//, { timeout: 30000 })
  await page.waitForTimeout(2000)
  await shot('19-assignment-top.png')
  const q1 = page.locator('#question-1')
  if (await q1.count()) {
    await reveal(q1)
    await shot('20-assignment-q1.png')
  }
  fs.writeFileSync(path.join(OUT, 'assignment-page-text.txt'), (await page.locator('#main-content').innerText()).slice(0, 8000))
}

await page.goto(`${BASE}${QUIZ}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.getByText(/Every question, and why|Result not found|Loading results/i).first().waitFor({ timeout: 60000 })
await page.waitForTimeout(1500)
await shot('21-quiz-result-top.png')

const review = await page.evaluate(() => {
  const questions = [...document.querySelectorAll('[id^="question-"]')].map((el) => {
    const imgs = [...el.querySelectorAll('img')].map((img) => ({
      src: img.getAttribute('src'),
      w: img.naturalWidth,
      h: img.naturalHeight,
      complete: img.complete,
      alt: (img.getAttribute('alt') || '').slice(0, 80),
    }))
    return {
      id: el.id,
      text: (el.innerText || '').slice(0, 1800),
      katexErrors: [...el.querySelectorAll('.katex-error')].map((k) => k.textContent),
      imgs,
    }
  })
  const h1 = document.querySelector('h1')?.innerText || ''
  return { h1, url: location.href, questions }
})
fs.writeFileSync(path.join(OUT, 'quiz-review.json'), JSON.stringify(review, null, 2))
note('quiz h1 ' + review.h1 + ' questions ' + review.questions.length)

for (const q of review.questions) {
  const n = q.id.replace('question-', '')
  await reveal(page.locator('#' + q.id))
  await shot(`22-q${n}.png`)
}

fs.writeFileSync(path.join(OUT, 'capture-notes.txt'), notes.join('\n'))
await context.close()
