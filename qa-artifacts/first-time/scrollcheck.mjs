import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\first-time'
const PORT = 42199
const PROFILE = path.join(OUT, 'profile-scroll')
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function killTree(pid) { return new Promise((r) => execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => r())) }
function log(m) { process.stdout.write(m + '\n') }
function getJson(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.setTimeout(1500, () => { req.destroy(); reject(new Error('t')) })
  })
}
const proc = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars',`--remote-debugging-port=${PORT}`,'--remote-allow-origins=*',`--user-data-dir=${PROFILE}`,'--window-size=1440,900','about:blank'], { stdio: 'ignore' })
let ws
try {
  let target
  for (let i = 0; i < 40 && !target; i++) {
    try { const list = await getJson('/json/list'); target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl) } catch {}
    await sleep(250)
  }
  if (!target) throw new Error('no target')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  let id = 0; const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); clearTimeout(p.t); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result) }
  })
  const send = (method, params={}, timeout=10000) => new Promise((resolve, reject) => {
    const my = ++id; const t = setTimeout(() => reject(new Error('timeout '+method)), timeout)
    pending.set(my, { resolve, reject, t }); ws.send(JSON.stringify({ id: my, method, params }))
  })
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.value
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')) }
  await send('Runtime.enable'); await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: 'http://localhost:3000/signup' }, 8000).catch(e => log(e.message))
  for (let i = 0; i < 16; i++) {
    await sleep(400)
    const ready = await ev(`(() => { const h=[...document.querySelectorAll('h1')].find(e=>e.textContent.includes('Create your account')); if(!h) return 0; let m=1,n=h; while(n){ m=Math.min(m, parseFloat(getComputedStyle(n).opacity)||0); n=n.parentElement } return m })()`)
    if (ready > 0.9) break
  }
  const before = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes('Create')); const r=b.getBoundingClientRect(); return { y: Math.round(r.y), inView: r.top < innerHeight && r.bottom > 0, scrollH: document.documentElement.scrollHeight } })()`)
  await ev(`window.scrollTo(0, document.documentElement.scrollHeight)`)
  await sleep(400)
  const after = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').includes('Create')); const r=b.getBoundingClientRect(); const eyes=[...document.querySelectorAll('button')].filter(x=>x.querySelector('svg') && !(x.innerText||'').trim()).map(x=>{ const q=x.getBoundingClientRect(); return { aria:x.getAttribute('aria-label'), x:Math.round(q.x), y:Math.round(q.y), w:Math.round(q.width), h:Math.round(q.height) } }); return { scrollY: Math.round(scrollY), y: Math.round(r.y), h: Math.round(r.height), inView: r.top>=0 && r.bottom<=innerHeight, text: b.innerText.replace(/\\s+/g,' ').trim(), eyes } })()`)
  await shot('21-signup-bottom.png')
  log('SIGNUP before ' + JSON.stringify(before))
  log('SIGNUP after ' + JSON.stringify(after))

  await send('Page.navigate', { url: 'http://localhost:3000/' }, 8000).catch(e => log(e.message))
  for (let i = 0; i < 20; i++) {
    await sleep(400)
    const ok = await ev(`!!document.querySelector('h1') && !document.querySelector('.animate-spin')`)
    if (ok) break
  }
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(n=>(n.textContent||'').trim().startsWith('Get started')); b.click() })()`)
  await sleep(600)
  const modal = await ev(`(() => {
    const scroller = document.querySelector('[role="dialog"] .overflow-y-auto, [aria-modal="true"] .overflow-y-auto');
    if (!scroller) return { missing: true };
    const beforeTop = scroller.scrollTop;
    const btn = [...scroller.querySelectorAll('button')].find(x => (x.innerText||'').includes('Create'));
    scroller.scrollTop = scroller.scrollHeight;
    const r = btn ? btn.getBoundingClientRect() : null;
    const sr = scroller.getBoundingClientRect();
    return { beforeTop, scrollTop: scroller.scrollTop, scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, btn: r && { y: Math.round(r.y), bottom: Math.round(r.bottom), inScroller: r.top >= sr.top - 2 && r.bottom <= sr.bottom + 2 }, text: btn ? btn.innerText.replace(/\\s+/g,' ').trim() : null };
  })()`)
  await shot('22-modal-scrolled.png')
  log('MODAL ' + JSON.stringify(modal))
} catch (e) {
  log('ERR ' + (e.stack || e))
} finally {
  try { ws && ws.close() } catch {}
  if (proc.pid) await killTree(proc.pid)
}
