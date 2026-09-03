/**
 * Reading a real homework page.
 *
 * Both fixtures are pages a student would actually photograph: a question with
 * their own full working already on it. That is the case the design nearly
 * missed, so it is the case this pins down.
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveHomeworkRead
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { parseHomeworkSheet, questionSummary, stepsFromQuestions } from '@/lib/studylab/homework'

const FIXTURES = 'C:/Users/Stephen/Downloads'

/** The route's own prompt, imported by reading the module it lives in. */
async function readSheet(file: string) {
  const bytes = fs.readFileSync(path.join(FIXTURES, file))
  const image = { mimeType: 'image/gif', base64: bytes.toString('base64') }

  const mod = await import('@/app/api/studylab/homework/read/route')
  // The prompt is not exported; drive the real route instead.
  const req = new Request('http://localhost/api/studylab/homework/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: `data:image/gif;base64,${image.base64}` }),
  })
  const res = await mod.POST(req as never)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return parseHomeworkSheet(json.sheet)
}

describe('reading a page that already has the student’s working on it', () => {
  it('reads the pump question, its table, and what they had already done', async () => {
    const sheet = await readSheet('homewrk 2.gif')

    console.log('\n═══ HOMEWORK 2 ' + '═'.repeat(56))
    console.log('  subject:', sheet.subject)
    console.log('  given  :')
    sheet.given.forEach((g) => console.log('    -', g.slice(0, 160)))
    sheet.questions.forEach((q) => {
      console.log(`\n  [${q.label}] ${questionSummary(q.text)}`)
      console.log('    text   :', q.text.slice(0, 260))
      console.log('    attempt:', (q.attempt ?? '(none)').slice(0, 260))
      console.log('    answer :', q.answer ?? '(none)')
      console.log('    rubric :', q.rubric ?? '(none)')
    })

    expect(sheet.questions.length).toBeGreaterThan(0)
    const q1 = sheet.questions[0]
    // The question names two pumps and an interest rate; the table is the
    // whole basis of it, so it has to survive into `given` or the question.
    const all = `${q1.text} ${sheet.given.join(' ')}`.toLowerCase()
    expect(all).toMatch(/pump/)
    expect(all).toMatch(/200[,.]?000|200000/)
    expect(all).toMatch(/7\s*%|7 percent/)
    // The page is covered in their own working, ending "B is better".
    expect(q1.attempt, 'the student’s working was not picked up').toBeTruthy()
    expect(q1.attempt!.toLowerCase()).toMatch(/eac|54,?621|52,?606|b is better/)

    // The table is one thing, not four; and `given` is not a second copy of
    // the question.
    expect(sheet.given.length).toBeLessThanOrEqual(4)
  }, 180_000)

  it('reads the beam question and does not mistake the layout advice for it', async () => {
    const sheet = await readSheet('homewrk 1.gif')

    console.log('\n═══ HOMEWORK 1 ' + '═'.repeat(56))
    console.log('  subject:', sheet.subject)
    sheet.given.forEach((g) => console.log('    -', g.slice(0, 160)))
    sheet.questions.forEach((q) => {
      console.log(`\n  [${q.label}] ${questionSummary(q.text)}`)
      console.log('    text   :', q.text.slice(0, 260))
      console.log('    attempt:', (q.attempt ?? '(none)').slice(0, 200))
    })

    expect(sheet.questions.length).toBeGreaterThan(0)
    const joined = sheet.questions.map((q) => q.text).join(' ').toLowerCase()
    expect(joined).toMatch(/deflection|beam/)

    // The page is annotated with advice on presenting engineering homework.
    // None of that is a question, and none of it is data either.
    const everything = `${joined} ${sheet.given.join(' ')}`.toLowerCase()
    expect(everything).not.toMatch(/straight edge|engineering paper|staple pages/)

    // The beam is a picture. Described here or lost — no turn after this one
    // ever sees the photo.
    expect(sheet.given.join(' ').toLowerCase(), 'the diagram was not described').toMatch(
      /beam|load|support/,
    )

    // Their working goes in `attempt`, not in the data the question leans on.
    expect(sheet.given.join(' ')).not.toMatch(/BOUNDARY CONDITIONS|C_?2\s*=\s*0/)
  }, 180_000)

  it('turns the questions it read into the lesson’s steps', async () => {
    const sheet = await readSheet('homewrk 2.gif')
    const steps = stepsFromQuestions(sheet, sheet.questions.map((q) => q.id))

    console.log('\n═══ THE PLAN ' + '═'.repeat(58))
    steps.forEach((s) => console.log(`  ${s.title}`))

    expect(steps).toHaveLength(sheet.questions.length)
    expect(steps[0].goal).toBe(sheet.questions[0].text)
    expect(steps[0].homework?.label).toBe(sheet.questions[0].label)
    // A rail entry has to fit a narrow column.
    steps.forEach((s) => expect(s.title.length).toBeLessThanOrEqual(80))
  }, 180_000)
})
