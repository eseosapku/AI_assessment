import { spawn, execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/logged-in-account'
const PROFILE = `${OUT}/chrome-profile`
const PORT = 9541
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const SECRET = process.env.QA_PASS || ''

if (!EMAIL || !SECRET) {
  console.error('missing QA_EMAIL or QA_PASS')
  process.exit(1)
}

function scrub(value) {
  if (typeof value === 'string') return value.split(SECRET).join('[redacted]')
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      if (/password|secret|hash|token/i.test(key)) out[key] = '[redacted]'
      else out[key] = scrub(val)
    }
    return out
  }
  return value
}

function safeUrl(raw) {
  try {
    const url = new URL(raw)
    if (url.host !== 'localhost:3000') return `${url.origin}${url.pathname}`
    for (const key of [...url.searchParams.keys()]) {
      if (/token|password|key|secret|auth/i.test(key)) url.searchParams.set(key, '[redacted]')
    }
    return url.href
  } catch {
    return String(raw).slice(0, 180)
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

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`timeout ${method}`))
      }, 30000)
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

const notes = []
function note(label, data) {
  const clean = scrub(data)
  notes.push({ label, data: clean })
  const brief = typeof clean === 'string' ? clean.slice(0, 180) : JSON.stringify(clean).slice(0, 300)
  console.log(label, brief)
}

let chrome

