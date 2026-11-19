import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = path.dirname(fileURLToPath(import.meta.url))
const shotDir = path.join(root, 'screenshots')
const profileDir = path.join(root, 'chrome-profile')
const base = 'http://localhost:3000'
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function redact(value) {
  return String(value ?? '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
}

function pathnameOf(href) {
  try {
    return new URL(href).pathname
  } catch {
    return ''
  }
}

const failures = []
const steps = []

function addFailure(entry) {
  failures.push(entry)
}

async function loginOnce() {
  const cachePath = path.join(root, 'session-user-full.json')
  if (process.env.QA_REUSE === '1') {
    const cached = JSON.parse(await readFile(cachePath, 'utf8'))
    if (!cached?.id || !cached?.name) throw new Error('Cached session is unusable')
    return cached
  }
  const identifier = process.env.QA_IDENTIFIER
  const password = process.env.QA_PASSWORD
  if (!identifier || !password) {
    throw new Error('Login environment is missing')
  }
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const raw = await response.text()
  let body = null
  try {
    body = JSON.parse(raw)
  } catch {
    body = null
  }
  if (!response.ok || !body?.user || typeof body.user !== 'object') {
    throw new Error(`Login failed with status ${response.status}`)
  }
  const user = { ...body.user }
  for (const key of Object.keys(user)) {
    if (/password/i.test(key)) delete user[key]
  }
  await writeFile(cachePath, JSON.stringify(user))
  await writeFile(path.join(root, 'session-user.json'), JSON.stringify({ name: user.name, role: user.role, idPresent: Boolean(user.id) }, null, 2))
  return user
}

async function snap(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || ''
    const compact = text.replace(/\s+/g, ' ').trim()
    let session = null
    let sessionRaw = false
    try {
      const raw = localStorage.getItem('user')
      sessionRaw = Boolean(raw)
      session = raw ? JSON.parse(raw) : null
    } catch {
      session = { parseError: true }
    }
    let portalText = ''
    const portal = document.querySelector('nextjs-portal')
    try {
      portalText = portal?.shadowRoot?.textContent || ''
    } catch {
      portalText = ''
    }
    const classroomNames = [...document.querySelectorAll('p')]
      .filter((node) => String(node.className).includes('text-[18px]'))
      .map((node) => (node.textContent || '').trim())
      .filter(Boolean)
    return {
      href: location.href,
      title: document.title,
      textSample: compact.slice(0, 700),
      textLen: compact.length,
      headings: [...document.querySelectorAll('h1')].map((node) => (node.textContent || '').trim()).slice(0, 6),
      hasSpinner: Boolean(document.querySelector('.animate-spin')),
      marketing: /Get started free|We'll build you a way through it|Stuck on something\?/i.test(compact),
      welcome: /Welcome back/i.test(compact),
      classroomsHeading: /Your classrooms/i.test(compact),
      noClasses: /No classes yet/i.test(compact),
      classroomNames,
      settingsHeading: /Profile\s*&\s*security/i.test(compact),
      practiceHeading: /Choose your/i.test(compact) && /mode/i.test(compact),
      appError: /Application error|client-side exception|Internal Server Error|Unhandled Runtime Error|This page could not be found|Server Error/i.test(`${compact}\n${portalText}`),
      portalText: portalText.replace(/\s+/g, ' ').trim().slice(0, 400),
      session: session
        ? {
            name: session.name || '',
            role: session.role || '',
            idPresent: Boolean(session.id),
            parseError: Boolean(session.parseError),
          }
        : null,
      sessionPresent: sessionRaw,
    }
  })
}

function sessionOk(snapshot, user) {
  if (!snapshot?.session || snapshot.session.parseError) return false
  const sameName = snapshot.session.name === user.name
  const path = pathnameOf(snapshot.href)
  return sameName && snapshot.session.idPresent && path !== '/' && path !== '/login' && !snapshot.marketing && !snapshot.appError
}

async function shoot(page, name) {
  const file = path.join(shotDir, name)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function waitFor(page, ready, timeout) {
  const start = Date.now()
  let snapshot = null
  while (Date.now() - start < timeout) {
    snapshot = await snap(page)
    if (snapshot.appError || snapshot.marketing) return { snapshot, timedOut: false }
    if (ready(snapshot)) {
      await page.waitForTimeout(800)
      const settled = await snap(page)
      return { snapshot: settled, timedOut: false }
    }
    await page.waitForTimeout(300)
  }
  return { snapshot, timedOut: true }
}

async function go(page, url) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    return {
      status: response ? response.status() : null,
      finalUrl: response ? response.url() : page.url(),
      error: null,
    }
  } catch (error) {
    return { status: null, finalUrl: page.url(), error: redact(error?.message || error).slice(0, 300) }
  }
}

