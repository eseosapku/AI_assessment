import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function contexts(body, needle) {
  const hits = []
  let from = 0
  while (hits.length < 4) {
    const i = body.indexOf(needle, from)
    if (i < 0) break
    hits.push(body.slice(Math.max(0, i - 90), i + needle.length + 90).replace(/\s+/g, ' '))
    from = i + needle.length
  }
  return hits
}

const pages = ['http://localhost:3000/', 'http://localhost:3000/signup', 'http://localhost:3000/login']
const report = {}
for (const url of pages) {
  const res = await fetch(url, { redirect: 'manual' })
  const body = await res.text()
  report[url] = {
    status: res.status,
    location: res.headers.get('location'),
    notFoundHits: contexts(body, 'This page could not be found'),
    nextErrorHits: contexts(body, '__next_error__'),
  }
}

const userDataDir = path.join(OUT, 'user-data-net404')
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
  if (res.status() >= 400) {
    failed.push({ status: res.status(), url: res.url(), type: res.request().resourceType() })
  }
})
page.on('requestfailed', (req) => {
  failed.push({ status: 'failed', url: req.url(), type: req.resourceType(), error: req.failure()?.errorText || '' })
})
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)
report.homeFailedResources = failed
await context.close()

fs.writeFileSync(path.join(OUT, 'marker-probe.json'), JSON.stringify(report, null, 2))
console.log('probed')
