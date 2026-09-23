/**
 * Walk the exam UI in a real browser and photograph what a learner sees.
 *
 * Every UI fault in this work was invisible from the code and obvious on the
 * page: a table whose columns overlapped, a figure clipped at the card edge, a
 * passage column colliding with the Previous button. Reasoning about Tailwind
 * classes did not find any of them. Looking did.
 *
 * Isolated by construction: its own Chrome, a throwaway profile directory, and
 * a debugging port that is not the default, so it can never attach to a
 * browser the user is already using.
 *
 *   node scripts/ui-walk.js --url=http://localhost:3000/assessment --shots=8
 *
 * Writes PNGs and a findings report to data/audit/ui/.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { chromium } = require('playwright-core')

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`))
  return a ? a.split('=').slice(1).join('=') : d
}

const URL = arg('url', 'http://localhost:3000/assessment')
const SHOTS = Number(arg('shots', 6))
const WIDTH = Number(arg('width', 1440))
const HEIGHT = Number(arg('height', 900))
const CHROME = arg('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe')

const TAG = arg('tag', 'run')
const OUT = path.join(__dirname, '..', 'data', 'audit', 'ui', TAG)

/**
 * Faults that can only be seen in a rendered page.
 *
 * Measured off the live DOM rather than guessed at from classes: a box that
 * overflows its parent, two boxes that overlap, text clipped by its
 * container, an image wider than the card holding it.
 */
