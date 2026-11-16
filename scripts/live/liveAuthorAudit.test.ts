/**
 * The live authoring audit: stations written ahead, end to end, through the
 * real models.
 *
 * Twenty stations across seven subjects, each driven pass by pass the way the
 * author route drives it -- two tries a pass, a verifier's redo sending its
 * part and everything after it back, the same 20 s abort -- then every check
 * key and practice answer solved blind by a second model. It counts what the
 * bar is set on (correct keys, stations authored without falling back to live,
 * seconds per pass) and what the tuning needs (refusals by pass, name cuts
 * that say the same thing three times, explore items the serve-time gates
 * would drop), and prices the run from the token counts of every call it made.
 *
 * Usage is captured in-process rather than read back from `ai_usage_events`:
 * a forty-minute run outlived its database connection once, and every row
 * after that was lost. Each station is written to a JSONL file the moment it
 * finishes, so a run that dies keeps what it did. The report goes to SCRATCH
 * (or the system temp folder), and the test fails if the bar is not met.
 *
 * Run with: npx vitest run --config vitest.live.config.ts scripts/live/liveAuthorAudit.test.ts
 */
import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const usage = vi.hoisted(() => [] as { requestId?: string | null; feature: string; modelId: string; inputTokens: number | null; outputTokens: number | null; latencyMs: number; status: string }[])
vi.mock('@/lib/ai-usage-recorder', async (orig) => {
  const { buildUsageEvent } = await import('@/lib/ai-usage')
  void orig
  return {
    withUsageTracking: async <T,>(context: Record<string, unknown>, call: () => Promise<T>): Promise<T> => {
      const startedAt = Date.now()
      const push = (extra: Record<string, unknown>) => {
        try {
          const e = buildUsageEvent({ ...(context as object), startedAt, ...extra } as Parameters<typeof buildUsageEvent>[0])
          usage.push({ requestId: e.requestId, feature: e.feature, modelId: e.modelId, inputTokens: e.tokens.inputTokens, outputTokens: e.tokens.outputTokens, latencyMs: e.latencyMs, status: e.status })
        } catch { /* telemetry never fails a call */ }
      }
      try {
        const result = await call()
        const parse = (context as { parseBody?: (r: T) => unknown }).parseBody
        let responseBody: unknown
        try { responseBody = parse ? parse(result) : undefined } catch { responseBody = undefined }
        push({ response: result, responseBody })
        return result
      } catch (error) {
        push({ error })
        throw error
      }
    },
  }
})

import { runPass, type PassContext } from '@/app/api/studylab/stations/passes'
import { PASSES, MAX_PASS_TRIES, stationVersion, type Pass } from '@/lib/studylab/stationJobs'
import { verifyBundleCode, type StationBundle, type Outcome } from '@/lib/studylab/stationBundle'
import { refuseUnjustifiedActivities, refuseUnjustifiedMaterials } from '@/app/api/studylab/tutor/dispatch'
import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob } from '@/lib/studylab/lessonJobs'
import { isSolvable } from '@/lib/studylab/material/solvable'
import { meaningFaults } from '@/lib/studylab/meaning'
import { validateMaterial } from '@/lib/studylab/material/validate'
import type { LessonStep } from '@/lib/studylab/lessonRun'
import type { CheckpointQuestion } from '@/lib/studylab/types'

const OUT_DIR = process.env.SCRATCH ?? os.tmpdir()
const CONCURRENCY = 4
const PASS_DEADLINE_MS = 20_000

type Station = { subject: string; lesson: string; steps: [string, string][]; at: number }

