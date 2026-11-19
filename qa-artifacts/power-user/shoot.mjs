import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const root = 'c:\\Users\\hp\\Desktop\\update\\AI_assessment\\qa-artifacts\\power-user'
const shotDir = root + '\\screenshots'
const profile = root + '\\chrome-profiles\\shot-session'
const port = 9477
const pages = [
  ['signup', '/signup', 3500],
  ['forgot-password', '/forgot-password', 3500],
  ['reset-password', '/reset-password', 3500],
  ['studylab-demo', '/studylab/demo', 7000],
  ['dev-scenes', '/dev/scenes', 8000],
  ['bedrock-test', '/bedrock-test', 3500],
  ['welcome', '/welcome', 7000],
]

mkdirSync(shotDir, { recursive: true })
rmSync(profile, { recursive: true, force: true })
mkdirSync(profile, { recursive: true })

function redact(s) {
  if (!s) return s
  return String(s)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED_URL]')
    .replace(/DATABASE_URL\s*[=:]\s*\S+/gi, 'DATABASE_URL=[REDACTED]')
    .replace(/(secret|password|api[_-]?key|token)\s*[=:]\s*\S+/gi, '$1=[REDACTED]')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let seq = 0
    const api = {
      send(method, params = {}, timeoutMs = 20000) {
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
  '--disable-component-update',
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
  for (const [name, path, waitMs] of pages) {
    const url = 'http://localhost:3000' + path
    let ctxId = null
    let targetId = null
    let client = null
    try {
      let created
      try {
        const ctx = await browser.send('Target.createBrowserContext')
        ctxId = ctx.browserContextId
        created = await browser.send('Target.createTarget', {
          url: 'about:blank',
          browserContextId: ctxId,
          width: 1440,
          height: 900,
        })
      } catch {
        created = await browser.send('Target.createTarget', { url: 'about:blank', width: 1440, height: 900 })
      }
      targetId = created.targetId
      let pageInfo = null
      for (let i = 0; i < 20; i++) {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        pageInfo = list.find((t) => t.id === targetId && t.webSocketDebuggerUrl)
        if (pageInfo) break
        await delay(100)
      }
      if (!pageInfo) throw new Error('no page websocket')
      client = await connect(pageInfo.webSocketDebuggerUrl)
      await client.send('Page.enable')
      await client.send('Runtime.enable')
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await client.send('Page.navigate', { url }, 30000)
      await delay(waitMs)
      const info = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const portal = document.querySelector('nextjs-portal');
          const portalText = portal ? (portal.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500) : '';
          const text = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 700);
          const err = /Application error|Unhandled/.test(text);
          return JSON.stringify({
            href: location.href,
            title: document.title,
            text,
            portalText,
            err,
            w: window.innerWidth,
            h: window.innerHeight,
          });
        })()`,
        returnByValue: true,
      })
      const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
      const buf = Buffer.from(shot.data, 'base64')
      const pngW = buf.readUInt32BE(16)
      const pngH = buf.readUInt32BE(20)
      const file = `${shotDir}\\${name}.png`
      writeFileSync(file, buf)
      let parsed = {}
      try { parsed = JSON.parse(info.result.value) } catch { parsed = { raw: info.result.value } }
      const row = {
        name,
        requested: url,
        href: parsed.href,
        title: parsed.title,
        text: redact(parsed.text),
        portalText: redact(parsed.portalText),
        err: parsed.err,
        viewport: [parsed.w, parsed.h],
        png: [pngW, pngH],
        bytes: buf.length,
        file,
      }
      notes.push(row)
      console.log(JSON.stringify(row))
    } catch (err) {
      const row = { name, requested: url, error: redact(err.message) }
      notes.push(row)
      console.log(JSON.stringify(row))
    } finally {
      if (client) client.close()
      if (targetId) {
        try { await browser.send('Target.closeTarget', { targetId }) } catch {}
      }
      if (ctxId) {
        try { await browser.send('Target.disposeBrowserContext', { browserContextId: ctxId }) } catch {}
      }
    }
  }
  browser.close()
} finally {
  writeFileSync(shotDir + '\\render-notes.json', JSON.stringify(notes, null, 2))
  try { proc.kill() } catch {}
  console.log('SHOOT_DONE')
}