function probe() {
  const findings = []
  const seen = new Set()
  const note = (kind, detail) => {
    const key = kind + '|' + detail
    if (seen.has(key)) return
    seen.add(key)
    findings.push({ kind, detail })
  }

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
  }

  const label = (el) => {
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    return t || el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')
  }

  // 1. Anything sticking out past the right edge of the document.
  const docW = document.documentElement.clientWidth
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > docW + 2 && r.width < docW * 1.5) {
      note('overflows-right', label(el) + ' — right edge ' + Math.round(r.right) + ' past ' + docW)
    }
  }

  // 2. Text clipped by its own box.
  for (const el of document.querySelectorAll('p, h1, h2, h3, span, div, td, th, button, label')) {
    if (!visible(el)) continue
    if (el.children.length > 0) continue
    const cs = getComputedStyle(el)
    if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
    if (el.scrollWidth > el.clientWidth + 4 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') {
      note('text-clipped', label(el))
    }
  }

  // 3. Two interactive things sitting on top of each other.
  const boxes = [...document.querySelectorAll('button, a[href], input, textarea, aside, img, svg')]
    .filter(visible)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (ox > 8 && oy > 8) {
        note('overlap', label(a.el) + '  ✕  ' + label(b.el))
      }
    }
  }

  // 4. An image wider than the box it sits in.
  for (const img of document.querySelectorAll('img')) {
    if (!visible(img)) continue
    const parent = img.parentElement
    if (!parent) continue
    const ir = img.getBoundingClientRect()
    const pr = parent.getBoundingClientRect()
    if (ir.width > pr.width + 2 || ir.right > pr.right + 2) {
      note('image-wider-than-card', (img.getAttribute('src') || '').slice(-50))
    }
  }

  // 5. A figure too small to read the labels on.
  //
  // A past-paper crop is line art with its labels set in about 10px at
  // original size; scaled below roughly a third it stops being legible, and
  // the labels are the part the question asks about.
  for (const img of document.querySelectorAll('img')) {
    if (!visible(img)) continue
    const r = img.getBoundingClientRect()
    const natural = img.naturalWidth || 0
    if (natural > 0 && r.width > 0 && r.width / natural < 0.34 && natural > 500) {
      note('figure-shrunk', Math.round((r.width / natural) * 100) + '% of ' + natural + 'px')
    }
  }

  // 6. Something you can click but cannot reach with a keyboard.
  for (const el of document.querySelectorAll('[onclick], div[role="button"], span[role="button"]')) {
    if (!visible(el)) continue
    if (el.tabIndex < 0) note('not-keyboard-reachable', label(el))
  }

  // 7. Text too small, or too pale against what is behind it.
  // `color(srgb 0.97 0.95 0.93)` carries channels in 0-1, `rgb(248, 244, 238)`
  // in 0-255, and reading the first as the second makes cream come back as
  // black. That is not hypothetical: `color-mix` is how every ss-* tint in
  // this app is set, so getComputedStyle returns the srgb form for most
  // surfaces here, and this probe duly reported near-black-on-cream text as
  // 1.3:1 and sent me looking for a contrast bug that did not exist.
  const parse = (c) => {
    const n = (c.match(/[\d.]+(?:e[+-]?\d+)?/gi) || []).map(Number)
    if (!n.length) return []
    if (/^color\(/i.test(c)) {
      const [r, g, b, a] = n
      return a === undefined ? [r * 255, g * 255, b * 255] : [r * 255, g * 255, b * 255, a]
    }
    return n
  }
  const lum = (rgb) => {
    const [r, g, b] = rgb.slice(0, 3).map((v) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const groundOf = (el) => {
    let node = el
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor
      const p = parse(bg)
      if (p.length >= 3 && (p.length < 4 || p[3] > 0.5)) return p
      node = node.parentElement
    }
    return [255, 255, 255]
  }
  for (const el of document.querySelectorAll('p, span, h1, h2, h3, button, label, li, td, th')) {
    if (!visible(el) || el.children.length > 0) continue
    const text = (el.innerText || '').trim()
    if (text.length < 2) continue
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    if (size && size < 12) note('text-under-12px', Math.round(size) + 'px: ' + text.slice(0, 40))
    const fg = parse(cs.color)
    if (fg.length < 3) continue
    const a = lum(fg) + 0.05
    const b = lum(groundOf(el)) + 0.05
    const ratio = a > b ? a / b : b / a
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    if (ratio < (large ? 3 : 4.5)) {
      note('low-contrast', ratio.toFixed(1) + ':1  ' + text.slice(0, 40))
    }
  }

  return findings
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-uiwalk-'))

  // launchPersistentContext, because the profile directory is how this stays
  // isolated: its own throwaway Chrome profile, never the user's.
  const browser = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: WIDTH, height: HEIGHT },
    args: [
      // Not 9222: never attach to a browser the user is already running.
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 160)))

  const report = []
  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    return file
  }

  // A paper to look at.
  //
  // /assessment reads sessionStorage.currentAssessment and redirects to the
  // landing page without one, so the first run of this photographed the
  // marketing carousel and reported its decorative overflow as a fault.
  const PAPER = arg('paper', '')
  if (PAPER) {
    const paper = JSON.parse(fs.readFileSync(PAPER, 'utf8'))
    // `URL` is this file's own target-url constant, which shadows the global.
    const origin = URL.replace(/^(https?:\/\/[^/]+).*$/, '$1')
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.evaluate((p) => {
      sessionStorage.setItem('currentAssessment', JSON.stringify(p))
    }, paper)
    console.log(`loaded ${paper?.questions?.length ?? 0} question(s) from ${path.basename(PAPER)}`)
  }

  console.log(`opening ${URL}`)
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot('00-open')

  for (let i = 0; i < SHOTS; i++) {
    const findings = await page.evaluate(probe)
    const heading = await page.evaluate(() => {
      const h = document.querySelector('h1, h2')
      return h ? (h.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 90) : ''
    })
    report.push({ step: i, heading, findings })
    console.log(`  [${i}] ${heading || '(no heading)'} — ${findings.length} finding(s)`)
    for (const f of findings.slice(0, 6)) console.log(`        ${f.kind}: ${f.detail}`)
    await shot(String(i).padStart(2, '0') + '-q')

    // Next question, if there is one.
    const next = page.getByRole('button', { name: /^next/i }).first()
    if (!(await next.count()) || !(await next.isEnabled().catch(() => false))) break
    await next.click().catch(() => {})
    await page.waitForTimeout(700)
  }

  fs.writeFileSync(
    path.join(OUT, 'findings.json'),
    JSON.stringify({ url: URL, viewport: [WIDTH, HEIGHT], consoleErrors, report }, null, 2),
  )

  const total = report.reduce((t, r) => t + r.findings.length, 0)
  console.log(`\n${total} layout finding(s) across ${report.length} screen(s)`)
  if (consoleErrors.length) {
    console.log(`${consoleErrors.length} console error(s):`)
    for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log('   ' + e)
  }
  console.log(`shots + findings in ${OUT}`)

  await browser.close()
  fs.rmSync(profile, { recursive: true, force: true })
}

main().catch((err) => { console.error(err); process.exit(1) })
