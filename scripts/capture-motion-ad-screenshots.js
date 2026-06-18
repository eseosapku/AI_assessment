/**
 * Capture StudySquare UI reference frames for motion ad production.
 * Injects localStorage user session then screenshots key pages.
 *
 * Usage: node scripts/capture-motion-ad-screenshots.js
 * Requires: dev server on localhost:3000, playwright (npx playwright install chromium)
 */
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'docs', 'motion-ad-assets')
const BASE = 'http://localhost:3000'

function readEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

async function getContext() {
  const { createClient } = require('@supabase/supabase-js')
  const { url, key } = readEnv()
  const sb = createClient(url, key)

  const { data: user } = await sb
    .from('users')
    .select('id,name,email,student_id,class,subjects,role,country')
    .limit(1)
    .maybeSingle()

  const { data: spaces } = await sb
    .from('learnspaces')
    .select('id,title')
    .order('updated_at', { ascending: false })
    .limit(1)

  return {
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          studentId: user.student_id,
          class: user.class,
          subjects: user.subjects,
          role: user.role ?? 'student',
          country: user.country ?? 'RW',
        }
      : null,
    learnSpaceId: spaces?.[0]?.id ?? null,
  }
}

async function main() {
  let playwright
  try {
    playwright = require('playwright')
  } catch {
    console.error('Install playwright: npm install -D playwright && npx playwright install chromium')
    process.exit(1)
  }

  const { user, learnSpaceId } = await getContext()
  if (!user) {
    console.error('No user found in database — sign up first or seed a test user.')
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await playwright.chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  })

  await context.addInitScript((userJson) => {
    localStorage.setItem('user', userJson)
  }, JSON.stringify(user))

  const page = await context.newPage()

  const shots = [
    { name: '01-dashboard-studylab-cta', path: '/', wait: 2500 },
    { name: '02-studylab-hub', path: '/studylab', wait: 3500 },
    { name: '03-gap-map', path: '/studylab/gap-map', wait: 4000 },
    { name: '04-exam-prep', path: '/exam-prep', wait: 3500, selector: 'text=Choose your exam' },
  ]

  if (learnSpaceId) {
    shots.push({
      name: '05-learnspace-workspace',
      path: `/studylab/${learnSpaceId}`,
      wait: 5000,
    })
  }

  for (const shot of shots) {
    try {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 60000 })
      if (shot.selector) {
        await page.waitForSelector(shot.selector, { timeout: 15000 }).catch(() => {})
      }
      await page.waitForTimeout(shot.wait)
      const file = path.join(OUT_DIR, `${shot.name}.png`)
      await page.screenshot({ path: file, fullPage: false })
      console.log(`OK: ${file}`)
    } catch (err) {
      console.log(`SKIP ${shot.name}: ${err.message}`)
    }
  }

  // LearnSpace with chat interaction if workspace loaded
  if (learnSpaceId) {
    try {
      await page.goto(`${BASE}/studylab/${learnSpaceId}`, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForTimeout(3000)
      const input = page.locator('textarea, input[type="text"]').last()
      if (await input.count()) {
        await input.fill('Explain the quadratic formula step by step')
        await page.waitForTimeout(500)
        await page.screenshot({
          path: path.join(OUT_DIR, '06-learnspace-topic-input.png'),
        })
        console.log(`OK: ${path.join(OUT_DIR, '06-learnspace-topic-input.png')}`)
      }
    } catch (err) {
      console.log(`SKIP learnspace input: ${err.message}`)
    }
  }

  await browser.close()
  console.log(`\nDone — assets in ${OUT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
