/**
 * Find, on a SCANNED textbook page, the figures the page asks a question about.
 *
 * Most of the Cambridge books that matter most -- Lower Secondary Science 7-9,
 * Primary Science 1-2, IGCSE Biology and Chemistry -- are scans: each page is
 * one picture with no text layer, so neither the question nor the figure's
 * edges can be read from the PDF. A vision model reads the page instead, the
 * way a person would: which figures does an exercise on this page point at,
 * where are they, and what does it ask.
 *
 * Input:  a list of {textbookId, pdf, pages?}
 * Output: data/textbook-scan-figures.raw.json (resumable) and crops under
 *         public/textbook-images/textbook-bank/<textbookId>/.
 *
 * Run with:  npx jiti scripts/locate-scanned-figures.ts <books.json> [--pages=20,45] [--only=34]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'data', 'textbook-scan-figures.raw.json')
const CROP_DIR = path.join(ROOT, 'public', 'textbook-images', 'textbook-bank')
const MODEL = process.env.SCAN_MODEL_ID || 'eu.anthropic.claude-sonnet-5-5'
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? ''

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

/** Render one page to PNG with PyMuPDF; returns the path and pixel size. */
function renderPage(pdf: string, page: number, out: string): { w: number; h: number } {
  const py = `import fitz,sys,json
d=fitz.open(sys.argv[1]);p=d[int(sys.argv[2])-1]
z=1100/max(p.rect.width,p.rect.height)
pix=p.get_pixmap(matrix=fitz.Matrix(z,z));pix.save(sys.argv[3]);print(json.dumps({"w":pix.width,"h":pix.height}))`
  return JSON.parse(execFileSync('python', ['-c', py, pdf, String(page), out]).toString())
}

/** Crop a box out of the page at print resolution. Box is in 0..1000 of the page. */
function crop(pdf: string, page: number, box: number[], out: string): { w: number; h: number } {
  const py = `import fitz,sys,json
d=fitz.open(sys.argv[1]);p=d[int(sys.argv[2])-1];b=[float(x)/1000 for x in sys.argv[3].split(',')]
r=p.rect;px=0.025;py=0.006
clip=fitz.Rect(r.x0+r.width*max(0,b[0]-px),r.y0+r.height*max(0,b[1]-py),r.x0+r.width*min(1,b[2]+px),r.y0+r.height*min(1,b[3]+py))
pix=p.get_pixmap(clip=clip,dpi=170);pix.save(sys.argv[4]);print(json.dumps({"w":pix.width,"h":pix.height}))`
  return JSON.parse(execFileSync('python', ['-c', py, pdf, String(page), box.join(','), out]).toString())
}

const PROMPT = (w: number, h: number) => [
  `This is one page of a school textbook (${w} x ${h} pixels).`,
  'Find every figure on it -- a diagram, drawing, chart, graph, table or photograph -- that an EXERCISE on this page asks the learner a question about (a numbered or lettered question, or "Look at the ... What/Which/How ...").',
  'Ignore figures no question on the page refers to, decorative pictures, icons, page furniture, and photos of people talking.',
  'For each one, give its box as [x0, y0, x1, y1] in thousandths of the page width and height (0 to 1000), tight around the figure INCLUDING its own labels and key, but NOT the question text.',
  '',
  'Reply with JSON only:',
  '{"figures": [{"box": [x0, y0, x1, y1], "question": "the exercise text that asks about it, copied exactly", "heading": "the exercise heading if any"}]}',
  'If there are none, reply {"figures": []}.',
].join('\n')

/**
 * --recrop: redo every stored crop from its box, with the current padding.
 * Labels run off sideways and question text sits above and below, so the
 * padding is wide and short; changing it costs nothing, since the boxes are kept.
 */
function recropAll(books: { id: number; pdf: string }[]) {
  const done: Record<string, any> = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  const pdfOf = new Map(books.map((b) => [b.id, b.pdf]))
  let n = 0
  for (const rec of Object.values<any>(done)) {
    const pdf = pdfOf.get(rec.textbookId)
    if (!pdf) continue
    rec.figures.forEach((f: any) => {
      const file = path.join(ROOT, 'public', f.localPath.replace(/^\//, ''))
      Object.assign(f, crop(pdf, rec.page, f.box, file))
      n++
    })
  }
  fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
  console.log(`re-cropped ${n}`)
}

async function main() {
  if (process.argv.includes('--recrop')) return recropAll(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')))
  const env = { ...loadEnv(), ...process.env } as Record<string, string>
  const client = new BedrockRuntimeClient({
    region: env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
  const books: { id: number; name: string; pdf: string }[] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const only = arg('only').split(',').filter(Boolean).map(Number)
  const done: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'scanpage-'))
  let inTok = 0, outTok = 0, kept = 0
  for (const b of books.filter((x) => !only.length || only.includes(x.id))) {
    const count = Number(execFileSync('python', ['-c', 'import fitz,sys;print(fitz.open(sys.argv[1]).page_count)', b.pdf]).toString())
    const pages = arg('pages') ? arg('pages').split(',').map(Number) : Array.from({ length: count }, (_, i) => i + 1)
    const queue = pages.filter((p) => !done[`${b.id}:${p}`])
    console.log(`${b.id} ${b.name.slice(0, 50)}: ${queue.length} page(s) to read`)
    fs.mkdirSync(path.join(CROP_DIR, String(b.id)), { recursive: true })
    const work = async (p: number) => {
      const png = path.join(tmp, `${b.id}-${p}.png`)
      const { w, h } = renderPage(b.pdf, p, png)
      const body = {
        anthropic_version: 'bedrock-2023-05-31', max_tokens: 1500,
        // Sonnet thinks at length by default; Haiku refuses the parameter.
        ...(/sonnet|opus/.test(MODEL) ? { output_config: { effort: 'low' } } : {}),
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: fs.readFileSync(png).toString('base64') } },
          { type: 'text', text: PROMPT(w, h) },
        ] }],
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await client.send(new InvokeModelCommand({ modelId: MODEL, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }))
          const out = JSON.parse(new TextDecoder().decode(res.body))
          inTok += out.usage?.input_tokens ?? 0; outTok += out.usage?.output_tokens ?? 0
          const text = String(out.content?.find((c: any) => c.type === 'text')?.text ?? '')
          const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
          const figs = (json.figures ?? []).filter((f: any) => Array.isArray(f.box) && f.box.length === 4 && String(f.question ?? '').trim())
          const rec: any[] = []
          figs.forEach((f: any, i: number) => {
            const name = `s${p}-f${i}.png`
            const size = crop(b.pdf, p, f.box, path.join(CROP_DIR, String(b.id), name))
            rec.push({ ...f, localPath: `/textbook-images/textbook-bank/${b.id}/${name}`, ...size })
            kept++
          })
          done[`${b.id}:${p}`] = { textbookId: b.id, textbookName: b.name, page: p, figures: rec }
          return
        } catch (err: any) {
          if (attempt === 2) console.log(`  page ${p} failed: ${String(err?.message ?? err).slice(0, 120)}`)
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        } finally {
          fs.rmSync(png, { force: true })
        }
      }
    }
    for (let i = 0; i < queue.length; i += 6) {
      await Promise.all(queue.slice(i, i + 6).map(work))
      fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
      if ((i / 6) % 10 === 0) console.log(`  ${Math.min(i + 6, queue.length)}/${queue.length} pages, ${kept} figures, tokens in ${inTok} out ${outTok}`)
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(done, null, 1))
  console.log(`kept ${kept} figures; tokens in ${inTok} out ${outTok}`)
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
