/**
 * Generate real Checkpoint papers and read what actually arrives.
 *
 * Every fault in the last audit was visible only on the page: a nitrogen
 * cycle printed above a question about reaction rates, forty-two identical
 * one-word asks, a comprehension question about a story nobody was shown.
 * None of them could be seen from a unit test, because none of them are
 * wrong in code -- they are wrong in the paper.
 *
 *   npx vitest run --config vitest.live.config.ts liveAuditPapers
 *
 * Writes a full transcript to data/audit/ so the questions can be read.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { checkpointSubject, type CheckpointProgramme } from '@/lib/cambridge-checkpoint'
import { buildPaper, paperBrief } from '@/lib/checkpoint-paper'
import { questionInventsItsOwnText, namesAbsentFromPassage } from '@/lib/passage-question-match'
import { beyondStage } from '@/lib/grade-vocabulary'
import { demandOf } from '@/lib/demand-variety'

const OUT_DIR = path.resolve(process.cwd(), 'data/audit')

/** What the form posts, assembled here so the route sees a real request. */
function bodyFor(programme: CheckpointProgramme, subjectName: string, componentNumber: string) {
  const subject = checkpointSubject(programme, subjectName)!
  const component = subject.components.find((c) => c.number === componentNumber)!
  const paper = buildPaper(subject, component, { mode: 'paper', seed: Date.now() % 100000 })
  return {
    subject,
    component,
    paper,
    body: {
      curriculum: 'checkpoint',
      subject: subject.name,
      grade: programme === 'primary' ? 6 : 9,
      // `count`, not `numQuestions` — the route's own field name.
      count: paper.slots.length,
      style: 'exam',
      customTime: paper.minutes ?? undefined,
      difficultyLevel: 'medium',
      questionType: 'mixed',
      examPrepContext: paperBrief(paper),
      paperSlots: paper.slots.map((s) => ({
        q: s.questionNumber, part: s.part, marks: s.marks,
        format: s.format, strand: s.strand, focus: s.focus,
      })),
      shortCount: paper.slots.filter((s) => s.format === 'short').length,
      // Deliberately NOT sent. The server must decide for itself; this is the
      // exact flag that was false when the Clara questions shipped.
      needsPassage: undefined,
      topics: [...new Set(paper.slots.map((s) => s.focus))],
    },
  }
}

/**
 * Does the paper stay on the topics that were asked for?
 *
 * "The questions don't match the topics I selected" was reported twice. The
 * blueprint names a focus per slot; this checks the questions came back about
 * those foci and not about the rest of the syllabus.
 */
function offTopic(stem: string, foci: readonly string[]): boolean {
  const words = new Set(
    foci.join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3),
  )
  if (words.size === 0) return false
  const text = stem.toLowerCase()
  // One content word from the chosen topics is a low bar and deliberately so:
  // this is looking for questions about a different part of the syllabus, not
  // grading how well the topic was covered.
  for (const w of words) if (text.includes(w)) return false
  return true
}

interface Finding { paper: string; kind: string; detail: string }

