import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\first-time'
const PORT = 42111
const PROFILE = path.join(OUT, 'profile-measure')

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function killTree(pid) {
  return new Promise((resolve) => execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve()))
}
function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 0
    this.pending = new Map()
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve)
      this.ws.addEventListener('error', reject)
    })
  }
  send(method, params = {}, timeout = 20000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ' + method)), timeout)
      this.pending.set(id, { resolve, reject, t })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  attach() {
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (!msg.id || !this.pending.has(msg.id)) return
      const { resolve, reject, t } = this.pending.get(msg.id)
      clearTimeout(t)
      this.pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    })
  }
  close() { try { this.ws.close() } catch {} }
}

async function waitForPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await getJson('/json/list')
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {}
    await sleep(200)
  }
  throw new Error('no target')
}

async function evalJson(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true })
  if (res.exceptionDetails) {
    return { exception: res.exceptionDetails.text || res.exceptionDetails.exception?.description }
  }
  return res.result?.value
}

const GEOM = `(() => {
  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      opacity: cs.opacity, color: cs.color, bg: cs.backgroundColor,
      visibility: cs.visibility, display: cs.display, overflow: cs.overflow,
      transform: cs.transform,
    };
  }
  const h1s = [...document.querySelectorAll('h1')].map(box);
  const create = [...document.querySelectorAll('h1')].find(e => (e.textContent || '').includes('Create your account'));
  let chain = [];
  let el = create || null;
  while (el && chain.length < 8) { chain.push(box(el)); el = el.parentElement; }
  const labels = [...document.querySelectorAll('p, h3, img, a, button')].map((n) => {
    const t = (n.innerText || n.getAttribute('alt') || n.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
    if (!t || t.length > 40) return null;
    if (!/Assess|Study|Improve|Classroom|Create your|Back to|Sign in|Get started|Features|Exam prep|Pricing|LearnSpace|PRODUCT/.test(t) && n.tagName !== 'IMG') return null;
    return { tag: n.tagName, ...box(n) };
  }).filter(Boolean);
  const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
  const spin = !!document.querySelector('.animate-spin');
  const sections = {};
  for (const id of ['features','how','pricing','studylab']) {
    const n = document.getElementById(id);
    if (!n) { sections[id] = null; continue; }
    const r = n.getBoundingClientRect();
    sections[id] = { viewTop: Math.round(r.top), absTop: Math.round(r.top + scrollY) };
  }
  const nav = [...document.querySelectorAll('nav[aria-label="Main"] a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
  return {
    url: location.href,
    hash: location.hash,
    scrollY: Math.round(scrollY),
    scrollH: document.documentElement.scrollHeight,
    inner: [innerWidth, innerHeight],
    spin,
    h1s,
    createChain: chain,
    labels,
    sections,
    nav,
    dialog: dialog ? box(dialog) : null,
    dialogText: dialog ? dialog.innerText.slice(0, 600) : null,
  };
})()`

async function shot(cdp, name) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const file = path.join(OUT, name)
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'))
  return file
}

async function nav(cdp, url) {
  await cdp.send('Page.navigate', { url })
  let last = null
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    last = await evalJson(cdp, GEOM)
    const hasLanding = last && last.h1s && last.h1s.some((h) => h && h.text && h.text.length > 0) && !last.spin
    const hasAuth = last && last.url && /signup|forgot-password|login/.test(last.url) && last.h1s && last.h1s.length > 0 && !last.spin
    if (hasLanding || hasAuth) {
      await sleep(1500)
      last = await evalJson(cdp, GEOM)
      return { waitedMs: (i + 1) * 500 + 1500, data: last }
    }
  }
  return { waitedMs: 15000, data: last, timedOut: true }
}

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  `--user-data-dir=${PROFILE}`, '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' })

const report = {}
try {
  const target = await waitForPage()
  const cdp = new Cdp(target.webSocketDebuggerUrl)
  await cdp.ready()
  cdp.attach()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  const jobs = [
    ['01-home.png', 'http://localhost:3000/'],
    ['02-features.png', 'http://localhost:3000/#features'],
    ['03-how.png', 'http://localhost:3000/#how'],
    ['04-pricing.png', 'http://localhost:3000/#pricing'],
    ['05-studylab.png', 'http://localhost:3000/#studylab'],
    ['06-signup.png', 'http://localhost:3000/signup'],
    ['07-forgot-password.png', 'http://localhost:3000/forgot-password'],
    ['08-login.png', 'http://localhost:3000/login'],
  ]
  for (const [name, url] of jobs) {
    process.stdout.write('NAV ' + name + '\n')
    const result = await nav(cdp, url)
    await shot(cdp, name)
    report[name] = { url, ...result }
    const d = result.data || {}
    process.stdout.write('  spin=' + d.spin + ' scroll=' + d.scrollY + ' h1=' + JSON.stringify((d.h1s || []).map((h) => h && h.text)) + ' timeout=' + !!result.timedOut + '\n')
  }

  process.stdout.write('CLICK exam and get started\n')
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/' })
  await nav(cdp, 'http://localhost:3000/')
  const clickExam = await evalJson(cdp, `(() => {
    const a = [...document.querySelectorAll('nav[aria-label="Main"] a')].find(n => n.textContent.trim() === 'Exam prep');
    if (!a) return { missing: true };
    a.click();
    return { href: a.getAttribute('href') };
  })()`)
  await sleep(800)
  const afterExam = await evalJson(cdp, GEOM)
  await shot(cdp, '09-exam-prep-click.png')
  const clickStart = await evalJson(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find(n => (n.textContent || '').trim().startsWith('Get started'));
    if (!b) return { missing: true };
    b.click();
    return { clicked: true };
  })()`)
  await sleep(800)
  const afterStart = await evalJson(cdp, GEOM)
  await shot(cdp, '10-get-started-modal.png')
  report.examClick = { clickExam, afterExam }
  report.getStarted = { clickStart, afterStart }
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  process.stdout.write('DONE\n')
  cdp.close()
} catch (e) {
  fs.writeFileSync(path.join(OUT, 'measure-error.txt'), String(e && e.stack || e))
  process.stdout.write('ERR ' + (e && e.message) + '\n')
} finally {
  if (proc.pid) await killTree(proc.pid)
}
