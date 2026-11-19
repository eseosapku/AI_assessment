import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const root = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\power-user'
const shotDir = root + '\\screenshots'
const profile = root + '\\chrome-profiles\\reshoot'
const port = 9481
const pages = [
  {
    name: 'studylab-demo',
    path: '/studylab/demo',
    done: (s) => s.href !== 'http://localhost:3000/studylab/demo' && s.href !== 'http://localhost:3000/login',
  },
  {
    name: 'dev-scenes',
    path: '/dev/scenes',
    done: (s) => (s.h2 || []).length > 0,
  },
]

mkdirSync(shotDir, { recursive: true })
rmSync(profile, { recursive: true, force: true })

function redact(s) {
  if (!s) return s
  return String(s)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED_URL]')
    .replace(/DATABASE_URL\s*[=:]\s*\S+/gi, 'DATABASE_URL=[REDACTED]')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let seq = 0
    const api = {
      send(method, params = {}, timeoutMs = 25000) {
        const id = ++seq
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            pending.delete(id)
            rej(new Error('timeout ' + method))
          }, timeoutMs)
          pending.set(id, {
            res: (v) => { clearTimeout(timer); res(v) },
            rej: (e) => { clearTimeout(timer); rej(e) },
          })
          ws.send(JSON.stringify({ id, method, params }))
        })
      },
      close() { try { ws.close() } catch {} },
    }
    ws.addEventListener('open', () => resolve(api))
    ws.addEventListener('error', () => reject(new Error('websocket error')))
    ws.addEventListener('message', (ev) => {
      let data
      try { data = JSON.parse(ev.data) } catch { return }
      if (!data.id || !pending.has(data.id)) return
      const p = pending.get(data.id)
      pending.delete(data.id)
      if (data.error) p.rej(new Error(JSON.stringify(data.error)))
      else p.res(data.result)
    })
  })
}

const probe = `(() => {
  const h2 = [...document.querySelectorAll('h2')].slice(0, 6).map((h) => ({
    t: (h.textContent || '').trim().slice(0, 80),
    top: Math.round(h.getBoundingClientRect().top),
  }))
  const text = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 400)
  return JSON.stringify({
    href: location.href,
    ready: document.readyState,
    text,
    h2,
    scrollH: document.documentElement.scrollHeight,
    spin: !!document.querySelector('.animate-spin'),
    errs: (window.__errs || []).slice(0, 8),
  })
})()`

async function waitForVersion() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return await res.json()
    } catch {}
    await delay(200)
  }
  throw new Error('Chrome debug port did not open')
}

const proc = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--no-pings',
  '--force-device-scale-factor=1',
  '--window-size=1440,900',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' })

const notes = []
try {
  const version = await waitForVersion()
  const browser = await connect(version.webSocketDebuggerUrl)
  for (const page of pages) {
    const url = 'http://localhost:3000' + page.path
    const ctx = await browser.send('Target.createBrowserContext')
    const created = await browser.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId: ctx.browserContextId,
      width: 1440,
      height: 900,
    })
    let pageInfo = null
    for (let i = 0; i < 30; i++) {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      pageInfo = list.find((t) => t.id === created.targetId && t.webSocketDebuggerUrl)
      if (pageInfo) break
      await delay(100)
    }
    const client = await connect(pageInfo.webSocketDebuggerUrl)
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__errs.push(String(e.reason&&e.reason.message||e.reason)));`,
    })
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    })
    await client.send('Page.navigate', { url }, 40000)
    let last = null
    for (let i = 0; i < 25; i++) {
      await delay(1000)
      try {
        const info = await client.send('Runtime.evaluate', { expression: probe, returnByValue: true })
        last = JSON.parse(info.result.value)
        console.log(page.name, 't=' + (i + 1), JSON.stringify({ href: last.href, spin: last.spin, h2: last.h2.length, text: (last.text || '').slice(0, 80), errs: last.errs }))
        if (page.done(last)) break
      } catch (err) {
        console.log(page.name, 'probe-fail', redact(err.message))
      }
    }
    const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    const buf = Buffer.from(shot.data, 'base64')
    const file = `${shotDir}\\${page.name}.png`
    writeFileSync(file, buf)
    const row = {
      name: page.name,
      requested: url,
      settled: last,
      png: [buf.readUInt32BE(16), buf.readUInt32BE(20)],
      bytes: buf.length,
      file,
    }
    notes.push(row)
    console.log('SAVED', JSON.stringify({ name: page.name, href: last && last.href, bytes: buf.length, h2: last && last.h2, errs: last && last.errs, text: last && (last.text || '').slice(0, 180) }))
    client.close()
    await browser.send('Target.closeTarget', { targetId: created.targetId })
    await browser.send('Target.disposeBrowserContext', { browserContextId: ctx.browserContextId })
  }
  browser.close()
} finally {
  writeFileSync(shotDir + '\\reshoot-notes.json', JSON.stringify(notes, null, 2))
  try { proc.kill() } catch {}
  console.log('RESHOOT_DONE')
}
