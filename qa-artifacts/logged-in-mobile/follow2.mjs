import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-mobile'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const PASSWORD = process.env.QA_PASSWORD || ''
if (!EMAIL || !PASSWORD) process.exit(1)
const loginRes = await fetch(ORIGIN + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
})
const body = await loginRes.json()
if (!loginRes.ok || !body.user) process.exit(1)
const user = body.user
for (const k of Object.keys(user)) if (/password|secret|token|hash/i.test(k)) delete user[k]

const context = await chromium.launchPersistentContext(path.join(OUT, 'chrome-profile'), {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  args: ['--window-size=390,844', '--no-first-run', '--disable-extensions', '--force-device-scale-factor=1', '--password-store=basic'],
})
await context.addInitScript((json) => localStorage.setItem('user', json), JSON.stringify(user))
const page = context.pages()[0] || (await context.newPage())
const out = {}
try {
  await page.goto(ORIGIN + '/practice', { waitUntil: 'commit' })
  await page.waitForSelector('nav[aria-label="Main, compact"]', { timeout: 20000 })
  await page.waitForSelector('text=Choose your mode', { timeout: 20000 })
  await page.waitForTimeout(800)
  await page.evaluate(() => { for (const el of document.querySelectorAll('nextjs-portal')) el.style.display = 'none' })
  await page.screenshot({ path: path.join(OUT, 'practice-fold.png'), fullPage: false })
  out.practice = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    const navTop = nav.getBoundingClientRect().top
    const cards = [...document.querySelectorAll('a, button')].map((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (!/Recall|Exam prep|Class assignment|Quiz me|Build your quiz/i.test(t)) return null
      const r = el.getBoundingClientRect()
      const h2 = el.querySelector('h2')
      const hr = h2 ? h2.getBoundingClientRect() : null
      const cta = [...el.querySelectorAll('span')].map((s) => s.innerText.trim()).find((s) => /Open /i.test(s))
      const ctaEl = cta ? [...el.querySelectorAll('span')].find((s) => /Open /i.test(s.innerText)) : null
      const cr = ctaEl ? ctaEl.getBoundingClientRect() : null
      return {
        t: t.slice(0, 90),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        title: h2 ? h2.innerText : null,
        titleTop: hr ? Math.round(hr.top) : null,
        titleBottom: hr ? Math.round(hr.bottom) : null,
        cta,
        ctaTop: cr ? Math.round(cr.top) : null,
        navTop: Math.round(navTop),
      }
    }).filter(Boolean)
    return { navTop: Math.round(navTop), cards }
  })

  await page.goto(ORIGIN + '/settings', { waitUntil: 'commit' })
  await page.waitForSelector('nav[aria-label="Main, compact"]', { timeout: 20000 })
  await page.waitForTimeout(500)
  out.settings = await page.evaluate(() => {
    const main = document.querySelector('main')
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    const navTop = nav.getBoundingClientRect().top
    const stuck = []
    const steps = Math.ceil(main.scrollHeight / 80)
    for (let i = 0; i <= steps; i++) {
      main.scrollTop = i * 80
      for (const el of main.querySelectorAll('button, a, input, select, textarea')) {
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8) continue
        const cy = r.top + r.height / 2
        if (cy < navTop - 1) continue
        if (r.bottom < navTop) continue
        const top = document.elementFromPoint(Math.min(innerWidth - 4, Math.max(4, r.left + r.width / 2)), Math.min(innerHeight - 4, cy))
        if (top && nav.contains(top)) {
          const label = (el.innerText || el.getAttribute('aria-label') || el.id || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40)
          stuck.push(label)
        }
      }
    }
    main.scrollTop = main.scrollHeight
    const still = []
    for (const el of main.querySelectorAll('button, a, input')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      const cy = r.top + r.height / 2
      if (cy < navTop) continue
      const top = document.elementFromPoint(Math.min(innerWidth - 4, r.left + r.width / 2), Math.min(innerHeight - 4, cy))
      if (top && nav.contains(top)) still.push((el.innerText || el.id || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40))
    }
    return { navTop: Math.round(navTop), uniqueWhileScrolling: [...new Set(stuck)], stillAtEnd: still }
  })

  await page.goto(ORIGIN + '/progress', { waitUntil: 'commit' })
  await page.waitForSelector('nav[aria-label="Main, compact"]', { timeout: 20000 })
  await page.waitForTimeout(800)
  out.progress = await page.evaluate(() => {
    const main = document.querySelector('main')
    main.scrollTop = main.scrollHeight
    const el = [...document.querySelectorAll('a')].find((a) => /start practicing/i.test(a.innerText || ''))
    if (!el) return { found: false, sample: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 180) }
    const r = el.getBoundingClientRect()
    const nav = document.querySelector('nav[aria-label="Main, compact"]').getBoundingClientRect().top
    return { found: true, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(nav) }
  })
} catch (err) {
  out.fatal = String(err.stack || err).slice(0, 400)
  console.error(out.fatal.split('\n')[0])
} finally {
  fs.writeFileSync(path.join(OUT, 'follow2.json'), JSON.stringify(out, null, 2))
  await context.close()
}
console.log('ok')
