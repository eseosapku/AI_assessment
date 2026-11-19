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
if (!loginRes.ok || !body.user) {
  console.error('login failed', loginRes.status)
  process.exit(1)
}
const user = body.user
for (const k of Object.keys(user)) if (/password|secret|token|hash/i.test(k)) delete user[k]

const context = await chromium.launchPersistentContext(path.join(OUT, 'chrome-profile'), {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  args: ['--window-size=390,844', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--force-device-scale-factor=1', '--password-store=basic'],
})
await context.addInitScript((json) => localStorage.setItem('user', json), JSON.stringify(user))
const page = context.pages()[0] || (await context.newPage())
page.setDefaultNavigationTimeout(60000)
const out = {}

async function hide(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('nextjs-portal, [data-nextjs-toast]')) el.style.setProperty('display', 'none', 'important')
  }).catch(() => {})
}

try {
  await page.goto(ORIGIN + '/classrooms', { waitUntil: 'commit' })
  await page.waitForFunction(() => {
    const spinning = [...document.querySelectorAll('.animate-spin')].some((el) => el.getBoundingClientRect().height > 8)
    const text = document.body.innerText || ''
    return !spinning && (/No classes yet|Upcoming|classrooms/i.test(text))
  }, { timeout: 25000 }).catch((e) => { out.classroomsWait = String(e).slice(0, 120) })
  await page.waitForTimeout(600)
  await hide(page)
  await page.screenshot({ path: path.join(OUT, 'classrooms.png'), fullPage: false })
  out.classrooms = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    const navTop = nav ? nav.getBoundingClientRect().top : null
    const names = [...document.querySelectorAll('button, a, h1, h2, p')].map((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (!t || t.length > 80) return null
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) return null
      return {
        t: t.slice(0, 70),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        clipped: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
        underNav: navTop != null && r.top + r.height / 2 > navTop && r.top < navTop,
      }
    }).filter(Boolean).slice(0, 20)
    return { path: location.pathname, navTop: navTop && Math.round(navTop), spinning: !!document.querySelector('.animate-spin'), names, sample: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) }
  })

  await page.goto(ORIGIN + '/practice', { waitUntil: 'commit' })
  await page.waitForTimeout(1500)
  await hide(page)
  const tour = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /skip the tour/i.test(d.innerText || '')))
  out.practiceTour = tour
  await page.screenshot({ path: path.join(OUT, 'practice-clear.png'), fullPage: false })
  out.practice = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    const navTop = nav.getBoundingClientRect().top
    const links = [...document.querySelectorAll('a, button')].map((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim()
      const r = el.getBoundingClientRect()
      if (r.height < 20 || r.bottom < navTop - 40 || r.top > innerHeight) return null
      const title = el.querySelector('h2')
      const tr = title ? title.getBoundingClientRect() : null
      const cx = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2))
      const probeY = Math.min(r.bottom - 4, navTop + 8)
      const above = document.elementFromPoint(cx, Math.max(r.top + 8, Math.min(r.bottom - 8, navTop - 20)))
      const onNav = document.elementFromPoint(cx, Math.min(innerHeight - 2, navTop + 12))
      return {
        t: t.slice(0, 80),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        titleTop: tr ? Math.round(tr.top) : null,
        titleUnderNav: tr ? tr.top >= navTop - 2 : null,
        visibleHit: above && (above === el || el.contains(above)),
        navCoversLower: !!(onNav && nav.contains(onNav) && r.bottom > navTop + 8),
      }
    }).filter(Boolean)
    return { navTop: Math.round(navTop), links }
  })

  await page.goto(ORIGIN + '/progress', { waitUntil: 'commit' })
  await page.waitForTimeout(1500)
  await hide(page)
  out.progress = await page.evaluate(() => {
    const el = [...document.querySelectorAll('a, button')].find((n) => /start practicing/i.test(n.innerText || ''))
    if (!el) return { found: false, dialog: [...document.querySelectorAll('[role="dialog"]')].map((d) => (d.innerText || '').slice(0, 40)) }
    const r = el.getBoundingClientRect()
    return { found: true, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), text: (el.innerText || '').replace(/\s+/g, ' ').trim() }
  })
  if (!out.progress.found) {
    await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = m.scrollHeight })
    await page.waitForTimeout(300)
    out.progressAtEnd = await page.evaluate(() => {
      const el = [...document.querySelectorAll('a, button')].find((n) => /start practicing/i.test(n.innerText || ''))
      if (!el) return { found: false }
      const r = el.getBoundingClientRect()
      const nav = document.querySelector('nav[aria-label="Main, compact"]')
      const navTop = nav.getBoundingClientRect().top
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const top = document.elementFromPoint(cx, cy)
      return { found: true, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(navTop), hit: (top?.innerText || '').slice(0, 30), covered: !!(nav && top && nav.contains(top)) }
    })
    await page.screenshot({ path: path.join(OUT, 'progress-end.png'), fullPage: false })
  }

  await page.goto(ORIGIN + '/settings', { waitUntil: 'commit' })
  await page.waitForTimeout(800)
  await hide(page)
  out.settingsSweep = await page.evaluate(() => {
    const main = document.querySelector('main')
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    const navTop = nav.getBoundingClientRect().top
    const hits = []
    const max = main.scrollHeight
    for (let y = 0; y <= max; y += 120) {
      main.scrollTop = y
      for (const el of main.querySelectorAll('button, a, input, select')) {
        const r = el.getBoundingClientRect()
        if (r.height < 8 || r.width < 8) continue
        const cy = r.top + r.height / 2
        if (cy < navTop || cy > innerHeight) continue
        const top = document.elementFromPoint(Math.min(innerWidth - 2, r.left + r.width / 2), cy)
        if (top && nav.contains(top)) {
          hits.push({ text: ((el.innerText || el.getAttribute('aria-label') || el.id || '').replace(/\s+/g, ' ').trim()).slice(0, 40), scroll: y, top: Math.round(r.top) })
        }
      }
    }
    main.scrollTop = main.scrollHeight
    return { navTop: Math.round(navTop), hits: hits.slice(0, 12), scrollHeight: main.scrollHeight, client: main.clientHeight }
  })
} catch (err) {
  out.fatal = String(err.stack || err).slice(0, 500)
  console.error(out.fatal.split('\n')[0])
} finally {
  fs.writeFileSync(path.join(OUT, 'follow.json'), JSON.stringify(out, null, 2))
  await context.close()
}
console.log('wrote follow')
