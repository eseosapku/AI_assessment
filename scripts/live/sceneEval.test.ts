/**
 * The scenes held to the bar (the interactions spec, section 5): every
 * registered scene authored ten times through the real explore pass, on
 * stations named from its own topics, then scored.
 *
 * - By code, on every scene item served: valid, solvable, not solved at the
 *   start, no self-answer (the meaning gates, the prompt check among them).
 * - By eye: the card drawn twice in a headless browser -- as served, and
 *   holding its solved work unmarked -- and a vision model asked the spec's
 *   four questions: is an answer visible before acting, does each picture show
 *   its label, does anything overlap or clip, does the thing visibly change.
 * - Uptake: how often the writer chose the scene at all. Reported, not held to
 *   the bar: a writer may rightly pick something else for a step.
 *
 * The bar is 90% on every scored dimension for each scene with five or more
 * scene items. Needs the dev server (SCENE_EVAL_URL, default
 * http://localhost:3107) for /dev/render and Chrome for the screenshots.
 *
 * Run with: npx vitest run --config vitest.live.config.ts scripts/live/sceneEval.test.ts
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { chromium, type Browser } from 'playwright-core'
import { runPass, type PassContext } from '@/app/api/studylab/stations/passes'
import { MAX_PASS_TRIES, stationVersion } from '@/lib/studylab/stationJobs'
import { engines, type SceneEngine } from '@/lib/studylab/engines'
import { validateSpec } from '@/lib/studylab/activities/validate'
import { meaningFaults } from '@/lib/studylab/meaning'
import { bedrockSender, extractJson, SONNET_45 } from '../figure-library/claude'
import type { LessonStep } from '@/lib/studylab/lessonRun'

const OUT_DIR = process.env.SCRATCH ?? os.tmpdir()
/** The eye on each card. Sonnet 5.5 set the bar, but this account is refused it (2026-11-01). */
const VISION_MODEL = process.env.SCENE_EVAL_VISION ?? SONNET_45
const BASE = process.env.SCENE_EVAL_URL ?? 'http://localhost:3107'
const PER_SCENE = Number(process.env.SCENE_EVAL_N ?? 10)
const ONLY = process.env.SCENE_EVAL_ONLY?.split(',')
const CONCURRENCY = 4
const PASS_DEADLINE_MS = 20_000
const BAR = 0.9
const MIN_ITEMS = 5

/** The subject a scene's lessons are taught in, for the station's context. */
const SUBJECT: Record<string, string> = {
  orbit: 'Physics', particles: 'Chemistry', atom: 'Chemistry', bonding: 'Chemistry', 'lab-bench': 'Chemistry',
  'coordinate-plane': 'Mathematics', 'body-flow': 'Biology', 'cause-chain': 'History',
  'algebra-tiles': 'Mathematics', 'food-web': 'Biology', 'supply-demand': 'Economics', 'business-finance': 'Business Studies',
  ledger: 'Accounting', 'counters-place-value': 'Mathematics', 'algorithm-tracer': 'Computer Science', 'measure-shape': 'Mathematics', 'stats-explorer': 'Mathematics', magnetism: 'Physics',
}

const DIMENSIONS = ['valid', 'solvable', 'unsolvedStart', 'noSelfAnswer', 'noAnswerVisible', 'picturesFit', 'noOverlap', 'changes'] as const
type Dimension = (typeof DIMENSIONS)[number]

