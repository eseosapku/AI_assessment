import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\first-time'
const PORT = 42133
const PROFILE = path.join(OUT, 'profile-probe')
const URL = process.argv[2] || 'http://localhost:3000/'
const NAME = process.argv[3] || 'probe-home'

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
  `--user-data-dir=${PROFILE}`, '--window-size=1440,900', URL,
], { stdio: 'ignore' })

let ws
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
  log('TARGET ' + target.url)
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, t } = pending.get(msg.id)
      clearTimeout(t)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })
  function send(method, params = {}, timeout = 8000) {
    const my = ++id
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ' + method)), timeout)
      pending.set(my, { resolve, reject, t })
      ws.send(JSON.stringify({ id: my, method, params }))
    })
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  const expr = `(() => {
    const h1 = document.querySelector('h1');
    const spin = !!document.querySelector('.animate-spin');
    let op = null, color = null, rect = null;
    if (h1) {
      const cs = getComputedStyle(h1);
      op = cs.opacity;
      color = cs.color;
      const r = h1.getBoundingClientRect();
      rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      let p = h1.parentElement, chain = [];
      while (p && chain.length < 4) {
        const pcs = getComputedStyle(p);
        chain.push({ tag: p.tagName, op: pcs.opacity, inline: (p.getAttribute('style')||'').slice(0,80) });
        p = p.parentElement;
      }
      var parentChain = chain;
    }
    const ids = ['features','how','pricing','studylab'];
    const sections = {};
    for (const id of ids) {
      const n = document.getElementById(id);
      sections[id] = n ? Math.round(n.getBoundingClientRect().top) : null;
    }
    const create = [...document.querySelectorAll('h1')].find(e => (e.textContent||'').includes('Create your account'));
    let createInfo = null;
    if (create) {
      const r = create.getBoundingClientRect();
      const cs = getComputedStyle(create);
      createInfo = { op: cs.opacity, color: cs.color, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    const interesting = [...document.querySelectorAll('p, img, a')].map(n => {
      const t = (n.innerText || n.alt || '').replace(/\\s+/g,' ').trim();
      if (!['Assess','Study','Improve','Classroom ready','A PRODUCT OF'].some(s => t.startsWith(s)) && n.tagName !== 'IMG') return null;
      const r = n.getBoundingClientRect();
      return { tag: n.tagName, t: t.slice(0,40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(Boolean);
    const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
    const imgs = [...document.images].map(img => {
      const r = img.getBoundingClientRect();
      const inView = r.top < innerHeight && r.bottom > 0 && r.width > 8;
      return { alt: (img.alt || img.src).slice(0, 60), nw: img.naturalWidth, nh: img.naturalHeight, rh: Math.round(r.height), rw: Math.round(r.width), inView, complete: img.complete };
    });
    return {
      href: location.href,
      hash: location.hash,
      scrollY: Math.round(scrollY),
      spin,
      h1: h1 ? h1.innerText.replace(/\\s+/g,' ').trim().slice(0,140) : null,
      op, color, rect,
      parentChain: typeof parentChain === 'undefined' ? null : parentChain,
      sections,
      createInfo,
      interesting,
      imgs: imgs.filter(i => i.inView),
      unloadedInView: imgs.filter(i => i.inView && i.nw === 0).length,
      dialog: dialog ? dialog.innerText.replace(/\\s+/g,' ').trim().slice(0,400) : null,
      title: document.title,
    };
  })()`

  let last
  for (let i = 0; i < 24; i++) {
    await sleep(500)
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
    last = res.result?.value
    log('t=' + ((i + 1) * 0.5) + ' spin=' + last?.spin + ' scroll=' + last?.scrollY + ' h1=' + (last?.h1 || 'none') + ' op=' + last?.op + ' hash=' + last?.hash + ' unloaded=' + last?.unloadedInView + ' createY=' + (last?.createInfo && last.createInfo.y))
    const textReady = last && !last.spin && (last.h1 || last.createInfo)
    const imagesReady = last && last.unloadedInView === 0
    if (textReady && (imagesReady || i >= 16)) break
  }
  await sleep(1200)
  const res2 = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
  last = res2.result?.value
  log('SETTLED ' + JSON.stringify(last))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, NAME + '.png'), Buffer.from(shot.data, 'base64'))
  fs.writeFileSync(path.join(OUT, NAME + '.json'), JSON.stringify(last, null, 2))
  log('SAVED ' + NAME)
} catch (e) {
  log('ERR ' + (e && e.stack || e))
} finally {
  try { ws && ws.close() } catch {}
  if (proc.pid) await killTree(proc.pid)
}
