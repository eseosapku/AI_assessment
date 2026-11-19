// Second pass: settled homepage hero, /studylab/demo, and /dev/scenes. Read-only.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/ai-judge'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9348
const PROFILE = `${OUT}/chrome-profile-2`
mkdirSync(PROFILE, { recursive: true })

const logLines = []
const log = (m) => {
  const line = `${new Date().toISOString()} ${m}`
  logLines.push(line)
  console.log(line)
  writeFileSync(`${OUT}/capture-rest-log.txt`, logLines.join('\n'), 'utf8')
}
const secretish = /DATABASE_URL|SECRET|PASSWORD|API_KEY|BEGIN [A-Z ]*PRIVATE KEY/i
const scrub = (s) => {
  const text = String(s ?? '')
  return secretish.test(text) ? '[redacted]' : text
}

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--force-device-scale-factor=1',
  '--window-size=1440,900',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  'about:blank',
], { stdio: 'ignore' })

let ws
const pending = new Map()
let seq = 0

function send(method, params = {}, timeoutMs = 120000) {
  const id = ++seq
  const p = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`timeout ${method}`))
      }
    }, timeoutMs)
  })
  ws.send(JSON.stringify({ id, method, params }))
  return p
}

async function ev(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 60000)
  if (res.exceptionDetails) throw new Error(scrub(res.exceptionDetails.text || 'eval exception'))
  return res.result?.value
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 30000)
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  log(`shot ${name}`)
}

async function waitUntil(expression, timeoutMs, label) {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await ev(expression)
      if (value) return value
      last = ''
    } catch (err) {
      last = scrub(err.message)
    }
    await delay(500)
  }
  log(`wait timeout ${label} ${last}`)
  return null
}