type Item = {
  scene: string
  station: string
  served: boolean
  usedScene: boolean
  tries: number
  reason?: string
  /** Every try's refusal, in order: the first is what turned a scene into something else. */
  reasons?: string[]
  prompt?: string
  config?: unknown
  scores?: Partial<Record<Dimension, boolean>>
  note?: string
  shots?: [string, string]
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Ten stations for a scene, named from its topics in turn. */
function stations(e: SceneEngine<unknown, unknown>): { lesson: string; step: LessonStep }[] {
  return Array.from({ length: PER_SCENE }, (_, i) => {
    const topic = e.covers[i % e.covers.length]
    const round = Math.floor(i / e.covers.length)
    const goal = round === 0 ? `Understand ${topic}` : `Work out ${topic} for yourself`
    return { lesson: cap(topic), step: { id: `s${i + 1}`, title: cap(topic), goal, status: 'pending', cardIds: [] } as LessonStep }
  })
}

const VISION = (prompt: string, config: unknown, about: string) => [
  'You check one learning card before a student sees it. Image 1 is the card as the student first sees it.',
  'Image 2 is the same card holding the right answer, before it is marked.',
  `The card's instruction: "${prompt}". The task it was configured with: ${JSON.stringify(config)}.`,
  `What its maker says the card shows, and what it keeps until marked: ${about}`,
  'Data a task gives the student to work from (a table of facts, the equation to make) is not the answer.',
  'Answer from what you can see:',
  '1. answer_visible: in image 1, is the answer already given -- the finished arrangement image 2 reaches, or the name,',
  '   value or result the task asks the student to find, printed on the card? (The instruction itself may name the task.)',
  '2. pictures_fit: does every picture or drawn object show what its label says? true when there is nothing to check.',
  '3. overlap: in either image, does text or a shape overlap another so it cannot be read, or get cut off at an edge?',
  '4. changes: do images 1 and 2 differ visibly in the drawing itself?',
  'Reply with JSON only: {"answer_visible":true|false,"pictures_fit":true|false,"overlap":true|false,"changes":true|false,"note":"<one sentence on any problem, or empty>"}',
].join('\n')

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')

async function shoot(browser: Browser, spec: unknown, state: unknown, subject: string, file: string): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: 520, height: 1100 } })
  try {
    await page.goto(`${BASE}/dev/render#${enc({ spec, state, subject })}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60_000 })
    const png = await page.locator('.react-flow__node').first().screenshot({ path: file })
    return png
  } finally {
    await page.close()
  }
}

async function evaluate(e: SceneEngine<unknown, unknown>, s: { lesson: string; step: LessonStep }, browser: Browser, send: ReturnType<typeof bedrockSender>): Promise<Item> {
  const subject = SUBJECT[e.id] ?? 'Science'
  const station = `${s.lesson} / ${s.step.goal}`
  const version = stationVersion({ title: s.step.title, goal: s.step.goal, position: 0, subject })
  const requestId = randomUUID()
  let fix: string | undefined
  const reasons: string[] = []
  let action: Record<string, unknown> | undefined
  let tries = 0
  for (; tries < MAX_PASS_TRIES && !action; tries++) {
    const ctx: PassContext = { title: s.lesson, subject, step: s.step, stepNo: 1, plan: [s.step], version, partial: {}, fix }
    try {
      const out = await runPass('explore', ctx, { signal: AbortSignal.timeout(PASS_DEADLINE_MS), usage: { requestId, userId: null } })
      if (out.ok) action = (out.partial as { explore?: { action?: Record<string, unknown> } } | undefined)?.explore?.action
      else { fix = out.reason; reasons.push(out.reason) }
    } catch (err) {
      fix = `[error] ${(err as Error)?.message ?? String(err)}`
      reasons.push(fix)
    }
  }
  if (!action) return { scene: e.id, station, served: false, usedScene: false, tries, reason: fix, reasons }
  const spec = action.spec as { pattern?: unknown; prompt?: unknown; payload?: { engine?: unknown; config?: unknown } } | undefined
  if (action.type !== 'createActivity' || spec?.pattern !== 'scene' || spec.payload?.engine !== e.id) {
    return { scene: e.id, station, served: true, usedScene: false, tries, reason: `wrote ${String(spec?.pattern ?? action.type)} instead`, reasons }
  }
  const config = e.parse(spec.payload.config)
  const item: Item = { scene: e.id, station, served: true, usedScene: true, tries, reasons, prompt: String(spec.prompt ?? ''), config: spec.payload.config }
  const scores: Partial<Record<Dimension, boolean>> = {
    valid: validateSpec(spec) && !!config,
    solvable: !!config && e.check(config, e.solve(config)).ok,
    unsolvedStart: !!config && !e.check(config, e.initial(config)).ok,
    noSelfAnswer: meaningFaults(action).length === 0,
  }
  if (config) {
    const base = path.join(OUT_DIR, `${e.id}-${s.step.id}`)
    const shots: [string, string] = [`${base}-a.png`, `${base}-b.png`]
    let said = ''
    try {
      const a = await shoot(browser, spec, undefined, subject, shots[0])
      const b = await shoot(browser, spec, e.solve(config), subject, shots[1])
      const reply = await send(VISION_MODEL, VISION(item.prompt!, item.config, e.prompt.split('config:')[0].replace(/s+/g, ' ').slice(0, 900)), 700, [
        { mediaType: 'image/png', data: a.toString('base64') },
        { mediaType: 'image/png', data: b.toString('base64') },
      ])
      said = reply.text
      const v = extractJson(reply.text) as { answer_visible?: unknown; pictures_fit?: unknown; overlap?: unknown; changes?: unknown; note?: unknown }
      scores.noAnswerVisible = v.answer_visible === false
      scores.picturesFit = v.pictures_fit !== false
      scores.noOverlap = v.overlap === false
      scores.changes = v.changes === true
      item.note = String(v.note ?? '')
      item.shots = shots
    } catch (err) {
      item.note = `[vision] ${(err as Error)?.message ?? String(err)}${said ? `: ${said.slice(0, 300)}` : ''}`
    }
  }
  item.scores = scores
  return item
}

describe('the scenes held to the bar', () => {
  it('authors each scene ten times and scores what is served', async () => {
    const send = bedrockSender()
    const browser = await chromium.launch({ channel: 'chrome', headless: true })
    const stamp = Date.now()
    const jsonl = path.join(OUT_DIR, `scene-eval-${stamp}.jsonl`)
    const items: Item[] = []
    try {
      const jobs = engines()
        .filter((e) => !ONLY || ONLY.includes(e.id))
        .flatMap((e) => stations(e).map((s) => () => evaluate(e, s, browser, send)))
      let next = 0
      await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (next < jobs.length) {
          const item = await jobs[next++]()
          items.push(item)
          fs.appendFileSync(jsonl, JSON.stringify(item) + '\n')
          const dims = item.scores ? DIMENSIONS.filter((d) => item.scores![d] === false) : []
          console.log(`${item.scene} | ${item.station} | ${item.usedScene ? (dims.length ? `FAIL ${dims.join(',')}` : 'ok') : item.served ? 'other' : 'unserved'}${item.note ? ` | ${item.note}` : ''}${item.reason && !item.usedScene ? ` | ${item.reason.slice(0, 160)}` : ''}`)
        }
      }))
    } finally {
      await browser.close()
    }

    const summary = Object.fromEntries(engines().filter((e) => !ONLY || ONLY.includes(e.id)).map((e) => {
      const mine = items.filter((i) => i.scene === e.id)
      const scored = mine.filter((i) => i.scores)
      const rate = (d: Dimension) => {
        const seen = scored.filter((i) => i.scores![d] !== undefined)
        return seen.length ? +(seen.filter((i) => i.scores![d]).length / seen.length).toFixed(2) : null
      }
      return [e.id, {
        authored: mine.length,
        served: mine.filter((i) => i.served).length,
        uptake: mine.length ? +(mine.filter((i) => i.usedScene).length / mine.length).toFixed(2) : 0,
        sceneItems: scored.length,
        ...Object.fromEntries(DIMENSIONS.map((d) => [d, rate(d)])),
      }]
    }))
    fs.writeFileSync(path.join(OUT_DIR, `scene-eval-${stamp}.json`), JSON.stringify(summary, null, 2))
    console.log(JSON.stringify(summary, null, 2))

    for (const [id, s] of Object.entries(summary)) {
      if ((s.sceneItems as number) < MIN_ITEMS) continue
      for (const d of DIMENSIONS) expect.soft((s as Record<string, number | null>)[d] ?? 1, `${id} ${d}`).toBeGreaterThanOrEqual(BAR)
    }
  }, 3_600_000)
})
