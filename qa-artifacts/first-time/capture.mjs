import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\first-time'
const PORT = 41987
const PROFILE = path.join(OUT, 'profile')

const pages = [
  { name: '01-home', url: 'http://localhost:3000/' },
  { name: '02-features', url: 'http://localhost:3000/#features' },
  { name: '03-how', url: 'http://localhost:3000/#how' },
  { name: '04-pricing', url: 'http://localhost:3000/#pricing' },
  { name: '05-studylab', url: 'http://localhost:3000/#studylab' },
  { name: '06-signup', url: 'http://localhost:3000/signup' },
  { name: '07-forgot-password', url: 'http://localhost:3000/forgot-password' },
  { name: '08-login', url: 'http://localhost:3000/login' },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function killTree(pid) {
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve())
  })
}

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
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
    this.listeners = []
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg)
      }
    })
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve())
      this.ws.addEventListener('error', (e) => reject(e))
    })
  }
  send(method, params = {}, timeout = 20000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('CDP timeout ' + method))
      }, timeout)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(t); resolve(v) },
        reject: (e) => { clearTimeout(t); reject(e) },
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  on(fn) { this.listeners.push(fn) }
  close() { try { this.ws.close() } catch {} }
}

async function waitForPage() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await getJson('/json/list')
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {}
    await sleep(200)
  }
  throw new Error('No DevTools page target')
}

const PROBE = `(() => {
  const h1 = document.querySelector('h1');
  const chain = [];
  let el = h1;
  while (el && chain.length < 5) {
    chain.push({
      tag: el.tagName,
      id: el.id || '',
      opacity: getComputedStyle(el).opacity,
      transform: getComputedStyle(el).transform,
      inline: (el.getAttribute('style') || '').slice(0, 160),
    });
    el = el.parentElement;
  }
  const ids = ['features', 'how', 'pricing', 'studylab'];
  const sections = {};
  for (const id of ids) {
    const n = document.getElementById(id);
    if (!n) { sections[id] = null; continue; }
    const r = n.getBoundingClientRect();
    sections[id] = { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  }
  const nav = [...document.querySelectorAll('nav[aria-label="Main"] a, nav[aria-label="Footer"] a')].map((a) => ({
    text: (a.textContent || '').trim(),
    href: a.getAttribute('href'),
    nav: a.closest('nav')?.getAttribute('aria-label') || '',
  }));
  const controls = [...document.querySelectorAll('button, a, input, label, h1, h2, h3')].slice(0, 80).map((el) => ({
    tag: el.tagName,
    type: el.getAttribute('type'),
    name: el.getAttribute('name'),
    placeholder: el.getAttribute('placeholder'),
    aria: el.getAttribute('aria-label'),
    href: el.getAttribute('href'),
    text: (el.innerText || el.getAttribute('value') || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
  }));
  const imgs = [...document.images].map((img) => {
    const r = img.getBoundingClientRect();
    const inView = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    return {
      src: img.currentSrc || img.src,
      alt: img.alt,
      complete: img.complete,
      nw: img.naturalWidth,
      nh: img.naturalHeight,
      inView,
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });
  const bodyText = (document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n').slice(0, 2500);
  return {
    url: location.href,
    title: document.title,
    scrollY: Math.round(window.scrollY),
    inner: [window.innerWidth, window.innerHeight],
    h1: h1 ? h1.innerText.replace(/\\s+/g, ' ').trim().slice(0, 200) : null,
    h1Opacity: h1 ? getComputedStyle(h1).opacity : null,
    chain,
    sections,
    nav,
    controls,
    imgs: imgs.filter((i) => i.inView || !i.complete || i.nw === 0),
    brokenInView: imgs.filter((i) => i.inView && i.complete && i.nw === 0 && i.h > 8),
    bodyText,
  };
})()`

async function captureOne(page) {
  const proc = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${PROFILE}`,
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' })

  const errors = []
  let cdp
  try {
    const target = await waitForPage()
    cdp = new Cdp(target.webSocketDebuggerUrl)
    await cdp.ready()
    cdp.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params?.exceptionDetails
        errors.push((d?.exception?.description || d?.text || 'exception').slice(0, 300))
      }
    })
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp.send('Page.navigate', { url: page.url })
    await sleep(3500)
    await cdp.send('Runtime.evaluate', {
      expression: `Promise.all([...document.images].map(img => img.complete ? 1 : new Promise(res => { img.addEventListener('load', () => res(1), {once:true}); img.addEventListener('error', () => res(0), {once:true}); setTimeout(() => res(0), 2000); })))`,
      awaitPromise: true,
      timeout: 8000,
    }).catch(() => {})
    const probed = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true })
    const data = probed.result?.value || { evalError: probed }
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const pngPath = path.join(OUT, page.name + '.png')
    fs.writeFileSync(pngPath, Buffer.from(shot.data, 'base64'))
    fs.writeFileSync(path.join(OUT, page.name + '.json'), JSON.stringify({ errors, data }, null, 2))
    const text = data.bodyText || ''
    fs.writeFileSync(path.join(OUT, page.name + '.txt'), text)
    return { name: page.name, png: pngPath, bytes: fs.statSync(pngPath).size, scrollY: data.scrollY, h1: data.h1, h1Opacity: data.h1Opacity, url: data.url, title: data.title, errors }
  } finally {
    if (cdp) cdp.close()
    if (proc.pid) await killTree(proc.pid)
    await sleep(400)
  }
}

const summary = []
for (const page of pages) {
  process.stdout.write('START ' + page.name + '\\n')
  try {
    const result = await captureOne(page)
    summary.push(result)
    process.stdout.write('OK ' + page.name + ' scroll=' + result.scrollY + ' h1op=' + result.h1Opacity + ' bytes=' + result.bytes + '\\n')
  } catch (e) {
    summary.push({ name: page.name, error: String(e && e.stack || e) })
    process.stdout.write('FAIL ' + page.name + ' ' + (e && e.message) + '\\n')
    await sleep(500)
  }
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
process.stdout.write('DONE\\n')
