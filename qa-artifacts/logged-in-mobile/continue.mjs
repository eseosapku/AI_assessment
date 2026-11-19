import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-mobile'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const PASSWORD = process.env.QA_PASSWORD || ''
if (!EMAIL || !PASSWORD) {
  console.error('missing credentials')
  process.exit(1)
}

const loginRes = await fetch(ORIGIN + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
})
const loginBody = await loginRes.json().catch(() => ({}))
if (!loginRes.ok || !loginBody.user) {
  console.error('login failed', loginRes.status)
  process.exit(1)
}
const user = loginBody.user
for (const key of Object.keys(user)) {
  if (/password|secret|token|hash/i.test(key)) delete user[key]
}
console.log('login', loginRes.status, user.role)

const userDataDir = path.join(OUT, 'chrome-profile')
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  args: [
    '--window-size=390,844',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--force-device-scale-factor=1',
    '--disable-features=PasswordManagerOnboarding,AutofillServerCommunication',
    '--password-store=basic',
  ],
})
await context.addInitScript((json) => {
  localStorage.setItem('user', json)
}, JSON.stringify(user))

const page = context.pages()[0] || (await context.newPage())
page.setDefaultNavigationTimeout(90000)
page.setDefaultTimeout(20000)

const report = { pages: {}, dismiss: {}, signOut: null }

function log(msg) {
  console.log(new Date().toISOString().slice(11, 19), msg)
}

async function hideDev(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('nextjs-portal, [data-nextjs-toast], [data-next-badge]')) {
      el.style.setProperty('display', 'none', 'important')
    }
  }).catch(() => {})
}

async function settle(page) {
  await page.waitForTimeout(400)
  let last = ''
  let stable = 0
  const start = Date.now()
  while (Date.now() - start < 12000) {
    await page.waitForTimeout(300)
    const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300)).catch(() => '')
    const spinning = await page.evaluate(() => [...document.querySelectorAll('.animate-spin')].some((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 12 && r.height > 12
    })).catch(() => false)
    if (text && text === last && !spinning) stable += 1
    else stable = 0
    last = text
    if (stable >= 3 && Date.now() - start > 1400) break
  }
}