/** Lessons as a plan would draft them; `at` is the station written (0-based). */
const STATIONS: Station[] = [
  { subject: 'Mathematics', lesson: 'Equivalent fractions', at: 1, steps: [
    ['Same amount, different pieces', 'See that 1/2, 2/4 and 3/6 name the same amount'],
    ['Making equivalent fractions', 'Multiply the top and bottom by the same number to make an equivalent fraction'],
    ['Simplest form', 'Divide the top and bottom by a common factor to simplify a fraction'] ] },
  { subject: 'Mathematics', lesson: 'Area of a triangle', at: 1, steps: [
    ['Area of a rectangle', 'Find the area of a rectangle as length times width'],
    ['Half a rectangle', 'See that a triangle is half of the rectangle drawn around it'],
    ['Using the formula', 'Find the area of a triangle with one half times base times height'] ] },
  { subject: 'Mathematics', lesson: 'Solving linear equations', at: 0, steps: [
    ['Keeping it balanced', 'Doing the same thing to both sides keeps an equation balanced'],
    ['One-step equations', 'Solve equations like x + 5 = 12 and 3x = 18'],
    ['Two-step equations', 'Solve equations like 2x + 3 = 11'] ] },
  { subject: 'Physics', lesson: 'Density', at: 2, steps: [
    ['Mass and volume', 'Tell the mass of an object from its volume'],
    ['Density as mass per volume', 'Calculate density as mass divided by volume'],
    ['Floating and sinking', 'Predict whether an object floats by comparing its density with water'] ] },
  { subject: 'Physics', lesson: 'Electric circuits', at: 2, steps: [
    ['Complete circuits', 'A bulb lights only when the circuit is a complete loop'],
    ['Series circuits', 'The current is the same at every point in a series circuit'],
    ['Adding resistance', 'More resistance in a circuit means less current for the same voltage'] ] },
  { subject: 'Physics', lesson: 'Speed', at: 2, steps: [
    ['Distance and time', 'Read the distance travelled and the time taken'],
    ['Calculating speed', 'Calculate speed as distance divided by time'],
    ['Distance-time graphs', 'A steeper line on a distance-time graph means a greater speed'] ] },
  { subject: 'Chemistry', lesson: 'Metals and reactivity', at: 1, steps: [
    ['Metals and non-metals', 'Sort elements into metals and non-metals by their properties'],
    ['The reactivity series', 'Order metals by how vigorously they react with water and acid'],
    ['Displacement', 'A more reactive metal displaces a less reactive metal from its compound'] ] },
  { subject: 'Chemistry', lesson: 'States of matter', at: 1, steps: [
    ['Particles in solids, liquids and gases', 'Describe how particles are arranged and move in each state'],
    ['Changes of state', 'Melting, boiling, condensing and freezing happen as particles gain or lose energy'],
    ['Diffusion', 'Particles spread from where they are concentrated to where they are not'] ] },
  { subject: 'Chemistry', lesson: 'Acids and alkalis', at: 0, steps: [
    ['The pH scale', 'Place solutions on the pH scale from 0 to 14 as acidic, neutral or alkaline'],
    ['Indicators', 'The colour of universal indicator shows the pH of a solution'],
    ['Neutralisation', 'An acid and an alkali react to make a salt and water'] ] },
  { subject: 'Biology', lesson: 'Enzymes', at: 1, steps: [
    ['What enzymes do', 'An enzyme speeds up a reaction without being used up'],
    ['Temperature and enzymes', 'The rate rises to an optimum temperature, then falls as the enzyme denatures'],
    ['pH and enzymes', 'Each enzyme works fastest at its own optimum pH'] ] },
  { subject: 'Biology', lesson: 'Photosynthesis', at: 1, steps: [
    ['Inputs and outputs', 'Carbon dioxide and water make glucose and oxygen, using light energy'],
    ['Limiting factors', 'Light intensity limits the rate of photosynthesis up to a point'],
    ['Leaf structure', 'Each part of a leaf is adapted to help photosynthesis'] ] },
  { subject: 'Biology', lesson: 'Food chains', at: 0, steps: [
    ['Producers and consumers', 'Sort organisms into producers, primary consumers and secondary consumers'],
    ['Energy transfer', 'Only about a tenth of the energy passes on to the next level'],
    ['Food webs', 'Removing one species from a food web affects the others'] ] },
  { subject: 'Geography', lesson: 'Plate tectonics', at: 1, steps: [
    ['Layers of the Earth', 'Name the crust, mantle, outer core and inner core in order'],
    ['Plate boundaries', 'Match each boundary type -- constructive, destructive, conservative -- to what happens there'],
    ['Earthquakes and volcanoes', 'Explain why earthquakes and volcanoes cluster along plate boundaries'] ] },
  { subject: 'Geography', lesson: 'Weather and climate', at: 1, steps: [
    ['Weather and climate', 'Tell weather from climate'],
    ['Reading climate graphs', 'Read the temperature line and the rainfall bars on a climate graph'],
    ['Climate zones', 'Describe the main climate zones and where they are'] ] },
  { subject: 'Geography', lesson: 'Population and migration', at: 2, steps: [
    ['Population pyramids', 'Read what the shape of a population pyramid says about a country'],
    ['The demographic transition', 'Order the stages of the demographic transition model'],
    ['Push and pull factors', 'Sort the reasons people migrate into push factors and pull factors'] ] },
  { subject: 'Computing', lesson: 'Binary numbers', at: 1, steps: [
    ['Place value in binary', 'Each binary column is worth double the one to its right: 1, 2, 4, 8'],
    ['Binary to denary', 'Convert a 4-bit binary number to denary'],
    ['Denary to binary', 'Convert a denary number up to 15 into 4-bit binary'] ] },
  { subject: 'Computing', lesson: 'Algorithms', at: 0, steps: [
    ['Sequence', 'Put the steps of an algorithm in the right order'],
    ['Selection', 'An IF statement chooses which path an algorithm takes'],
    ['Iteration', 'A loop repeats steps until a condition is met'] ] },
  { subject: 'Computing', lesson: 'Logic gates', at: 1, steps: [
    ['AND, OR and NOT', 'State the output of each gate for its inputs'],
    ['Truth tables', 'Complete a truth table for a two-input logic gate'],
    ['Combining gates', 'Work out the output of two gates joined together'] ] },
  { subject: 'History', lesson: 'The Industrial Revolution', at: 0, steps: [
    ['Causes', 'Sort the causes of the Industrial Revolution into economic, technological and social'],
    ['The factory system', 'Explain how work changed when it moved from homes into factories'],
    ['Industrial towns', 'Describe living conditions in the new industrial towns'] ] },
  { subject: 'History', lesson: 'Using historical sources', at: 1, steps: [
    ['Primary and secondary sources', 'Sort sources into primary and secondary'],
    ['Reliability', "Judge how reliable a source is from who made it, when, and why"],
    ['Corroboration', 'Check one source against another to test a claim'] ] },
]

