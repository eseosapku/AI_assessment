import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\logged-in-mobile'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const PASSWORD = process.env.QA_PASSWORD || ''

if (!EMAIL || !PASSWORD) {
  console.error('missing credentials in environment')
  process.exit(1)
}

fs.mkdirSync(OUT, { recursive: true })

function assertLocal(url) {
  const u = new URL(url, ORIGIN)
  if (u.hostname !== 'localhost' || u.port !== '3000' || u.protocol !== 'http:') {
    throw new Error('refusing non-local url')
  }
  return u.toString()
}

const loginRes = await fetch(assertLocal(ORIGIN + '/api/auth/login'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
})
const loginBody = await loginRes.json().catch(() => ({}))
if (!loginRes.ok || !loginBody.user) {
  console.error('login failed', loginRes.status, String(loginBody.error || 'no user'))
  process.exit(1)
}
const user = loginBody.user
for (const key of Object.keys(user)) {
  if (/password|secret|token|hash/i.test(key)) delete user[key]
}
const userJson = JSON.stringify(user)
console.log('login ok', loginRes.status, 'role', user.role, 'profileComplete', user.profileComplete, 'genderSet', user.gender != null, 'nameLen', String(user.name || '').length)

const ROUTES = ['/dashboard', '/practice', '/studylab', '/classrooms', '/progress', '/settings']