async function main() {
  await mkdir(shotDir, { recursive: true })
  await mkdir(profileDir, { recursive: true })
  const user = await loginOnce()
  const firstName = String(user.name || '').split(' ')[0] || ''
  console.log(`Logged in once as ${user.name} (${user.role})`)

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromePath,
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  })
  context.setDefaultNavigationTimeout(90000)
  const page = context.pages()[0] || (await context.newPage())
  const net = []
  let phase = 'setup'
  page.on('response', (response) => {
    const url = response.url()
    const status = response.status()
    const type = response.request().resourceType()
    if (status < 400 && type !== 'document' && !url.includes('/api/classrooms')) return
    const entry = {
      phase,
      status,
      type,
      url: redact(url.split('?')[0]),
    }
    net.push(entry)
    if (status >= 500 || url.includes('/api/classrooms')) {
      response
        .text()
        .then((text) => {
          entry.snippet = redact(text).slice(0, 240)
        })
        .catch(() => {})
    }
  })
  page.on('pageerror', (error) => {
    net.push({ phase, status: 'pageerror', type: 'pageerror', url: redact(error?.message || error).slice(0, 400) })
  })

  const client = await context.newCDPSession(page)
  const stored = JSON.stringify(user)
  const added = await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('user', ${JSON.stringify(stored)}); } catch (e) {}`,
  })

  phase = 'inject'
  const setupNav = await go(page, `${base}/dashboard`)
  await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: added.identifier })
  let setupSnap = await snap(page)
  if (!setupSnap.sessionPresent) {
    await page.evaluate((json) => localStorage.setItem('user', json), stored)
    phase = 'inject-reload'
    await go(page, `${base}/dashboard`)
    setupSnap = await snap(page)
  }
  const setupReady = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/dashboard' && snapshot.welcome && snapshot.textSample.includes(firstName),
    60000,
  )
  steps.push({
    phase: 'setup',
    nav: setupNav,
    sessionPresent: setupReady.snapshot?.sessionPresent ?? false,
    sessionName: setupReady.snapshot?.session?.name ?? null,
    url: setupReady.snapshot?.href ?? page.url(),
    timedOut: setupReady.timedOut,
  })
  if (!sessionOk(setupReady.snapshot, user)) {
    const evidence = await shoot(page, 'setup-session-failed.png')
    addFailure({
      severity: 'blocker',
      title: 'Session was not established after storing the user',
      steps: 'POST /api/auth/login once, store the returned user in localStorage under the key user, open /dashboard.',
      expected: 'Dashboard opens as the logged-in student.',
      actual: redact(JSON.stringify({
        url: setupReady.snapshot?.href,
        marketing: setupReady.snapshot?.marketing,
        appError: setupReady.snapshot?.appError,
        sessionPresent: setupReady.snapshot?.sessionPresent,
        welcome: setupReady.snapshot?.welcome,
        text: setupReady.snapshot?.textSample,
        nav: setupNav,
      })),
      evidence,
    })
  }

  const dashboardRuns = []
  for (let i = 1; i <= 5; i += 1) {
    phase = `dashboard-${i}`
    const nav = await go(page, `${base}/dashboard`)
    const ready = await waitFor(
      page,
      (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/dashboard' && snapshot.welcome && snapshot.textSample.includes(firstName),
      45000,
    )
    const snapshot = ready.snapshot
    const survived = Boolean(snapshot) && sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/dashboard' && !snapshot.marketing
    const row = {
      n: i,
      httpStatus: nav.status,
      navError: nav.error,
      finalUrl: snapshot?.href || nav.finalUrl,
      survived,
      timedOut: ready.timedOut,
      welcome: snapshot?.welcome ?? false,
      marketing: snapshot?.marketing ?? false,
      appError: snapshot?.appError ?? false,
      sessionName: snapshot?.session?.name ?? null,
      headings: snapshot?.headings ?? [],
      textSample: snapshot?.textSample ?? '',
    }
    dashboardRuns.push(row)
    console.log(`dashboard ${i}: http ${nav.status} survived ${survived} url ${pathnameOf(row.finalUrl)}`)
    if (!survived || (nav.status !== null && nav.status >= 400) || snapshot?.appError) {
      const evidence = await shoot(page, `dashboard-${i}-failed.png`)
      addFailure({
        severity: snapshot?.marketing || !snapshot?.sessionPresent ? 'blocker' : 'major',
        title: `Dashboard open ${i} did not keep the logged-in session`,
        steps: `Stored the login user once. Opened /dashboard ${i} time(s) in a row.`,
        expected: 'HTTP success, /dashboard stays open, and the same student is still signed in.',
        actual: redact(JSON.stringify({
          httpStatus: nav.status,
          navError: nav.error,
          url: snapshot?.href,
          marketing: snapshot?.marketing,
          appError: snapshot?.appError,
          portal: snapshot?.portalText,
          sessionPresent: snapshot?.sessionPresent,
          welcome: snapshot?.welcome,
          timedOut: ready.timedOut,
          text: snapshot?.textSample,
        })),
        evidence,
      })
    }
  }

  phase = 'back-dashboard'
  const backStart = await go(page, `${base}/dashboard`)
  const backDash = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/dashboard' && snapshot.welcome,
    45000,
  )
  phase = 'back-practice'
  const practiceNav = await go(page, `${base}/practice`)
  const practiceReady = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/practice' && snapshot.practiceHeading,
    45000,
  )
  let practiceEvidence = null
  if (!practiceReady.snapshot || practiceReady.snapshot.marketing || practiceReady.snapshot.appError || pathnameOf(practiceReady.snapshot.href) !== '/practice') {
    practiceEvidence = await shoot(page, 'practice-before-back-failed.png')
  }
  phase = 'back-browser'
  let backNav = { status: null, finalUrl: page.url(), error: null }
  try {
    const response = await page.goBack({ waitUntil: 'domcontentloaded', timeout: 90000 })
    backNav = { status: response ? response.status() : null, finalUrl: response ? response.url() : page.url(), error: null }
  } catch (error) {
    backNav = { status: null, finalUrl: page.url(), error: redact(error?.message || error).slice(0, 300) }
  }
  const backReady = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/dashboard' && snapshot.welcome && snapshot.textSample.includes(firstName) && !snapshot.marketing,
    45000,
  )
  const backSnapshot = backReady.snapshot
  const backOk = Boolean(backSnapshot)
    && sessionOk(backSnapshot, user)
    && pathnameOf(backSnapshot.href) === '/dashboard'
    && backSnapshot.welcome
    && !backSnapshot.marketing
    && backSnapshot.textSample.includes(firstName)
  console.log(`back: practice http ${practiceNav.status} back http ${backNav.status} still student ${backOk} url ${pathnameOf(backSnapshot?.href || '')}`)
  steps.push({
    phase: 'history',
    dashboard: { status: backStart.status, url: backDash.snapshot?.href, welcome: backDash.snapshot?.welcome },
    practice: { status: practiceNav.status, url: practiceReady.snapshot?.href, heading: practiceReady.snapshot?.practiceHeading, marketing: practiceReady.snapshot?.marketing, appError: practiceReady.snapshot?.appError },
    back: { status: backNav.status, error: backNav.error, url: backSnapshot?.href, welcome: backSnapshot?.welcome, marketing: backSnapshot?.marketing, nameVisible: backSnapshot?.textSample?.includes(firstName) },
  })
  if (practiceEvidence) {
    const evidence = practiceEvidence
    addFailure({
      severity: practiceReady.snapshot?.marketing ? 'blocker' : 'major',
      title: 'Practice did not stay signed in before browser back',
      steps: 'Open /dashboard, then open /practice.',
      expected: 'Practice opens for the same signed-in student.',
      actual: redact(JSON.stringify({
        httpStatus: practiceNav.status,
        url: practiceReady.snapshot?.href,
        marketing: practiceReady.snapshot?.marketing,
        appError: practiceReady.snapshot?.appError,
        portal: practiceReady.snapshot?.portalText,
        text: practiceReady.snapshot?.textSample,
      })),
      evidence,
    })
  }
  if (!backOk) {
    const evidence = await shoot(page, 'back-to-dashboard-failed.png')
    addFailure({
      severity: backSnapshot?.marketing || pathnameOf(backSnapshot?.href || '') === '/' ? 'blocker' : 'major',
      title: 'Browser back from practice did not return the signed-in dashboard',
      steps: 'Open /dashboard, open /practice, press the browser back button.',
      expected: 'Back returns to /dashboard still signed in as the same student, not the marketing page.',
      actual: redact(JSON.stringify({
        httpStatus: backNav.status,
        navError: backNav.error,
        url: backSnapshot?.href,
        marketing: backSnapshot?.marketing,
        appError: backSnapshot?.appError,
        portal: backSnapshot?.portalText,
        welcome: backSnapshot?.welcome,
        sessionName: backSnapshot?.session?.name,
        text: backSnapshot?.textSample,
      })),
      evidence,
    })
  }

  phase = 'classrooms-open'
  const classOpen = await go(page, `${base}/classrooms`)
  const classFirst = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/classrooms' && snapshot.classroomsHeading && !snapshot.hasSpinner,
    45000,
  )
  phase = 'classrooms-refresh'
  const classBeforeNet = net.length
  let classReload = { status: null, finalUrl: page.url(), error: null }
  try {
    const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    classReload = { status: response ? response.status() : null, finalUrl: response ? response.url() : page.url(), error: null }
  } catch (error) {
    classReload = { status: null, finalUrl: page.url(), error: redact(error?.message || error).slice(0, 300) }
  }
  const classWaitStart = Date.now()
  let classSnapshot = null
  while (Date.now() - classWaitStart < 45000) {
    classSnapshot = await snap(page)
    const classApiSoFar = net.slice(classBeforeNet).filter((entry) => entry.url.includes('/api/classrooms') && typeof entry.status === 'number')
    const apiSettled = classApiSoFar.length > 0
    const listVisible = classSnapshot.classroomNames.length > 0 || (classSnapshot.noClasses && apiSettled)
    if (classSnapshot.marketing || classSnapshot.appError) break
    if (sessionOk(classSnapshot, user) && pathnameOf(classSnapshot.href) === '/classrooms' && classSnapshot.classroomsHeading && !classSnapshot.hasSpinner && listVisible) {
      await page.waitForTimeout(600)
      classSnapshot = await snap(page)
      break
    }
    await page.waitForTimeout(300)
  }
  const classApi = net.slice(classBeforeNet).filter((entry) => entry.url.includes('/api/classrooms'))
  const classOk = sessionOk(classSnapshot, user)
    && pathnameOf(classSnapshot.href) === '/classrooms'
    && classSnapshot.classroomsHeading
    && !classSnapshot.appError
    && !classSnapshot.marketing
    && !classSnapshot.hasSpinner
    && (classSnapshot.classroomNames.length > 0 || classSnapshot.noClasses)
    && (classReload.status === null || classReload.status < 500)
    && classApi.every((entry) => typeof entry.status !== 'number' || entry.status < 500)
  console.log(`classrooms refresh: http ${classReload.status} list ${classOk} cards ${classSnapshot.classroomNames.length} api ${classApi.map((entry) => entry.status).join(',')}`)
  steps.push({
    phase: 'classrooms',
    open: { status: classOpen.status, url: classFirst.snapshot?.href, heading: classFirst.snapshot?.classroomsHeading },
    refresh: {
      status: classReload.status,
      error: classReload.error,
      url: classSnapshot.href,
      heading: classSnapshot.classroomsHeading,
      noClasses: classSnapshot.noClasses,
      cards: classSnapshot.classroomNames,
      spinner: classSnapshot.hasSpinner,
      api: classApi,
    },
  })
  if (!classOk) {
    const evidence = await shoot(page, 'classrooms-refresh-failed.png')
    addFailure({
      severity: (classReload.status && classReload.status >= 500) || classApi.some((entry) => entry.status >= 500) || classSnapshot.appError ? 'blocker' : 'major',
      title: 'Refreshing classrooms did not load the class list',
      steps: 'Open /classrooms, then refresh once.',
      expected: 'The classrooms page reloads the class list and does not return a 500.',
      actual: redact(JSON.stringify({
        httpStatus: classReload.status,
        navError: classReload.error,
        url: classSnapshot.href,
        marketing: classSnapshot.marketing,
        appError: classSnapshot.appError,
        portal: classSnapshot.portalText,
        heading: classSnapshot.classroomsHeading,
        spinner: classSnapshot.hasSpinner,
        noClasses: classSnapshot.noClasses,
        cards: classSnapshot.classroomNames,
        api: classApi,
        text: classSnapshot.textSample,
      })),
      evidence,
    })
  }

  phase = 'settings-open'
  const settingsOpen = await go(page, `${base}/settings`)
  const settingsFirst = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/settings' && snapshot.settingsHeading,
    45000,
  )
  phase = 'settings-refresh'
  let settingsReload = { status: null, finalUrl: page.url(), error: null }
  try {
    const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    settingsReload = { status: response ? response.status() : null, finalUrl: response ? response.url() : page.url(), error: null }
  } catch (error) {
    settingsReload = { status: null, finalUrl: page.url(), error: redact(error?.message || error).slice(0, 300) }
  }
  const settingsReady = await waitFor(
    page,
    (snapshot) => sessionOk(snapshot, user) && pathnameOf(snapshot.href) === '/settings' && snapshot.settingsHeading && snapshot.welcome,
    45000,
  )
  const settingsSnapshot = settingsReady.snapshot
  const settingsOk = Boolean(settingsSnapshot)
    && sessionOk(settingsSnapshot, user)
    && pathnameOf(settingsSnapshot.href) === '/settings'
    && settingsSnapshot.settingsHeading
    && !settingsSnapshot.marketing
    && !settingsSnapshot.appError
    && (settingsReload.status === null || settingsReload.status < 400)
  console.log(`settings refresh: http ${settingsReload.status} ok ${settingsOk} url ${pathnameOf(settingsSnapshot?.href || '')}`)
  steps.push({
    phase: 'settings',
    open: { status: settingsOpen.status, url: settingsFirst.snapshot?.href, heading: settingsFirst.snapshot?.settingsHeading, marketing: settingsFirst.snapshot?.marketing },
    refresh: { status: settingsReload.status, error: settingsReload.error, url: settingsSnapshot?.href, heading: settingsSnapshot?.settingsHeading, marketing: settingsSnapshot?.marketing, appError: settingsSnapshot?.appError },
  })
  if (!settingsFirst.snapshot || settingsFirst.snapshot.marketing || settingsFirst.snapshot.appError || pathnameOf(settingsFirst.snapshot.href) !== '/settings') {
    const evidence = await shoot(page, 'settings-open-failed.png')
    addFailure({
      severity: settingsFirst.snapshot?.marketing ? 'blocker' : 'major',
      title: 'Settings did not open for the signed-in student',
      steps: 'Open /settings. Do not save.',
      expected: 'Settings shows Profile & security for the same student.',
      actual: redact(JSON.stringify({
        httpStatus: settingsOpen.status,
        url: settingsFirst.snapshot?.href,
        marketing: settingsFirst.snapshot?.marketing,
        appError: settingsFirst.snapshot?.appError,
        text: settingsFirst.snapshot?.textSample,
      })),
      evidence,
    })
  }
  if (!settingsOk) {
    const evidence = await shoot(page, 'settings-refresh-failed.png')
    addFailure({
      severity: settingsSnapshot?.marketing ? 'blocker' : 'major',
      title: 'Refreshing settings did not keep the signed-in settings page',
      steps: 'Open /settings, then refresh. Do not save.',
      expected: 'Settings reloads Profile & security still signed in as the same student.',
      actual: redact(JSON.stringify({
        httpStatus: settingsReload.status,
        navError: settingsReload.error,
        url: settingsSnapshot?.href,
        marketing: settingsSnapshot?.marketing,
        appError: settingsSnapshot?.appError,
        portal: settingsSnapshot?.portalText,
        heading: settingsSnapshot?.settingsHeading,
        welcome: settingsSnapshot?.welcome,
        text: settingsSnapshot?.textSample,
      })),
      evidence,
    })
  }

  const serverErrors = net.filter((entry) => typeof entry.status === 'number' && entry.status >= 500)
  if (serverErrors.length && !failures.some((failure) => /500|classrooms|Dashboard|settings|Practice|back/i.test(failure.title))) {
    const evidence = await shoot(page, 'server-error-last-page.png')
    addFailure({
      severity: 'major',
      title: 'A server error occurred during the signed-in navigation',
      steps: 'Open dashboard five times, go dashboard to practice and back, refresh classrooms, refresh settings.',
      expected: 'Pages load without a 500.',
      actual: redact(JSON.stringify(serverErrors)),
      evidence,
    })
  }

  const summary = {
    student: user.name,
    sessionSurvivedAllDashboardOpens: dashboardRuns.every((row) => row.survived && (row.httpStatus === null || row.httpStatus < 400)),
    dashboardRuns: dashboardRuns.map((row) => ({
      n: row.n,
      httpStatus: row.httpStatus,
      survived: row.survived,
      url: pathnameOf(row.finalUrl),
      marketing: row.marketing,
      appError: row.appError,
    })),
    backOk,
    classroomsOk: classOk,
    settingsOk,
    failures,
    steps,
    serverErrors,
  }
  await writeFile(path.join(root, 'results.json'), JSON.stringify(summary, null, 2))
  console.log(`FAILURES ${failures.length}`)
  await context.close()
}

main().catch(async (error) => {
  console.error(redact(error?.stack || error?.message || error))
  await writeFile(path.join(root, 'results.json'), JSON.stringify({ crashed: redact(error?.message || error), failures }, null, 2))
  process.exitCode = 1
})
