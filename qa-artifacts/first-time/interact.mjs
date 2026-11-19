import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\first-time'
const PORT = 42177
const PROFILE = path.join(OUT, 'profile-interact')

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function killTree(pid) { return new Promise((r) => execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => r())) }
function log(m) { process.stdout.write(m + '\n') }
function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.setTimeout(1500, () => { req.destroy(); reject(new Error('http timeout')) })
  })
}

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  `--user-data-dir=${PROFILE}`, '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' })

const VIEW = `(() => {
  const h1 = document.querySelector('h1');
  const spin = !!document.querySelector('.animate-spin');
  function minOp(el) {
    let m = 1, n = el;
    const chain = [];
    while (n && chain.length < 6) {
      const op = parseFloat(getComputedStyle(n).opacity);
      chain.push(op);
      if (op < m) m = op;
      n = n.parentElement;
    }
    return { m, chain };
  }
  const heads = [...document.querySelectorAll('h1,h2')].slice(0, 8).map(el => {
    const r = el.getBoundingClientRect();
    const o = minOp(el);
    return { t: el.innerText.replace(/\\s+/g,' ').trim().slice(0, 80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), minOp: Math.round(o.m * 100) / 100, chain: o.chain };
  });
  const sections = {};
  for (const id of ['features','how','pricing','studylab']) {
    const n = document.getElementById(id);
    sections[id] = n ? Math.round(n.getBoundingClientRect().top) : null;
  }
  const dash = [...document.images].find(i => (i.alt || '').includes('dashboard'));
  const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
  const topText = [...document.querySelectorAll('h1,h2,h3,button,a')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 50 && r.top < 220 && r.height > 0 && r.width > 0 && getComputedStyle(el).opacity !== '0';
  }).map(el => el.innerText.replace(/\\s+/g,' ').trim().slice(0, 60)).filter(Boolean).slice(0, 8);
  const buttons = [...document.querySelectorAll('button')].slice(0, 30).map(b => ({
    type: b.getAttribute('type'),
    aria: b.getAttribute('aria-label'),
    text: (b.innerText || '').replace(/\\s+/g,' ').trim().slice(0, 40),
  }));
  const submit = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('Create'));
  let submitBox = null;
  if (submit) {
    const r = submit.getBoundingClientRect();
    submitBox = { y: Math.round(r.y), h: Math.round(r.height), x: Math.round(r.x), w: Math.round(r.width) };
  }
  return {
    href: location.href,
    hash: location.hash,
    scrollY: Math.round(scrollY),
    spin,
    dashH: dash ? Math.round(dash.getBoundingClientRect().height) : null,
    dashNw: dash ? dash.naturalWidth : null,
    heads,
    sections,
    topText,
    dialog: dialog ? dialog.innerText.replace(/\\s+/g,' ').trim().slice(0, 500) : null,
    buttons,
    submitBox,
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
  };
})()`