function pngSize(file) {
  const buf = fs.readFileSync(file)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function auditScript() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const visible = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1
  }
  const textOf = (el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()

  const nav = document.querySelector('nav[aria-label="Main, compact"]')
  const navRect = nav ? nav.getBoundingClientRect() : null

  const labelInfo = []
  if (nav) {
    const links = [...nav.querySelectorAll('a')]
    for (const a of links) {
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT)
      let node = null
      let last = null
      while ((node = walker.nextNode())) {
        if ((node.textContent || '').trim()) last = node
      }
      const aRect = a.getBoundingClientRect()
      let textRect = null
      if (last) {
        const range = document.createRange()
        range.selectNodeContents(last)
        textRect = range.getBoundingClientRect()
      }
      labelInfo.push({
        text: textOf(a),
        link: { x: Math.round(aRect.x), y: Math.round(aRect.y), w: Math.round(aRect.width), h: Math.round(aRect.height), right: Math.round(aRect.right) },
        textBox: textRect
          ? { x: Math.round(textRect.x), y: Math.round(textRect.y), w: Math.round(textRect.width), h: Math.round(textRect.height), right: Math.round(textRect.right), bottom: Math.round(textRect.bottom) }
          : null,
        textWiderThanLink: !!(textRect && textRect.width > aRect.width + 1),
        textOutsideLink: !!(textRect && (textRect.right > aRect.right + 1 || textRect.left < aRect.left - 1 || textRect.bottom > aRect.bottom + 1)),
      })
    }
    for (let i = 0; i < labelInfo.length; i++) {
      for (let j = i + 1; j < labelInfo.length; j++) {
        const A = labelInfo[i].textBox
        const B = labelInfo[j].textBox
        if (!A || !B) continue
        const overlap = A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y
        if (overlap) {
          labelInfo[i].overlaps = labelInfo[j].text
          labelInfo[j].overlaps = labelInfo[i].text
        }
      }
    }
  }

  const main = document.querySelector('main')
  const scrollers = [document.scrollingElement, document.documentElement, document.body, main].filter(Boolean)
  const overflowScroll = scrollers.map((el) => ({
    tag: el === main ? 'main' : el === document.body ? 'body' : el === document.documentElement ? 'html' : 'scroller',
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    overflowX: el.scrollWidth > el.clientWidth + 1,
  }))

  const bleed = []
  const nodes = document.querySelectorAll('body *')
  for (const el of nodes) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    const overflows = r.right > vw + 1 || r.left < -1
    if (!overflows) continue
    const parent = el.parentElement
    const pr = parent ? parent.getBoundingClientRect() : null
    const parentOverflows = pr && (pr.right > vw + 1 || pr.left < -1)
    if (parentOverflows) continue
    const cs = getComputedStyle(el)
    bleed.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls: String(el.className || '').toString().slice(0, 80),
      text: textOf(el).slice(0, 80),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      position: cs.position,
    })
    if (bleed.length >= 12) break
  }

  const covered = []
  if (nav && navRect) {
    const controls = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')]
    for (const el of controls) {
      if (nav.contains(el) || !visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.bottom < navRect.top + 4 || r.top > navRect.bottom - 4) continue
      const overlapTop = Math.max(r.top, navRect.top)
      const overlapBot = Math.min(r.bottom, navRect.bottom)
      const overlapH = overlapBot - overlapTop
      if (overlapH < 8) continue
      const cx = Math.min(vw - 2, Math.max(2, r.left + r.width / 2))
      const cy = Math.min(vh - 2, Math.max(2, (overlapTop + overlapBot) / 2))
      const topEl = document.elementFromPoint(cx, cy)
      const blocked = !!topEl && nav.contains(topEl) && !el.contains(topEl)
      if (!blocked) continue
      const frac = overlapH / r.height
      const centerCovered = r.top + r.height / 2 >= navRect.top
      if (frac < 0.25 && !centerCovered) continue
      covered.push({
        tag: el.tagName.toLowerCase(),
        text: textOf(el).slice(0, 80),
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        frac: Math.round(frac * 100),
        centerCovered,
      })
      if (covered.length >= 12) break
    }
  }

  const cutOff = []
  const candidates = [...document.querySelectorAll('h1, h2, h3, p, span, a, button, li, label, [class*="truncate"], [class*="line-clamp"]')]
  for (const el of candidates) {
    if (!visible(el)) continue
    const full = textOf(el)
    if (!full || full.length > 80) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none'
    const ellipsis = cs.textOverflow === 'ellipsis'
    const hidden = cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.overflowY === 'hidden'
    const wider = el.scrollWidth > el.clientWidth + 2
    const taller = el.scrollHeight > el.clientHeight + 2
    if (!(wider || (taller && (clamp || hidden)) || (ellipsis && wider))) continue
    if (el.childElementCount > 3 && !String(el.className || '').includes('truncate')) continue
    cutOff.push({
      tag: el.tagName.toLowerCase(),
      text: full,
      w: Math.round(r.width),
      h: Math.round(r.height),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      ellipsis,
      clamp: cs.webkitLineClamp || '',
      cls: String(el.className || '').toString().slice(0, 70),
    })
    if (cutOff.length >= 15) break
  }

  const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(visible).map((el) => {
    const r = el.getBoundingClientRect()
    const buttons = [...el.querySelectorAll('button, a')].filter(visible).map((b) => {
      const br = b.getBoundingClientRect()
      const cx = br.left + br.width / 2
      const cy = br.top + br.height / 2
      const inView = br.width > 0 && br.top >= -1 && br.left >= -1 && br.bottom <= vh + 1 && br.right <= vw + 1
      let hittable = false
      let hit = ''
      if (inView) {
        const topEl = document.elementFromPoint(Math.min(vw - 2, Math.max(2, cx)), Math.min(vh - 2, Math.max(2, cy)))
        hittable = !!topEl && (topEl === b || b.contains(topEl))
        hit = textOf(topEl).slice(0, 40)
      }
      return {
        text: textOf(b).slice(0, 60),
        w: Math.round(br.width),
        h: Math.round(br.height),
        top: Math.round(br.top),
        left: Math.round(br.left),
        right: Math.round(br.right),
        bottom: Math.round(br.bottom),
        inView,
        hittable,
        hit,
      }
    })
    return {
      label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '',
      text: textOf(el).slice(0, 280),
      top: Math.round(r.top),
      left: Math.round(r.left),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      w: Math.round(r.width),
      h: Math.round(r.height),
      offscreen: r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1,
      buttons,
    }
  })

  const small = []
  for (const el of document.querySelectorAll('a, button, [role="button"]')) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
    const label = textOf(el)
    if (!label) continue
    if (r.width >= 40 && r.height >= 40) continue
    const cx = Math.min(vw - 2, Math.max(2, r.left + Math.min(r.width / 2, r.width - 1)))
    const cy = Math.min(vh - 2, Math.max(2, r.top + Math.min(r.height / 2, r.height - 1)))
    const topEl = document.elementFromPoint(cx, cy)
    small.push({
      tag: el.tagName.toLowerCase(),
      text: label.slice(0, 70),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      left: Math.round(r.left),
      hittable: !!topEl && (topEl === el || el.contains(topEl)),
    })
    if (small.length >= 20) break
  }

  const signOut = [...document.querySelectorAll('a, button')].filter((el) => /sign out|log out|logout/i.test(textOf(el))).map((el) => {
    const r = el.getBoundingClientRect()
    return { text: textOf(el).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), visible: visible(el) }
  })

  return {
    href: location.href,
    path: location.pathname,
    vw,
    vh,
    signedIn: (() => {
      try { return !!JSON.parse(localStorage.getItem('user') || 'null')?.id } catch { return false }
    })(),
    nav: navRect ? { top: Math.round(navRect.top), h: Math.round(navRect.height), bottom: Math.round(navRect.bottom) } : null,
    labels: labelInfo,
    overflowScroll,
    bleed,
    covered,
    cutOff,
    dialogs,
    small,
    signOut,
    textSample: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400),
  }
}

