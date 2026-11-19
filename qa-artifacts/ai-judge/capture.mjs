// Headless Chrome capture for public StudySquare pages. Read-only: navigation and screenshots only.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const OUT = 'c:/Users/hp/Desktop/update/AI_assessment/qa-artifacts/ai-judge'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9347
const PROFILE = `${OUT}/chrome-profile`

mkdirSync(OUT, { recursive: true })
mkdirSync(PROFILE, { recursive: true })

const logLines = []
const log = (m) => {
  const line = `${new Date().toISOString()} ${m}`
  logLines.push(line)
  console.log(line)
  writeFileSync(`${OUT}/capture-log.txt`, logLines.join('\n'), 'utf8')
}

const secretish = /DATABASE_URL|SECRET|PASSWORD|API_KEY|BEGIN [A-Z ]*PRIVATE KEY/i

function scrub(s) {
  if (s == null) return ''
  const text = String(s)
  if (secretish.test(text)) return '[redacted]'
  return text
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
const pageErrors = []

function send(method, params = {}) {
  const id = ++seq
  const p = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`timeout ${method}`))
      }
    }, 30000)
  })
  ws.send(JSON.stringify({ id, method, params }))
  return p
}

async function ev(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (res.exceptionDetails) {
    const d = scrub(res.exceptionDetails.text || res.exceptionDetails.exception?.description || 'eval exception')
    throw new Error(d)
  }
  return res.result?.value
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const file = `${OUT}/${name}.png`
  writeFileSync(file, Buffer.from(data, 'base64'))
  log(`shot ${name} ${Buffer.from(data, 'base64').length}`)
  return file
}

async function waitUntil(expression, timeoutMs, label) {
  const start = Date.now()
  let last = null
  while (Date.now() - start < timeoutMs) {
    try {
      last = await ev(expression)
      if (last) return last
    } catch (err) {
      last = scrub(err.message)
    }
    await delay(400)
  }
  log(`wait timeout ${label}: ${scrub(last)}`)
  return null
}

async function open(url) {
  log(`navigate ${url}`)
  await send('Page.navigate', { url })
  await delay(500)
}

