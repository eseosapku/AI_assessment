import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ORIGIN = 'http://localhost:3000'
const results = {
  host: ORIGIN,
  startedAt: new Date().toISOString(),
  phases: {},
}

function save() {
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
}

function assertLocal(url) {
  const u = new URL(url)
  if (u.hostname !== 'localhost' || u.port !== '3000' || u.protocol !== 'http:') {
    throw new Error('refusing non-local url ' + url)
  }
}

const ERROR_MARKERS = [
  'Application error',
  'client-side exception',
  'Internal Server Error',
  'Unhandled Runtime Error',
  'This page could not be found',
  'Server Error',
  '__next_error__',
]

function summarizeDocument(status, contentType, body) {
  const titleMatch = body.match(/<title>([^<]*)<\/title>/i)
  const markers = ERROR_MARKERS.filter((m) => body.includes(m))
  const isHtml = /<html[\s>]/i.test(body) || (contentType || '').includes('text/html')
  return {
    status,
    contentType: contentType || null,
    bytes: Buffer.byteLength(body),
    title: titleMatch ? titleMatch[1].trim() : null,
    isHtml,
    markers,
    hasCreateAccount: body.includes('Create your account'),
    hasStudySquare: body.includes('StudySquare'),
    realPage:
      status === 200 &&
      isHtml &&
      body.length > 500 &&
      markers.length === 0 &&
      !!(titleMatch && titleMatch[1].trim()),
  }
}

async function requestDocument(url) {
  assertLocal(url)
  const t0 = performance.now()
  const res = await fetch(url, {
    redirect: 'manual',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  })
  const body = await res.text()
  const ms = Math.round(performance.now() - t0)
  const summary = summarizeDocument(res.status, res.headers.get('content-type'), body)
  return {
    url,
    ms,
    location: res.headers.get('location'),
    ...summary,
  }
}

async function followRedirects(startUrl, maxRedirects = 5) {
  assertLocal(startUrl)
  const chain = []
  let current = startUrl
  const seen = []
  for (let i = 0; i <= maxRedirects; i++) {
    const hop = await requestDocument(current)
    const repeated = seen.includes(current)
    seen.push(current)
    chain.push({ hop: i, repeated, ...hop })
    const canFollow =
      hop.status >= 300 &&
      hop.status < 400 &&
      hop.location &&
      i < maxRedirects
    if (!canFollow) {
      const stillRedirect = hop.status >= 300 && hop.status < 400 && !!hop.location
      return {
        chain,
        stoppedBecauseRedirectCap: stillRedirect,
        repeatedUrl: chain.some((h) => h.repeated),
      }
    }
    current = new URL(hop.location, current).href
    assertLocal(current)
  }
  return { chain, stoppedBecauseRedirectCap: true, repeatedUrl: true }
}

function sanitizeLoginBody(text) {
  const out = { bytes: Buffer.byteLength(text), json: false }
  try {
    const data = JSON.parse(text)
    out.json = true
    out.keys = data && typeof data === 'object' ? Object.keys(data) : []
    if (data && typeof data === 'object') {
      if ('error' in data) out.error = String(data.error).slice(0, 180)
      if ('message' in data) out.message = String(data.message).slice(0, 180)
      if ('success' in data) out.success = data.success === true
      out.hasUserObject = data.user != null
    }
  } catch {
    out.excerpt = text.replace(/wrong-password/g, '[redacted]').slice(0, 180)
  }
  return out
}

async function failedLogin() {
  const started = new Date().toISOString()
  const t0 = performance.now()
  const res = await fetch(ORIGIN + '/api/auth/login', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      identifier: 'nobody-impatient@example.com',
      password: 'wrong-password',
    }),
  })
  const text = await res.text()
  return {
    started,
    finished: new Date().toISOString(),
    ms: Math.round(performance.now() - t0),
    status: res.status,
    location: res.headers.get('location'),
    contentType: res.headers.get('content-type'),
    setCookie: res.headers.has('set-cookie'),
    ...sanitizeLoginBody(text),
  }
}