interface PassCall { pass: Pass; ms: number; ok: boolean; reason?: string; redo?: string }
/** `correct` is null when the second model could not be reached: unchecked, read by hand. */
interface KeyCheck { kind: 'check' | 'practice' | 'material'; prompt: string; key: string; correct: boolean | null; note: string }
interface Report {
  station: string
  subject: string
  status: 'ready' | 'failed'
  calls: PassCall[]
  exploreKind?: string
  apparatus?: string
  solvable?: boolean | null
  servedWhole?: boolean
  serveDrop?: string[]
  cutsAlike?: number
  keys: KeyCheck[]
  requestId: string
  /** The key check's own calls, priced apart from the authoring. */
  keysRequestId: string
  bundle?: StationBundle
  /** What the meaning gates still find on the items that would be served: should always be nothing. */
  meaning?: string[]
}

/**
 * The meaning gates' refusals, by what they found: the rate at which a pass
 * was written again for each, which is what the prompts are tuned on.
 */
const MEANING_KINDS: [string, RegExp][] = [
  ['responds', /at every slider position|hardly moves|cannot be worked out from the slider|stays where it is|does not change as the slider moves|slider is named "x"/],
  ['marked-on-output', /give a "target"|reaches the target/],
  ['solved-at-start', /solved before (anything is moved|the slider moves)/],
  ['self-answer', /has no picture, so the card|is both a box and a piece/],
  ['picture-fits', /does not show/],
]

const asSteps = (s: Station): LessonStep[] =>
  s.steps.map(([title, goal], i) => ({ id: `s${i + 1}`, title, goal, status: 'pending', cardIds: [] }) as LessonStep)