let ws
const report = {}
try {
  let target
  for (let i = 0; i < 40; i++) {
    try {
      const list = await getJson('/json/list')
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (target) break
    } catch {}
    await sleep(250)
  }
  if (!target) throw new Error('no target')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      clearTimeout(p.t)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
      else p.resolve(msg.result)
    }
  })
  function send(method, params = {}, timeout = 10000) {
    const my = ++id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ' + method)), timeout)
      pending.set(my, { resolve, reject, t })
      ws.send(JSON.stringify({ id: my, method, params }))
    })
  }
  async function ev(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true })
    return res.result?.value
  }
  async function shot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'))
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  async function open(url) {
    await send('Page.navigate', { url }, 8000).catch((e) => log('nav ' + e.message))
  }
  async function until(pred, tries = 24) {
    let last
    for (let i = 0; i < tries; i++) {
      await sleep(500)
      last = await ev(VIEW)
      if (pred(last)) return last
    }
    return last
  }

  log('HOME')
  await open('http://localhost:3000/')
  let home = await until((d) => d && !d.spin && d.dashNw > 100)
  await shot('11-home-ready.png')
  report.home = home
  log('home scroll=' + home?.scrollY + ' dash=' + home?.dashH)

  const clicks = [
    ['Features', '12-click-features.png'],
    ['LearnSpace', '13-click-studylab.png'],
    ['Exam prep', '14-click-exam.png'],
    ['Pricing', '15-click-pricing.png'],
  ]
  for (const [label, file] of clicks) {
    const clicked = await ev(`(() => { const a = [...document.querySelectorAll('nav[aria-label="Main"] a')].find(n => n.textContent.trim() === ${JSON.stringify(label)}); if (!a) return {missing:true}; a.click(); return {href:a.getAttribute('href')}; })()`)
    await sleep(900)
    const after = await ev(VIEW)
    await shot(file)
    report['click-' + label] = { clicked, scrollY: after?.scrollY, hash: after?.hash, sections: after?.sections, topText: after?.topText, heads: after?.heads?.slice(0, 4) }
    log('CLICK ' + label + ' scroll=' + after?.scrollY + ' hash=' + after?.hash + ' top=' + JSON.stringify(after?.topText))
  }

  const how = await ev(`(() => { const a = [...document.querySelectorAll('a')].find(n => n.textContent.trim() === 'See how it works'); if (!a) return {missing:true}; a.click(); return {href:a.getAttribute('href')}; })()`)
  await sleep(900)
  const afterHow = await ev(VIEW)
  await shot('16-click-how.png')
  report.how = { how, scrollY: afterHow?.scrollY, hash: afterHow?.hash, topText: afterHow?.topText, sections: afterHow?.sections }
  log('HOW scroll=' + afterHow?.scrollY + ' top=' + JSON.stringify(afterHow?.topText))

  await open('http://localhost:3000/')
  await until((d) => d && !d.spin && d.dashNw > 100)
  const started = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(n => (n.textContent||'').trim().startsWith('Get started')); if (!b) return {missing:true}; b.click(); return {ok:true}; })()`)
  await sleep(700)
  const modal = await ev(VIEW)
  await shot('17-get-started-modal.png')
  report.getStarted = { started, dialog: modal?.dialog, href: modal?.href }
  log('MODAL ' + (modal?.dialog || 'none'))

  await open('http://localhost:3000/')
  await until((d) => d && !d.spin && (d.heads || []).length)
  const signin = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(n => (n.textContent||'').trim() === 'Sign in'); if (!b) return {missing:true}; b.click(); return {ok:true}; })()`)
  await sleep(700)
  const loginModal = await ev(VIEW)
  await shot('18-sign-in-modal.png')
  report.signIn = { signin, dialog: loginModal?.dialog, href: loginModal?.href }
  log('SIGNIN ' + (loginModal?.dialog || 'none'))

  log('SIGNUP WAIT')
  await open('http://localhost:3000/signup')
  const signupTimeline = []
  let signup
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    signup = await ev(VIEW)
    const create = (signup?.heads || []).find(h => (h.t || '').includes('Create your account'))
    signupTimeline.push({ t: (i + 1) * 0.5, minOp: create?.minOp, y: create?.y })
    if (create && create.minOp > 0.9) break
  }
  await shot('19-signup-settled.png')
  report.signup = { timeline: signupTimeline, heads: signup?.heads, buttons: signup?.buttons, submitBox: signup?.submitBox, scrollH: signup?.scrollH, clientH: signup?.clientH, href: signup?.href }
  log('SIGNUP ' + JSON.stringify(signupTimeline))

  log('FORGOT WAIT')
  await open('http://localhost:3000/forgot-password')
  const forgotTimeline = []
  let forgot
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    forgot = await ev(VIEW)
    const h = (forgot?.heads || []).find(x => (x.t || '').includes('Forgot'))
    forgotTimeline.push({ t: (i + 1) * 0.5, minOp: h?.minOp, y: h?.y })
    if (h && h.minOp > 0.9) break
  }
  await shot('20-forgot-settled.png')
  report.forgot = { timeline: forgotTimeline, heads: forgot?.heads, href: forgot?.href }
  log('FORGOT ' + JSON.stringify(forgotTimeline))

  fs.writeFileSync(path.join(OUT, 'interact.json'), JSON.stringify(report, null, 2))
  log('DONE')
} catch (e) {
  log('ERR ' + (e && e.stack || e))
  fs.writeFileSync(path.join(OUT, 'interact-error.txt'), String(e && e.stack || e))
} finally {
  try { ws && ws.close() } catch {}
  if (proc.pid) await killTree(proc.pid)
}
