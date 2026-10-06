/**
 * Questions about the bank's figures, written and checked ONCE, ahead of time.
 *
 * Live, a figure question is written by Nova Lite from a text description of
 * the figure -- it never sees the picture -- and is not checked. A blind
 * review found the figures right and the questions wrong: a misread
 * stem-and-leaf median, "positive phototropism" accepted for gravity. The
 * figures are a fixed set, so their questions need not be written live:
 *
 *   write  -- Nova Lite, LOOKING AT the figure, three questions per figure
 *             (multiple choice, short answer, written);
 *   check  -- Sonnet, looking at the figure, works each one out: is it
 *             answerable from the figure, is the key right, is it at the
 *             level, does it give itself away. Fixed where it can be,
 *             dropped where it cannot.
 *
 * Variants, for the comparison that decides whether this is worth it:
 *   --variant=A  Nova, description only, unchecked  (what quizzes do today)
 *   --variant=B  Nova, sees the figure, unchecked   (step 2's writer alone)
 *   --variant=C  Nova sees it, Sonnet checks it      (the bank)
 *
 * Run with:  npx jiti scripts/build-figure-question-bank.ts --variant=C --books=34 [--limit=25] [--out=...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { buildTextbookFigurePrompt, type FigureQuestionKind } from '../lib/textbook-figure-prompt'
import { subjectOfBook as subjectOf, levelOfBook as levelOf } from '../lib/book-level'
import { stageOfBook, type TextbookFigure } from '../lib/textbook-figure-bank'

const ROOT = process.cwd()
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''
const VARIANT = (arg('variant') || 'C').toUpperCase()
const WRITER = process.env.WRITER_MODEL_ID || 'eu.amazon.nova-lite-v1:0'
const CHECKER = process.env.CHECKER_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const OUT = arg('out') || path.join(ROOT, 'data', 'figure-question-bank.json')
/** Variant D checks strictly: ok or drop, never patched. */
const STRICT = VARIANT === 'D'

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-west-1',
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
})
let usage = { novaIn: 0, novaOut: 0, checkIn: 0, checkOut: 0 }

function image(f: TextbookFigure): { bytes: string; format: 'png' | 'jpeg' } {
  const file = path.join(ROOT, 'public', f.localPath.replace(/^\//, ''))
  // From the bytes, not the name: some library ".png" files are JPEGs.
  const data = fs.readFileSync(file)
  const png = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
  return { bytes: data.toString('base64'), format: png ? 'png' : 'jpeg' }
}
function firstJson(text: string): any {
  const t = String(text ?? '')
  const s = t.indexOf('{')
  const e = t.lastIndexOf('}')
  if (s < 0 || e < s) return null
  try {
    const j = JSON.parse(t.slice(s, e + 1))
    return Array.isArray(j?.questions) ? j.questions[0] : j
  } catch { return null }
}

async function write(f: TextbookFigure, kind: FigureQuestionKind, id: number, seeImage: boolean): Promise<any | null> {
  const prompt = buildTextbookFigurePrompt({
    subject: subjectOf(f.textbookName), level: levelOf(f.textbookName), topic: f.topic, id, kind,
    marks: kind === 'written' ? 2 : undefined,
    figure: { noun: f.noun, shows: f.shows, labels: f.labels, original: f.original },
  }) + (seeImage ? `\n\nThe ${f.noun} itself is attached: read it directly, and trust it over the description above.` : '')
  const img = image(f)
  const content: any[] = seeImage ? [{ image: { format: img.format, source: { bytes: img.bytes } } }, { text: prompt }] : [{ text: prompt }]
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.send(new InvokeModelCommand({
        modelId: WRITER, contentType: 'application/json', accept: 'application/json',
        body: JSON.stringify({ messages: [{ role: 'user', content }], inferenceConfig: { maxTokens: 900, temperature: 0.3 } }),
      }))
      const out = JSON.parse(new TextDecoder().decode(res.body))
      usage.novaIn += out.usage?.inputTokens ?? 0
      usage.novaOut += out.usage?.outputTokens ?? 0
      const q = firstJson(out.output?.message?.content?.[0]?.text)
      if (q && String(q.question ?? '').trim()) return { ...q, id }
    } catch { /* asked again below */ }
  }
  return null
}

/**
 * Variant D's writer: Sonnet, looking at the figure. Nova wrote 74 questions
 * with the figure in front of it and only 17 were right as written -- seeing
 * the picture did not make it read the picture.
 */