/** Drives one station the way the author route does: one pass a call, two tries a pass. */
async function author(s: Station): Promise<Report> {
  const plan = asSteps(s)
  const step = plan[s.at]
  const version = stationVersion({ title: step.title, goal: step.goal, position: s.at, subject: s.subject })
  const requestId = randomUUID()
  const results: Partial<Record<Pass, Partial<StationBundle>>> = {}
  const done = new Set<Pass>()
  const failures: Partial<Record<Pass, number>> = {}
  // What the route's authorState hands the next try: the last reason each pass was refused.
  const lastFailure: Partial<Record<Pass, string>> = {}
  const calls: PassCall[] = []
  let bundle: StationBundle | undefined

  for (let guard = 0; guard < 24; guard += 1) {
    const pass = PASSES.find((p) => !done.has(p))
    if (!pass) break
    if (PASSES.some((p) => (failures[p] ?? 0) >= MAX_PASS_TRIES && !done.has(p))) break
    // What the route's authorState merges: the parts of the passes still standing.
    const partial = PASSES.filter((p) => done.has(p)).reduce((acc, p) => ({ ...acc, ...results[p] }), {} as Partial<StationBundle>)
    const ctx: PassContext = { title: s.lesson, subject: s.subject, step, stepNo: s.at + 1, plan, version, partial, fix: lastFailure[pass] }
    const t = Date.now()
    let out: Awaited<ReturnType<typeof runPass>>
    try {
      out = await runPass(pass, ctx, { signal: AbortSignal.timeout(PASS_DEADLINE_MS), usage: { requestId, userId: null } })
    } catch (err) {
      const e = err as { name?: string; message?: string }
      out = { ok: false, reason: `[error] ${e?.name ?? 'Error'}: ${e?.message ?? String(err)}` }
    }
    calls.push({ pass, ms: Date.now() - t, ok: out.ok, ...(out.ok ? {} : { reason: out.reason, ...(out.redo ? { redo: out.redo } : {}) }) })
    if (out.ok) {
      done.add(pass)
      results[pass] = out.partial ?? {}
      if (out.bundle) bundle = out.bundle
      continue
    }
    // A verify that sent a part back did its job: the part it faulted is charged instead.
    if (!(pass === 'verify' && out.redo)) failures[pass] = (failures[pass] ?? 0) + 1
    if (!out.reason.startsWith('[error] ')) lastFailure[pass] = out.reason
    if (out.redo) {
      for (const p of PASSES.slice(PASSES.indexOf(out.redo), PASSES.indexOf('verify'))) {
        if (!done.has(p)) continue
        done.delete(p)
        // Only the faulted part is charged; what was built on it is superseded.
        if (p === out.redo) { failures[p] = (failures[p] ?? 0) + 1; lastFailure[p] = out.reason }
      }
    }
  }

  const report: Report = { station: `${s.lesson} / ${step.title}`, subject: s.subject, status: bundle ? 'ready' : 'failed', calls, keys: [], requestId, keysRequestId: randomUUID() }
  if (!bundle) return report
  report.bundle = bundle
  inspect(report, bundle, step)
  report.keys = await checkKeys(bundle, s, report.keysRequestId)
  return report
}

function inspect(report: Report, bundle: StationBundle, step: LessonStep) {
  const a = bundle.explore.action as unknown as Record<string, unknown>
  report.exploreKind = a.type === 'createCard' ? `card:${String(a.card)}` : String(a.type)
  report.apparatus = bundle.explore.intent?.apparatus ?? (a.spec as { pattern?: string } | undefined)?.pattern
  if (a.type === 'build_material') {
    const v = validateMaterial(a.spec as never)
    report.solvable = v.ok ? isSolvable(v.spec as never).ok : false
  } else report.solvable = null
  // The serve-time gates, as dispatch runs them on the authored explore and
  // practice, each with its intent back on. The explore alone once stood in
  // for "served whole" while a practice material without its intent would
  // have been refused.
  const p = bundle.practice.action as unknown as Record<string, unknown>
  const items = [
    bundle.explore.intent ? { ...a, intent: bundle.explore.intent } : a,
    bundle.practice.intent ? { ...p, intent: bundle.practice.intent } : p,
  ]
  const { kept: acts, refused: r1 } = refuseUnjustifiedActivities(items, { title: step.title, goal: step.goal })
  const { kept, refused: r2 } = refuseUnjustifiedMaterials(acts)
  report.servedWhole = kept.length === items.length
  report.serveDrop = [...r1, ...r2]
  report.cutsAlike = cutsAlike(bundle.name)
  verifyBundleCode(bundle).ok || (report.servedWhole = false)
  report.meaning = [...meaningFaults(a), ...meaningFaults(p)]
}

