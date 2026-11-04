import { open, log, resolve, shots } from './check-gap-map-lib.mjs'

const BEFORE_BIO = JSON.stringify({ 201: { state: 'gap', bands: { s2011: 'gap', s2012: 'shaky', s2013: 'none' } } })
const raiseOsmosis = (f) => { const s = f.data.textbooks[1].topics[0].subtopics[0]; s.score = 90; s.lowest = 34; s.attempts = 12; f.data.textbooks[1].topics[0].score = null }

export default {
  async closed() {
    const { browser, page, ctx } = await open()
    const q = (sel) => page.locator(sel)
    log('close button', await q('button[aria-label^="Close Mathematics"]').getAttribute('aria-expanded'))
    const box = await q('button[aria-label^="Close Mathematics"]').boundingBox()
    log('target px', Math.round(box.width), Math.round(box.height))
    await q('button[aria-label^="Close Mathematics"]').click()
    await page.waitForTimeout(500)
    log('closed: open-button', await q('button[aria-label^="Open Mathematics"]').count(), 'text', JSON.stringify(await q('.ss-rack-crow').first().innerText()))
    await page.screenshot({ path: resolve(shots, 'final-closed-tray.png') })
    log('saved', await page.evaluate(() => localStorage.getItem('ss-gap-closed:shoot-user')))
    await page.reload(); await page.waitForSelector('.ss-rack'); await page.waitForTimeout(1200)
    log('after reload closed?', await q('button[aria-label^="Open Mathematics"]').isVisible(), 'tiles visible', await q('.ss-rack-t').first().isVisible())
    await q('button[aria-label^="Open Mathematics"]').click(); await page.waitForTimeout(500)
    await page.reload(); await page.waitForSelector('.ss-rack'); await page.waitForTimeout(1200)
    log('after reopen+reload open?', await q('button[aria-label^="Close Mathematics"]').isVisible(), await page.evaluate(() => localStorage.getItem('ss-gap-closed:shoot-user')))
    // keyboard
    await q('button[aria-label^="Close Mathematics"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(450)
    log('keyboard closes', await q('button[aria-label^="Open Mathematics"]').isVisible())
    // a closed tray's tiles are out of the tab order
    log('hidden tray tile focusable', await page.evaluate(() => { const t = [...document.querySelectorAll('[data-tray-key]')][0].querySelector('.ss-rack-t'); return getComputedStyle(t).visibility }))
    // Kana's "Let's fix it" still works with her tray closed
    await q('.ss-rack-say a').click(); await page.waitForTimeout(1200)
    log('fix-it url', page.url().slice(page.url().indexOf('/studylab')))
    await browser.close()
    const r = await open({ reduced: true })
    await r.page.locator('button[aria-label^="Close Mathematics"]').click(); await r.page.waitForTimeout(100)
    log('reduced: fold transition', await r.page.evaluate(() => getComputedStyle(document.querySelector('.ss-rack-fold')).transitionDuration), 'already closed at 100ms', await r.page.locator('button[aria-label^="Open Mathematics"]').isVisible())
    await r.browser.close()
    // storage unavailable
    const b = await open({ init: () => { const g = Storage.prototype.getItem, st = Storage.prototype.setItem; Storage.prototype.getItem = function (k) { if (String(k).startsWith('ss-gap')) throw new Error('denied'); return g.call(this, k) }; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('ss-gap')) throw new Error('denied'); return st.call(this, k, v) } } })
    const errs = []
    b.page.on('pageerror', (e) => errs.push(e.message))
    await b.page.locator('button[aria-label^="Close Mathematics"]').click(); await b.page.waitForTimeout(500)
    log('storage blocked: still closes', await b.page.locator('button[aria-label^="Open Mathematics"]').isVisible(), 'page errors', errs.length)
    await b.browser.close()
  },

  async other() {
    const { browser, page } = await open()
    const card = page.locator('.ss-rack-other')
    log('heading', JSON.stringify(await card.locator('.t').innerText()), 'summary', JSON.stringify(await card.locator('.s').innerText()), 'expanded', await card.locator('button').first().getAttribute('aria-expanded'))
    await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
    await page.evaluate(() => document.getElementById('main-content').scrollTo(0, 99999)); await page.waitForTimeout(300)
    await page.screenshot({ path: resolve(shots, 'final-other-closed.png') })
    await card.locator('button').first().click(); await page.waitForTimeout(500)
    await page.evaluate(() => document.getElementById('main-content').scrollTo(0, 99999)); await page.waitForTimeout(300)
    log('open rows', await card.locator('li').allInnerTexts())
    log('note', JSON.stringify(await card.locator('.ss-rack-other-note').innerText()))
    log('name clamp', await page.evaluate(() => { const n = document.querySelector('.ss-rack-other-l .n'); const cs = getComputedStyle(n); return [cs.whiteSpace, cs.textOverflow] }))
    await page.screenshot({ path: resolve(shots, 'final-other-open.png') })
    await page.reload(); await page.waitForSelector('.ss-rack'); await page.waitForTimeout(1200)
    log('open after reload', await page.locator('.ss-rack-other button').first().getAttribute('aria-expanded'))
    await browser.close()
    const e = await open({ mutate: (f) => { f.data.textbooks = f.data.textbooks.filter((b) => !b.topics.length) } })
    log('no trays: expanded', await e.page.locator('.ss-rack-other button').first().getAttribute('aria-expanded'), 'trays', await e.page.locator('[data-tray-key]').count(), 'say', JSON.stringify(await e.page.locator('.ss-rack-say').innerText()))
    await e.page.screenshot({ path: resolve(shots, 'final-no-trays.png') })
    await e.browser.close()
  },

  async flight() {
    for (const reduced of [false, true]) {
      const { browser, page, ctx } = await open({ reduced })
      const navs = []
      page.on('framenavigated', (fr) => { if (fr === page.mainFrame()) navs.push(Date.now()) })
      const tile = page.locator('.ss-rack-t[data-topic-id="102"]')
      await tile.scrollIntoViewIfNeeded()
      const t0 = Date.now()
      const seen = []
      const poll = (async () => {
        for (let i = 0; i < 30; i++) {
          const r = await page.evaluate(() => { const el = document.querySelector('[data-kana-flying]'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y) } })
          seen.push({ t: Date.now() - t0, r })
          if (!reduced && r && seen.filter((s) => s.r).length === 6) await page.screenshot({ path: resolve(shots, 'final-midflight.png') })
          await page.waitForTimeout(25)
        }
      })()
      await tile.click(); await tile.click({ force: true }).catch(() => {})
      await poll
      const withEl = seen.filter((s) => s.r)
      const distinct = new Set(withEl.map((s) => `${s.r.x},${s.r.y}`)).size
      log(reduced ? 'reduced' : 'motion', 'flying samples', withEl.length, 'distinct positions', distinct, 'url', page.url().slice(page.url().indexOf('?')), 'navigations', navs.length, 'first nav ms', navs.length ? navs[0] - t0 : null)
      await page.waitForTimeout(600)
      log(' pop class seen on tile (after)?', await page.evaluate(() => document.querySelectorAll('.ss-rack-t.pop').length))
      await browser.close()
    }
    // ctrl-click: opens at once, no flying
    const { browser, page, ctx } = await open()
    const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null)
    await page.locator('.ss-rack-t[data-topic-id="102"]').scrollIntoViewIfNeeded()
    await page.locator('.ss-rack-t[data-topic-id="102"]').click({ modifiers: ['Control'] })
    await page.waitForTimeout(200)
    log('ctrl-click flying el', await page.locator('[data-kana-flying]').count(), 'new tab', !!(await popup), 'same page url still home', !page.url().includes('chapter'))
    await browser.close()
  },

  async plates() {
    const { browser, page } = await open({ query: '?chapter=101' })
    const hop = () => page.evaluate(() => { const el = document.querySelector('.ss-rack-hopper'); const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y)] })
    log('plates animate in: first stop opacity at 100ms (fresh load)?')
    const before = await hop()
    const target = page.locator('.ss-rack-stop').nth(0)
    const t0 = Date.now()
    const samples = []
    const sheetBefore = await page.locator('.ss-rack-sheet-p').innerText()
    const poll = (async () => { for (let i = 0; i < 24; i++) { samples.push([Date.now() - t0, await hop()]); if (i === 6) await page.screenshot({ path: resolve(shots, 'final-hop.png') }); await page.waitForTimeout(25) } })()
    await target.click()
    await poll
    const url = page.url()
    log('before', before, 'samples', JSON.stringify(samples.filter((_, i) => i % 3 === 0)))
    log('url', url.slice(url.indexOf('?')), 'sheet before', JSON.stringify(sheetBefore.slice(0, 30)), 'after', JSON.stringify((await page.locator('.ss-rack-sheet-p').innerText()).slice(0, 30)))
    const end = samples[samples.length - 1][1]
    log('first sample near old position', Math.abs(samples[0][1][0] - before[0]) + Math.abs(samples[0][1][1] - before[1]) < 60, 'distinct positions', new Set(samples.map((s) => s[1].join())).size, 'ends at', end)
    await browser.close()
    const r = await open({ query: '?chapter=101', reduced: true })
    await r.page.locator('.ss-rack-stop').nth(0).click(); await r.page.waitForTimeout(100)
    log('reduced: anims running', await r.page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.ss-rack-path')).length))
    await r.browser.close()
  },

  async teach() {
    const { browser, page, state } = await open({ query: '?chapter=101', mutate: null })
    await page.evaluate(() => { window.open = () => ({ opener: null }) })
    await page.locator('button:has-text("Teach me this")').click()
    await page.waitForTimeout(600)
    log('buttons disabled after teach?', await page.evaluate(() => [...document.querySelectorAll('.ss-rack-sheet button')].map((b) => b.disabled)))
    log('post calls', JSON.stringify(state.calls))
    // the lesson finished in the other tab: Quadratic equations 22 -> 90
    const s = state.fixture.data.textbooks[0].topics[0].subtopics[2]; s.score = 90; s.lowest = 22; s.attempts = 12
    await page.waitForTimeout(3300)
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
    await page.waitForTimeout(1500)
    log('cheer', JSON.stringify(await page.locator('.ss-rack-sheet-p').innerText()))
    log('plate label', await page.locator('.ss-rack-stop').nth(2).getAttribute('aria-label'))
    await page.screenshot({ path: resolve(shots, 'final-cheer.png') })
    await browser.close()
  },

  async deeplink() {
    const { browser, page } = await open({ query: '?subject=Biology&focus=Movement%20into%20and%20out%20of%20cells&assessment=x', before: BEFORE_BIO, mutate: raiseOsmosis })
    await page.waitForTimeout(800)
    log('url', page.url().slice(page.url().indexOf('?')), 'home hidden', await page.evaluate(() => document.querySelector('.ss-rack').hidden), 'cheer', JSON.stringify(await page.locator('.ss-rack-sheet-p').innerText()))
    await page.locator('.ss-rack-back').click()
    const tops = []
    for (let i = 0; i < 22; i++) { tops.push(await page.evaluate(() => { const t = [...document.querySelectorAll('.ss-rack-t[data-topic-id="201"] .ss-rack-tile')].find((e) => e.getBoundingClientRect().width); return t ? Math.round(t.getBoundingClientRect().top) : null })); await page.waitForTimeout(40) }
    log('tile top over time', JSON.stringify(tops), 'moved', new Set(tops.filter((x) => x !== null)).size > 2)
    await browser.close()
  },

  async scrollback() {
    const { browser, page } = await open({ height: 560, mutate: (f) => { for (let i = 0; i < 6; i++) f.data.textbooks.push({ ...JSON.parse(JSON.stringify(f.data.textbooks[1])), id: 50 + i, name: `Filler ${i} Mathematics`, topics: f.data.textbooks[1].topics.map((t) => ({ ...t, id: t.id + 1000 * (i + 1), subtopics: t.subtopics.map((s) => ({ ...s, id: s.id + 10000 * (i + 1) })) })) }) } })
    await page.evaluate(() => document.getElementById('main-content').scrollTo(0, 420)); await page.waitForTimeout(300)
    const y0 = await page.evaluate(() => document.getElementById('main-content').scrollTop)
    const tile = page.locator('.ss-rack-t:visible').filter({ has: page.locator(':scope') })
    const idx = await page.evaluate(() => { const ts = [...document.querySelectorAll('.ss-rack-t')]; const i = ts.findIndex((t) => { const r = t.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight - 20 && r.left > 0 && r.right < innerWidth }); return i })
    await page.locator('.ss-rack-t').nth(idx).click(); await page.waitForTimeout(1200)
    const y1 = await page.evaluate(() => document.getElementById('main-content').scrollTop)
    log('home scrolled', y0, 'chapter opens at', y1, page.url().slice(page.url().indexOf('?')))
    await page.locator('.ss-rack-back').click(); await page.waitForTimeout(1800); log('url after back', page.url())
    log('dbg', await page.evaluate(() => window.__hs)); log('back restores', await page.evaluate(() => document.getElementById('main-content').scrollTop))
    await page.goBack().catch(() => {}); await page.waitForTimeout(300)
    await browser.close()
  },

  async chevrons() {
    const many = (f) => { const t = f.data.textbooks[0].topics; for (let i = 0; i < 9; i++) t.push({ ...JSON.parse(JSON.stringify(t[1])), id: 500 + i, name: `Extra ${i}`, subtopics: [{ id: 5000 + i, name: `X${i}`, score: 90, lowest: 90, attempts: 4 }] }) }
    const { browser, page } = await open({ width: 1280, height: 800, mutate: many })
    const row = '[data-tray-key] .ss-rack-tray'
    const st = () => page.evaluate(() => { const r = document.querySelector('[data-tray-key] .ss-rack-tray'); return { left: r.scrollLeft, max: r.scrollWidth - r.clientWidth, l: !!document.querySelector('.ss-rack-sc.l'), r: !!document.querySelector('.ss-rack-sc.r'), disp: document.querySelector('.ss-rack-sc.r') ? getComputedStyle(document.querySelector('.ss-rack-sc.r')).display : null } })
    log('start', JSON.stringify(await st()))
    await page.screenshot({ path: resolve(shots, 'final-chevrons.png') })
    await page.locator('.ss-rack-sc.r').first().click(); await page.waitForTimeout(700)
    log('after right', JSON.stringify(await st()))
    for (let i = 0; i < 4; i++) { const b = page.locator('.ss-rack-sc.r'); if (await b.count()) { await b.first().click(); await page.waitForTimeout(600) } }
    log('at end', JSON.stringify(await st()))
    await page.mouse.move(600, 400); await page.mouse.wheel(0, 300); await page.waitForTimeout(300)
    log('wheel still scrolls page', await page.evaluate(() => document.getElementById('main-content').scrollTop > 0))
    await browser.close()
    const t = await open({ width: 390, height: 844, hover: false, mutate: many })
    log('touch: chevron display', await t.page.evaluate(() => { const b = document.querySelector('.ss-rack-sc'); return b ? getComputedStyle(b).display : 'none (absent)' }))
    await t.browser.close()
  },

  async phone() {
    const { browser, page } = await open({ width: 390, height: 844, hover: false, query: '?chapter=101' })
    await page.waitForTimeout(2500); await page.evaluate(() => document.getElementById('main-content').scrollTo({ top: 99999, behavior: 'instant' })); await page.waitForTimeout(700)
    log('phone', JSON.stringify(await page.evaluate(() => {
      const sheet = document.querySelector('.ss-rack-sheet').getBoundingClientRect()
      const last = [...document.querySelectorAll('.ss-rack-col')].pop().getBoundingClientRect()
      const main = document.getElementById('main-content')
      return { sheetTop: Math.round(sheet.top), lastBlockBottom: Math.round(last.bottom), clear: Math.round(sheet.top - last.bottom), scrolledToEnd: main.scrollTop + main.clientHeight >= main.scrollHeight - 2, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth }
    })))
    await page.screenshot({ path: resolve(shots, 'final-phone-chapter.png') })
    await browser.close()
    const h = await open({ width: 390, height: 844, hover: false })
    await h.page.screenshot({ path: resolve(shots, 'final-phone-home.png') })
    await h.browser.close()
  },

  async dark() {
    const { browser, page, ctx } = await open({ mutate: (f) => { f.data.textbooks[0].name = 'Cambridge IGCSE 3rd (Third ) Mathematics 0580 Core and Extended'; f.data.textbooks[1].name = 'Cambridge Lower Secondary Science 7 Second'; f.data.textbooks[2].name = 'Cambridge International AS & A Level Physics Coursebook' } })
    await page.evaluate(() => { localStorage.setItem('theme', 'dark') }); await page.reload(); await page.waitForSelector('.ss-rack'); await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(shots, 'final-dark-home.png') })
    await browser.close()
  },

  async errorstate() {
    const { browser, page, state } = await open({ query: '' })
    await browser.close()
    const b = await open()
    b.state.fail = true
    await b.page.reload(); await b.page.waitForTimeout(2500)
    log('error text', JSON.stringify(await b.page.locator('.ss-rack-err').innerText().catch(() => null)), 'first-quiz invite', await b.page.locator('text=Take your first quiz').count())
    b.state.fail = false
    await b.page.locator('button:has-text("Try again")').click(); await b.page.waitForTimeout(1500)
    log('after retry trays', await b.page.locator('[data-tray-key]').count())
    await b.browser.close()
  },
}