async function writeWithClaude(f: TextbookFigure, kind: FigureQuestionKind, id: number): Promise<any | null> {
  const prompt = buildTextbookFigurePrompt({
    subject: subjectOf(f.textbookName), level: levelOf(f.textbookName), topic: f.topic, id, kind,
    marks: kind === 'written' ? 2 : undefined,
    figure: { noun: f.noun, shows: f.shows, labels: f.labels, original: f.original },
  }) + `\n\nThe ${f.noun} itself is attached. Read it directly and trust it over the description. Work the answer out yourself before writing the key, and make every mark-scheme point something the question actually asks for.`
  const img = image(f)
  const body = {
    anthropic_version: 'bedrock-2023-05-31', max_tokens: 2500, output_config: { effort: 'low' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: img.format === 'png' ? 'image/png' : 'image/jpeg', data: img.bytes } },
      { type: 'text', text: prompt },
    ] }],
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.send(new InvokeModelCommand({ modelId: CHECKER, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
      const out = JSON.parse(new TextDecoder().decode(res.body))
      usage.novaIn += out.usage?.input_tokens ?? 0
      usage.novaOut += out.usage?.output_tokens ?? 0
      const q = firstJson(out.content?.find((c: any) => c.type === 'text')?.text)
      if (q && String(q.question ?? '').trim()) return { ...q, id }
    } catch (e: any) { noteFailure(e) }
  }
  return null
}

const failures = new Set<string>()
/** Each kind of failure once. Swallowed whole, 156 figures failed twice over with nothing to say why. */
function noteFailure(e: any): void {
  const msg = `${e?.name ?? 'Error'}: ${String(e?.message ?? e).slice(0, 160)}`
  if (failures.has(msg)) return
  failures.add(msg)
  console.error(`  call failed -- ${msg}`)
}

const CHECK = (f: TextbookFigure, q: any) => [
  `You are a strict examiner checking a question written about the attached figure from a ${subjectOf(f.textbookName)} textbook, for a learner at ${levelOf(f.textbookName)}.`,
  'The learner sees ONLY the figure and the question text. Work the answer out yourself from the figure: read every value, do every calculation, check the science.',
  '',
  'The question, as JSON:',
  JSON.stringify(q, null, 1),
  '',
  'It FAILS if: it cannot be answered from the figure plus knowledge expected at this level; the key, correct_answer index, accepted answers or mark scheme is wrong, incomplete for its marks, or rejects an obviously correct answer; more than one option is correct; the answer is printed on the figure or stated in the question; it names a label or value the figure does not show; it is above or below the level; it is ambiguous.',
  ...(STRICT ? [
    'Also FAILS if: a mark-scheme point rewards something the question does not ask for (an explanation it never requested); the mark scheme does not state the actual answer; a reading off a dial, scale, screen or graph cannot be made to the precision the key claims; two labels could both be the answer; the accepted answers miss a common correct form (a unit, a synonym); it tests only looking, not the subject.',
    'Be the harshest examiner you know. When in doubt, it fails.',
  ] : []),
  '',
  'Reply with JSON only:',
  ...(STRICT
    ? ['{"verdict": "ok" | "drop", "reason": "one sentence"}', 'There is no "fix": a question is right as written or it is dropped.']
    : ['{"verdict": "ok" | "fix" | "drop", "reason": "one sentence", "fixed": { only the fields that need correcting, e.g. "correct_answer", "options", "short_answer", "marking_criteria", "question", "explanation" } }',
       '"fix" only when a small correction to those fields makes it right; otherwise "drop".']),
].join('\n')

async function check(f: TextbookFigure, q: any): Promise<{ verdict: string; reason: string; question: any } | null> {
  const img = image(f)
  const body = {
    anthropic_version: 'bedrock-2023-05-31', max_tokens: STRICT ? 6000 : 2000, output_config: { effort: STRICT ? 'medium' : 'low' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: img.format === 'png' ? 'image/png' : 'image/jpeg', data: img.bytes } },
      { type: 'text', text: CHECK(f, q) },
    ] }],
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.send(new InvokeModelCommand({ modelId: CHECKER, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
      const out = JSON.parse(new TextDecoder().decode(res.body))
      usage.checkIn += out.usage?.input_tokens ?? 0
      usage.checkOut += out.usage?.output_tokens ?? 0
      const j = firstJson(out.content?.find((c: any) => c.type === 'text')?.text)
      if (!j?.verdict) continue
      const fixed = j.verdict === 'fix' && j.fixed && typeof j.fixed === 'object' ? { ...q, ...j.fixed } : q
      return { verdict: String(j.verdict), reason: String(j.reason ?? ''), question: fixed }
    } catch { /* asked again */ }
  }
  return null
}