async function shoot(name, url, ready) {
  assertLocal(url)
  const userDataDir = path.join(OUT, 'user-data-' + name)
  fs.mkdirSync(userDataDir, { recursive: true })
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
    ],
  })
  const page = context.pages()[0] || (await context.newPage())
  const pageErrors = []
  const consoleErrors = []
  let crashed = false
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err).slice(0, 300)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(String(msg.text()).slice(0, 300))
  })
  page.on('crash', () => {
    crashed = true
  })
  let navStatus = null
  let navUrl = null
  let navError = null
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    navStatus = res ? res.status() : null
    navUrl = page.url()
    if (ready) await ready(page)
    else await page.waitForTimeout(800)
  } catch (err) {
    navError = String(err && err.message ? err.message : err).slice(0, 400)
    navUrl = page.url()
  }
  const png = path.join(OUT, name + '.png')
  let screenshotError = null
  try {
    await page.screenshot({ path: png, fullPage: true })
  } catch (err) {
    screenshotError = String(err && err.message ? err.message : err).slice(0, 300)
  }
  let dom = null
  try {
    dom = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : ''
      const submit = document.querySelector('button[type="submit"]')
      const overlay = document.querySelector('nextjs-portal')
      return {
        title: document.title,
        url: location.href,
        textLength: text.length,
        hasCreateAccount: text.includes('Create your account'),
        hasName: !!document.querySelector('#name'),
        hasEmail: !!document.querySelector('#email'),
        hasStudentId: !!document.querySelector('#studentId'),
        hasPassword: !!document.querySelector('#password'),
        hasConfirm: !!document.querySelector('#confirmPassword'),
        hasClass: !!document.querySelector('#className'),
        hasCountry: !!document.querySelector('#country'),
        hasGender: !!document.querySelector('#gender'),
        hasSubmit: !!submit,
        submitText: submit ? (submit.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80) : '',
        hasStudent: text.includes('Student'),
        hasTeacher: text.includes('Teacher'),
        hasBackHome: text.includes('Back to home'),
        hasAppError: /Application error|client-side exception|Internal Server Error|Unhandled Runtime Error/i.test(
          text,
        ),
        overlayText: overlay ? (overlay.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240) : '',
        snippet: text.replace(/\s+/g, ' ').trim().slice(0, 280),
      }
    })
  } catch (err) {
    dom = { evalError: String(err && err.message ? err.message : err).slice(0, 300) }
  }
  await context.close()
  return {
    name,
    userDataDir,
    png,
    pngBytes: fs.existsSync(png) ? fs.statSync(png).size : 0,
    navStatus,
    navUrl,
    navError,
    screenshotError,
    crashed,
    pageErrors,
    consoleErrors,
    dom,
  }
}

async function signupReady(page) {
  await page.waitForSelector('text=Create your account', { timeout: 15000 })
  await page.waitForSelector('#name', { timeout: 10000 })
  await page.waitForSelector('#password', { timeout: 10000 })
  await page.waitForSelector('#confirmPassword', { timeout: 10000 })
  await page.waitForTimeout(700)
}

try {
  const burst = []
  for (let i = 1; i <= 5; i++) {
    const hop = await requestDocument(ORIGIN + '/')
    burst.push({ n: i, ...hop })
  }
  results.phases.homeBurst = burst
  save()

  results.phases.homeScreenshot = await shoot('home-last', ORIGIN + '/', async (page) => {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(500)
  })
  save()

  const backForwardUrls = [ORIGIN + '/signup', ORIGIN + '/', ORIGIN + '/signup']
  const backForward = []
  for (const url of backForwardUrls) {
    backForward.push(await requestDocument(url))
  }
  results.phases.backForward = backForward
  save()

  results.phases.loginRedirects = [await followRedirects(ORIGIN + '/login', 5), await followRedirects(ORIGIN + '/login', 5)]
  save()

  const [loginA, loginB] = await Promise.all([failedLogin(), failedLogin()])
  results.phases.parallelFailedLogin = [loginA, loginB]
  save()

  const [signupA, signupB] = await Promise.all([
    shoot('signup-a', ORIGIN + '/signup', signupReady),
    shoot('signup-b', ORIGIN + '/signup', signupReady),
  ])
  results.phases.signupScreenshots = [signupA, signupB]
  save()

  results.finishedAt = new Date().toISOString()
  results.ok = true
  save()
} catch (err) {
  results.ok = false
  results.fatal = String(err && err.stack ? err.stack : err).slice(0, 2000)
  results.finishedAt = new Date().toISOString()
  save()
  console.error(results.fatal)
  process.exitCode = 1
}

console.log('wrote ' + path.join(OUT, 'results.json'))