function measure() {
  const vw = innerWidth
  const vh = innerHeight
  const textOf = (el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()
  const nav = document.querySelector('nav[aria-label="Main, compact"]')
  const navRect = nav ? nav.getBoundingClientRect() : null
  const labels = []
  if (nav) {
    for (const a of nav.querySelectorAll('a')) {
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT)
      let node = null
      let last = null
      while ((node = walker.nextNode())) if ((node.textContent || '').trim()) last = node
      let box = null
      if (last) {
        const range = document.createRange()
        range.selectNodeContents(last)
        const r = range.getBoundingClientRect()
        box = { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right) }
      }
      const ar = a.getBoundingClientRect()
      labels.push({ label: textOf(a), x: Math.round(ar.x), w: Math.round(ar.width), box })
    }
  }
  const gaps2 = []
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1]
    const cur = labels[i]
    if (prev.box && cur.box) gaps2.push({ from: prev.label, to: cur.label, px: cur.box.x - prev.box.right })
  }

  const main = document.querySelector('main')
  const overflow = {
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main: main ? main.scrollWidth - main.clientWidth : null,
  }

  const bleed = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    if (r.right <= vw + 1 && r.left >= -1) continue
    const p = el.parentElement
    const pr = p ? p.getBoundingClientRect() : null
    if (pr && (pr.right > vw + 1 || pr.left < -1)) continue
    bleed.push({ tag: el.tagName.toLowerCase(), text: textOf(el).slice(0, 60), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) })
    if (bleed.length >= 8) break
  }

  const covered = []
  if (nav && navRect) {
    for (const el of document.querySelectorAll('a, button, input, [role="button"]')) {
      if (nav.contains(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      if (r.bottom < navRect.top + 6 || r.top > navRect.bottom) continue
      const cx = Math.min(vw - 2, Math.max(2, r.left + r.width / 2))
      const cy = Math.min(vh - 2, Math.max(2, Math.max(r.top, navRect.top) + 4))
      const centerY = r.top + r.height / 2
      const topEl = document.elementFromPoint(cx, Math.min(vh - 2, centerY))
      const blocked = centerY >= navRect.top && topEl && nav.contains(topEl)
      if (!blocked) continue
      covered.push({ text: textOf(el).slice(0, 70), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) })
      if (covered.length >= 8) break
    }
  }

  const cut = []
  for (const el of document.querySelectorAll('[class*="truncate"], h1, h2, h3, p, a, button, span')) {
    const full = textOf(el)
    if (!full || full.length > 60 || el.childElementCount > 2) continue
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > vh || r.width < 8) continue
    const cs = getComputedStyle(el)
    const clipped = el.scrollWidth > el.clientWidth + 3 || ((cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) && el.scrollHeight > el.clientHeight + 3)
    if (!clipped) continue
    cut.push({ text: full, w: Math.round(r.width), scrollW: el.scrollWidth, clientW: el.clientWidth, cls: String(el.className || '').slice(0, 50) })
    if (cut.length >= 10) break
  }

  const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((el) => {
    const r = el.getBoundingClientRect()
    const buttons = [...el.querySelectorAll('button')].map((b) => {
      const br = b.getBoundingClientRect()
      return { text: textOf(b).slice(0, 40), w: Math.round(br.width), h: Math.round(br.height), top: Math.round(br.top), bottom: Math.round(br.bottom), inView: br.top >= 0 && br.bottom <= vh && br.left >= 0 && br.right <= vw }
    })
    return { text: textOf(el).slice(0, 160), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), off: r.bottom > vh + 1 || r.right > vw + 1 || r.left < -1, buttons }
  })

  const small = []
  for (const el of document.querySelectorAll('a, button')) {
    const label = textOf(el)
    if (!label) continue
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > vh || r.width < 2) continue
    if (r.width >= 40 && r.height >= 40) continue
    if (nav && nav.contains(el)) continue
    small.push({ text: label.slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) })
    if (small.length >= 12) break
  }

  return {
    path: location.pathname,
    labels: labels.map((l) => ({ label: l.label, box: l.box })),
    gaps: gaps2,
    overflow,
    bleed,
    covered,
    cut,
    dialogs,
    small,
    navTop: navRect ? Math.round(navRect.top) : null,
  }
}

// fix label field — I shadowed text. Patch by redefining measure cleanly below if gaps are empty.
// The function above has a bug: labels.push uses `text` twice. I'll compute gaps in node from raw boxes if needed.