async function main() {
  const books = arg('books').split(',').filter(Boolean).map(Number)
  // --source=checkpoint: the past-paper figures, read into the same shape. A
  // Checkpoint figure has a code and a stage where a textbook figure has a
  // book, so it is given a book-like name the level and subject come from.
  const CHECKPOINT_NAMES: Record<string, string> = {
    '0893': 'Cambridge Lower Secondary Science 9', '0097': 'Cambridge Primary Science 6',
    '0862': 'Cambridge Lower Secondary Mathematics Stage 9', '0096': 'Cambridge Primary Mathematics Stage 6',
    '0876': 'Cambridge Lower Secondary English as a Second Language Stage 9', '0057': 'Cambridge Primary English as a Second Language Stage 6',
  }
  const bank: TextbookFigure[] = arg('source') === 'checkpoint'
    ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'checkpoint-figure-bank.json'), 'utf8')).figures.map((f: any) => ({
        id: f.id, textbookIds: [], textbookName: CHECKPOINT_NAMES[f.code] ?? 'Cambridge Checkpoint', page: 0,
        localPath: f.localPath, noun: f.noun, shows: f.shows, labels: f.labels, topic: f.focus, original: f.original,
      }))
    : JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'textbook-figure-bank.json'), 'utf8')).figures
  // --skip-igcse: the IGCSE books, held back until approved.
  let figures = bank
    .filter((f) => !books.length || f.textbookIds.some((id) => books.includes(id)))
    .filter((f) => !process.argv.includes('--skip-igcse') || !/igcse|o level/i.test(f.textbookName))
    // --only-igcse: the IGCSE books on their own, into their own file.
    .filter((f) => !process.argv.includes('--only-igcse') || /igcse|o level/i.test(f.textbookName))
  if (arg('limit')) {
    // An even spread through the book, not its first chapter.
    const n = Number(arg('limit'))
    const step = Math.max(1, Math.floor(figures.length / n))
    figures = figures.filter((_, i) => i % step === 0).slice(0, n)
  }
  const done: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const kinds: FigureQuestionKind[] = ['mcq', 'short', 'written']
  const todo = figures.filter((f) => !done[f.id])
  console.log(`variant ${VARIANT}: ${todo.length} figure(s) to do (${Object.keys(done).length} done)`)
  let n = 0
  const queue = todo.map((f, i) => ({ f, i }))
  await Promise.all(Array.from({ length: Number(arg('parallel')) || 5 }, async () => {
    while (queue.length) {
      const { f, i } = queue.shift()!
      const rec: any = { figureId: f.id, localPath: f.localPath, textbookIds: f.textbookIds, topic: f.topic, questions: [] }
      if (VARIANT === 'A' || VARIANT === 'B') {
        const kind = kinds[i % kinds.length]
        const q = await write(f, kind, 1, VARIANT === 'B')
        if (q) rec.questions.push({ kind, question: q })
      } else {
        for (const kind of kinds) {
          const q = VARIANT === 'D' ? await writeWithClaude(f, kind, 1) : await write(f, kind, 1, true)
          if (!q) continue
          const c = await check(f, q)
          if (!c) continue
          rec.questions.push({ kind, verdict: c.verdict, reason: c.reason, question: c.question, kept: c.verdict !== 'drop' })
        }
      }
      // Nothing written at all means the calls failed (throttling, a
      // dropped connection), not that the figure has no questions in it --
      // left undone, so the next run tries it again.
      if (!rec.questions.length) continue
      done[f.id] = rec
      n++
      if (n % 10 === 0) { fs.writeFileSync(OUT, JSON.stringify(done, null, 1)); console.log(`  ${n}/${todo.length}  usage ${JSON.stringify(usage)}`) }
    }
  }))
  fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
  const all = Object.values<any>(done).flatMap((r) => r.questions)
  const kept = all.filter((q) => q.kept !== false).length
  console.log(`done ${n}; questions ${all.length}, kept ${kept}; verdicts ${JSON.stringify(all.reduce((a: any, q: any) => { a[q.verdict ?? 'unchecked'] = (a[q.verdict ?? 'unchecked'] ?? 0) + 1; return a }, {}))}`)
  console.log(`usage ${JSON.stringify(usage)}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