async function connect() {
  let version
  for (let i = 0; i < 50; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      break
    } catch {
      await delay(250)
    }
  }
  if (!version?.webSocketDebuggerUrl) throw new Error('no devtools')
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', () => reject(new Error('websocket error')))
  })
  ws.addEventListener('message', (evnt) => {
    const msg = JSON.parse(evnt.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(scrub(JSON.stringify(msg.error))))
      else resolve(msg.result)
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
}

async function captureHero() {
  log('navigate home')
  await send('Page.navigate', { url: 'http://localhost:3000/' })
  await waitUntil(`document.body && document.body.innerText.includes('Get started') ? 'ok' : ''`, 30000, 'home text')
  const info = await waitUntil(`(() => {
    const img = document.querySelector('img[alt="StudySquare dashboard"]');
    if (!img) return '';
    const r = img.getBoundingClientRect();
    if (!(img.complete && img.naturalWidth > 0)) return '';
    return JSON.stringify({ natural: [img.naturalWidth, img.naturalHeight], top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), opacity: getComputedStyle(img).opacity });
  })()`, 20000, 'dashboard image')
  writeFileSync(`${OUT}/hero-image.json`, scrub(info || 'missing'))
  await delay(1200)
  await shot('01b-home-settled')
  await ev(`(() => { const img = document.querySelector('img[alt="StudySquare dashboard"]'); if (img) img.scrollIntoView({ block: 'center' }); return true; })()`)
  await delay(800)
  await shot('01c-home-dashboard')
}

async function captureDemo() {
  log('navigate demo')
  await send('Page.navigate', { url: 'http://localhost:3000/studylab/demo' })
  const ready = await waitUntil(`(() => {
    const t = document.body ? document.body.innerText : '';
    const p = location.pathname;
    if (p === '/login' || p === '/signup' || /sign in/i.test(t) || t.includes('could not be found') || t.includes('LearnSpace') || t.includes('404') || t.length > 80) return p;
    return '';
  })()`, 90000, 'demo')
  await delay(1000)
  const facts = await ev(`(() => ({ href: location.href, title: document.title, text: (document.body?.innerText || '').slice(0, 12000) }))()`)
  writeFileSync(`${OUT}/demo-text.txt`, scrub(facts?.text || ''), 'utf8')
  writeFileSync(`${OUT}/demo-meta.json`, JSON.stringify({ ready, href: facts?.href, title: facts?.title }, null, 2))
  await shot('05-studylab-demo')
  log(`demo at ${facts?.href}`)
}

async function captureScenes() {
  log('navigate scenes')
  await send('Page.navigate', { url: 'http://localhost:3000/dev/scenes' })
  const ready = await waitUntil(`(() => {
    const t = document.body ? document.body.innerText : '';
    if (t.includes('All scenes') || t.includes('could not be found') || t.includes('404') || /sign in/i.test(t)) return t.slice(0, 180);
    return '';
  })()`, 180000, 'scenes')
  await delay(1000)
  const facts = await ev(`(() => ({ href: location.href, title: document.title, text: (document.body?.innerText || '').slice(0, 4000) }))()`)
  writeFileSync(`${OUT}/scenes-meta.json`, JSON.stringify({ ready: scrub(ready || ''), href: facts?.href, title: facts?.title }, null, 2))
  writeFileSync(`${OUT}/scenes-top-text.txt`, scrub(facts?.text || ''), 'utf8')
  await shot('06-scenes-top')
  if (!String(facts?.text || '').includes('All scenes')) {
    log('no scene catalogue on the page')
    return
  }
  const summary = await ev(`(() => ({
    header: document.querySelector('header')?.innerText || '',
    count: document.querySelectorAll('section[id]').length,
    groups: [...document.querySelectorAll('h2')].map((h) => h.textContent),
  }))()`)
  writeFileSync(`${OUT}/scenes-index.json`, JSON.stringify(summary, null, 2))
  log(`cards ${summary.count}`)
  const cards = []
  let lastGroupShot = ''
  for (let i = 0; i < summary.count; i++) {
    await ev(`document.querySelectorAll('section[id]')[${i}]?.scrollIntoView({ block: 'center' })`)
    let text = ''
    for (let t = 0; t < 3; t++) {
      await delay(t === 0 ? 300 : 450)
      text = await ev(`document.querySelectorAll('section[id]')[${i}]?.innerText?.slice(0, 4000) || ''`) || ''
      if (text.length > 140) break
    }
    const meta = await ev(`(() => {
      const s = document.querySelectorAll('section[id]')[${i}];
      if (!s) return null;
      const block = s.closest('div[id]');
      const group = block?.querySelector('h2')?.textContent || '';
      const title = block?.querySelector('p')?.innerText || '';
      const overflow = [];
      for (const el of s.querySelectorAll('p, span, h1, h2, h3, h4, td, th, li, button, label')) {
        if (el.clientWidth < 30) continue;
        if (el.scrollWidth > el.clientWidth + 16 && (el.innerText || '').trim()) {
          overflow.push((el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120));
          if (overflow.length >= 4) break;
        }
      }
      return { id: s.id, group, title: title.slice(0, 180), overflow };
    })()`)
    const card = { index: i, id: meta?.id, group: meta?.group || '', title: scrub(meta?.title || ''), overflow: meta?.overflow || [], text: scrub(text) }
    cards.push(card)
    const groupKey = card.group
    const shoot = i < 2 || (meta?.overflow || []).length > 0 || text.length > 1200 || (groupKey && groupKey !== lastGroupShot)
    if (shoot) {
      if (groupKey) lastGroupShot = groupKey
      const safe = String(meta?.id || i).replace(/[^a-zA-Z0-9_-]/g, '_')
      await shot(`scene-${String(i).padStart(3, '0')}-${safe}`)
      card.shot = `scene-${String(i).padStart(3, '0')}-${safe}.png`
    }
    if (i % 8 === 0) {
      writeFileSync(`${OUT}/scenes-cards.json`, JSON.stringify(cards, null, 2))
      log(`scanned ${i + 1}/${summary.count}`)
    }
  }
  writeFileSync(`${OUT}/scenes-cards.json`, JSON.stringify(cards, null, 2))
  log(`scenes done ${cards.length}`)
}

try {
  await connect()
  await captureHero()
  await captureDemo()
  await captureScenes()
  log('done')
} catch (err) {
  log(`FATAL ${scrub(err.stack || err.message)}`)
  try { await shot('99-error') } catch { /* ignore */ }
  process.exitCode = 1
} finally {
  try { ws?.close() } catch { /* ignore */ }
  chrome.kill()
}