async function shot(page, name) {
  await hideDev(page)
  const file = path.join(OUT, name + '.png')
  await page.screenshot({ path: file, fullPage: false })
  const buf = fs.readFileSync(file)
  return { file, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const routes = ['/dashboard', '/practice', '/studylab', '/classrooms', '/progress', '/settings']

try {
  for (const route of routes) {
    log('goto ' + route)
    await page.goto(ORIGIN + route, { waitUntil: 'commit', timeout: 90000 })
    await page.waitForSelector('body', { timeout: 20000 })
    await settle(page)
    const name = route.slice(1)
    report.pages[name] = { shot: await shot(page, name), before: await page.evaluate(measure) }
    log('shot ' + name + ' dialogs ' + (report.pages[name].before.dialogs || []).length)

    const hadTour = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /skip the tour/i.test(d.innerText || '')))
    if (hadTour) {
      const attempts = []
      const skip = page.getByRole('button', { name: 'Skip the tour' })
      const box = await skip.boundingBox().catch(() => null)
      if (box && box.y + box.height <= 844 && box.y >= 0) {
        await skip.click({ timeout: 4000 }).catch(() => attempts.push('skip-click-failed'))
        attempts.push('clicked-skip')
      } else {
        attempts.push('skip-offscreen')
        const pt = await page.evaluate(() => {
          const d = [...document.querySelectorAll('[role="dialog"]')].find((el) => /skip the tour/i.test(el.innerText || ''))
          if (!d) return null
          const r = d.getBoundingClientRect()
          const spots = [[innerWidth / 2, 16], [16, 160], [innerWidth - 16, 160]]
          for (const [x, y] of spots) {
            if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) return { x, y }
          }
          return null
        })
        if (pt) {
          await page.mouse.click(pt.x, pt.y)
          attempts.push('backdrop')
        }
      }
      await page.waitForTimeout(400)
      let still = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /skip the tour/i.test(d.innerText || '')))
      if (still) {
        const pt = await page.evaluate(() => {
          const d = [...document.querySelectorAll('[role="dialog"]')].find((el) => /skip the tour/i.test(el.innerText || ''))
          if (!d) return null
          const r = d.getBoundingClientRect()
          const spots = [[innerWidth / 2, 12], [10, 200], [innerWidth - 10, 80], [innerWidth / 2, innerHeight - 8]]
          for (const [x, y] of spots) {
            if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) return { x, y }
          }
          return null
        })
        if (pt) {
          await page.mouse.click(pt.x, pt.y)
          attempts.push('backdrop-2')
          await page.waitForTimeout(300)
          still = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /skip the tour/i.test(d.innerText || '')))
        }
      }
      report.dismiss[name] = { attempts, still }
      log('dismiss ' + name + ' ' + JSON.stringify(report.dismiss[name]))
      await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0 })
      report.pages[name].after = await page.evaluate(measure)
      const end = await page.evaluate(() => {
        const m = document.querySelector('main')
        if (!m) return null
        m.scrollTop = m.scrollHeight
        return { top: m.scrollTop, height: m.scrollHeight, client: m.clientHeight }
      })
      await page.waitForTimeout(200)
      report.pages[name].atEnd = { scroll: end, ...(await page.evaluate(measure)) }
      if ((report.pages[name].after.covered || []).length || (report.pages[name].atEnd.covered || []).length) {
        await shot(page, name + '-bottom')
      }
    }
  }

  log('sign out check')
  await page.goto(ORIGIN + '/settings', { waitUntil: 'commit' })
  await settle(page)
  await hideDev(page)
  const pageText = await page.evaluate(() => ({
    signOut: /sign out/i.test(document.body.innerText || ''),
    logout: /log\s*out/i.test(document.body.innerText || ''),
  }))
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = m.scrollHeight })
  await page.waitForTimeout(300)
  const atBottom = await page.evaluate(() => ({
    signOut: /sign out/i.test(document.body.innerText || ''),
    logout: /log\s*out/i.test(document.body.innerText || ''),
  }))
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0 })
  const buttons = page.locator('header button')
  const n = await buttons.count()
  let opened = false
  if (n) {
    await buttons.nth(n - 1).click()
    await page.waitForTimeout(800)
    opened = true
  }
  const sheet = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')]
    const d = dialogs.find((el) => /logout|log out|sign out|profile/i.test(el.innerText || '')) || null
    if (!d) return { open: false, texts: dialogs.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)) }
    const btn = [...d.querySelectorAll('button')].find((b) => /log\s*out|sign out/i.test(b.innerText || ''))
    if (!btn) return { open: true, hasLogout: false, sample: (d.innerText || '').slice(0, 200) }
    btn.scrollIntoView({ block: 'center' })
    const r = btn.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const top = document.elementFromPoint(Math.min(innerWidth - 2, Math.max(2, cx)), Math.min(innerHeight - 2, Math.max(2, cy)))
    const nav = document.querySelector('nav[aria-label="Main, compact"]')
    return {
      open: true,
      hasLogout: true,
      label: (btn.innerText || '').replace(/\s+/g, ' ').trim(),
      box: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) },
      inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      hit: (top?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      coveredByNav: !!(nav && top && nav.contains(top)),
      scrollH: d.scrollHeight,
      clientH: d.clientHeight,
    }
  })
  await page.screenshot({ path: path.join(OUT, 'settings-profile.png'), fullPage: false })
  report.signOut = { pageText, atBottom, headerButtons: n, opened, sheet }
  log('signout ' + JSON.stringify(report.signOut).slice(0, 400))
} catch (err) {
  report.fatal = String(err && err.stack ? err.stack : err).slice(0, 900)
  log('FATAL ' + report.fatal.split('\n')[0])
} finally {
  fs.writeFileSync(path.join(OUT, 'audit2.json'), JSON.stringify(report, null, 2))
  await context.close()
}
log('done')
if (report.fatal) process.exit(1)