async function connect() {
  let version
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      version = await res.json()
      break
    } catch {
      await delay(250)
    }
  }
  if (!version?.webSocketDebuggerUrl) throw new Error('Chrome DevTools did not start')
  const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`)
  const list = await listRes.json()
  const page = list.find((t) => t.type === 'page') || list[0]
  log(`cdp page ${page.url}`)
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
      return
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const text = scrub(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || '')
      if (text) pageErrors.push(text.slice(0, 400))
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.bringToFront')
}

async function pageFacts() {
  return ev(`(() => ({
    href: location.href,
    title: document.title,
    text: (document.body?.innerText || '').slice(0, 20000),
  }))()`)
}

async function scrollShot(jsFind, name) {
  const found = await ev(`(() => {
    const el = (${jsFind});
    if (!el) return false;
    el.scrollIntoView({ block: 'start' });
    return true;
  })()`)
  await delay(700)
  await ev(`(() => {
    const pending = [...document.images].filter((img) => !img.complete);
    return pending.length;
  })()`)
  await delay(800)
  if (!found) {
    log(`missing section for ${name}`)
    return
  }
  await shot(name)
}

async function captureHome() {
  await open('http://localhost:3000/')
  const ready = await waitUntil(
    `document.body && document.body.innerText.includes('Get started') ? document.title : ''`,
    25000,
    'home',
  )
  const facts = await pageFacts()
  writeFileSync(`${OUT}/home-text.txt`, scrub(facts?.text || ''), 'utf8')
  writeFileSync(`${OUT}/home-meta.json`, JSON.stringify({ ready: !!ready, href: facts?.href, title: facts?.title, chars: (facts?.text || '').length }, null, 2))
  await shot('01-home')

  await open('http://localhost:3000/#features')
  await waitUntil(`document.body && document.body.innerText.includes('Get started') ? 'ok' : ''`, 20000, 'features')
  await scrollShot(`document.getElementById('features')`, '02-features')
  const featuresText = await ev(`document.getElementById('features') ? document.getElementById('features').innerText.slice(0, 8000) : ''`)
  writeFileSync(`${OUT}/features-text.txt`, scrub(featuresText || ''), 'utf8')

  await scrollShot(`[...document.querySelectorAll('h2')].find((h) => (h.textContent || '').includes('Every question type'))`, '03-question-samples')

  await open('http://localhost:3000/#studylab')
  await waitUntil(`document.body && document.body.innerText.includes('StudyLab') ? 'ok' : ''`, 20000, 'studylab')
  await scrollShot(`document.getElementById('studylab')`, '04-studylab')
  const studyText = await ev(`document.getElementById('studylab') ? document.getElementById('studylab').innerText.slice(0, 8000) : ''`)
  writeFileSync(`${OUT}/studylab-text.txt`, scrub(studyText || ''), 'utf8')
}

async function captureDemo() {
  await open('http://localhost:3000/studylab/demo')
  const ready = await waitUntil(
    `(() => {
      const t = document.body ? document.body.innerText : '';
      const p = location.pathname;
      if (p === '/login' || p === '/signup' || t.includes('Sign in') || t.includes('could not be found') || t.includes('LearnSpace') || t.includes('404')) return p + '|' + t.slice(0, 80);
      return '';
    })()`,
    90000,
    'demo',
  )
  await delay(600)
  const facts = await pageFacts()
  writeFileSync(`${OUT}/demo-text.txt`, scrub(facts?.text || ''), 'utf8')
  writeFileSync(`${OUT}/demo-meta.json`, JSON.stringify({ ready: scrub(ready || ''), href: facts?.href, title: facts?.title }, null, 2))
  await shot('05-studylab-demo')
}

async function captureScenes() {
  await open('http://localhost:3000/dev/scenes')
  const ready = await waitUntil(
    `(() => {
      const t = document.body ? document.body.innerText : '';
      if (t.includes('All scenes') || t.includes('could not be found') || t.includes('404') || t.includes('Sign in')) return t.slice(0, 120);
      return '';
    })()`,
    180000,
    'scenes',
  )
  await delay(800)
  const facts = await pageFacts()
  writeFileSync(`${OUT}/scenes-meta.json`, JSON.stringify({ ready: scrub(ready || ''), href: facts?.href, title: facts?.title }, null, 2))
  await shot('06-scenes-top')
  if (!facts?.text?.includes('All scenes')) {
    writeFileSync(`${OUT}/scenes-text.txt`, scrub(facts?.text || ''), 'utf8')
    log('scenes page did not show catalogue cards')
    return
  }

  const summary = await ev(`(() => {
    const header = document.querySelector('header')?.innerText || '';
    const ids = [...document.querySelectorAll('section[id]')].map((s) => s.id);
    const groups = [...document.querySelectorAll('h2')].map((h) => h.textContent);
    return { header, count: ids.length, ids, groups };
  })()`)
  writeFileSync(`${OUT}/scenes-index.json`, JSON.stringify(summary, null, 2))
  log(`scene cards ${summary?.count}`)

  const cards = []
  const count = summary?.count || 0
  let lastGroup = ''
  for (let i = 0; i < count; i++) {
    await ev(`(() => {
      const s = document.querySelectorAll('section[id]')[${i}];
      if (s) s.scrollIntoView({ block: 'center' });
      return true;
    })()`)
    let text = ''
    for (let t = 0; t < 4; t++) {
      await delay(t === 0 ? 250 : 400)
      text = await ev(`(() => {
        const s = document.querySelectorAll('section[id]')[${i}];
        return s ? s.innerText.slice(0, 5000) : '';
      })()`) || ''
      if (text.length > 160) break
    }
    const meta = await ev(`(() => {
      const s = document.querySelectorAll('section[id]')[${i}];
      if (!s) return null;
      let group = '';
      let node = s.parentElement;
      while (node && !group) {
        const h = node.querySelector(':scope > p, :scope > h2');
        if (h && h.tagName === 'H2') group = h.textContent || '';
        const prev = node.previousElementSibling;
        if (!group && prev && prev.tagName === 'H2') group = prev.textContent || '';
        node = node.parentElement;
      }
      const heading = s.parentElement?.parentElement?.querySelector('p')?.innerText || '';
      const overflow = [];
      for (const el of s.querySelectorAll('p, h1, h2, h3, h4, span, td, th, li, button, label, div')) {
        if (el.clientWidth < 40 || el.childElementCount > 6) continue;
        if (el.scrollWidth > el.clientWidth + 12) {
          const snippet = (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 140);
          if (snippet) overflow.push({ w: el.clientWidth, sw: el.scrollWidth, snippet });
          if (overflow.length >= 6) break;
        }
      }
      const r = s.getBoundingClientRect();
      return { id: s.id, group, heading: heading.slice(0, 200), overflow, box: { w: Math.round(r.width), h: Math.round(r.height) } };
    })()`)
    const group = meta?.group || ''
    const card = { index: i, id: meta?.id, group, heading: scrub(meta?.heading || ''), overflow: meta?.overflow || [], box: meta?.box, text: scrub(text) }
    cards.push(card)
    const firstOfGroup = group && group !== lastGroup
    if (group) lastGroup = group
    const wall = text.length > 1400
    const overflow = (meta?.overflow || []).length > 0
    if (firstOfGroup || wall || overflow || i < 2) {
      const safe = String(meta?.id || i).replace(/[^a-zA-Z0-9_-]/g, '_')
      await shot(`scene-${String(i).padStart(3, '0')}-${safe}`)
      card.shot = true
    }
    if (i % 10 === 0) log(`scanned ${i + 1}/${count}`)
  }
  writeFileSync(`${OUT}/scenes-cards.json`, JSON.stringify(cards, null, 2))
  log(`scenes scan done ${cards.length}`)
}

try {
  await connect()
  await captureHome()
  await captureDemo()
  await captureScenes()
  writeFileSync(`${OUT}/page-errors.txt`, pageErrors.filter((e) => !secretish.test(e)).slice(0, 40).join('\n---\n'), 'utf8')
  log('done')
} catch (err) {
  log(`FATAL ${scrub(err.stack || err.message)}`)
  try { await shot('99-error') } catch { /* page may not be ready */ }
  process.exitCode = 1
} finally {
  try { ws?.close() } catch { /* ignore */ }
  chrome.kill()
}