/** How alike the three name cuts are: the mean word overlap of their cards, 0 to 1. */
function cutsAlike(name: Record<Outcome, { say: string; actions: unknown[] }>): number {
  const words = (o: Outcome) =>
    new Set(
      name[o].actions
        .filter((x) => (x as { type?: string }).type === 'createCard')
        .map((x) => `${(x as { title?: string }).title ?? ''} ${(x as { body?: string }).body ?? ''}`)
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    )
  const jac = (x: Set<string>, y: Set<string>) => {
    const inter = [...x].filter((w) => y.has(w)).length
    const union = new Set([...x, ...y]).size
    return union ? inter / union : 1
  }
  const [s, h, u] = (['solved', 'helped', 'untried'] as const).map(words)
  return Number(((jac(s, h) + jac(s, u) + jac(h, u)) / 3).toFixed(2))
}

/** Every check key and the practice answer, solved by a second model that never saw the author's working. */
async function checkKeys(bundle: StationBundle, s: Station, requestId: string): Promise<KeyCheck[]> {
  const out: KeyCheck[] = []
  const ask = async (prompt: string): Promise<Record<string, unknown>> => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await askOnce(prompt)
      } catch (err) {
        if (attempt >= 2) return { unreachable: String((err as { message?: string })?.message ?? err) }
      }
    }
  }
  const askOnce = async (prompt: string) => {
    const raw = await callGemma(prompt, {
      maxTokens: 700, temperature: 0, model: modelForJob('plan'),
      usage: { feature: 'station_audit_keycheck', requestId, userId: null },
    })
    // The verdict field comes first, and is read by pattern when the working
    // (LaTeX and all) will not parse.
    try {
      return parseJsonRobust(raw) as Record<string, unknown>
    } catch {
      const answer = raw.match(/"answer"\s*:\s*(\d+)/)?.[1]
      const correct = raw.match(/"correct"\s*:\s*(true|false)/)?.[1]
      return { ...(answer ? { answer: Number(answer) } : {}), ...(correct ? { correct: correct === 'true' } : {}), working: raw.slice(0, 300) }
    }
  }
  const head = `SUBJECT: ${s.subject}. A question for a secondary-school student.`
  for (const q of bundle.check.questions as CheckpointQuestion[]) {
    if (q.format === 'mcq') {
      const got = await ask([head, '', q.prompt, ...q.options.map((o, i) => `${i}. ${o}`), '',
        'Answer it. Plain text, no LaTeX. Reply with JSON only: { "answer": <the option number>, "working": "<brief>" }'].join('\n'))
      const blind = Number(got.answer)
      if (got.unreachable || !Number.isInteger(blind)) {
        out.push({ kind: 'check', prompt: q.prompt, key: `${q.answer}. ${q.options[q.answer]}`, correct: null, note: `unchecked: ${String(got.unreachable ?? got.working ?? '')}`.slice(0, 300) })
        continue
      }
      out.push({ kind: 'check', prompt: q.prompt, key: `${q.answer}. ${q.options[q.answer]}`, correct: blind === q.answer,
        note: blind === q.answer ? '' : `blind solver chose ${blind}. ${q.options[blind] ?? '?'} -- ${String(got.working ?? '')}` })
    } else {
      const key = q.format === 'short' ? `rubric: ${q.rubric ?? '(none)'}`
        : q.format === 'match' ? `pairs: ${q.pairs.map((p) => `${p.left} -> ${p.right}`).join('; ')}`
        : q.format === 'fill' ? `sentence: ${q.text}; blanks in order: ${q.answer.join(' | ')}; tiles: ${q.tiles.join(', ')}`
        : q.format === 'order' ? `right order: ${q.items.join(' -> ')}`
        : q.format === 'tap' ? `parts to tap on ${q.figure}: ${q.answer.join(', ')}`
        : `goal: ${q.goal}`
      const got = await ask([head, '', q.prompt, '', `MARKING KEY -- ${key}`, '',
        'Solve the question yourself first, then say whether the key is correct and would accept a right answer and refuse a wrong one.',
        'Plain text, no LaTeX. Reply with JSON only: { "correct": true|false, "problem": "<if not>", "working": "<brief>" }'].join('\n'))
      out.push({ kind: 'check', prompt: q.prompt, key, correct: typeof got.correct === 'boolean' ? got.correct : null, note: got.correct === true ? '' : String(got.problem ?? got.unreachable ?? got.working ?? '') })
    }
  }
  for (const [label, action] of [['explore', bundle.explore.action], ['practice', bundle.practice.action]] as const) {
    const k = await materialKey(label, action as unknown as Record<string, unknown>, head, ask)
    if (k) out.push(k)
  }
  const p = bundle.practice.action as unknown as Record<string, unknown>
  if (p.type === 'createCard' && typeof p.answer === 'string') {
    const got = await ask([head, '', `${String(p.title ?? '')}\n${String(p.body ?? '')}`, '', `ANSWER GIVEN: ${p.answer}`,
      Array.isArray(p.steps) ? `WORKING GIVEN: ${(p.steps as string[]).join(' / ')}` : '', '',
      'Solve it yourself first, then say whether the answer and working given are correct.',
      'Plain text, no LaTeX. Reply with JSON only: { "correct": true|false, "problem": "<if not>", "working": "<brief>" }'].join('\n'))
    out.push({ kind: 'practice', prompt: String(p.title ?? ''), key: p.answer, correct: typeof got.correct === 'boolean' ? got.correct : null, note: got.correct === true ? '' : String(got.problem ?? got.unreachable ?? '') })
  }
  return out
}

