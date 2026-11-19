import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const PROFILE = path.join(OUT, 'chrome-profile-b')

const password = process.env.SS_LOGIN_PASSWORD
const res = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'b.sumba@alustudent.com', password }),
})
const json = await res.json()
if (!res.ok) throw new Error('login failed ' + res.status)
const user = json.user
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
const nets = []
page.on('response', async (r) => {
  const url = r.url()
  if (url.includes('/api/')) nets.push(`${r.status()} ${url.slice(0, 160)}`)
})
page.on('pageerror', (err) => nets.push('pageerror ' + String(err).slice(0, 300)))
page.on('console', (msg) => {
  if (msg.type() === 'error') nets.push('console ' + msg.text().slice(0, 300))
})

await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(28000)
const facts = await page.evaluate(() => {
  const stored = localStorage.getItem('user')
  let id = null
  let keys = []
  try {
    const u = JSON.parse(stored || '{}')
    id = u.id
    keys = Object.keys(u)
  } catch (e) {
    id = 'parse-fail'
  }
  return {
    id,
    keys,
    hrefs: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).slice(0, 40),
    text: (document.body.innerText || '').slice(0, 2500),
    nextErr: document.querySelector('nextjs-portal') ? 'portal' : '',
  }
})
fs.writeFileSync(path.join(OUT, 'debug-dash.json'), JSON.stringify({ nets, facts }, null, 2))
await page.screenshot({ path: path.join(OUT, 'debug-dash.png') })
console.log('id', facts.id)
console.log('keys', facts.keys.join(','))
console.log('hrefs', facts.hrefs.filter(Boolean).join(' | '))
console.log('nets', nets.join('\n'))
console.log('TEXT---')
console.log(facts.text.slice(0, 1200))
await context.close()
