/**
 * Student-only walk of dashboard, classrooms, and one saved result.
 * Does not click Start, Continue, Retry, Retake, New set, or Submit.
 */
import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const PROFILE = path.join(OUT, 'chrome-profile-d')

const notes = []
function note(msg) {
  notes.push(msg)
  console.log(msg)
}

async function login() {
  const password = process.env.SS_LOGIN_PASSWORD
  if (!password) throw new Error('SS_LOGIN_PASSWORD is not set')
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'b.sumba@alustudent.com',
      password,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.user) {
    throw new Error(`login failed (${res.status})`)
  }
  const user = { ...json.user }
  delete user.password
  fs.writeFileSync(path.join(OUT, 'session-user.json'), JSON.stringify({ id: user.id, name: user.name, role: user.role, class: user.class ?? user.className ?? null }, null, 2))
  note(`login ok role=${user.role} id=${user.id}`)
  return user
}

async function shot(page, name) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage: false })
  note(`shot ${name} url=${page.url()}`)
  return file
}

async function shotFull(page, name) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage: true })
  note(`shot-full ${name}`)
  return file
}

async function pageFacts(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || ''
    const links = [...document.querySelectorAll('a')].map((a) => ({
      href: a.getAttribute('href'),
      label: (a.getAttribute('aria-label') || a.innerText || '').trim().slice(0, 180),
    }))
    const buttons = [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim().slice(0, 80)).filter(Boolean)
    const katexErrors = [...document.querySelectorAll('.katex-error')].map((el) => el.textContent?.slice(0, 200))
    const brokenImgs = [...document.querySelectorAll('img')].filter((img) => img.complete && img.naturalWidth === 0 && img.src).map((img) => img.src).slice(0, 20)
    const overflow = [...document.querySelectorAll('h1,h2,h3,p,button,a')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && el.scrollWidth > el.clientWidth + 8 && r.width < window.innerWidth
    }).slice(0, 15).map((el) => ({
      tag: el.tagName,
      text: (el.innerText || '').trim().slice(0, 120),
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }))
    return {
      title: document.title,
      url: location.href,
      text: text.slice(0, 14000),
      links,
      buttons: [...new Set(buttons)].slice(0, 80),
      katexErrors,
      brokenImgs,
      overflow,
    }
  })
}

async function dismissChromeNoise(page) {
  const labels = ['Skip', 'Got it', 'Not now', 'Close', 'Dismiss', 'Maybe later']
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if (await btn.count()) {
      await btn.first().click({ timeout: 1500 }).catch(() => {})
    }
  }
}