/** Fields that give a material's answer away, taken off before it is solved blind. */
const GIVEAWAY = new Set(['binId', 'defensible', 'correct', 'isCorrect', 'answer', 'consequence'])

/** The activity as the student meets it: no answer fields, its lists out of order. */
function asMet(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(asMet)
    const ided = items.length > 1 && items.every((x) => x && typeof x === 'object' && 'id' in (x as object))
    return ided ? [...items.slice(1), items[0]].reverse() : items
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !GIVEAWAY.has(k)).map(([k, v]) => [k, asMet(v)]))
  }
  return value
}

const SHAPES: Record<string, string> = {
  exactSet: '{ "kind": "exactSet", "itemIds": ["<every id that is right>"] }',
  exactOrder: '{ "kind": "exactOrder", "itemIds": ["<every id, in the right order>"] }',
  binAssignment: '{ "kind": "binAssignment", "assign": { "<item id>": "<bin id>" } }',
  pairing: '{ "kind": "pairing", "pairs": [["<id>", "<id it pairs with>"]] }',
}
// numericWithin is left out: its target is a slider position or a pan difference,
// which no one can solve blind without knowing what the material measures.

/** A material's own answer key, solved blind; null for a kind with no single answer to compare. */
async function materialKey(
  label: string,
  action: Record<string, unknown>,
  head: string,
  ask: (prompt: string) => Promise<Record<string, unknown>>,
): Promise<KeyCheck | null> {
  if (action.type !== 'createActivity') return null
  const spec = action.spec as { success?: Record<string, unknown>; hints?: unknown; reveal?: unknown } & Record<string, unknown>
  const success = spec?.success
  const kind = String(success?.kind ?? '')
  if (!success || !SHAPES[kind]) return null
  const { success: _s, hints: _h, reveal: _r, ...shown } = spec
  // A compose answer is a set of joins, "<id>-<id>"; a hotspot pairing joins a hotspot id to its label.
  const shape = spec.pattern === 'compose' && kind === 'exactSet'
    ? '{ "kind": "exactSet", "itemIds": ["<id>-<id> for every join that is right"] }'
    : kind === 'pairing'
      ? '{ "kind": "pairing", "pairs": [["<hotspot or left id>", "<the label text or right id that goes there>"]] }'
      : SHAPES[kind]
  const got = await ask([head, '', `An activity for the student (${label}):`, JSON.stringify(asMet(shown)), '',
    'Work out the correct answer. Plain text, no LaTeX. Reply with JSON only:',
    `{ "answer": ${shape}, "working": "<brief>" }`].join('\n'))
  const a = (got.answer ?? {}) as Record<string, unknown>
  const key = JSON.stringify(success).slice(0, 300)
  if (got.unreachable || !got.answer) return { kind: 'material', prompt: `${label}: ${String(spec.prompt ?? '')}`, key, correct: null, note: `unchecked: ${String(got.unreachable ?? got.working ?? '')}`.slice(0, 300) }
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const pairKey = (v: unknown) => ids(v).sort().join('|')
  let correct: boolean
  // A join is the same join either way round.
  const join = (v: unknown) => ids(v).map((x) => x.split('-').sort().join('-')).sort().join()
  if (kind === 'exactSet') correct = spec.pattern === 'compose' ? join(a.itemIds) === join(success.itemIds) : ids(a.itemIds).sort().join() === ids(success.itemIds).sort().join()
  else if (kind === 'exactOrder') correct = ids(a.itemIds).join() === ids(success.itemIds).join()
  else if (kind === 'binAssignment') {
    const want = (success.assign ?? {}) as Record<string, string>
    const have = (a.assign ?? {}) as Record<string, string>
    correct = Object.keys(want).length === Object.keys(have).length && Object.entries(want).every(([k, v]) => have[k] === v)
  } else if (kind === 'pairing') {
    const set = (v: unknown) => (Array.isArray(v) ? v.map(pairKey).sort().join(';') : '')
    correct = set(a.pairs) === set(success.pairs)
  } else correct = false
  return { kind: 'material', prompt: `${label}: ${String(spec.prompt ?? '')}`, key, correct,
    note: correct ? '' : `blind solver: ${JSON.stringify(a).slice(0, 200)} -- ${String(got.working ?? '').slice(0, 200)}` }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]) }
  }))
  return out
}

