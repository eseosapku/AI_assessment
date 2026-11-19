import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const art = await fetch('http://localhost:3000/art/celebration.png', { redirect: 'manual' })
const artInfo = { status: art.status, type: art.headers.get('content-type'), bytes: (await art.arrayBuffer()).byteLength }

const userDataDir = path.join(OUT, 'user-data-signup-inspect')
fs.mkdirSync(userDataDir, { recursive: true })
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1440, height: 1000 },
  args: ['--no-first-run', '--disable-extensions'],
})
const page = context.pages()[0] || (await context.newPage())
const failed = []
page.on('response', (res) => {
  if (res.status() >= 400) failed.push({ status: res.status(), url: res.url() })
})
await page.goto('http://localhost:3000/signup', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('#confirmPassword', { timeout: 15000 })
await page.waitForTimeout(800)
const metrics = await page.evaluate(() => {
  const pick = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      opacity: s.opacity,
      visibility: s.visibility,
      display: s.display,
      color: s.color,
      transform: s.transform,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    }
  }
  const form = document.querySelector('form')
  const motion = form ? form.parentElement : null
  return {
    docH: document.documentElement.scrollHeight,
    form: pick(form),
    motion: pick(motion),
    h1: pick(document.querySelector('h1')),
    name: pick(document.querySelector('#name')),
    password: pick(document.querySelector('#password')),
    submit: pick(document.querySelector('button[type="submit"]')),
    country: pick(document.querySelector('#country')),
    className: pick(document.querySelector('#className')),
  }
})
await page.screenshot({ path: path.join(OUT, 'signup-inspect-viewport.png') })
const form = page.locator('form')
await form.screenshot({ path: path.join(OUT, 'signup-inspect-form.png') })
await page.locator('h1').screenshot({ path: path.join(OUT, 'signup-inspect-heading.png') })
await context.close()

const report = { artInfo, failed, metrics }
fs.writeFileSync(path.join(OUT, 'signup-inspect.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