async function auditOne(
  programme: CheckpointProgramme, subjectName: string, componentNumber: string,
  findings: Finding[], lines: string[],
) {
  const { subject, component, paper, body } = bodyFor(programme, subjectName, componentNumber)
  const label = `${subject.name} ${subject.code}/${component.number}`
  lines.push(`\n${'='.repeat(74)}\n${label} — ${paper.slots.length} slots, ${paper.totalMarks} marks\n${'='.repeat(74)}`)

  const { POST } = await import('@/app/api/generate-assessment/route')
  const req = new Request('http://localhost/api/generate-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  })

  let json: any
  try {
    const res = await POST(req as any)
    json = await res.json()
    if (!res.ok) {
      findings.push({ paper: label, kind: 'request-failed', detail: String(json?.error).slice(0, 160) })
      lines.push(`REQUEST FAILED: ${String(json?.error).slice(0, 200)}`)
      return
    }
  } catch (err) {
    findings.push({ paper: label, kind: 'threw', detail: String(err).slice(0, 200) })
    lines.push(`THREW: ${String(err).slice(0, 300)}`)
    return
  }

  const questions: any[] = json?.questions ?? []
  lines.push(`returned ${questions.length} question(s)`)
  // Keep the raw paper so scripts/ui-walk.js can put it in front of a real
  // browser. Every UI fault in this work was invisible from the code.
  fs.writeFileSync(
    path.join(OUT_DIR, `paper-${subject.code}-${component.number}.json`),
    JSON.stringify(json), 'utf8',
  )
  // The route echoes back the subject string it actually used, which is
  // what the passage decision is made from.
  lines.push(`route saw subject: "${json?.subject}"  curriculum: "${json?.curriculum}"`)

  const passage = questions.find((q) => q?.passage)?.passage ?? ''
  const isLanguage = /english|second language/i.test(subject.name)
  if (isLanguage) {
    lines.push(passage ? `PASSAGE (${passage.split(/\s+/).length} words):\n${passage}\n` : 'NO PASSAGE')
    if (!passage) findings.push({ paper: label, kind: 'no-passage', detail: 'a language paper with no text' })
  }

  const withFigure = questions.filter((q) => q?.image_url).length
  const withDrawn = questions.filter((q) => q?.diagram_svg).length
  lines.push(`figures attached: ${withFigure} from the library, ${withDrawn} drawn`)

  // The figure's own description pasted into the stem.
  for (const q of questions) {
    if (/\[\s*(?:diagram|figure|image|table|graph)\s*:/i.test(String(q?.question ?? ''))) {
      findings.push({ paper: label, kind: 'figure-description-in-stem', detail: String(q.question).slice(0, 120) })
    }
  }

  const formats = questions.reduce((a: any, q) => {
    const k = q?.type === 'interactive' ? `interactive:${q?.kind ?? '?'}` : String(q?.type ?? '?')
    a[k] = (a[k] ?? 0) + 1
    return a
  }, {})
  lines.push(`shapes returned: ${JSON.stringify(formats)}`)

  // ── the checks ──────────────────────────────────────────────────────────
  const seenStems = new Map<string, number>()
  let offTopicCount = 0
  for (const [i, q] of questions.entries()) {
    const stem = String(q?.question ?? '')
    lines.push(`\n[${i + 1}] (${q?.marks ?? '?'} mark) ${q?.type ?? '?'}${q?.image_url ? '  [FIGURE]' : ''}`)
    lines.push(`    ${stem}`)
    if (Array.isArray(q?.options) && q.options.length) lines.push(`    options: ${q.options.join(' | ')}`)
    if (q?.short_answer) lines.push(`    key: ${JSON.stringify(q.short_answer).slice(0, 120)}`)

    // A question pointing at a figure that is not there.
    const pointsAtFigure = /\b(?:see|look\s+at|in|on|from|using|use|according\s+to|based\s+on)\s+(?:the|this|these|your)\s+(?:diagram|picture|figure|graph|image|photo|illustration|map|chart|table|circuit|apparatus)\b/i.test(stem)
    // A drawn figure travels as SVG, and an interactive question renders its
    // own table or options -- neither has an image_url and both are present.
    const hasVisual = Boolean(q?.image_url) || Boolean(q?.diagram_svg)
      || (q?.type === 'interactive' && (q?.kind === 'categorize' || q?.kind === 'multi_select'))
      || (q?.type === 'mcq' && Array.isArray(q?.options) && q.options.length > 0)
    if (pointsAtFigure && !hasVisual) {
      findings.push({ paper: label, kind: 'figure-referenced-but-absent', detail: stem.slice(0, 120) })
    }

    // A comprehension question about someone the text never mentions.
    if (isLanguage && passage && questionInventsItsOwnText(stem, passage)) {
      findings.push({
        paper: label, kind: 'invented-story',
        detail: `${namesAbsentFromPassage(stem, passage).join(', ')} :: ${stem.slice(0, 100)}`,
      })
    }

    // The same opening sentence used again and again.
    const opener = stem.split(/(?<=[.!?])\s+/)[0]?.trim().toLowerCase() ?? ''
    if (opener.length > 24) {
      const n = (seenStems.get(opener) ?? 0) + 1
      seenStems.set(opener, n)
      if (n === 3) findings.push({ paper: label, kind: 'scenario-repeated', detail: opener.slice(0, 110) })
    }

    // A question about a different part of the syllabus.
    //
    // Counted, not flagged per question. Keyword overlap is a weak signal:
    // "Name the gas produced when the candle burns" is squarely about
    // combustion and shares no word with it, and flagging each one produced
    // 34 findings on a paper that was fine. A HIGH RATE still means
    // something, so the rate is what is reported.
    if (!isLanguage && offTopic(stem, body.topics)) offTopicCount++

    // Terminology past the stage being sat.
    const advanced = beyondStage(stem, programme === 'primary' ? 6 : 9)
    if (advanced.length) {
      findings.push({ paper: label, kind: 'above-stage', detail: `${advanced.join(', ')} :: ${stem.slice(0, 90)}` })
    }

    // The prompt printed as the question.
    if (/\brefer to it as\b|\bdo not restate\b|\bthe question should send\b/i.test(stem)) {
      findings.push({ paper: label, kind: 'prompt-leak', detail: stem.slice(0, 120) })
    }

    // A one-word answer slot with no key cannot be marked.
    if (q?.type === 'short_answer' && !q?.short_answer) {
      findings.push({ paper: label, kind: 'short-answer-no-key', detail: stem.slice(0, 100) })
    }
  }

  if (!isLanguage && questions.length > 0) {
    const rate = offTopicCount / questions.length
    lines.push(`
questions sharing no word with the chosen topics: ${offTopicCount}/${questions.length}`)
    // Half a paper with no lexical tie to any chosen topic is not wording.
    if (rate > 0.5) {
      findings.push({
        paper: label, kind: 'off-topic-paper',
        detail: `${offTopicCount} of ${questions.length} questions share no word with the chosen topics`,
      })
    }
  }

  // How varied are the demands?
  //
  // "Look at the diagram. Write down the normal force on the car." followed
  // by "Look at the diagram. Write down the friction force on the car." is
  // two questions and one idea. Counted on the first four words, which is
  // what a demand's shape lives in.
  // Measured on the DEMAND, not the opening words.
  //
  // Counting raw openings punished the paper for being authentic: a
  // blueprint with fourteen ring-around slots produces fourteen questions
  // opening "Draw a ring around", which is the correct Cambridge wording and
  // not a fault. What matters is whether they ASK different things.
  const openers = questions.map((q) =>
    demandOf(q?.question).split(' ').filter((w) => w.length > 3).slice(0, 5).join(' '))
  const distinct = new Set(openers.filter(Boolean)).size
  const variety = questions.length ? distinct / questions.length : 1
  lines.push(`
distinct demand openings: ${distinct}/${questions.length}`)
  // Which ones repeat, and how often. "All the questions are the same" is
  // only actionable once you can see WHICH.
  const tally = new Map<string, number>()
  for (const o of openers) if (o) tally.set(o, (tally.get(o) ?? 0) + 1)
  const repeats = [...tally].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])
  for (const [opening, n] of repeats.slice(0, 8)) lines.push(`   x${n}  ${opening}`)
  if (variety < 0.6 && questions.length >= 8) {
    findings.push({
      paper: label, kind: 'samey',
      detail: `only ${distinct} distinct openings across ${questions.length} questions`,
    })
  }

  const marks = questions.reduce((t, q) => t + (Number(q?.marks) || 0), 0)
  lines.push(`\nmarks awarded: ${marks} of ${paper.totalMarks}`)
  if (marks !== paper.totalMarks) {
    findings.push({ paper: label, kind: 'marks-mismatch', detail: `${marks} vs ${paper.totalMarks}` })
  }
  if (questions.length < paper.slots.length) {
    findings.push({ paper: label, kind: 'short-paper', detail: `${questions.length} of ${paper.slots.length}` })
  }
}

