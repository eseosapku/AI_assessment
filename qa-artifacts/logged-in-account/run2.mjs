import { spawn, execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/logged-in-account'
const PROFILE = `${OUT}/chrome-profile-2`
const PORT = 9542
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || ''
const SECRET = process.env.QA_PASS || ''
const EXPECTED_NAME = 'Sumba Mabumba Branis'
const EXPECTED_EMAIL = 'b.sumba@alustudent.com'

if (!EMAIL || !SECRET) {
  console.error('missing credentials')
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

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id)
        clearTimeout(timer)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
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
    } catch { /* starting */ }
    await delay(250)
  }
  throw new Error('chrome debug port did not open')
}

const findings = {}
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
  findings.identity = {
    name: sessionUser.name,
    email: sessionUser.email,
    role: sessionUser.role,
    studentId: sessionUser.studentId,
    className: sessionUser.class,
    profileComplete: sessionUser.profileComplete,
  }

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
  ws = await waitForOpen(page.webSocketDebuggerUrl)
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  async function evalFn(source, args = []) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(${source})(${args.map((arg) => JSON.stringify(arg)).join(',')})`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'eval failed'
      throw new Error(String(text).slice(0, 500))
    }
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
    const url = new URL(pathname, BASE)
    if (url.host !== 'localhost:3000') throw new Error(`refusing ${url.host}`)
    const loaded = waitLoad()
    await cdp.send('Page.navigate', { url: url.href })
    await loaded
  }

  async function shot(name) {
    const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    const file = `${OUT}/${name}.png`
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    return file
  }

  async function mouseClick(x, y) {
    const px = Math.round(x)
    const py = Math.round(y)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px, y: py })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1 })
  }

  async function key(keyName, code, vk) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  }

  const BOXES = `function(){
    function box(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden' || r.width < 2 || r.height < 2) return null
      return {
        label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '',
        top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom),
        w: Math.round(r.width), h: Math.round(r.height), z: s.zIndex,
        text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220)
      }
    }
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(box).filter(Boolean)
    const bell = document.querySelector('button[aria-label^="Notifications"]')
    const account = [...document.querySelectorAll('header button')].find((b) => b.querySelector('img'))
    const hit = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const x = Math.round(r.left + r.width / 2)
      const y = Math.round(r.top + r.height / 2)
      const top = document.elementFromPoint(x, y)
      return { x, y, tag: top ? top.tagName : '', label: top ? (top.getAttribute('aria-label') || top.getAttribute('aria-hidden') || (top.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60)) : '', same: top === el || (el.contains && top && el.contains(top)) }
    }
    return {
      href: location.href,
      active: (document.activeElement && (document.activeElement.innerText || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName) || '').toString().replace(/\\s+/g, ' ').trim().slice(0, 80),
      dialogs,
      bell: box(bell),
      account: box(account),
      hitBell: hit(bell),
      hitAccount: hit(account)
    }
  }`

  await goto('/')
  await evalFn(`function(user){
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('ss-tour-seen-home', '1')
    localStorage.setItem('ss-product-tour-seen', '1')
    return true
  }`, [sessionUser])
  await goto('/dashboard')
  const ready = await (async () => {
    for (let i = 0; i < 40; i++) {
      const text = await evalFn(`function(){ return (document.body && document.body.innerText || '').slice(0, 200) }`)
      if (/Welcome back/.test(text || '')) return true
      await delay(250)
    }
    return false
  })()
  findings.dashboardReady = ready
  await delay(600)

  const before = await evalFn(BOXES)
  findings.beforeClick = before
  if (!before?.hitBell) throw new Error('notification bell missing')
  await mouseClick(before.hitBell.x, before.hitBell.y)
  await delay(400)
  const afterBell = await evalFn(BOXES)
  findings.afterBellMouse = afterBell
  await shot('02b-notifications-mouse')

  await key('Tab', 'Tab', 9)
  await delay(200)
  const afterTab = await evalFn(BOXES)
  findings.afterTab = afterTab
  await key('Enter', 'Enter', 13)
  await delay(700)
  const afterEnter = await evalFn(BOXES)
  findings.afterTabEnter = afterEnter
  await shot('06-overlap-tab-enter')

  const notif = afterEnter?.dialogs?.find((d) => d.label === 'Notifications')
  const profile = afterEnter?.dialogs?.find((d) => d.label === 'profile-sidebar-title')
  if (notif && profile) {
    const overlap = !(notif.right <= profile.left || profile.right <= notif.left || notif.bottom <= profile.top || profile.bottom <= notif.top)
    findings.keyboardOverlap = { overlap, notif, profile }
  } else {
    findings.keyboardOverlap = { overlap: false, dialogs: afterEnter?.dialogs || [] }
    const account = afterBell?.account
    if (account) {
      await evalFn(`function(){
        const account = [...document.querySelectorAll('header button')].find((b) => b.querySelector('img'))
        if (account) account.focus()
        return document.activeElement === account
      }`)
      await key('Enter', 'Enter', 13)
      await delay(700)
      const focused = await evalFn(BOXES)
      findings.afterFocusEnter = focused
      await shot('06b-overlap-focus-enter')
    }
  }

  await key('Escape', 'Escape', 27)
  await delay(300)
  await key('Escape', 'Escape', 27)
  await delay(300)

  const closed = await evalFn(BOXES)
  findings.afterEscape = { dialogs: closed.dialogs, hitAccount: closed.hitAccount }
  if (closed.hitAccount?.same) {
    await mouseClick(closed.hitAccount.x, closed.hitAccount.y)
    await delay(600)
  }
  const menu = await evalFn(`function(){
    const dialog = document.querySelector('#profile-sidebar-title')?.closest('[role="dialog"]')
    if (!dialog) return { open: false }
    const link = [...dialog.querySelectorAll('a[href]')].find((a) => a.getAttribute('href') === '/settings')
    if (!link) return { open: true, links: [...dialog.querySelectorAll('a')].map((a) => a.getAttribute('href')) }
    const r = link.getBoundingClientRect()
    link.scrollIntoView({ block: 'center' })
    const r2 = link.getBoundingClientRect()
    return { open: true, x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2), text: link.innerText.trim(), top: Math.round(r.top) }
  }`)
  findings.settingsLink = menu
  if (!menu?.x) throw new Error('settings link not clickable')
  await mouseClick(menu.x, menu.y)
  let landed = ''
  for (let i = 0; i < 40; i++) {
    landed = await evalFn(`function(){ return location.pathname }`)
    if (landed === '/settings') break
    await delay(250)
  }
  await delay(800)
  findings.settingsPath = landed

  const settingsTop = await evalFn(`function(){
    const main = document.querySelector('main')
    const text = (main ? main.innerText : document.body.innerText).replace(/\\s+/g, ' ').trim()
    const fields = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      id: el.id || '',
      type: el.type || el.tagName,
      value: el.type === 'password' ? (el.value ? '[set]' : '') : String(el.value || '').slice(0, 160)
    }))
    const studentId = [...document.querySelectorAll('p, span, dd, div')].map((el) => (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) ? el.textContent.trim() : '').find((t) => /^STD-/.test(t)) || ''
    const links = [...document.querySelectorAll('main a[href], a[href="/report-card"], a[href="/profile"], a[href="/subscription"]')].map((a) => ({ text: (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80), href: a.getAttribute('href') })).slice(0, 25)
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((el) => (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300))
    return {
      href: location.href,
      h1: document.querySelector('h1')?.innerText || '',
      header: (document.querySelector('header')?.innerText || '').replace(/\\s+/g, ' ').trim(),
      fields,
      studentId,
      links,
      dialogs,
      paywall: /subscribe to continue|monthly subscription|used your 2 free|payment required|upgrade to/i.test(text),
      text: text.slice(0, 2500)
    }
  }`)
  findings.settingsTop = settingsTop
  await shot('05-settings')

  const scrollInfo = await evalFn(`function(){
    const main = document.querySelector('main')
    if (!main) return null
    return { sh: main.scrollHeight, ch: main.clientHeight }
  }`)
  findings.settingsScroll = scrollInfo
  if (scrollInfo && scrollInfo.sh > scrollInfo.ch + 80) {
    await evalFn(`function(){
      const main = document.querySelector('main')
      main.scrollTop = Math.round(main.scrollHeight * 0.45)
      return main.scrollTop
    }`)
    await delay(300)
    await shot('05-settings-mid')
    await evalFn(`function(){
      const main = document.querySelector('main')
      main.scrollTop = main.scrollHeight
      return main.scrollTop
    }`)
    await delay(400)
    await shot('05-settings-bottom')
    findings.settingsBottom = await evalFn(`function(){
      const main = document.querySelector('main')
      return (main?.innerText || '').replace(/\\s+/g, ' ').trim().slice(-1800)
    }`)
  }

  findings.nameMatch = {
    headerHasSumba: /Sumba/.test(settingsTop.header || ''),
    fullName: (settingsTop.fields || []).find((f) => f.id === 'set-full-name')?.value || '',
    email: (settingsTop.fields || []).find((f) => f.id === 'set-email')?.value || '',
    expectedName: EXPECTED_NAME,
    expectedEmail: EXPECTED_EMAIL,
  }

  const linkChecks = []
  for (const link of settingsTop.links || []) {
    if (!link.href || !link.href.startsWith('/')) continue
    const res = await fetch(new URL(link.href, BASE), { redirect: 'manual' })
    linkChecks.push({ href: link.href, status: res.status, location: res.headers.get('location') || '' })
  }
  const practice = await fetch(`${BASE}/practice`, { redirect: 'manual' })
  linkChecks.push({ href: '/practice', status: practice.status, location: practice.headers.get('location') || '', source: 'notification target' })
  findings.linkChecks = linkChecks

  writeFileSync(`${OUT}/notes2.json`, JSON.stringify(scrub(findings), null, 2))
  console.log('settings', landed)
  console.log('keyboardOverlap', JSON.stringify(findings.keyboardOverlap))
  console.log('name', findings.nameMatch.fullName, findings.nameMatch.email)
  console.log('paywall', settingsTop.paywall)
  console.log('WROTE notes2')
} catch (error) {
  const message = scrub(error instanceof Error ? error.stack || error.message : String(error))
  writeFileSync(`${OUT}/run2-error.txt`, message)
  console.error(message)
  process.exitCode = 1
} finally {
  try { ws?.close() } catch { /* ignore */ }
  if (chrome?.pid) {
    try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }) } catch { /* already exited */ }
  }
  setTimeout(() => process.exit(process.exitCode || 0), 300)
}
