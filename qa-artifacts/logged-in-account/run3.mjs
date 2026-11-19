import { spawn, execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/logged-in-account'
const PROFILE = `${OUT}/chrome-profile-3`
const PORT = 9543
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const SECRET = process.env.QA_PASS || ''

if (!EMAIL || !SECRET) process.exit(1)

function scrub(value) {
  if (typeof value === 'string') return value.split(SECRET).join('[redacted]')
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) out[key] = /password|secret|hash|token/i.test(key) ? '[redacted]' : scrub(val)
    return out
  }
  return value
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (!msg.id || !this.pending.has(msg.id)) return
      const { resolve, reject, timer } = this.pending.get(msg.id)
      clearTimeout(timer)
      this.pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    })
  }
  send(method, params = {}, timeout = 20000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`timeout ${method}`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

function waitForOpen(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error('websocket open timeout')), 10000)
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws) })
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('websocket error')) })
  })
}

async function waitForPort() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return
    } catch { /* starting */ }
    await delay(250)
  }
  throw new Error('chrome debug port did not open')
}

const out = {}
let chrome
let ws

try {
  mkdirSync(OUT, { recursive: true })
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: SECRET }),
  })
  const loginBody = await loginRes.json().catch(() => ({}))
  if (!loginRes.ok || !loginBody.user) throw new Error(`login status ${loginRes.status}`)
  const sessionUser = loginBody.user

  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-sync',
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-features=Translate,MediaRouter',
    '--force-color-profile=srgb', '--window-size=1440,900',
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', 'about:blank',
  ], { stdio: 'ignore' })

  await waitForPort()
  const pages = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
  const page = pages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
  ws = await waitForOpen(page.webSocketDebuggerUrl)
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  async function evalFn(source, args = []) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(${source})(${args.map((arg) => JSON.stringify(arg)).join(',')})`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description || result.exceptionDetails.text).slice(0, 400))
    return result.result?.value
  }

  function waitLoad() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('load timeout')), 25000)
      const listener = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.method === 'Page.loadEventFired') {
          clearTimeout(timer)
          ws.removeEventListener('message', listener)
          resolve()
        }
      }
      ws.addEventListener('message', listener)
    })
  }

  async function goto(pathname) {
    const loaded = waitLoad()
    await cdp.send('Page.navigate', { url: new URL(pathname, BASE).href })
    await loaded
  }

  async function shot(name) {
    const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(image.data, 'base64'))
  }

  async function mouseClick(x, y) {
    const px = Math.round(x)
    const py = Math.round(y)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1 })
  }

  async function keyTap(key, code, vk, text) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: text || '', unmodifiedText: text || '' })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  }

  await goto('/')
  await evalFn(`function(user){
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('ss-tour-seen-home', '1')
    localStorage.setItem('ss-product-tour-seen', '1')
    return true
  }`, [sessionUser])
  await goto('/dashboard')
  for (let i = 0; i < 40; i++) {
    const ok = await evalFn(`function(){ return /Welcome back/.test(document.body.innerText || '') }`)
    if (ok) break
    await delay(250)
  }
  await delay(500)

  const bell = await evalFn(`function(){
    const el = document.querySelector('button[aria-label^="Notifications"]')
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: el.getAttribute('aria-label') }
  }`)
  out.bell = bell
  await mouseClick(bell.x, bell.y)
  await delay(400)

  const space = await evalFn(`function(){
    const account = [...document.querySelectorAll('header button')].find((b) => (b.innerText || '').includes('Sumba'))
    account.focus()
    return document.activeElement === account
  }`)
  out.focused = space
  await keyTap(' ', 'Space', 32, ' ')
  await delay(500)
  out.afterSpace = await evalFn(`function(){
    return [...document.querySelectorAll('[role="dialog"]')].map((el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '')
  }`)
  if (!out.afterSpace.includes('profile-sidebar-title')) {
    await evalFn(`function(){
      const account = [...document.querySelectorAll('header button')].find((b) => (b.innerText || '').includes('Sumba'))
      account.click()
      return true
    }`)
    await delay(600)
    out.activatedByClick = true
  }
  out.afterActivate = await evalFn(`function(){
    function box(el) {
      const r = el.getBoundingClientRect()
      return { label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '', top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), z: getComputedStyle(el).zIndex }
    }
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(box)
    const a = dialogs.find((d) => d.label === 'Notifications')
    const b = dialogs.find((d) => d.label === 'profile-sidebar-title')
    let overlap = null
    if (a && b) {
      const left = Math.max(a.left, b.left)
      const right = Math.min(a.right, b.right)
      const top = Math.max(a.top, b.top)
      const bottom = Math.min(a.bottom, b.bottom)
      overlap = { w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
    }
    return { dialogs, overlap }
  }`)
  await shot('07-menus-overlapping')

  await evalFn(`function(){
    document.querySelector('[aria-label="Close profile"]')?.click()
    return true
  }`)
  await delay(300)
  await mouseClick(200, 400)
  await delay(300)

  const opened = await evalFn(`function(){
    const account = [...document.querySelectorAll('header button')].find((b) => (b.innerText || '').includes('Sumba'))
    account.click()
    return true
  }`)
  out.reopened = opened
  await delay(500)
  const linkInfo = await evalFn(`function(){
    const link = document.querySelector('#profile-sidebar-title')?.closest('[role="dialog"]')?.querySelector('a[href="/settings"]')
    if (!link) return { found: false }
    link.scrollIntoView({ block: 'center' })
    const r = link.getBoundingClientRect()
    const x = Math.round(r.left + r.width / 2)
    const y = Math.round(r.top + r.height / 2)
    const top = document.elementFromPoint(x, y)
    return {
      found: true,
      x, y,
      hit: top ? (top.innerText || top.getAttribute('aria-label') || top.tagName).toString().replace(/\\s+/g, ' ').trim().slice(0, 40) : '',
      inside: !!(top && (top === link || link.contains(top))),
    }
  }`)
  out.linkInfo = linkInfo
  if (linkInfo.inside) await mouseClick(linkInfo.x, linkInfo.y)
  else {
    await evalFn(`function(){
      document.querySelector('a[href="/settings"]').click()
      return true
    }`)
    out.settingsVia = 'element-click'
  }
  let path = ''
  for (let i = 0; i < 40; i++) {
    path = await evalFn(`function(){ return location.pathname }`)
    if (path === '/settings') break
    await delay(250)
  }
  out.path = path
  if (path !== '/settings') {
    await goto('/settings')
    out.path = await evalFn(`function(){ return location.pathname }`)
    out.settingsVia = 'direct-navigation'
  }
  for (let i = 0; i < 30; i++) {
    const ready = await evalFn(`function(){ return (document.querySelector('#set-full-name')?.value || '').length }`)
    if (ready > 0) break
    await delay(200)
  }
  await delay(400)
  out.settings = await evalFn(`function(){
    const main = document.querySelector('main')
    const text = (main?.innerText || '').replace(/\\s+/g, ' ').trim()
    const fields = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      id: el.id, type: el.type, value: el.type === 'password' ? (el.value ? '[set]' : '') : String(el.value || '').slice(0, 120)
    }))
    const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi)].map((m) => m[0])
    return {
      href: location.href,
      h1: document.querySelector('h1')?.innerText || '',
      header: (document.querySelector('header')?.innerText || '').replace(/\\s+/g, ' ').trim(),
      fields,
      emails,
      paywall: /subscribe to continue|monthly subscription|used your 2 free|payment required/i.test(text),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((el) => (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 200)),
      text: text.slice(0, 1800),
    }
  }`)
  await shot('05-settings')
  const scrolled = await evalFn(`function(){
    const main = document.querySelector('main')
    if (!main) return null
    main.scrollTop = Math.round(main.scrollHeight / 2)
    return { sh: main.scrollHeight, ch: main.clientHeight, top: main.scrollTop }
  }`)
  out.scrollMid = scrolled
  await delay(300)
  await shot('05-settings-mid')
  await evalFn(`function(){ const main = document.querySelector('main'); if (main) main.scrollTop = main.scrollHeight; return true }`)
  await delay(300)
  await shot('05-settings-bottom')
  out.settingsBottom = await evalFn(`function(){
    const text = (document.querySelector('main')?.innerText || '').replace(/\\s+/g, ' ').trim()
    return text.slice(-1600)
  }`)

  writeFileSync(`${OUT}/notes3.json`, JSON.stringify(scrub(out), null, 2))
  console.log(JSON.stringify({
    bell: out.bell?.label,
    afterSpace: out.afterSpace,
    activatedByClick: out.activatedByClick || false,
    overlap: out.afterActivate?.overlap || null,
    path: out.path,
    via: out.settingsVia || 'mouse',
    h1: out.settings?.h1,
    name: (out.settings?.fields || []).find((f) => f.id === 'set-full-name')?.value,
    email: (out.settings?.fields || []).find((f) => f.id === 'set-email')?.value,
    paywall: out.settings?.paywall,
    header: out.settings?.header,
  }))
  console.log('WROTE notes3')
} catch (error) {
  const message = scrub(error instanceof Error ? error.stack || error.message : String(error))
  writeFileSync(`${OUT}/run3-error.txt`, message)
  console.error(message)
  process.exitCode = 1
} finally {
  try { ws?.close() } catch { /* ignore */ }
  if (chrome?.pid) {
    try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch { /* gone */ }
  }
  setTimeout(() => process.exit(process.exitCode || 0), 200)
}
