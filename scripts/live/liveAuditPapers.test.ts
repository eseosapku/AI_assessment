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
  lines.push(`figures attached: ${withFigure}`)

  const formats = questions.reduce((a: any, q) => {
    const k = q?.type === 'interactive' ? `interactive:${q?.kind ?? '?'}` : String(q?.type ?? '?')
    a[k] = (a[k] ?? 0) + 1
    return a
  }, {})
  lines.push(`shapes returned: ${JSON.stringify(formats)}`)

  // ── the checks ──────────────────────────────────────────────────────────
  const seenStems = new Map<string, number>()
  for (const [i, q] of questions.entries()) {
    const stem = String(q?.question ?? '')
    lines.push(`\n[${i + 1}] (${q?.marks ?? '?'} mark) ${q?.type ?? '?'}${q?.image_url ? '  [FIGURE]' : ''}`)
    lines.push(`    ${stem}`)
    if (Array.isArray(q?.options) && q.options.length) lines.push(`    options: ${q.options.join(' | ')}`)
    if (q?.short_answer) lines.push(`    key: ${JSON.stringify(q.short_answer).slice(0, 120)}`)

    // A question pointing at a figure that is not there.
    const pointsAtFigure = /\b(?:see|look\s+at|in|on|from|using|use|according\s+to|based\s+on)\s+(?:the|this|these|your)\s+(?:diagram|picture|figure|graph|image|photo|illustration|map|chart|table|circuit|apparatus)\b/i.test(stem)
    if (pointsAtFigure && !q?.image_url) {
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

    // The prompt printed as the question.
    if (/\brefer to it as\b|\bdo not restate\b|\bthe question should send\b/i.test(stem)) {
      findings.push({ paper: label, kind: 'prompt-leak', detail: stem.slice(0, 120) })
    }

    // A one-word answer slot with no key cannot be marked.
    if (q?.type === 'short_answer' && !q?.short_answer) {
      findings.push({ paper: label, kind: 'short-answer-no-key', detail: stem.slice(0, 100) })
    }
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
  }, 45 * 60 * 1000)
})
