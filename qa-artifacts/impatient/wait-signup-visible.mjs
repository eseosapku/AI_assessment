import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function openSignup(name) {
  const userDataDir = path.join(OUT, 'user-data-visible-' + name)
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
  const t0 = performance.now()
  const res = await page.goto('http://localhost:3000/signup', { waitUntil: 'domcontentloaded', timeout: 20000 })
  const domMs = Math.round(performance.now() - t0)
  let becameVisible = false
  let waitError = null
  const visibleT0 = performance.now()
  try {
    await page.waitForFunction(() => {
      const heading = document.querySelector('h1.font-display.text-3xl')
      const box = heading && heading.parentElement
      if (!box) return false
      return getComputedStyle(box).opacity === '1'
    }, { timeout: 15000 })
    becameVisible = true
  } catch (err) {
    waitError = String(err.message || err).slice(0, 240)
  }
  const visibleMs = Math.round(performance.now() - visibleT0)
  const metrics = await page.evaluate(() => {
    const heading = document.querySelector('h1.font-display.text-3xl')
    const box = heading ? heading.parentElement : null
    const style = box ? getComputedStyle(box) : null
    const submit = document.querySelector('button[type="submit"]')
    return {
      opacity: style ? style.opacity : null,
      transform: style ? style.transform : null,
      heading: heading ? heading.innerText : null,
      submit: submit ? submit.innerText.replace(/\s+/g, ' ').trim() : null,
      name: !!document.querySelector('#name'),
      email: !!document.querySelector('#email'),
      password: !!document.querySelector('#password'),
      confirm: !!document.querySelector('#confirmPassword'),
      className: !!document.querySelector('#className'),
    }
  })
  const png = path.join(OUT, 'signup-visible-' + name + '.png')
  await page.screenshot({ path: png, fullPage: true })
  await context.close()
  return {
    name,
    navStatus: res ? res.status() : null,
    domMs,
    becameVisible,
    visibleMs,
    waitError,
    metrics,
    consoleErrors,
    pngBytes: fs.statSync(png).size,
  }
}

const [a, b] = await Promise.all([openSignup('a'), openSignup('b')])
const report = { a, b }
fs.writeFileSync(path.join(OUT, 'signup-visible.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