try {
  mkdirSync(OUT, { recursive: true })
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: SECRET }),
  })
  const loginBody = await loginRes.json().catch(() => ({}))
  if (!loginRes.ok || !loginBody?.user) {
    throw new Error(`login failed status ${loginRes.status}`)
  }
  const sessionUser = loginBody.user
  note('login', {
    status: loginRes.status,
    role: sessionUser.role,
    name: sessionUser.name,
    email: sessionUser.email,
    profileComplete: sessionUser.profileComplete,
    genderSet: sessionUser.gender != null,
    className: sessionUser.class || '',
  })

  rmSync(PROFILE, { recursive: true, force: true })
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
    '--force-color-profile=srgb',
    '--window-size=1440,900',
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    'about:blank',
  ], { stdio: 'ignore' })

  await waitForPort()
  const pages = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
  const page = pages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
  if (!page) throw new Error('no page target')
  const ws = await waitForOpen(page.webSocketDebuggerUrl)
  const cdp = new CDP(ws)

  const consoleEvents = []
  const netEvents = []

  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type
      if (type !== 'error' && type !== 'warning') return
      const text = msg.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')
      consoleEvents.push({ type, text: scrub(String(text)).slice(0, 400) })
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const details = msg.params.exceptionDetails || {}
      const text = details.exception?.description || details.text || 'exception'
      consoleEvents.push({ type: 'exception', text: scrub(String(text)).slice(0, 500) })
    } else if (msg.method === 'Network.responseReceived') {
      const response = msg.params.response || {}
      if (response.status >= 400) {
        netEvents.push({ status: response.status, url: safeUrl(response.url), type: msg.params.type })
      }
    } else if (msg.method === 'Network.loadingFailed') {
      if (msg.params.canceled) return
      netEvents.push({ status: 0, error: msg.params.errorText, type: msg.params.type })
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
    const holder = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement' })
    const objectId = holder.result.objectId
    const result = await cdp.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: source,
      arguments: args.map((value) => ({ value })),
      returnByValue: true,
      awaitPromise: true,
    })
    if (objectId) await cdp.send('Runtime.releaseObject', { objectId }).catch(() => {})
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'eval failed'
      throw new Error(scrub(String(text)).slice(0, 500))
    }
    return scrub(result.result?.value)
  }

  function waitLoad() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cdp.off(listener)
        reject(new Error('load timeout'))
      }, 25000)
      const listener = (msg) => {
        if (msg.method === 'Page.loadEventFired') {
          clearTimeout(timer)
          cdp.off(listener)
          resolve()
        }
      }
      cdp.on(listener)
    })
  }

  async function goto(pathname) {
    const url = new URL(pathname, BASE)
    if (url.host !== 'localhost:3000') throw new Error(`refusing ${url.host}`)
    const mark = consoleEvents.length
    const netMark = netEvents.length
    const loaded = waitLoad()
    await cdp.send('Page.navigate', { url: url.href })
    await loaded
    return { consoleFrom: mark, netFrom: netMark }
  }

  async function shot(name) {
    const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    const file = `${OUT}/${name}.png`
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    return file
  }

  async function waitUntil(source, timeout = 15000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const value = await evalFn(source)
      if (value) return value
      await delay(250)
    }
    return null
  }

  const SNAP = `function(){
    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="menu"], [aria-modal="true"]')].map((el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return {
        label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '',
        text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 900),
        z: s.zIndex,
        display: s.display,
        top: Math.round(r.top),
        left: Math.round(r.left),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        w: Math.round(r.width),
        h: Math.round(r.height)
      }
    })
    const header = document.querySelector('header')
    const headerText = header ? (header.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400) : ''
    const h1 = document.querySelector('h1')
    const links = [...document.querySelectorAll('a[href]')].slice(0, 40).map((a) => ({
      text: (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
      href: a.getAttribute('href')
    }))
    let overlay = ''
    const portal = document.querySelector('nextjs-portal')
    if (portal && portal.shadowRoot) overlay = (portal.shadowRoot.textContent || '').replace(/\\s+/g, ' ').slice(0, 500)
    const fields = [...document.querySelectorAll('input, textarea, select')].slice(0, 30).map((el) => {
      const label = el.id ? document.querySelector('label[for="' + el.id + '"]') : null
      const value = el.type === 'password' ? (el.value ? '[set]' : '') : String(el.value || '').slice(0, 140)
      return { id: el.id || '', name: el.name || '', type: el.type || el.tagName, label: label ? label.innerText.trim().slice(0, 80) : '', value }
    })
    return {
      href: location.href,
      title: document.title,
      headerText,
      h1: h1 ? h1.innerText.trim().slice(0, 160) : '',
      body: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 3500),
      dialogs,
      links,
      fields,
      overlay
    }
  }`

  note('step', 'open origin')
  await goto('/')
  const stored = await evalFn(`function(user){
    localStorage.setItem('user', JSON.stringify(user))
    const back = JSON.parse(localStorage.getItem('user') || 'null')
    return { stored: !!back, name: back && back.name, email: back && back.email, role: back && back.role }
  }`, [sessionUser])
  note('session-stored', stored)

  note('step', 'dashboard')
  await goto('/dashboard')
  const ready = await waitUntil(`function(){
    const text = document.body ? document.body.innerText : ''
    if (/Welcome back/i.test(text)) return 'dashboard'
    if (document.querySelector('[aria-labelledby="gender-prompt-title"]')) return 'gender'
    if (location.pathname === '/login' || location.pathname === '/complete-profile') return location.pathname
    if (/sign in/i.test(text) && location.pathname === '/') return 'home'
    return ''
  }`)
  await delay(1200)
  const dash = await evalFn(SNAP)
  note('dashboard-ready', { ready, href: dash.href, title: dash.title, headerText: dash.headerText, h1: dash.h1, dialogs: dash.dialogs.map((d) => ({ label: d.label, text: d.text.slice(0, 240), z: d.z, top: d.top, left: d.left, w: d.w, h: d.h })), overlay: dash.overlay })
  await shot('01-dashboard')

  const genderBlocked = await evalFn(`function(){
    const el = document.querySelector('[aria-labelledby="gender-prompt-title"]')
    if (!el) return false
    const dialog = el.closest('[role="dialog"]') || el
    dialog.setAttribute('data-qa-hidden', '1')
    dialog.style.display = 'none'
    return true
  }`)
  note('gender-hidden-without-save', genderBlocked)

  const tour = await evalFn(`function(){
    const title = document.querySelector('#tour-title')
    if (!title) return null
    return { title: title.innerText, body: (document.querySelector('#tour-body')?.innerText || '').slice(0, 300) }
  }`)
  note('tour', tour)
  if (tour) {
    await shot('01b-tour')
    await evalFn(`function(){
      const buttons = [...document.querySelectorAll('button')]
      const skip = buttons.find((b) => /skip the tour/i.test(b.innerText || ''))
      if (skip) skip.click()
      return !!skip
    }`)
    await delay(400)
  }

  await evalFn(`function(){
    const bell = document.querySelector('button[aria-label^="Notifications"]')
    if (!bell) return 'missing'
    bell.click()
    return bell.getAttribute('aria-label')
  }`)
  const notifOpen = await waitUntil(`function(){
    const dialog = document.querySelector('[role="dialog"][aria-label="Notifications"]')
    return dialog ? 'open' : ''
  }`, 5000)
  await delay(300)
  const notif = await evalFn(`function(){
    const dialog = document.querySelector('[role="dialog"][aria-label="Notifications"]')
    const bell = document.querySelector('button[aria-label^="Notifications"]')
    const account = [...document.querySelectorAll('header button')].find((b) => b.querySelector('img') && /rounded-full/.test(b.className))
    function box(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), z: s.zIndex, text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200) }
    }
    const items = dialog ? [...dialog.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean) : []
    return { open: !!dialog, bellLabel: bell ? bell.getAttribute('aria-label') : null, dialog: box(dialog), bell: box(bell), account: box(account), items, header: (document.querySelector('header')?.innerText || '').replace(/\\s+/g, ' ').trim() }
  }`)
  note('notifications', notif)
  await shot('02-notifications')

  const both = await evalFn(`function(){
    const account = [...document.querySelectorAll('header button')].find((b) => /rounded-full/.test(b.className) && b.querySelector('img'))
    if (account) account.click()
    return !!account
  }`)
  await delay(700)
  const bothState = await evalFn(`function(){
    function box(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (s.display === 'none' || r.width < 2 || r.height < 2) return null
      return { label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.id || '', top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), z: s.zIndex, text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500) }
    }
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(box).filter(Boolean)
    return { clickedAccount: ${both ? 'true' : 'false'}, dialogs }
  }`)
  note('both-open', bothState)
  await shot('03-notifications-then-account')

  await evalFn(`function(){ document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const close = document.querySelector('[aria-label="Close profile"]'); return !!close }`)
  await delay(250)
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await delay(300)

  await evalFn(`function(){
    const account = [...document.querySelectorAll('header button')].find((b) => /rounded-full/.test(b.className) && b.querySelector('img'))
    if (account) account.click()
    return account ? (account.innerText || '').replace(/\\s+/g, ' ').trim() : 'missing'
  }`)
  const menuOpen = await waitUntil(`function(){
    return document.querySelector('#profile-sidebar-title') ? 'open' : ''
  }`, 5000)
  await delay(500)
  const menu = await evalFn(`function(){
    const dialog = document.querySelector('#profile-sidebar-title')?.closest('[role="dialog"]')
    if (!dialog) return { open: false, body: (document.body.innerText || '').slice(0, 500) }
    const links = [...dialog.querySelectorAll('a[href]')].map((a) => ({ text: (a.innerText || '').replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href') }))
    const buttons = [...dialog.querySelectorAll('button')].map((b) => (b.innerText || b.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)
    const r = dialog.getBoundingClientRect()
    return {
      open: true,
      title: document.querySelector('#profile-sidebar-title')?.innerText || '',
      text: (dialog.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 2000),
      links,
      buttons,
      box: { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
      scroll: { sh: dialog.scrollHeight, ch: dialog.clientHeight }
    }
  }`)
  note('account-menu', { menuOpen, menu })
  await shot('04-account-menu')

  if (menu?.scroll && menu.scroll.sh > menu.scroll.ch + 40) {
    await evalFn(`function(){
      const dialog = document.querySelector('#profile-sidebar-title')?.closest('[role="dialog"]')
      if (dialog) dialog.scrollTop = dialog.scrollHeight
      return true
    }`)
    await delay(300)
    await shot('04b-account-menu-bottom')
    await evalFn(`function(){
      const dialog = document.querySelector('#profile-sidebar-title')?.closest('[role="dialog"]')
      if (dialog) dialog.scrollTop = 0
      return true
    }`)
  }

  const hrefChecks = await evalFn(`async function(){
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) return { error: 'no session' }
    const subRes = await fetch('/api/subscription/status?user_id=' + encodeURIComponent(user.id))
    const subJson = await subRes.json().catch(() => ({}))
    const dashRes = await fetch('/api/dashboard/student?user_id=' + encodeURIComponent(user.id))
    const dashJson = await dashRes.json().catch(() => ({}))
    const params = new URLSearchParams()
    if (user.id) params.set('student_id', user.id)
    if (user.email) params.set('student_email', user.email)
    const roomRes = await fetch('/api/classrooms?' + params.toString())
    const roomJson = await roomRes.json().catch(() => ({}))
    const recents = dashJson?.data?.recentAssessments || []
    const rooms = roomJson?.data || []
    const hrefs = []
    for (const room of rooms) {
      if (Number(room.open_count) > 0 || Number(room.upcoming_count) > 0) hrefs.push('/classrooms/' + room.classroom_id)
    }
    if (recents.length === 0) hrefs.push('/practice')
    else {
      const last = Date.parse(recents[0]?.date)
      const days = Number.isNaN(last) ? 99 : Math.floor((Date.now() - last) / 86400000)
      if (days >= 3) hrefs.push('/practice')
    }
    for (const item of recents.slice(0, 6)) {
      if (item?.id) hrefs.push('/results/' + item.id)
    }
    const unique = [...new Set(hrefs)]
    const checks = []
    for (const href of unique) {
      const res = await fetch(href, { redirect: 'manual' })
      const text = await res.text()
      checks.push({
        href,
        status: res.status,
        location: res.headers.get('location') || '',
        notFound: /this page could not be found|404/i.test(text.slice(0, 4000))
      })
    }
    const snap = subJson?.data || {}
    return {
      subStatus: subRes.status,
      subscribed: snap.isSubscribed === true,
      subscriptionStatus: snap.status || null,
      freeRemaining: snap.freeAssessmentsRemaining,
      dashStatus: dashRes.status,
      roomStatus: roomRes.status,
      recentCount: recents.length,
      roomCount: rooms.length,
      checks
    }
  }`)
  note('href-checks', hrefChecks)

  const pageLinks = []
  const seen = new Set()
  for (const link of menu?.links || []) {
    const href = link.href || ''
    if (!href.startsWith('/')) continue
    if (href.startsWith('/api/')) continue
    if (seen.has(href)) continue
    seen.add(href)
    pageLinks.push(link)
  }
  note('page-destinations', pageLinks)

  const opened = []
  let index = 5
  for (const link of pageLinks) {
    const slug = link.href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page'
    const name = `${String(index).padStart(2, '0')}-${slug}`
    index += 1
    note('visit', link)
    const marks = await goto(link.href)
    await waitUntil(`function(){
      const text = document.body ? document.body.innerText : ''
      return text.trim().length > 40 ? 'yes' : ''
    }`, 10000)
    await delay(800)
    const state = await evalFn(SNAP)
    const file = await shot(name)
    const scrolled = await evalFn(`function(){
      const main = document.querySelector('main')
      if (!main || main.scrollHeight <= main.clientHeight + 80) return null
      main.scrollTop = main.scrollHeight
      return { sh: main.scrollHeight, ch: main.clientHeight }
    }`)
    let bottom = null
    if (scrolled) {
      await delay(400)
      bottom = await shot(`${name}-bottom`)
      await evalFn(`function(){ const main = document.querySelector('main'); if (main) main.scrollTop = 0; return true }`)
    }
    opened.push({
      text: link.text,
      href: link.href,
      landed: state.href,
      title: state.title,
      h1: state.h1,
      headerText: state.headerText,
      file,
      bottom,
      dialogs: state.dialogs.map((d) => ({ label: d.label, text: d.text.slice(0, 400), z: d.z, top: d.top, left: d.left, w: d.w, h: d.h })),
      fields: state.fields,
      body: state.body,
      overlay: state.overlay,
      console: consoleEvents.slice(marks.consoleFrom),
      network: netEvents.slice(marks.netFrom),
    })
    note('landed', { href: link.href, landed: state.href, h1: state.h1, headerText: state.headerText })
  }

  writeFileSync(`${OUT}/notes.json`, JSON.stringify(scrub({ opened, notes }), null, 2))
  console.log('WROTE notes', opened.map((item) => item.href).join(', ') || '(no page links)')
} catch (error) {
  const message = scrub(error instanceof Error ? error.stack || error.message : String(error))
  writeFileSync(`${OUT}/run-error.txt`, message)
  console.error(message)
  process.exitCode = 1
} finally {
  if (chrome?.pid) {
    try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch { /* already exited */ }
  }
}