describe('a real paper, read', () => {
  it('generates one of each and reports what is wrong with it', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    const findings: Finding[] = []
    const lines: string[] = []

    const only = process.env.AUDIT_ONLY
    const all: [CheckpointProgramme, string, string][] = [
      ['lower-secondary', 'English as a Second Language', '01'],
      ['lower-secondary', 'English', '01'],
      ['lower-secondary', 'Science', '01'],
      ['lower-secondary', 'Mathematics', '01'],
      ['primary', 'Science', '01'],
    ]
    const plan = only ? all.filter((p) => p[1].toLowerCase().includes(only.toLowerCase())) : all

    for (const [prog, subj, comp] of plan) {
      try {
        await auditOne(prog, subj, comp, findings, lines)
      } catch (err) {
        lines.push(`\n${subj} ${comp} BLEW UP: ${String(err).slice(0, 300)}`)
        findings.push({ paper: `${subj}/${comp}`, kind: 'crashed', detail: String(err).slice(0, 200) })
      }
      fs.writeFileSync(path.join(OUT_DIR, 'transcript.txt'), lines.join('\n'), 'utf8')
    }

    const byKind = findings.reduce((a: Record<string, number>, f) => {
      a[f.kind] = (a[f.kind] ?? 0) + 1
      return a
    }, {})
    const report = [
      `${findings.length} finding(s)`,
      JSON.stringify(byKind, null, 2),
      '',
      ...findings.map((f) => `[${f.kind}] ${f.paper}\n    ${f.detail}`),
    ].join('\n')
    fs.writeFileSync(path.join(OUT_DIR, 'findings.txt'), report, 'utf8')
    fs.writeFileSync(path.join(OUT_DIR, 'transcript.txt'), lines.join('\n'), 'utf8')

    expect(lines.length).toBeGreaterThan(0)
    // A paper that failed to generate is the worst finding there is, and this
    // used to report "1 passed" over five failed requests -- every paper file
    // on disk was from the run before, and they were checked as if they were
    // new. The learner would have seen "Failed to generate 40 questions".
    const failed = lines.filter((l) => /REQUEST FAILED|BLEW UP/.test(l))
    expect(failed, failed.join('\n')).toEqual([])
  }, 45 * 60 * 1000)
})
