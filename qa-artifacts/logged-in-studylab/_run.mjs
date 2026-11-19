import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/logged-in-studylab'
const PROFILE = `${OUT}/chrome-profile`
const PORT = 9347
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const SECRET = process.env.QA_PASS || ''

if (!EMAIL || !SECRET) {
  console.error('missing credentials')
  process.exit(1)
}

function scrub(value) {
  if (typeof value === 'string') {
    return value.split(SECRET).join('[redacted]').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-url]')
  }
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      if (/password|secret|token|hash|authorization/i.test(key)) continue
      out[key] = scrub(val)
    }
    return out
  }
  return value
}

function safeUrl(raw) {
  try {
    const url = new URL(raw)
    return `${url.origin}${url.pathname}`
  } catch {
    return String(raw).slice(0, 160)
  }
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = new Set()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id)
        clearTimeout(timer)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(scrub(JSON.stringify(msg.error))))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const listener of this.listeners) listener(msg)
      }
    })
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`timeout ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(listener) {
    this.listeners.add(listener)
  }

  off(listener) {
    this.listeners.delete(listener)
  }
}

function waitForOpen(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error('websocket open timeout')), 10000)
    ws.addEventListener('open', () => {
      clearTimeout(timer)
      resolve(ws)
    })
    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('websocket error'))
    })
  })
}

async function waitForPort() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (response.ok) return
    } catch {
      // chrome still starting
    }
    await delay(250)
  }
  throw new Error('chrome debug port did not open')
}

async function listPages() {
  const pages = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
  return pages.filter((item) => item.type === 'page')
}

const PROBE = `function(){
  const de = document.documentElement
  if (!document.body) {
    return { href: location.href, title: document.title, text: '', spinners: [], alerts: [], dialogs: [], overlay: '', canvases: [], nodes: [], offenders: [], buttons: [], session: { hasUser: false }, marketing: false, lessonControls: {}, overflowX: 0 }
  }
  const visible = (el) => {
    if (!el) return false
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 6 && rect.height > 6 && rect.bottom > 0 && rect.top < window.innerHeight
  }
  const spinners = [...document.querySelectorAll('.animate-spin, [class*="animate-spin"]')].filter(visible).map((el) => {
    const rect = el.getBoundingClientRect()
    return { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left), cls: String(el.className).slice(0, 80) }
  })
  const alerts = [...document.querySelectorAll('[role="alert"], [role="alertdialog"]')].filter(visible).map((el) => (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 400))
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map((el) => ({
    label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '',
    text: (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 500)
  }))
  let overlay = ''
  const portal = document.querySelector('nextjs-portal')
  if (portal && portal.shadowRoot) overlay = (portal.shadowRoot.textContent || '').replace(/\\s+/g, ' ').slice(0, 1500)
  const canvases = [...document.querySelectorAll('canvas, .react-flow, .react-flow__renderer, [data-tour="gapmap-canvas"], .ss-rack, .ss-rack-chap, .ss-trail')].slice(0, 16).map((el) => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return {
      tag: el.tagName,
      cls: String(el.className).slice(0, 100),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      overflow: style.overflow,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      sh: el.scrollHeight,
      sw: el.scrollWidth,
      ch: el.clientHeight,
      cw: el.clientWidth
    }
  })
  const nodes = [...document.querySelectorAll('.react-flow__node')].slice(0, 20).map((el) => {
    const rect = el.getBoundingClientRect()
    const text = (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 80)
    return { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), w: Math.round(rect.width), h: Math.round(rect.height), text }
  })
  const renderer = document.querySelector('.react-flow__renderer')
  let rendererBox = null
  if (renderer) {
    const rect = renderer.getBoundingClientRect()
    rendererBox = { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), w: Math.round(rect.width), h: Math.round(rect.height) }
  }
  const offenders = []
  for (const el of document.body.querySelectorAll('h1, h2, canvas, .react-flow, .ss-rack, .ss-hub-card, button')) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) continue
    if (rect.right > window.innerWidth + 16 || rect.left < -16) {
      offenders.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 100),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        text: (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 80)
      })
    }
    if (offenders.length >= 8) break
  }
  const buttons = [...document.querySelectorAll('button, a')].map((el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 40)
  let session = { hasUser: false }
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (user && user.id) {
      session = {
        hasUser: true,
        role: user.role || null,
        profileComplete: user.profileComplete !== false,
        genderSet: user.gender != null,
        subjectCount: Array.isArray(user.subjects) ? user.subjects.length : 0
      }
    }
  } catch (error) {
    session = { hasUser: false, parseError: String(error).slice(0, 80) }
  }
  const text = (document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n')
  const marketing = /Try StudyLab free/i.test(text) && /Sign in/i.test(text)
  return {
    href: location.href,
    title: document.title,
    overflowX: de.scrollWidth - de.clientWidth,
    scrollHeight: de.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    text: text.slice(0, 3500),
    spinners,
    alerts,
    dialogs,
    overlay,
    canvases,
    nodes,
    rendererBox,
    offenders,
    buttons,
    session,
    marketing,
    lessonControls: {
      next: !!document.querySelector('[aria-label="Your next lesson"]'),
      cards: document.querySelectorAll('button.ss-hub-card').length,
      shelf: !!document.querySelector('[aria-label="Your lessons"]'),
      loadFailed: /couldn.?t load your learnspaces/i.test(text)
    }
  }
}`

let chrome
const report = { pages: [], notes: [] }

mkdirSync(OUT, { recursive: true })

function isLessonUrl(raw) {
  try {
    const url = new URL(raw)
    return url.pathname.startsWith('/studylab/') && url.pathname !== '/studylab/gap-map'
  } catch {
    return false
  }
}

try {
  const health = await fetch(BASE, { redirect: 'manual', signal: AbortSignal.timeout(60000) })
  report.notes.push({ server: health.status })

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: SECRET }),
    signal: AbortSignal.timeout(60000),
  })
  const loginBody = await loginRes.json().catch(() => ({}))
  if (!loginRes.ok || !loginBody.user) {
    report.notes.push({ login: 'failed', status: loginRes.status })
    writeFileSync(`${OUT}/observations.json`, JSON.stringify(scrub(report), null, 2))
    console.log(JSON.stringify(scrub({ login: 'failed', status: loginRes.status })))
    process.exit(2)
  }
  const user = loginBody.user
  report.notes.push({
    login: 'ok',
    role: user.role || null,
    profileComplete: user.profileComplete !== false,
    genderSet: user.gender != null,
  })

  rmSync(PROFILE, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=Translate,MediaRouter',
    '--disable-popup-blocking',
    '--force-color-profile=srgb',
    '--host-resolver-rules=MAP localhost 127.0.0.1',
    '--window-size=1440,900',
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    'http://localhost:3000/login',
  ], { stdio: 'ignore' })

  await waitForPort()
  let page = null
  for (let i = 0; i < 40; i++) {
    const pages = await listPages()
    page = pages.find((item) => item.webSocketDebuggerUrl && String(item.url || '').includes('localhost:3000'))
      || pages.find((item) => item.webSocketDebuggerUrl)
    if (page && String(page.url || '').includes('localhost:3000')) break
    await delay(400)
  }
  if (!page) throw new Error('no page target')
  console.log('chrome-target', safeUrl(page.url || ''))

  async function attach(wsUrl) {
    const ws = await waitForOpen(wsUrl)
    const cdp = new CDP(ws)
    const consoleEvents = []
    const netEvents = []
    cdp.on((msg) => {
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type
        if (type !== 'error' && type !== 'warning') return
        const text = msg.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')
        consoleEvents.push({ type, text: scrub(String(text)).slice(0, 500) })
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params.exceptionDetails || {}
        const text = details.exception?.description || details.text || 'exception'
        consoleEvents.push({ type: 'exception', text: scrub(String(text)).slice(0, 700) })
      } else if (msg.method === 'Network.responseReceived') {
        const response = msg.params.response || {}
        if (response.status >= 400) {
          netEvents.push({ status: response.status, url: safeUrl(response.url) })
        }
      } else if (msg.method === 'Network.loadingFailed') {
        if (msg.params.canceled) return
        netEvents.push({ status: 0, error: msg.params.errorText || 'failed' })
      }
    })
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    async function evalFn(source, args = []) {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(${source})(${args.map((value) => JSON.stringify(value)).join(',')})`,
        returnByValue: true,
        awaitPromise: true,
      })
      if (result.exceptionDetails) {
        const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'eval failed'
        throw new Error(scrub(String(text)).slice(0, 500))
      }
      return scrub(result.result?.value)
    }

    async function goto(pathname) {
      const url = new URL(pathname, BASE)
      if (url.host !== 'localhost:3000') throw new Error(`refusing ${url.host}`)
      const mark = consoleEvents.length
      const netMark = netEvents.length
      await evalFn(`function(href){ location.assign(href) }`, [url.href]).catch((error) => {
        report.notes.push({ assign: pathname, error: String(error.message || error).slice(0, 180) })
      })
      const start = Date.now()
      let lastError = ''
      while (Date.now() - start < 90000) {
        try {
          const state = await evalFn(`function(){
            return {
              href: location.href,
              ready: document.readyState,
              text: (document.body && document.body.innerText || '').slice(0, 80)
            }
          }`)
          const here = new URL(state.href)
          if (here.pathname === url.pathname && (state.ready === 'interactive' || state.ready === 'complete')) {
            return { consoleFrom: mark, netFrom: netMark }
          }
        } catch (error) {
          lastError = String(error.message || error).slice(0, 180)
        }
        await delay(500)
      }
      report.notes.push({ goto: pathname, load: 'navigation timeout', lastError })
      return { consoleFrom: mark, netFrom: netMark }
    }

    async function shot(name) {
      const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
      const file = `${OUT}/${name}.png`
      writeFileSync(file, Buffer.from(image.data, 'base64'))
      return file
    }

    async function probe() {
      return evalFn(PROBE)
    }

    async function settle(maxMs = 14000) {
      let last = ''
      let stable = 0
      const start = Date.now()
      let latest = null
      while (Date.now() - start < maxMs) {
        latest = await probe()
        const text = latest.text || ''
        const spinning = (latest.spinners || []).length > 0
        if (text === last) {
          stable += 1
          const elapsed = Date.now() - start
          const substantial = text.length > 180
          if (text.length < 40 && elapsed < 15000) {
            // document is up but the app has not painted yet
          } else if (!spinning && stable >= 3 && elapsed > 2000) return latest
          else if (spinning && substantial && stable >= 4 && elapsed > 12000) return latest
        } else {
          stable = 0
          last = text
        }
        await delay(450)
      }
      return latest || await probe()
    }

    return { cdp, ws, evalFn, goto, shot, probe, settle, consoleEvents, netEvents }
  }

  const session = await attach(page.webSocketDebuggerUrl)
  const arrived = Date.now()
  while (Date.now() - arrived < 60000) {
    const state = await session.evalFn(`function(){ return { href: location.href, ready: document.readyState } }`).catch(() => null)
    if (state && state.href.includes('/login') && (state.ready === 'interactive' || state.ready === 'complete')) break
    await delay(400)
  }
  console.log('login-page-ready')
  await session.evalFn(`function(payload){
    localStorage.setItem('user', JSON.stringify(payload))
    return localStorage.getItem('user') ? 'set' : 'missing'
  }`, [user])
  const stored = await session.evalFn(`function(){
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    return { hasUser: !!(user && user.id), role: user && user.role, profileComplete: user ? user.profileComplete !== false : false }
  }`)
  report.notes.push({ stored })

  async function capture(name, sessionRef, marks, extra = {}) {
    const snap = await sessionRef.settle(extra.maxMs || 14000)
    if ((snap.spinners || []).length > 0) {
      await delay(6000)
    }
    const after = await sessionRef.probe()
    const file = await sessionRef.shot(name)
    let bottom = null
    const scrolled = await sessionRef.evalFn(`function(){
      const nodes = [document.scrollingElement, ...document.querySelectorAll('main, body *')]
      let best = null
      for (const el of nodes) {
        if (!el || el.clientHeight < 200) continue
        if (el.scrollHeight > el.clientHeight + 160) {
          if (!best || el.scrollHeight > best.scrollHeight) best = el
        }
      }
      if (!best) return null
      best.setAttribute('data-qa-scroll', '1')
      best.scrollTop = best.scrollHeight
      return { sh: best.scrollHeight, ch: best.clientHeight }
    }`)
    if (scrolled) {
      await delay(400)
      bottom = await sessionRef.shot(`${name}-bottom`)
      await sessionRef.evalFn(`function(){
        const el = document.querySelector('[data-qa-scroll]')
        if (el) { el.scrollTop = 0; el.removeAttribute('data-qa-scroll') }
      }`)
    }
    const entry = {
      name,
      file,
      bottom,
      href: after.href,
      title: after.title,
      marketing: after.marketing,
      session: after.session,
      spinners: after.spinners,
      alerts: after.alerts,
      dialogs: after.dialogs,
      overlay: after.overlay,
      overflowX: after.overflowX,
      offenders: after.offenders,
      canvases: after.canvases,
      nodes: after.nodes,
      rendererBox: after.rendererBox,
      buttons: after.buttons,
      lessonControls: after.lessonControls,
      text: after.text,
      console: sessionRef.consoleEvents.slice(marks?.consoleFrom || 0).slice(0, 25),
      network: sessionRef.netEvents.slice(marks?.netFrom || 0).slice(0, 25),
    }
    report.pages.push(entry)
    writeFileSync(`${OUT}/observations.json`, JSON.stringify(scrub(report), null, 2))
    console.log(JSON.stringify({
      name,
      href: entry.href,
      marketing: entry.marketing,
      spinners: entry.spinners.length,
      alerts: entry.alerts,
      dialogs: entry.dialogs.map((d) => d.label || d.text.slice(0, 80)),
      overlay: entry.overlay.slice(0, 180),
      overflowX: entry.overflowX,
      offenders: entry.offenders.length,
      nodes: entry.nodes.length,
      lessonControls: entry.lessonControls,
      textHead: (entry.text || '').slice(0, 280),
    }))
    return entry
  }

  const hubMarks = await session.goto('/studylab')
  const hub = await capture('01-studylab', session, hubMarks, { maxMs: 40000 })

  const canOpen = hub.lessonControls?.next || hub.lessonControls?.cards > 0
  if (!canOpen) {
    report.notes.push({ lesson: 'empty-or-create-only', loadFailed: hub.lessonControls?.loadFailed || false })
  } else try {
    const idsBefore = new Set((await listPages()).map((item) => item.id))
    const click = await session.evalFn(`function(){
      const next = document.querySelector('[aria-label="Your next lesson"] button')
      const card = document.querySelector('button.ss-hub-card')
      const target = next || card
      if (!target) return { ok: false }
      const label = (target.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 180)
      if (/^(study|teach me this|quiz me|build my lesson)$/i.test(label)) return { ok: false, blocked: label }
      target.click()
      return { ok: true, label, kind: next ? 'next' : 'card' }
    }`)
    report.notes.push({ click })
    let lessonSession = session
    let lessonMarks = { consoleFrom: session.consoleEvents.length, netFrom: session.netEvents.length }
    let switched = false
    if (click?.ok) {
      let found = null
      for (let i = 0; i < 40; i++) {
        await delay(500)
        const now = await listPages()
        found = now.find((item) => !idsBefore.has(item.id) && isLessonUrl(item.url || ''))
        if (found) break
        const same = await session.probe().catch(() => null)
        if (same?.href && isLessonUrl(same.href)) {
          found = { sameTab: true, href: same.href }
          break
        }
      }
      if (found && found.webSocketDebuggerUrl) {
        lessonSession = await attach(found.webSocketDebuggerUrl)
        lessonMarks = { consoleFrom: 0, netFrom: 0 }
        switched = true
        report.notes.push({ lessonTab: safeUrl(found.url || '') })
      } else if (found?.sameTab) {
        report.notes.push({ lessonTab: 'same', href: found.href })
      } else {
        report.notes.push({ lessonTab: 'did-not-open' })
      }
    }
    const sameAfter = await session.probe()
    if (click?.ok && (switched || isLessonUrl(sameAfter.href))) {
      await capture('02-lesson', lessonSession, lessonMarks, { maxMs: 35000 })
    }
  } catch (error) {
    report.notes.push({ lesson: 'failed', error: scrub(String(error && error.stack || error)).slice(0, 500) })
  }

  const gapMarks = await session.goto('/studylab/gap-map')
  await capture('03-gap-map', session, gapMarks, { maxMs: 40000 })

  const demoMarks = await session.goto('/studylab/demo')
  await capture('04-demo', session, demoMarks, { maxMs: 30000 })

  writeFileSync(`${OUT}/observations.json`, JSON.stringify(scrub(report), null, 2))
  console.log('DONE')
} catch (error) {
  report.notes.push({ fatal: scrub(String(error && error.stack || error)).slice(0, 1200) })
  try { writeFileSync(`${OUT}/observations.json`, JSON.stringify(scrub(report), null, 2)) } catch { /* ignore */ }
  console.error(scrub(String(error && error.stack || error)).slice(0, 1200))
  process.exitCode = 1
} finally {
  if (chrome && !chrome.killed) {
    try { chrome.kill() } catch { /* ignore */ }
  }
  await delay(400)
  if (chrome?.pid) {
    try {
      spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch { /* ignore */ }
  }
}
