/**
 * Draw the figure library up front, in bulk, for a human to approve.
 *
 * The per-question version of this asked the model for a spec WHILE the paper
 * was being written: one extra call per figure slot, on the clock, with the
 * learner waiting and nobody looking at the result. The verdict on it was
 * "I'm not sure this SVG thing is working", and the verdict was right — not
 * because the drawing is wrong, but because nothing was ever inspected.
 *
 * So the same machinery runs here instead. Every focus in every strand, six
 * variations each, drawn and written to disk. Nothing reaches a paper until
 * it has been looked at and approved, and a question that wants a figure then
 * takes one that a person has already seen.
 *
 * Nova writes the SPEC. This file draws it. The model never emits SVG.
 *
 *   npx vitest run --config vitest.live.config.ts bulkFigures
 *
 * Resumable: re-running keeps what is already on disk and fills the gaps.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { callGemma } from '@/lib/bedrock'
import { STRAND_FOCI } from '@/lib/checkpoint-paper'
import { buildFigureSpecPrompt, drawFromReply, worthDrawing, FIGURE_SETTINGS } from '@/lib/figure-request'

const OUT_DIR = path.resolve(process.cwd(), 'data/figure-drafts')
const INDEX = path.join(OUT_DIR, 'index.json')

/** Which subject each strand belongs to, for the review screen's grouping. */
const SUBJECT_OF_STRAND: Record<string, string> = {
  'Number': 'Mathematics',
  'Algebra, Geometry and Measure': 'Mathematics',
  'Statistics and Probability': 'Mathematics',
  'Biology': 'Science',
  'Chemistry': 'Science',
  'Physics': 'Science',
  'Earth and Space': 'Science',
  'Thinking and Working Scientifically': 'Science',
  'Science in Context': 'Science',
  'Reading': 'English',
  'Reading and Usage': 'English',
  'Writing': 'English',
}

/** Both Checkpoint stages, so a figure is drawn at the level it will be used. */
const STAGES = ['Cambridge Primary Stage 6', 'Cambridge Lower Secondary Stage 9']

/** How many attempts per focus per stage. Duplicates are the limiting factor. */
const VARIANTS = Number(process.env.FIGURE_VARIANTS ?? 12)

/**
 * Two figures are the same figure if they draw the same picture.
 *
 * Keying on the raw spec let "Walk, Bike, Car, Bus" and "Walk, Bike, Bus,
 * Car" both through, which is two rows in a review screen and one figure.
 * Case, order and spacing are normalised away; the numbers are not.
 */
function sameness(spec: Record<string, unknown>): string {
  const bits: string[] = [String(spec.kind)]
  const walk = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(walk).sort().join(',')
    if (v && typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, x]) => `${k}:${walk(x)}`).sort().join(';')
    }
    return String(v).toLowerCase().replace(/\s+/g, ' ').trim()
  }
  bits.push(walk(spec))
  return bits.join('|')
}

export interface FigureDraft {
  id: string
  subject: string
  strand: string
  focus: string
  stage: string
  kind: string
  spec: unknown
  description: string
  labels: string[]
  svg: string
}

function loadIndex(): FigureDraft[] {
  try {
    return JSON.parse(fs.readFileSync(INDEX, 'utf8')) as FigureDraft[]
  } catch {
    return []
  }
}

/** Run a list of jobs `width` at a time. */
async function pool<T>(jobs: (() => Promise<T>)[], width: number): Promise<T[]> {
  const out: T[] = []
  let next = 0
  const workers = Array.from({ length: Math.min(width, jobs.length) }, async () => {
    while (true) {
      const mine = next++
      if (mine >= jobs.length) return
      out[mine] = await jobs[mine]()
    }
  })
  await Promise.all(workers)
  return out
}