async function settle(page) {
  await page.waitForTimeout(500)
  let last = ''
  let stable = 0
  const start = Date.now()
  while (Date.now() - start < 10000) {
    await page.waitForTimeout(350)
    const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400)).catch(() => '')
    const spinning = await page.evaluate(() => [...document.querySelectorAll('.animate-spin')].some((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 10 && r.height > 10 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0
    })).catch(() => false)
    if (text && text === last && !spinning) stable += 1
    else stable = 0
    last = text
    if (stable >= 3 && Date.now() - start > 1600) break
  }
  await page.waitForTimeout(400)
}

async function scrollMainToEnd(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return { scrolled: false }
    main.scrollTop = main.scrollHeight
    return { scrolled: true, scrollTop: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight }
  })
}

const userDataDir = path.join(OUT, 'chrome-profile')
fs.mkdirSync(userDataDir, { recursive: true })

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
}, userJson)

const page = context.pages()[0] || (await context.newPage())
const report = { pages: {}, dismiss: {}, signOut: null, shots: {} }

try {
  for (const route of ROUTES) {
    const url = assertLocal(ORIGIN + route)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await settle(page)
    const name = route.replace(/^\//, '')
    const file = path.join(OUT, name + '.png')
    await page.screenshot({ path: file, fullPage: false })
    report.shots[name] = { file, ...pngSize(file) }
    report.pages[name] = await page.evaluate(auditScript)
    const end = await scrollMainToEnd(page)
    await page.waitForTimeout(250)
    const atEnd = await page.evaluate(auditScript)
    report.pages[name].atEnd = {
      scroll: end,
      covered: atEnd.covered,
      signOut: atEnd.signOut,
      bleed: atEnd.bleed,
      cutOff: atEnd.cutOff,
    }
    await page.evaluate(() => {
      const main = document.querySelector('main')
      if (main) main.scrollTop = 0
    })
  }

  await page.goto(assertLocal(ORIGIN + '/dashboard'), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await settle(page)
  report.dismiss.dashboard = await tryDismiss(page)
  await page.screenshot({ path: path.join(OUT, 'dashboard-after-dismiss.png'), fullPage: false })

  await page.goto(assertLocal(ORIGIN + '/settings'), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await settle(page)
  report.signOut = await checkSignOut(page)
} catch (err) {
  report.fatal = String(err && err.stack ? err.stack : err).slice(0, 800)
  console.error('run error', report.fatal.split('\n')[0])
} finally {
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 2))
  await context.close()
}

console.log('wrote audit', path.join(OUT, 'audit.json'))
if (report.fatal) process.exit(1)

async function tryDismiss(page) {
  const before = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => /skip the tour/i.test(d.innerText || ''))
    if (!dialog) return { present: false, dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)) }
    const r = dialog.getBoundingClientRect()
    return {
      present: true,
      text: (dialog.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 180),
      rect: { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
    }
  })
  if (!before.present) return { ...before, attempts: [], still: false }

  const attempts = []
  const skip = page.getByRole('button', { name: 'Skip the tour' })
  const skipBox = await skip.boundingBox().catch(() => null)
  if (skipBox && skipBox.y >= 0 && skipBox.x >= 0 && skipBox.y + skipBox.height <= 844 && skipBox.x + skipBox.width <= 390) {
    await skip.click({ timeout: 3000 }).catch((e) => attempts.push('skip-click-failed'))
    attempts.push('clicked-skip')
  } else {
    attempts.push('skip-not-in-view')
    const point = await page.evaluate(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => /skip the tour/i.test(d.innerText || ''))
      if (!dialog) return null
      const r = dialog.getBoundingClientRect()
      const spots = [[innerWidth / 2, 10], [12, 120], [innerWidth - 12, 120], [innerWidth / 2, innerHeight - 12]]
      for (const [x, y] of spots) {
        const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        if (!inside) return { x, y }
      }
      return null
    })
    if (point) {
      await page.mouse.click(point.x, point.y)
      attempts.push('clicked-backdrop')
    } else {
      attempts.push('no-backdrop-point')
    }
  }
  await page.waitForTimeout(500)
  let still = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /skip the tour/i.test(d.innerText || '')))
  if (still) {
    await page.keyboard.press('Escape').catch(() => {})
    attempts.push('pressed-escape')
    await page.waitForTimeout(400)
    still = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => /skip the tour/i.test(d.innerText || '')))
  }
  return { before, attempts, still, escapeOnly: attempts.includes('pressed-escape') && !still && !attempts.includes('clicked-skip') && !attempts.includes('clicked-backdrop') }
}