/** Dollars per million tokens, in and out. */
function price(model: string): [number, number] {
  if (/sonnet/i.test(model)) return [3, 15]
  if (/haiku/i.test(model)) return [1, 5]
  if (/nova-lite/i.test(model)) return [0.06, 0.24]
  return [0, 0]
}

describe('the live authoring audit', () => {
  it('writes twenty stations ahead to the bar', async () => {
    const only = process.env.AUDIT_ONLY ? Number(process.env.AUDIT_ONLY) : STATIONS.length
    const stamp = Date.now()
    const live = path.join(OUT_DIR, `author-audit-${stamp}.jsonl`)
    const reports = await pool(STATIONS.slice(0, only), CONCURRENCY, async (st) => {
      let r: Report
      try {
        r = await author(st)
      } catch (err) {
        r = { station: `${st.lesson} / ${st.steps[st.at][0]}`, subject: st.subject, status: 'failed', keys: [], requestId: '', keysRequestId: '',
          calls: [{ pass: 'explore', ms: 0, ok: false, reason: `[error] harness: ${String((err as { message?: string })?.message ?? err)}` }] }
      }
      fs.appendFileSync(live, JSON.stringify(r) + '\n')
      console.log(`${r.status} ${r.station}: ${r.calls.map((c) => `${c.pass} ${(c.ms / 1000).toFixed(1)}s${c.ok ? '' : ' FAIL'}`).join(', ')}`)
      return r
    })

    const cost = (f: (feature: string) => boolean) =>
      usage.filter((u) => f(u.feature)).reduce((sum, u) => {
        const [i, o] = price(u.modelId)
        return sum + ((u.inputTokens ?? 0) * i + (u.outputTokens ?? 0) * o) / 1e6
      }, 0)
    const rows = Object.values(usage.reduce((acc, u) => {
      const k = `${u.feature} ${u.modelId} ${u.status}`
      const a = (acc[k] ??= { feature: u.feature, model: u.modelId, status: u.status, calls: 0, input: 0, output: 0, maxMs: 0 })
      a.calls += 1; a.input += u.inputTokens ?? 0; a.output += u.outputTokens ?? 0; a.maxMs = Math.max(a.maxMs, u.latencyMs)
      return acc
    }, {} as Record<string, { feature: string; model: string; status: string; calls: number; input: number; output: number; maxMs: number }>))

    const ready = reports.filter((r) => r.status === 'ready')
    const keys = ready.flatMap((r) => r.keys.filter((k) => k.kind === 'check'))
    const practice = ready.flatMap((r) => r.keys.filter((k) => k.kind === 'practice'))
    const material = ready.flatMap((r) => r.keys.filter((k) => k.kind === 'material'))
    const times = reports.flatMap((r) => r.calls.map((c) => c.ms)).sort((a, b) => a - b)
    const q = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? 0
    const refusals: Record<string, number> = {}
    for (const r of reports) for (const c of r.calls) if (!c.ok) refusals[c.pass] = (refusals[c.pass] ?? 0) + 1
    const summary = {
      stations: reports.length,
      ready: ready.length,
      readyRate: ready.length / reports.length,
      checkKeys: `${keys.filter((k) => k.correct === true).length}/${keys.filter((k) => k.correct !== null).length}`,
      checkKeysUnchecked: keys.filter((k) => k.correct === null).length,
      practiceAnswers: `${practice.filter((k) => k.correct === true).length}/${practice.filter((k) => k.correct !== null).length}`,
      materialKeys: `${material.filter((k) => k.correct === true).length}/${material.filter((k) => k.correct !== null).length}`,
      materialKeysUnchecked: material.filter((k) => k.correct === null).length,
      passSeconds: { p50: q(0.5) / 1000, p90: q(0.9) / 1000, max: (times[times.length - 1] ?? 0) / 1000, over20: times.filter((t) => t >= PASS_DEADLINE_MS).length },
      refusalsByPass: refusals,
      materials: ready.filter((r) => r.exploreKind !== 'card:practice').length,
      unsolvable: ready.filter((r) => r.solvable === false).length,
      servedWholeAtServeTime: `${ready.filter((r) => r.servedWhole).length}/${ready.length}`,
      // The meaning gates: faults left on served items (must be 0), and the passes they sent back, by kind.
      meaningFaultsServed: ready.reduce((n, r) => n + (r.meaning?.length ?? 0), 0),
      meaningRewrites: Object.fromEntries(MEANING_KINDS.map(([kind, re]) => [kind, reports.reduce((n, r) => n + r.calls.filter((c) => !c.ok && re.test(c.reason ?? '')).length, 0)])),
      cutsAlikeMean: Number((ready.reduce((s, r) => s + (r.cutsAlike ?? 0), 0) / Math.max(1, ready.length)).toFixed(2)),
      cutsAlikeOver60: ready.filter((r) => (r.cutsAlike ?? 0) > 0.6).length,
      costAuthoring: Number(cost((f) => f.startsWith('station_') && f !== 'station_audit_keycheck').toFixed(3)),
      costPerStation: Number((cost((f) => f.startsWith('station_') && f !== 'station_audit_keycheck') / reports.length).toFixed(3)),
      costKeyCheck: Number(cost((f) => f === 'station_audit_keycheck').toFixed(3)),
      usage: rows,
    }

    const lines = [
      `# Authoring audit ${new Date().toISOString()}`, '', '```json', JSON.stringify(summary, null, 2), '```', '',
      ...reports.flatMap((r) => [
        `## ${r.status === 'ready' ? 'READY' : 'FAILED'} -- ${r.subject}: ${r.station}`,
        `passes: ${r.calls.map((c) => `${c.pass} ${(c.ms / 1000).toFixed(1)}s${c.ok ? '' : ` FAIL(${c.reason}${c.redo ? ` -> ${c.redo}` : ''})`}`).join(' | ')}`,
        r.bundle ? `explore: ${r.exploreKind} ${r.apparatus ?? ''} solvable=${r.solvable} servedWhole=${r.servedWhole}${r.serveDrop?.length ? ` drop=${r.serveDrop.join(' / ')}` : ''} cutsAlike=${r.cutsAlike}` : '',
        r.bundle ? `opening: ${r.bundle.explore.opening}` : '',
        ...(r.bundle ? (['solved', 'helped', 'untried'] as const).map((o) => `${o}: ${r.bundle!.name[o].say} || ${r.bundle!.name[o].actions.filter((a) => (a as { type?: string }).type === 'createCard').map((a) => (a as { title?: string }).title).join(' + ')}`) : []),
        ...r.keys.map((k) => `${k.correct === true ? 'ok ' : k.correct === null ? '???' : 'BAD'} ${k.kind}: ${k.prompt} [${k.key}]${k.note ? ` -- ${k.note}` : ''}`),
        '',
      ]),
    ]
    const file = path.join(OUT_DIR, `author-audit-${stamp}.md`)
    fs.writeFileSync(file, lines.filter((l) => l !== undefined).join('\n'))
    fs.writeFileSync(file.replace(/\.md$/, '.json'), JSON.stringify(reports, null, 2))
    console.log(`report: ${file}`)
    console.log(JSON.stringify({ ...summary, usage: undefined }, null, 2))

    expect(keys.every((k) => k.correct !== false)).toBe(true)
    expect(summary.readyRate).toBeGreaterThanOrEqual(0.9)
    expect(summary.meaningFaultsServed).toBe(0)
    expect(summary.passSeconds.over20).toBe(0)
  }, 60 * 60 * 1000)
})