describe('bulk figure drafts', () => {
  it(
    'draws every focus it can and writes them for review',
    async () => {
      fs.mkdirSync(OUT_DIR, { recursive: true })

      const drafts = loadIndex()
      // Two figures that draw identically are one figure, however they were
      // asked for. Variation across six asks is the point; duplication is the
      // cost, and this is where it is paid.
      const seen = new Set(drafts.map((d) => sameness(d.spec as Record<string, unknown>)))
      const done = new Set(drafts.map((d) => `${d.strand}|${d.focus}|${d.stage}`))

      type Job = { strand: string; focus: string; stage: string; rank: number }
      const jobs: Job[] = []
      for (const [strand, foci] of Object.entries(STRAND_FOCI)) {
        foci.forEach((focus, i) => {
          // Asked about "cell structure and function", the model returned a
          // 10 cm x 10 cm rectangle: it cannot draw a cell, so it took
          // whatever was on the menu. Nothing downstream could tell that
          // from a real answer. So a focus the six shapes cannot serve is
          // never asked about in the first place.
          if (!worthDrawing(focus)) return
          for (const stage of STAGES) {
            // FIGURE_REDRAW=1 goes round again on foci already drawn, to
            // deepen the library rather than skip it. The sameness check
            // still holds, so a second round only ever adds new pictures.
            if (!process.env.FIGURE_REDRAW && done.has(`${strand}|${focus}|${stage}`)) continue
            jobs.push({ strand, focus, stage, rank: i })
          }
        })
      }
      // Round-robin across strands, so a capped smoke run samples all twelve
      // rather than spending its whole budget on Number.
      jobs.sort((a, b) => a.rank - b.rank)

      // A smoke run measures the yield before the full run spends 1,100 calls
      // finding out. FIGURE_JOB_LIMIT=10 is the probe.
      const cap = Number(process.env.FIGURE_JOB_LIMIT ?? 0)
      if (cap > 0) jobs.length = Math.min(jobs.length, cap)

      const log = (m: string) => fs.appendFileSync(path.join(OUT_DIR, 'run.log'), m + '\n', 'utf8')
      log(`--- ${new Date().toISOString()}  ${jobs.length} job(s), ${VARIANTS} variant(s) each`)

      let asked = 0
      let drawn = 0
      let duplicate = 0

      const tasks = jobs.map((job) => async () => {
        const subject = SUBJECT_OF_STRAND[job.strand] ?? 'Other'

        for (let v = 0; v < VARIANTS; v++) {
          asked++
          // A different setting each time, walked rather than sampled, so the
          // library ends up spread across all twenty rather than clustered on
          // whichever one the model likes.
          // The offset moves a second round onto settings the first did not
          // reach, which is where the new pictures come from.
          const offset = Number(process.env.FIGURE_SETTING_OFFSET ?? 0)
          const setting = FIGURE_SETTINGS[(job.rank * VARIANTS + v + offset) % FIGURE_SETTINGS.length]
          const prompt = buildFigureSpecPrompt(subject, job.stage, job.focus, setting)
          // Capped: 0.4 + v * 0.25 reached 3.15 at twelve variants, which
          // Bedrock rejects outright -- and the rejection surfaced as "the
          // provided model identifier is invalid", because callGemma reports
          // the LAST candidate's error once the fallback chain is exhausted.
          // Every call in the run failed and the message named the wrong
          // cause. Variety comes from the setting anyway.
          const temperature = Math.min(1, 0.4 + (v % 3) * 0.25)

          // Throttling arrives wearing the same wrong name, for the same
          // reason: the primary is throttled, the chain walks on, and the
          // invalid last candidate is what gets reported. It is transient,
          // so it is worth waiting out rather than losing the draft.
          let reply = ''
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              reply = await callGemma(prompt, { maxTokens: 400, temperature })
              break
            } catch (err) {
              if (attempt === 2) {
                log(`  ERR ${job.focus}: ${String(err).slice(0, 120)}`)
              } else {
                await new Promise((r) => setTimeout(r, 800 * (attempt + 1) + Math.random() * 400))
              }
            }
          }
          if (!reply) continue

          const figure = drawFromReply(reply)
          if (!figure) continue

          const key = sameness(figure.spec as unknown as Record<string, unknown>)
          if (seen.has(key)) {
            duplicate++
            continue
          }
          seen.add(key)
          drawn++

          drafts.push({
            id: `${drafts.length}-${figure.spec.kind}`,
            subject,
            strand: job.strand,
            focus: job.focus,
            stage: job.stage,
            kind: figure.spec.kind,
            spec: figure.spec,
            description: figure.description,
            labels: figure.labels,
            svg: figure.svg,
          })
        }

        // Written as we go: a run this long must not lose its work to a
        // credential expiry two thirds of the way through.
        if (drafts.length % 25 < VARIANTS) {
          fs.writeFileSync(INDEX, JSON.stringify(drafts, null, 0), 'utf8')
        }
      })

      await pool(tasks, 5)

      fs.writeFileSync(INDEX, JSON.stringify(drafts, null, 0), 'utf8')

      const byKind: Record<string, number> = {}
      const bySubject: Record<string, number> = {}
      for (const d of drafts) {
        byKind[d.kind] = (byKind[d.kind] ?? 0) + 1
        bySubject[d.subject] = (bySubject[d.subject] ?? 0) + 1
      }

      const summary = [
        `asked      ${asked}`,
        `drawn      ${drawn}`,
        `duplicate  ${duplicate}`,
        `total      ${drafts.length}`,
        `by kind    ${JSON.stringify(byKind)}`,
        `by subject ${JSON.stringify(bySubject)}`,
      ].join('\n')
      log(summary)
      fs.writeFileSync(path.join(OUT_DIR, 'summary.txt'), summary, 'utf8')

      expect(drafts.length).toBeGreaterThan(0)
    },
    60 * 60 * 1000,
  )
})
