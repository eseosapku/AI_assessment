import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const outFile = path.join(OUT, 'signup-styles.json')

const art = await fetch('http://localhost:3000/art/celebration.png', { method: 'GET', redirect: 'manual' })
const artBytes = (await art.arrayBuffer()).byteLength

const htmlRes = await fetch('http://localhost:3000/signup', { redirect: 'manual' })
const html = await htmlRes.text()
const opacityHits = []
let from = 0
while (opacityHits.length < 6) {
  const i = html.indexOf('opacity:0', from)
  const j = html.indexOf('opacity: 0', from)
  const k = i === -1 ? j : j === -1 ? i : Math.min(i, j)
  if (k < 0) break
  opacityHits.push(html.slice(Math.max(0, k - 60), k + 40).replace(/\s+/g, ' '))
  from = k + 8
}

const userDataDir = path.join(OUT, 'user-data-signup-styles')
fs.mkdirSync(userDataDir, { recursive: true })
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 1000 },
  args: ['--no-first-run', '--disable-extensions'],
})
const page = context.pages()[0] || (await context.newPage())
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 240))
})
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err.message || err).slice(0, 240)))
await page.goto('http://localhost:3000/signup', { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.waitForSelector('#confirmPassword', { timeout: 15000 })
await page.waitForTimeout(1200)

async function read() {
  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName,
        id: el.id || '',
        opacity: s.opacity,
        visibility: s.visibility,
        display: s.display,
        color: s.color,
        bg: s.backgroundColor,
        border: s.borderTopColor + ' ' + s.borderTopWidth,
        transform: s.transform,
        overflow: s.overflow,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    }
    const form = document.querySelector('form')
    let node = form
    const ancestors = []
    while (node && ancestors.length < 6) {
      ancestors.push(pick(node))
      node = node.parentElement
    }
    return {
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      docH: document.documentElement.scrollHeight,
      h1: pick(document.querySelector('h1.font-display.text-3xl')),
      name: pick(document.querySelector('#name')),
      submit: pick(document.querySelector('button[type="submit"]')),
      ancestors,
    }
  })
}

const at1200 = await read()
fs.writeFileSync(outFile, JSON.stringify({ art: { status: art.status, type: art.headers.get('content-type'), bytes: artBytes }, opacityHits, at1200, consoleErrors }, null, 2))
await page.screenshot({ path: path.join(OUT, 'signup-styles-viewport.png') })
await context.close()
console.log('styles written')
