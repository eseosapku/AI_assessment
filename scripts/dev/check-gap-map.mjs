// node scripts/dev/check-gap-map.mjs <scenario> [width height]
import { open, log, resolve, shots, visibleBars } from './check-gap-map-lib.mjs'
import extra from './check-gap-map-scenarios.mjs'
const [scenario, W = '1440', H = '900'] = process.argv.slice(2)
const scenarios = {
  async bars() {
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 768]]) {
      for (const query of ['', '?chapter=101']) {
        const { browser, page } = await open({ width: w, height: h, query })
        const bars = await page.evaluate(visibleBars)
        const info = await page.evaluate(() => {
          const main = document.getElementById('main-content')
          const sheet = document.querySelector('.ss-rack-sheet')
          const r = sheet?.getBoundingClientRect()
          return { mainScrolls: main ? main.scrollHeight > main.clientHeight : null, mainH: main?.clientHeight, mainSH: main?.scrollHeight, sheetVisible: r ? r.top >= 0 && r.bottom <= innerHeight : null }
        })
        log(w, h, query || 'home', 'bars', bars.length, JSON.stringify(bars), JSON.stringify(info))
        if (w === 1920 || w === 1440) await page.screenshot({ path: resolve(shots, `final-${query ? 'chapter' : 'home'}-${w}.png`) })
        await browser.close()
      }
    }
  },
}

const all = { ...scenarios, ...extra }
if (!all[scenario]) { console.error('unknown scenario', scenario); process.exit(1) }
await all[scenario]()
process.exit(0)
