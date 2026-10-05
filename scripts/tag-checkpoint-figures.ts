/**
 * Read each Checkpoint past-paper figure once, with the question it was printed
 * in, and record what it shows, which syllabus focus it serves, and whether a
 * new question can be written about it at all.
 *
 * Input:  data/checkpoint-figure-bank.raw.json   (scripts/build_checkpoint_figure_bank.py)
 * Output: data/checkpoint-figure-bank.tags.json  (resumable: done ids are skipped)
 *
 * Why a model reads the picture here when the library already has vision
 * captions: those captions were written from the picture ALONE, and a picture
 * alone is ambiguous in exactly the way that ruins a question. With the
 * question beside it there is nothing to guess -- the paper says it is "the
 * pathway of water moving through a plant", and the model's job shrinks to
 * reading the labels and saying which focus that is.
 *
 * Offline, once. Run with:  npx jiti scripts/tag-checkpoint-figures.ts [--limit=N]
 */
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { fociFor } from '../lib/checkpoint-paper'
import { CHECKPOINT_SUBJECTS } from '../lib/cambridge-checkpoint'

const ROOT = process.cwd()
const RAW = path.join(ROOT, 'data', 'checkpoint-figure-bank.raw.json')
const OUT = path.join(ROOT, 'data', 'checkpoint-figure-bank.tags.json')
const MODEL = process.env.TAG_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) ?? '').split('=')[1]) || Infinity
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').split('=')[1] || ''

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const file of ['.env', '.env.local']) {
    const p = path.join(ROOT, file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

type Raw = {
  id: string; code: string; subject: string; stage: number; component: number; session: string
  page: number; question_number: number; localPath: string; width: number; height: number
  labels: string[]; question: string
}

/** The strands a figure in this paper may be filed under, with their foci. */
function fociMenu(code: string): { strand: string; foci: readonly string[] }[] {
  const subject = CHECKPOINT_SUBJECTS.find((s) => s.code === code)
  if (!subject) return []
  return subject.strands
    .map((strand) => ({ strand, foci: fociFor(subject, strand) }))
    .filter((s) => s.foci.length > 0)
}

function prompt(f: Raw): string {
  const menu = fociMenu(f.code)
    .map((s) => `${s.strand}:\n${s.foci.map((x) => `  - ${x}`).join('\n')}`)
    .join('\n')
  const maths = f.subject === 'Mathematics'
  return [
    `This figure was cut from a Cambridge ${f.subject} Checkpoint paper (Stage ${f.stage}). New practice questions are going to be written about it by a writer who CANNOT see it and will rely entirely on what you say it shows.`,
    '',
    `Words printed on the figure: ${f.labels.length ? f.labels.join(' | ') : '(none)'}`,
    '',
    'The question it was printed in ([THIS DIAGRAM] is where it sat; [ANOTHER DIAGRAM] is a different figure):',
    '"""',
    f.question.slice(0, 2600),
    '"""',
    '',
    'Syllabus foci for this paper, by strand:',
    menu,
    '',
    'Reply with JSON only, no prose:',
    '{',
    '  "usable": true or false,',
    '  "reason": "why not, when usable is false",',
    '  "noun": "what a question would call it: diagram, graph, bar chart, pie chart, table, notice, picture, map, number line, grid, chart, drawing",',
    '  "shows": "what is drawn, in one to three plain sentences: name every labelled part and give every printed number exactly. Nothing that is not visible.",',
    '  "focus": "one focus from the list, copied exactly",',
    '  "strand": "the strand that focus is listed under",',
    '  "original": "the lines of the question that use THIS figure (its stem and the parts asking about it), copied exactly, at most 700 characters; leave out parts about other figures",',
    maths ? '  "primary_ok": true or false -- could a 10 to 11 year old (Stage 6) answer a sensible question about this figure?' : '  "primary_ok": false',
    '}',
    '',
    'usable is FALSE when any of these is true:',
    '- the crop is cut off, so part of the figure or its labels is missing',
    '- it is an empty grid, empty axes, an empty table or a blank box for the learner to draw or write in, with nothing to read off it',
    '- it only makes sense together with another figure, or with a long text that is not shown',
    '- it is part of the page rather than a figure (a header, a logo, a ruled box)',
    '- the answer to its question is printed on it',
    '- the image itself contains a sentence of the QUESTION -- a premise ("A total of 324 pizzas are sold."), a demand, an instruction or a lettered part -- rather than labels, a title, axis names, or speech bubbles the question asks about',
    '- it belongs to a listening task ("you will hear")',
  ].join('\n')
}

async function main() {
  const env = { ...loadEnv(), ...process.env } as Record<string, string>
  const client = new BedrockRuntimeClient({
    region: env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
  const raw: Raw[] = JSON.parse(fs.readFileSync(RAW, 'utf8')).figures
  const done: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}

  // Listening papers are pictures for audio the learner will never hear.
  const isListening = (f: Raw) => /English as a Second Language/.test(f.subject) && f.component === 2
  const todo = raw
    .filter((f) => !done[f.id] && !isListening(f) && (!ONLY || f.code === ONLY))
    .slice(0, LIMIT)
  console.log(`${todo.length} to tag (${Object.keys(done).length} already done) with ${MODEL}`)

  let inTok = 0
  let outTok = 0
  let n = 0
  const save = () => fs.writeFileSync(OUT, JSON.stringify(done, null, 1))

  async function tag(f: Raw) {
    const file = path.join(ROOT, 'public', f.localPath.replace(/^\//, ''))
    const data = fs.readFileSync(file).toString('base64')
    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      // Low effort: the paper has already said what the figure is, so there
      // is little to reason about, and default effort spent ~1,600 tokens a
      // figure thinking -- and ran one out of room before the JSON.
      max_tokens: 2500,
      output_config: { effort: 'low' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
          { type: 'text', text: prompt(f) },
        ],
      }],
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await client.send(new InvokeModelCommand({
          modelId: MODEL, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body),
        }))
        const out = JSON.parse(new TextDecoder().decode(res.body))
        inTok += out.usage?.input_tokens ?? 0
        outTok += out.usage?.output_tokens ?? 0
        const text = String(out.content?.[0]?.text ?? '')
        const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
        done[f.id] = JSON.parse(json)
        n++
        if (n % 20 === 0) { save(); console.log(`  ${n}/${todo.length}  tokens in ${inTok} out ${outTok}`) }
        return
      } catch (err: any) {
        if (attempt === 2) console.log(`  FAILED ${f.id}: ${String(err?.message ?? err).slice(0, 160)}`)
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
  }

  const queue = [...todo]
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) await tag(queue.shift()!)
  }))
  save()
  console.log(`tagged ${n}; tokens in ${inTok} out ${outTok}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