async function checkSignOut(page) {
  const initial = await page.evaluate(() => {
    const text = (document.body.innerText || '')
    return {
      hasSignOutText: /sign out/i.test(text),
      hasLogoutText: /log\s*out/i.test(text),
    }
  })
  const headerButtons = page.locator('header button')
  const count = await headerButtons.count()
  if (!count) return { ...initial, opened: false, reason: 'no header button' }
  await headerButtons.last().click({ timeout: 5000 }).catch((e) => { initial.clickError = String(e).slice(0, 160) })
  await page.waitForTimeout(700)
  const sheet = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => /profile|logout|log out|sign out/i.test((d.innerText || '') + (d.getAttribute('aria-label') || '')))
    if (!dialog) {
      return { open: false, dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100)) }
    }
    const buttons = [...dialog.querySelectorAll('button, a')].map((el) => {
      const r = el.getBoundingClientRect()
      const label = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()
      return { text: label.slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }
    })
    return { open: true, buttons, scrollHeight: dialog.scrollHeight, clientHeight: dialog.clientHeight }
  })
  if (!sheet.open) {
    await page.screenshot({ path: path.join(OUT, 'settings-profile-closed.png'), fullPage: false })
    return { ...initial, opened: false, sheet }
  }
  const logout = page.getByRole('button', { name: /log out|sign out|logout/i }).last()
  const found = await logout.count()
  if (!found) {
    await page.screenshot({ path: path.join(OUT, 'settings-profile.png'), fullPage: false })
    return { ...initial, opened: true, found: false, sheet }
  }
  await logout.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(300)
  const box = await logout.boundingBox()
  const hit = box
    ? await page.evaluate(({ x, y, w, h }) => {
        const cx = x + w / 2
        const cy = y + h / 2
        const top = document.elementFromPoint(cx, cy)
        const nav = document.querySelector('nav[aria-label="Main, compact"]')
        return {
          cx: Math.round(cx),
          cy: Math.round(cy),
          inView: cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth,
          topText: (top?.innerText || top?.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
          coveredByNav: !!(nav && top && nav.contains(top)),
          matchesLogout: /log\s*out|sign out/i.test((top?.innerText || '') + (top?.getAttribute?.('aria-label') || '')),
        }
      }, box)
    : null
  await page.screenshot({ path: path.join(OUT, 'settings-profile.png'), fullPage: false })
  return { ...initial, opened: true, found: true, box, hit, sheetButtons: sheet.buttons }
}
