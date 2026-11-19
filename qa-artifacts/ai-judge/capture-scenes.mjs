// Wait until /dev/scenes actually paints catalogue cards, then read them. Read-only.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/ai-judge'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9349
const PROFILE = `${OUT}/chrome-profile-3`
mkdirSync(PROFILE, { recursive: true })

const lines = []
const log = (m) => {
  const line = `${new Date().toISOString()} ${m}`
  lines.push(line)
  console.log(line)
  writeFileSync(`${OUT}/capture-scenes-log.txt`, lines.join('\n'), 'utf8')
}
const secretish = /DATABASE_URL|SECRET|PASSWORD|API_KEY|BEGIN [A-Z ]*PRIVATE KEY/i
const scrub = (s) => (secretish.test(String(s ?? '')) ? '[redacted]' : String(s ?? ''))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--force-device-scale-factor=1', '--window-size=1440,900',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' })

let ws
const pending = new Map()
let seq = 0
function send(method, params = {}, timeoutMs = 90000) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`timeout ${method}`))
      }
    }, timeoutMs)
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function ev(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 60000)
  if (res.exceptionDetails) throw new Error(scrub(res.exceptionDetails.text || 'eval'))
  return res.result?.value
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 30000)
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  log(`shot ${name}`)
}
async function waitUntil(expression, timeoutMs, label) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await ev(expression)
      if (value) return value
    } catch (err) {
      log(`eval ${label} ${scrub(err.message)}`)
    }
    await delay(400)
  }
  log(`timeout ${label}`)
  return null
}

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (version.webSocketDebuggerUrl) break
    } catch { /* retry */ }
    await delay(250)
  }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', () => reject(new Error('websocket')))
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

async function traceDemo() {
  const trace = []
  await send('Page.navigate', { url: 'http://localhost:3000/studylab/demo' })
  const start = Date.now()
  while (Date.now() - start < 20000) {
    let href = ''
    let snippet = ''
    try {
      href = await ev('location.href')
      snippet = await ev(`(document.body?.innerText || '').replace(/\\s+/g, ' ').slice(0, 160)`)
    } catch { /* navigating */ }
    trace.push({ t: Date.now() - start, href, snippet: scrub(snippet) })
    if (href.endsWith('/') && trace.some((row) => row.href?.includes('/login')) && Date.now() - start > 2500) break
    await delay(400)
  }
  writeFileSync(`${OUT}/demo-trace.json`, JSON.stringify(trace, null, 2))
  await shot('05b-after-demo')
  log(`demo trace ${trace.at(-1)?.href}`)
}

async function captureScenes() {
  const t0 = Date.now()
  await send('Page.navigate', { url: 'http://localhost:3000/dev/scenes' })
  await waitUntil(`document.body && document.body.innerText.includes('All scenes') ? 'ok' : ''`, 120000, 'header')
  const headerAt = Date.now() - t0
  const count = await waitUntil(`document.querySelectorAll('section[id]').length || ''`, 60000, 'sections')
  const sectionsAt = Date.now() - t0
  log(`header ${headerAt}ms sections ${sectionsAt}ms count ${count}`)
  await delay(600)
  await shot('07-scenes-loaded')
  const header = await ev(`document.querySelector('header')?.innerText || ''`)
  writeFileSync(`${OUT}/scenes-loaded-header.txt`, scrub(header || ''))
  if (!count) {
    const text = await ev(`(document.body?.innerText || '').slice(0, 3000)`)
    writeFileSync(`${OUT}/scenes-empty.txt`, scrub(text || ''))
    log('sections never mounted')
    return
  }

  const total = Number(count)
  const cards = []
  let lastGroup = ''
  let shots = 0
  for (let i = 0; i < total; i++) {
    await ev(`document.querySelectorAll('section[id]')[${i}].scrollIntoView({block:'center'})`)
    let text = ''
    for (let n = 0; n < 3; n++) {
      await delay(n === 0 ? 220 : 380)
      text = await ev(`document.querySelectorAll('section[id]')[${i}]?.innerText || ''`) || ''
      if (text.length > 120) break
    }
    const meta = await ev(`(() => {
      const s = document.querySelectorAll('section[id]')[${i}];
      const scene = s.closest('div[id]');
      const title = scene?.querySelector(':scope > p')?.innerText || '';
      const group = scene?.parentElement?.querySelector(':scope > h2')?.textContent || '';
      const overflow = [];
      for (const el of s.querySelectorAll('p, span, h1, h2, h3, h4, td, th, li, label, button')) {
        const raw = (el.innerText || '').trim();
        if (!raw || el.clientWidth < 24) continue;
        if (el.scrollWidth > el.clientWidth + 16) {
          overflow.push(raw.replace(/\\s+/g, ' ').slice(0, 140));
          if (overflow.length >= 4) break;
        }
      }
      const clipped = [];
      for (const el of s.querySelectorAll('p, h1, h2, h3, div')) {
        if (el.clientHeight > 36 && el.scrollHeight > el.clientHeight + 24 && el.clientHeight < 220) {
          const raw = (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 140);
          if (raw) clipped.push(raw);
          if (clipped.length >= 3) break;
        }
      }
      return { id: s.id, group, title: title.slice(0, 200), overflow, clipped };
    })()`)
    const card = {
      index: i,
      id: meta?.id,
      group: meta?.group || '',
      title: scrub(meta?.title || ''),
      overflow: (meta?.overflow || []).map(scrub),
      clipped: (meta?.clipped || []).map(scrub),
      chars: text.length,
      text: scrub(text).slice(0, 3500),
    }
    cards.push(card)
    const newGroup = card.group && card.group !== lastGroup
    const interesting = (card.overflow.length + card.clipped.length) > 0 || card.chars > 1100 || card.chars < 40
    if ((newGroup || interesting) && shots < 28) {
      lastGroup = card.group || lastGroup
      const safe = String(card.id || i).replace(/[^a-zA-Z0-9_-]/g, '_')
      const name = `scene-${String(i).padStart(3, '0')}-${safe}`
      await shot(name)
      card.shot = `${name}.png`
      shots += 1
    } else if (newGroup) lastGroup = card.group
    if (i % 20 === 0) {
      writeFileSync(`${OUT}/scenes-cards.json`, JSON.stringify(cards))
      log(`scanned ${i + 1}/${total} shots ${shots}`)
    }
  }
  writeFileSync(`${OUT}/scenes-cards.json`, JSON.stringify(cards, null, 2))
  const brief = cards.map((c) => ({
    id: c.id, group: c.group, title: c.title, chars: c.chars,
    overflow: c.overflow.length, clipped: c.clipped.length, shot: c.shot || '',
    text: c.text.slice(0, 500),
  }))
  writeFileSync(`${OUT}/scenes-brief.json`, JSON.stringify(brief, null, 2))
  log(`done ${cards.length} shots ${shots}`)
}

try {
  await connect()
  await traceDemo()
  await captureScenes()
} catch (err) {
  log(`FATAL ${scrub(err.stack || err.message)}`)
  try { await shot('99-scenes-error') } catch { /* ignore */ }
  process.exitCode = 1
} finally {
  try { ws?.close() } catch { /* ignore */ }
  chrome.kill()
}