async function main() {
  const user = await login()
  fs.mkdirSync(PROFILE, { recursive: true })

  const context = await chromium.launchPersistentContext(PROFILE, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    args: ['--no-first-run', '--disable-sync', '--disable-extensions'],
  })
  await context.addInitScript((userJson) => {
    localStorage.setItem('user', userJson)
    // A first-run coach mark covers the class list. Skip it the way the dialog does,
    // so the pages underneath can be read. This does not start or submit anything.
    localStorage.setItem('ss-tour-seen-home', '1')
    localStorage.setItem('ss-product-tour-seen', '1')
  }, JSON.stringify(user))

  const page = context.pages()[0] || await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') note(`console.error ${msg.text().slice(0, 300)}`)
  })
  page.on('pageerror', (err) => note(`pageerror ${String(err).slice(0, 300)}`))

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('button', { name: /Skip the tour/i }).click({ timeout: 4000 }).catch(() => {})
  await page.waitForSelector('a[href^="/results/"]', { timeout: 90000 })
  await page.waitForTimeout(800)
  const dash = await pageFacts(page)
  fs.writeFileSync(path.join(OUT, 'dashboard.json'), JSON.stringify(dash, null, 2))
  await shot(page, '01-dashboard-top.png')
  await page.evaluate(() => window.scrollTo(0, 700))
  await page.waitForTimeout(400)
  await shot(page, '02-dashboard-mid.png')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  await shot(page, '03-dashboard-bottom.png')

  const resultLinks = dash.links.filter((l) => l.href && l.href.startsWith('/results/'))
  note(`result links ${resultLinks.length}`)

  await page.goto(`${BASE}/classrooms`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('button', { name: /Skip the tour/i }).click({ timeout: 4000 }).catch(() => {})
  await page.getByText(/Grade 6/i).first().waitFor({ timeout: 90000 })
  await page.waitForTimeout(800)
  const rooms = await pageFacts(page)
  fs.writeFileSync(path.join(OUT, 'classrooms.json'), JSON.stringify(rooms, null, 2))
  await shot(page, '04-classrooms.png')

  const science = page.getByRole('button', { name: /Grade 6/i })
  const scienceCount = await science.count()
  note(`grade6 buttons ${scienceCount}`)
  if (scienceCount) {
    await science.first().click()
    await page.getByText(/View feedback|Finished assignments/i).first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(800)
    const klass = await pageFacts(page)
    fs.writeFileSync(path.join(OUT, 'grade6.json'), JSON.stringify(klass, null, 2))
    await shot(page, '05-grade6-top.png')
    await page.evaluate(() => window.scrollTo(0, 700))
    await page.waitForTimeout(300)
    await shot(page, '06-grade6-mid.png')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    await shot(page, '07-grade6-bottom.png')

    const feedback = page.getByRole('button', { name: /^View feedback$/i })
    const feedbackCount = await feedback.count()
    note(`view feedback buttons ${feedbackCount}`)
    const scienceCard = page.locator('div').filter({ hasText: /Science Learners Book 6/ }).filter({ has: page.getByRole('button', { name: /^View feedback$/i }) }).last()
    const feedbackTarget = (await scienceCard.count()) ? scienceCard.getByRole('button', { name: /^View feedback$/i }) : feedback
    if (feedbackCount) {
      await feedbackTarget.first().click()
      await page.waitForTimeout(3000)
      const assignment = await pageFacts(page)
      fs.writeFileSync(path.join(OUT, 'assignment-result.json'), JSON.stringify({ url: page.url(), ...assignment, text: assignment.text.slice(0, 8000) }, null, 2))
      await shot(page, '08-assignment-result-top.png')
      await page.evaluate(() => {
        const q = document.getElementById('question-1')
        if (q) q.scrollIntoView({ block: 'start' })
      })
      await page.waitForTimeout(400)
      await shot(page, '09-assignment-question.png')
    } else {
      note('no view-feedback control; did not open Start/Continue/Retry')
    }
  }

  // Back to dashboard and open one existing result via its results link.
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('a[href^="/results/"]', { timeout: 90000 })
  await page.waitForTimeout(500)
  const cards = await page.$$eval('a[href^="/results/"]', (els) => els.map((a) => ({
    href: a.getAttribute('href'),
    label: a.getAttribute('aria-label') || '',
    card: (a.parentElement?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
  })))
  fs.writeFileSync(path.join(OUT, 'dashboard-cards.json'), JSON.stringify(cards, null, 2))
  const rawish = cards.find((c) => /Cambridge-IGCSE|MARRY|MARRY-JONES|AS _ A Level|SB Core/i.test(`${c.label} ${c.card}`))
  const chosen = rawish || cards[0]
  note(`chosen result ${chosen ? chosen.href : 'none'} rawish=${Boolean(rawish)}`)
  if (chosen?.href) {
    await page.goto(`${BASE}${chosen.href}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3000)
    await shot(page, '10-quiz-result-top.png')
    const questions = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[id^="question-"]')]
      return nodes.map((el) => ({
        id: el.id,
        text: (el.innerText || '').slice(0, 2500),
        katex: [...el.querySelectorAll('.katex-error')].map((k) => k.textContent),
        htmlSnippet: (el.innerHTML || '').replace(/\s+/g, ' ').slice(0, 1500),
      }))
    })
    const header = await pageFacts(page)
    fs.writeFileSync(path.join(OUT, 'quiz-result.json'), JSON.stringify({
      url: page.url(),
      headerText: header.text.slice(0, 4000),
      katexErrors: header.katexErrors,
      brokenImgs: header.brokenImgs,
      overflow: header.overflow,
      questionCount: questions.length,
      questions,
    }, null, 2))

    const qCount = questions.length
    const shots = Math.min(qCount, 8)
    for (let i = 1; i <= shots; i++) {
      await page.evaluate((n) => {
        const q = document.getElementById(`question-${n}`)
        if (q) q.scrollIntoView({ block: 'start' })
      }, i)
      await page.waitForTimeout(250)
      await shot(page, `11-question-${i}.png`)
    }
    if (qCount > 8) {
      await page.evaluate((n) => {
        const q = document.getElementById(`question-${n}`)
        if (q) q.scrollIntoView({ block: 'start' })
      }, qCount)
      await page.waitForTimeout(250)
      await shot(page, `12-question-last.png`)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await shotFull(page, '13-quiz-result-full.png').catch((err) => note(`full shot failed ${err.message}`))
  }

  fs.writeFileSync(path.join(OUT, 'notes.txt'), notes.join('\n'))
  await context.close()
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err)
  process.exit(1)
})
