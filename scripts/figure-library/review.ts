// scripts/figure-library/review.ts
import fs from 'node:fs'
import path from 'node:path'
import { readJson, type Store } from './store'
import type { ImageInput } from './claude'

/**
 * The blind review: the reviewer answers each question without seeing the key, and code
 * compares. 'p1a-review' was the first run, which showed the key and let a reviewer pass
 * items it had itself called ambiguous; its verdicts stay in the store as history.
 */
export const REVIEW_JOB = 'p1a-blind'
/** Spec 3.3: a family passes a blind review of 30 items scoring 27 or better. */
export const REVIEW_SIZE = 30
export const PASS_MARK = 27
export const SHORT_FLOOR = 20
/** A figure (about 800 tokens), the prompt (about 600) and a worked check of each question (about 450 out). */
export const REVIEW_USD_PER_ITEM = 0.008

export const LEVELS: Record<string, string> = {
  P: 'Primary (ages 6 to 11)',
  LS: 'Lower Secondary (ages 11 to 14)',
  UP: 'Upper Secondary: IGCSE, senior secondary, WAEC (ages 14 to 17)',
  AL: 'AS and A Level (ages 16 to 18)',
}

/** `tolerance`: how far from the key a reading from a curve is still right, as the question states it; 0 or absent is exact. */
export interface ReviewQuestion { n: number; kind: string; stem: string; options: string[]; answer: string; accepted: string[]; tolerance?: number }
export interface ReviewItem { figureId: string; family: string; subject: string; band: string; preview: string; questions: ReviewQuestion[] }
export interface QuestionVerdict {
  n: number
  /** The answer as the key gives it, for the record and the rejection reason. */
  key: string
  ownAnswer: string
  /** Worked out in code: the reviewer's own answer is the key. */
  keyCorrect: boolean
  answerable: boolean
  /** Exactly one answer is right: for multiple choice, no other option is also right. */
  singleAnswer: boolean
  problem: string
}
export interface Verdict { pass: boolean; figureClear: boolean; educational: boolean; questions: QuestionVerdict[]; problems: string[] }

const letter = (i: number) => String.fromCharCode(65 + i)

/**
 * The words sent with the figure. Blind twice over: nothing says how the figure was made
 * or what family it is from, and no answer key is shown, so the key cannot lead the
 * reviewer's own answer.
 */
export function reviewPrompt(item: ReviewItem): string {
  const questions = item.questions.map((q) => {
    if (q.kind === 'mcq') {
      const options = q.options.map((o, i) => `   ${letter(i)}) ${o}`).join('\n')
      return `${q.n}. [multiple choice] ${q.stem}\n${options}`
    }
    return `${q.n}. [short answer] ${q.stem}`
  }).join('\n\n')
  // Only where a question states a tolerance: an exact reading's marker gives no slack, so there
  // "readings could differ by a square" stays a real objection.
  const estimate = item.questions.some((q) => (q.tolerance ?? 0) > 0)
  return [
    'You are checking one exam figure and its questions before they are given to students.',
    `Subject: ${item.subject}. Level: ${LEVELS[item.band] ?? item.band}.`,
    '',
    'The figure is attached. These are its questions:',
    '',
    questions,
    '',
    'Answer each question yourself, from the figure and the question alone, as a careful student would.',
    'Give a multiple-choice answer as its letter. Then judge:',
    '- answerable: a student at this level can answer it from the figure and the question alone; nothing is unclear or missing.',
    '- single_answer: exactly one answer is right; for multiple choice, no other option is also right.'
      + (estimate ? ' An estimate read from a graph counts as one answer when careful readings agree to within one small square, as a mark scheme accepts that range.' : ''),
    '- figure_clear: every label, number and line the questions need is legible and unambiguous; nothing overlaps or is cut off.',
    '- educational: the figure teaches or tests something real in this subject at this level.',
    '',
    'Reply with JSON only, in this shape:',
    '{"questions":[{"n":1,"worked":"one or two lines","own_answer":"...","answerable":true,"single_answer":true,"problem":""}],"figure_clear":true,"educational":true,"problems":[]}',
  ].join('\n')
}

// ".7" is 0.7; a hyphen after a digit joins a range ("12-13"), it is not a minus sign.
const NUMBER = /(?<![\d.])-?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*\d+(?:\.\d+)?)?/g

// A unit's power, read as part of the unit only where it is one (P3f final review):
// - the unit follows a number; a one-letter unit (m, s) only after a space, so "6m^5" and "1s2 2s2" stay algebra and
//   configurations;
// - the power is one a unit has: ^2, ^3, ^-1, ^-2, or written bare as m2, cm3, m/s2, m s-2;
// - nothing that reads as another unit follows it, so "1 ms–2 ms" stays a range.
const UNIT_POWER = new RegExp(
  String.raw`(\d\s?(?:[ckm]m|m\/s|m\s?s)|\d\s(?:m|s))` +
  String.raw`(?:\s?\^\s?-?[123]|(?<=[ckm]?m)[23]|(?<=\/s)2|(?<=s)-[12])` +
  String.raw`(?![\d.])(?!\s?(?:[ckm]?m|m\/s|m\s?s|s)\b)`, 'g')

/** Every number in an answer, a fraction as its value: "9/25", "18/50" and "0.36" are one answer. */
function numbersIn(text: string): number[] {
  // "1,500" and "12 800" are one number: a comma or space before exactly three digits separates thousands.
  // Standard form is one number: "4 × 10^4" and "4×10⁴" are 40000.
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  const standard = text.replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/(?<![\d./])(-?(?:\d+(?:\.\d+)?|\.\d+))\s*[×x*·]\s*10\s*(?:\^\s*(-?\d+)|([⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+))/g,
      (_, a: string, p: string | undefined, s: string | undefined) => {
      const power = p ?? s!.replace('⁻', '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => String(sup.indexOf(d)))
      return String(parseFloat((Number(a) * 10 ** Number(power)).toPrecision(12)))
    })
  // A unit's power after a number is part of the unit: "3 m/s^2", "3 m s^-2", "12 cm3" each give one number.
  const joined = standard.replace(/(\d)[, ](?=\d{3}(?!\d))/g, '$1').replace(UNIT_POWER, '$1')
  return (joined.match(NUMBER) ?? []).map((t) => {
    const [a, b] = t.split('/').map((x) => Number(x.trim()))
    return b === undefined ? a : a / b
  })
}

/** Whether every number written in `text` is `key` rounded to the places it is written to ("5.67" or "5.7" for 17/3). */
function roundsTo(text: string, key: number): boolean {
  const tokens = text.replace(/[−–—]/g, '-').replace(/(\d)[, ](?=\d{3}(?!\d))/g, '$1').match(NUMBER) ?? []
  return tokens.length > 0 && tokens.every((t) => {
    if (t.includes('/')) {
      const [a, b] = t.split('/').map((x) => Number(x.trim()))
      return Math.abs(a / b - key) < 1e-9
    }
    const places = (t.split('.')[1] ?? '').length
    return Math.abs(Number(t) - key) <= 0.5 * 10 ** -places + 1e-9
  })
}

/** Lowercased and single-spaced, without a closing full stop or a leading article. */
function words(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/[.,;:!?]+$/g, '').trim().replace(/^(?:the|an?)\s+/, '')
}

/** As `words`, each number by its value: "0.020 s" and "0.02 s" are the same form. */
function canon(text: string): string {
  return words(text).replace(/-?\d+\.\d+/g, (t) => String(Number(t)))
}

/** A letter on its own or before a bracket, stop or space: "A", "(A)", "A) Mango", "A. Mango". */
const LETTER = /^\(?([a-z])(?:[).:]|\s|$)/i

/**
 * Whether the reviewer's own answer is the key. Multiple choice: the same letter, or the
 * option's words. A numeric key: the same numbers in the same order, whatever the units
 * ("40 students", "07:30" against "7:30", "(3, -2)"); for a one-number key, every number the
 * reviewer writes is it ("1/10 (0.1)" restates it), or within the tolerance the question states
 * ("about 55 (accept 54 to 57)"). Other numbers in the accepted list are other forms of the key
 * ("80 mm" for 8 cm), never other right answers. An answer typed exactly as an accepted form is
 * right, as the student would be marked. Otherwise the same words.
 */
/** "2+", "+2", "Mg²⁺", "Cl⁻" as a size, a sign and an element; anything else, null. A key is a charge only with
 *  its sign last ("2+"): a key "-3" is a number, and "x = -3" must still read as it. */
function chargeOf(text: string, isKey = false): { size: number; sign: string; symbol: string } | null {
  const t = text.normalize('NFKC').replace(/[−–]/g, '-').replace(/\s+/g, '')
  let m = /^([A-Z][a-z]?)?(\d?)([+-])$/.exec(t)
  if (m) return { symbol: m[1] ?? '', size: Number(m[2] || 1), sign: m[3] }
  if (isKey) return null
  m = /^([+-])(\d)$/.exec(t)
  if (m) return { symbol: '', size: Number(m[2]), sign: m[1] }
  return null
}

/** "(×10¹⁴ Hz)", "x 10^14 Hz" with no number before it: a unit factor the question set (P3h fix review). */
const UNIT_FACTOR = /(?<![\d.]\s*)\(?\s*[×x*]\s?10\s?(?:\^\s?-?\d+|[⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*[A-Za-zΩμµ/]*\s*\)?/g
// A code: hexadecimal with a digit and a letter ("3F", "0x3F", "3Fh", "3F₁₆"), or letters then digits ("C4", "S03").
const CODE = /^(?:0x)?(?=[0-9a-f]*\d)[0-9a-f]*[a-f][0-9a-f]*(?:h|₁₆)?$|^[a-z]{1,3}\d{1,3}$/i
// A latitude or longitude: a number of degrees and its hemisphere ("30°N", "45° E").
const HEMISPHERE = /^(\d+(?:\.\d+)?)\s*°?\s*([NSEW])$/i

/** "about 170 g", "≈ 63.6", "approximately 60": the words that mark an estimate, not part of the answer. */
const HEDGE = /^(?:about|approximately|approx\.?|roughly|around|nearly|almost|~|≈)\s*/i

function unhedged(text: string): string {
  return text.trim().replace(HEDGE, '').trim()
}

/** `v` rounded half up to `n` significant figures. */
function sigRound(v: number, n: number): number {
  if (v === 0) return 0
  const step = 10 ** (Math.floor(Math.log10(Math.abs(v))) - n + 1)
  return Math.sign(v) * Math.floor(Math.abs(v) / step + 0.5 + 1e-9) * step
}

/**
 * Whether a part holds one number, the key rounded to the 2 or 3 (or more) significant figures it is written to:
 * "158" or "160" for 158.4, "0.63" for 0.625, "1690" for 1687.5 (P3h review). One significant figure is not
 * enough: "0" for 0.4 and "4" for 4.4 say too little to be the key.
 */
function roughly(part: string, key: number): boolean {
  const tokens = unhedged(part).replace(/[−–—]/g, '-').replace(/(\d)[, ](?=\d{3}(?!\d))/g, '$1').match(NUMBER) ?? []
  if (tokens.length !== 1 || tokens[0].includes('/')) return false
  const t = tokens[0]
  const v = Number(t)
  if (Math.abs(v - key) < 1e-9) return true
  const digits = t.replace(/^-/, '').replace('.', '').replace(/^0+/, '')
  const least = t.includes('.') ? digits.length : digits.replace(/0+$/, '').length  // "1690" may be 3 or 4 figures
  for (let n = Math.max(2, least); n <= digits.length; n++) {
    if (Math.abs(sigRound(key, n) - v) <= 1e-9 * Math.max(1, Math.abs(v))) return true
  }
  return false
}

/** The letters of a unit, with a standard form's "× 10" taken out: "11 ×10¹⁴ Hz" and "11 x 10^14 Hz" are both "hz". */
function unitOf(text: string): string {
  return text.replace(/\s?[×x*·]\s?10/gi, ' ').replace(/[^A-Za-zµμΩ°%]/g, '').toLowerCase()
}

/**
 * Whether a part is one of the accepted forms: the same words (an "about" in front aside), ending in one ("also
 * called group 15"), or the same numbers in the same unit ("11 ×10¹⁴ Hz" for "11 × 10¹⁴ Hz").
 */
function isForm(q: ReviewQuestion, part: string): boolean {
  const mine = canon(unhedged(part))
  const nums = numbersIn(part)
  return q.accepted.some((form) => {
    const c = canon(form)
    if (c === mine || mine.endsWith(' ' + c)) return true
    const theirs = numbersIn(form)
    return theirs.length > 0 && theirs.length === nums.length && theirs.every((v, i) => Math.abs(v - nums[i]) < 1e-9 * Math.max(1, Math.abs(v)))
      && unitOf(form) === unitOf(unhedged(part))
  })
}

export function agrees(q: ReviewQuestion, own: string): boolean {
  const text = own.trim()
  if (q.kind === 'mcq') {
    const key = Number(q.answer)
    const m = LETTER.exec(text)
    if (m) return m[1].toUpperCase().charCodeAt(0) - 65 === key
    return words(text) === words(q.options[key] ?? '')
  }
  // A code ("3F", "0x3F", "C4", "S03") is not its digits: "3E" read as 3 had reached "3F" (P3k). The answer
  // names exactly one code, perhaps glossed ("cell C4", "3F (hexadecimal)"), and it is one of the forms.
  if (CODE.test(q.answer.replace(/\s+/g, ''))) {
    const forms = [q.answer, ...q.accepted].map(canon)
    const codes = unhedged(text).split(/[\s,;()]+/).map((t) => t.replace(/[.:]+$/, '')).filter((t) => CODE.test(t))
    return codes.length === 1 && forms.includes(canon(codes[0]))
  }
  // A latitude or longitude is its number and its hemisphere: "30°S" read as 30 had reached "30°N" (P3m). The answer
  // names one, in letters or words ("30 degrees north"), perhaps glossed.
  const hemi = HEMISPHERE.exec(q.answer.trim())
  if (hemi) {
    const found = [...unhedged(text).toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(?:°|degrees?)?\s*(north|south|east|west|[nsew])\b/g)]
    return found.length === 1 && Number(found[0][1]) === Number(hemi[1]) && found[0][2][0] === hemi[2].toLowerCase()
  }
  // A charge or an ion ("2+", "1-", "Pb²⁺") is its size and its sign, and the element if one is named: numbers
  // alone read "2-" as "2+" (P3g final review). An answer in words ("lead(II) ions") falls to the accepted forms.
  const key = chargeOf(q.answer, true)
  if (key) {
    // "Cu2+ (copper(II) ion)", "Sodium ion, Na+", "+1 (1+)": every charge written is the key, and there is one.
    const pieces = [text, ...text.split(/[(),;]|\s+or\s+|\s+and\s+/)].map((p) => unhedged(p)).filter(Boolean)
    const found = pieces.map((p) => chargeOf(p)).filter((c): c is NonNullable<typeof c> => c !== null)
    if (found.length) return found.every((c) => c.size === key.size && c.sign === key.sign && (!key.symbol || !c.symbol || c.symbol === key.symbol))
      && found.some((c) => !key.symbol || c.symbol === key.symbol)
    return q.accepted.some((form) => canon(form) === canon(unhedged(text)))
  }
  const expected = numbersIn(q.answer)
  if (expected.length) {
    // "7 (×10¹⁴ Hz)": a power of ten with no number before it is the unit the question set, not a second number.
    const unitless = text.replace(UNIT_FACTOR, ' ').trim()
    let exact = unitless
    if (unitless.includes('≈')) {
      const at = unitless.indexOf('≈')
      const head = unitless.slice(0, at).trim()
      const tail = unitless.slice(at + 1).trim()
      // "x ≈ 1.6": a label, then the answer. "17/3 ≈ 5.67": the exact answer, then a rounding of it;
      // anything else after "≈" ("or 16/3") is a second answer and is compared with the rest.
      if (!numbersIn(head).length) exact = tail
      else if (expected.length === 1 && roundsTo(tail, expected[0])) exact = head
    }
    const mine = numbersIn(exact)
    const same = (a: number, b: number) => Math.abs(a - b) < 1e-9
    const near = (a: number) => Math.abs(a - expected[0]) <= (q.tolerance ?? 0) + 1e-9
    const reached = expected.length === 1
      ? mine.length > 0 && mine.every(near)
      : mine.length === expected.length && mine.every((v, i) => same(v, expected[i]))
    // "0.5 A (500 mA)", "R = 6 Ω": in parts at brackets, "=" and "or", each part with a number is the key
    // or one of its accepted forms. A part "or" splits off must be one too, so a hedge still fails.
    const parts = exact.split(/[()=]|\s+or\s+/).map((s) => s.trim()).filter((s) => numbersIn(s).length > 0)
    // A key of several numbers ("15:00") may be restated in brackets too ("15:00 (3 p.m.)"): one part has its numbers,
    // and every other part is one of its forms (P3m).
    const all = (part: string) => { const v = numbersIn(part); return v.length === expected.length && v.every((x, i) => same(x, expected[i])) }
    const restated = parts.length > 0 && (expected.length === 1
      ? parts.every((part) => numbersIn(part).every(near) || roughly(part, expected[0]) || isForm(q, part))
      : parts.some(all) && parts.every((part) => all(part) || isForm(q, part)))
    return reached || restated || isForm(q, text)
  }
  // "Copper (metal)", "Chlorine gas (Cl2)", "copper, deposited on electrode Y": the answer, then a gloss. The part
  // before the bracket or comma must be the key, and the gloss must not offer another answer ("or zinc").
  const forms = q.accepted.length ? q.accepted : [q.answer]
  const plain = unhedged(text)
  if (forms.some((form) => words(form) === words(plain))) return true
  const at = plain.search(/[(,]/)
  if (at > 0 && !/\bor\b/i.test(plain.slice(at))) return forms.some((form) => words(form) === words(plain.slice(0, at)))
  return false
}

/**
 * A reviewer's "not a single answer" is met by the question's own tolerance when every number it
 * wrote lies inside it (agrees() checks that): "13 or 14" is one right answer to a marker who
 * accepts 12 to 16. Only a question that states a tolerance; elsewhere the objection stands.
 */
function hedgeInside(q: ReviewQuestion, keyCorrect: boolean): boolean {
  return keyCorrect && q.kind !== 'mcq' && (q.tolerance ?? 0) > 0
}

/**
 * The reviewer's reply as a verdict. Whether each key is right is worked out here, by
 * comparing the reviewer's own answer with it; the pass is worked out from the parts and
 * never taken from the model; and a reply that leaves out an answer or a judgement is
 * refused rather than read as a pass.
 */
export function parseVerdict(raw: unknown, item: ReviewItem): Verdict {
  if (!raw || typeof raw !== 'object') throw new Error('The review is not a JSON object')
  const r = raw as { questions?: unknown; figure_clear?: unknown; educational?: unknown; problems?: unknown }
  if (typeof r.figure_clear !== 'boolean' || typeof r.educational !== 'boolean') {
    throw new Error('The review has no figure_clear or educational judgement')
  }
  const given = Array.isArray(r.questions) ? (r.questions as Record<string, unknown>[]) : []
  const questions = item.questions.map((q) => {
    const v = given.find((x) => x && Number(x.n) === q.n)
    const own = typeof v?.own_answer === 'string' || typeof v?.own_answer === 'number' ? String(v.own_answer).trim() : ''
    if (!v || !own || typeof v.answerable !== 'boolean' || typeof v.single_answer !== 'boolean') {
      throw new Error(`The review does not answer and judge question ${q.n}`)
    }
    const key = q.kind === 'mcq' ? `${letter(Number(q.answer))}) ${q.options[Number(q.answer)]}` : q.answer
    const keyCorrect = agrees(q, own)
    return {
      n: q.n, key, ownAnswer: own, keyCorrect, answerable: v.answerable, singleAnswer: v.single_answer || hedgeInside(q, keyCorrect),
      problem: String(v.problem ?? ''),
    }
  })
  const problems = Array.isArray(r.problems) ? r.problems.map(String).filter(Boolean) : []
  const pass = r.figure_clear && r.educational && questions.every((q) => q.keyCorrect && q.answerable && q.singleAnswer)
  return { pass, figureClear: r.figure_clear, educational: r.educational, questions, problems }
}

/**
 * Figures to review in a job, leaving out any already reviewed, so a stopped run carries on
 * without paying twice. Drawn families: up to `size` per family, earliest seeds first,
 * rejected ones included. Given `figureIds` (real images): those figures, with the full
 * image and only the questions `writer` wrote; one with none from that writer is left out.
 */
export function itemsToReview(db: Store, o: { job: string; size: number; families?: readonly string[]; figureIds?: readonly string[]; writer?: string }): ReviewItem[] {
  const reviewed = db.prepare('SELECT 1 FROM reviews WHERE job = ? AND figure_id = ?')
  const questionsOf = db.prepare(`SELECT n, kind, stem, options, answer, accepted, tolerance FROM figure_questions
    WHERE figure_id = ? AND (? IS NULL OR model = ?) ORDER BY n`)
  const toItem = (f: { id: string; family: string; subject: string; band: string; preview: string | null }): ReviewItem => ({
    figureId: f.id, family: f.family, subject: f.subject, band: f.band, preview: f.preview ?? '',
    questions: (questionsOf.all(f.id, o.writer ?? null, o.writer ?? null) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string; tolerance: number }[])
      .map((q) => ({ n: q.n, kind: q.kind, stem: q.stem, options: readJson<string[]>(q.options, []), answer: q.answer, accepted: readJson<string[]>(q.accepted, []), tolerance: Number(q.tolerance) || 0 })),
  })
  if (o.figureIds) {
    const pick = db.prepare(`SELECT id, COALESCE(family, origin) AS family, subject, band,
      CASE WHEN origin = 'drawn' THEN preview ELSE asset END AS preview FROM figures WHERE id = ?`)
    return o.figureIds.flatMap((id) => {
      const f = pick.get(id) as { id: string; family: string; subject: string; band: string; preview: string | null } | undefined
      if (!f || reviewed.get(o.job, id)) return []
      const item = toItem(f)
      return item.questions.length ? [item] : []
    })
  }
  const families = o.families?.length
    ? o.families
    : (db.prepare("SELECT DISTINCT family FROM figures WHERE origin = 'drawn' ORDER BY family").all() as { family: string }[]).map((r) => r.family)
  const pick = db.prepare("SELECT id, family, subject, band, preview FROM figures WHERE origin = 'drawn' AND family = ? ORDER BY seed LIMIT ?")
  const items: ReviewItem[] = []
  for (const family of families) {
    for (const f of pick.all(family, o.size) as { id: string; family: string; subject: string; band: string; preview: string | null }[]) {
      if (!reviewed.get(o.job, f.id)) items.push(toItem(f))
    }
  }
  return items
}

function reasonFor(v: Verdict): string {
  const parts = [
    ...(v.figureClear ? [] : ['figure unclear']),
    ...(v.educational ? [] : ['not educational']),
    ...v.questions
      .filter((q) => !q.keyCorrect || !q.answerable || !q.singleAnswer)
      .map((q) => {
        const why = [
          ...(q.keyCorrect ? [] : [`the reviewer answered "${q.ownAnswer}", the key is ${q.key}`]),
          ...(q.singleAnswer ? [] : ['more than one answer is right']),
          ...(q.answerable ? [] : ['not answerable from the figure']),
        ]
        return `Q${q.n}: ${why.join('; ')}${q.problem ? `: ${q.problem}` : ''}`
      }),
    ...v.problems,
  ]
  return (parts.join('; ') || 'failed review').slice(0, 600)
}

/** Records one verdict, replacing any earlier one for this job. A failed figure is rejected, with the reasons. */
export function saveVerdict(db: Store, o: { job: string; model: string; figureId: string; verdict: Verdict; mark?: boolean }): void {
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(job, figure_id) DO UPDATE SET model = excluded.model, pass = excluded.pass, detail = excluded.detail, at = excluded.at`)
      .run(o.job, o.figureId, o.model, o.verdict.pass ? 1 : 0, JSON.stringify(o.verdict), new Date().toISOString())
    // A comparison of writers judges questions, not the image: it leaves the figure's status alone.
    if (o.mark !== false) {
      if (o.verdict.pass) {
        db.prepare("UPDATE figures SET status = 'stored', reason = NULL WHERE id = ? AND status = 'rejected'").run(o.figureId)
      } else {
        db.prepare("UPDATE figures SET status = 'rejected', reason = ? WHERE id = ?").run(reasonFor(o.verdict), o.figureId)
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Recomputes every verdict in a job from what its reviewer said, under the current rules
 * (after agrees() learns another fair way of writing an answer). Nothing is sent or paid
 * for. Returns how many verdicts changed.
 */
export function regrade(db: Store, job: string, writer?: string): number {
  const rows = db.prepare('SELECT figure_id AS id, model, detail FROM reviews WHERE job = ? ORDER BY figure_id')
    .all(job) as { id: string; model: string; detail: string }[]
  const questionsOf = db.prepare('SELECT n, kind, stem, options, answer, accepted, tolerance FROM figure_questions WHERE figure_id = ? AND (? IS NULL OR model = ?)')
  let changed = 0
  for (const r of rows) {
    const v = readJson<Verdict | null>(r.detail, null)
    if (!v?.questions) continue
    const qs = (questionsOf.all(r.id, writer ?? null, writer ?? null) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string; tolerance: number }[])
      .map((q) => ({ ...q, options: readJson<string[]>(q.options, []), accepted: readJson<string[]>(q.accepted, []), tolerance: Number(q.tolerance) || 0 }))
    const questions = v.questions.map((q) => {
      const asked = qs.find((x) => x.n === q.n)
      if (!asked) return q
      const keyCorrect = agrees(asked, q.ownAnswer)
      return { ...q, keyCorrect, singleAnswer: q.singleAnswer || hedgeInside(asked, keyCorrect) }
    })
    const pass = v.figureClear && v.educational && questions.every((q) => q.keyCorrect && q.answerable && q.singleAnswer)
    if (pass !== v.pass || questions.some((q, i) => q.keyCorrect !== v.questions[i].keyCorrect)) {
      // A writer's job judges that writer's questions, never the image itself.
      saveVerdict(db, { job, model: r.model, figureId: r.id, verdict: { ...v, questions, pass }, mark: !writer })
      changed++
    }
  }
  return changed
}

export interface FamilyScore { family: string; reviewed: number; passed: number; passes: boolean }

/** Each family's score in this job. A family passes at 27 of 30; fewer than 30 reviewed is not yet a pass. */
export function familyScores(db: Store, job: string): FamilyScore[] {
  const rows = db.prepare(`SELECT f.family AS family, COUNT(*) AS reviewed, SUM(r.pass) AS passed,
      (SELECT COUNT(*) FROM figures d WHERE d.origin = 'drawn' AND d.family = f.family) AS drawn
    FROM reviews r JOIN figures f ON f.id = r.figure_id WHERE r.job = ? AND f.family IS NOT NULL GROUP BY f.family ORDER BY f.family`)
    .all(job) as { family: string; reviewed: number; passed: number; drawn: number }[]
  return rows.map((r) => {
    const reviewed = Number(r.reviewed)
    const passed = Number(r.passed)
    // A family with fewer than 30 different figures (em_spectrum has 28) passes once every one is
    // reviewed, at the same rate: 27 of 30.
    // ...but never on fewer than SHORT_FLOOR: one figure, or a draw cut short, says too little (P3f final review).
    const short = reviewed < REVIEW_SIZE && reviewed >= SHORT_FLOOR && reviewed >= Number(r.drawn)
    return {
      family: r.family,
      reviewed,
      passed,
      passes: reviewed >= REVIEW_SIZE ? passed >= PASS_MARK : short && passed * REVIEW_SIZE >= PASS_MARK * reviewed,
    }
  })
}

/**
 * Approves the drawn figures of every family that passes its blind review in this job (27 of 30):
 * all its figures not rejected, including those beyond the reviewed sample, since a family is
 * judged as a whole. P2 serves figures with status 'approved'.
 */
export function approveDrawn(db: Store, job: string): { approved: number; families: string[] } {
  const families = familyScores(db, job).filter((s) => s.passes).map((s) => s.family)
  const approve = db.prepare("UPDATE figures SET status = 'approved', reason = NULL WHERE origin = 'drawn' AND family = ? AND status <> 'rejected'")
  let approved = 0
  for (const family of families) approved += Number(approve.run(family).changes)
  return { approved, families }
}

/**
 * Passes whose reviewer still wrote a concern. The verdict stands, but a person reads
 * these before a family is approved: a reviewer has passed items it called ambiguous.
 */
export function notedPasses(db: Store, job: string): { figureId: string; notes: string }[] {
  const rows = db.prepare('SELECT figure_id AS id, detail FROM reviews WHERE job = ? AND pass = 1 ORDER BY figure_id')
    .all(job) as { id: string; detail: string }[]
  return rows.flatMap((r) => {
    const v = readJson<Partial<Verdict>>(r.detail, {})
    const notes = [...(v.problems ?? []), ...(v.questions ?? []).map((q) => q.problem)].filter(Boolean).join('; ')
    return notes ? [{ figureId: r.id, notes }] : []
  })
}

const IMAGE_TYPES: Record<string, ImageInput['mediaType']> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

/** The figure's image for a model, typed by its extension, or null when missing: then nothing is sent or paid for. */
export function previewImage(lib: string, item: Pick<ReviewItem, 'preview'>): ImageInput | null {
  if (!item.preview) return null
  const file = path.join(lib, item.preview)
  const mediaType = IMAGE_TYPES[path.extname(file).toLowerCase()]
  if (!mediaType || !fs.existsSync(file)) return null
  return { mediaType, data: fs.readFileSync(file).toString('base64') }
}

/** Questions in a job that pass on every count: the measure two writers are compared on (spec 5.5). */
export function cleanRate(db: Store, job: string): { figures: number; questions: number; clean: number; rate: number } {
  const rows = db.prepare('SELECT detail FROM reviews WHERE job = ?').all(job) as { detail: string }[]
  let questions = 0
  let clean = 0
  for (const r of rows) {
    const v = readJson<Partial<Verdict>>(r.detail, {})
    for (const q of v.questions ?? []) {
      questions++
      if (v.figureClear && v.educational && q.keyCorrect && q.answerable && q.singleAnswer) clean++
    }
  }
  return { figures: rows.length, questions, clean, rate: questions ? clean / questions : 0 }
}

/**
 * Approves real images for the library (spec 5.3: a figure is approved when it has at least one
 * kept question). Screened-in images with this writer's kept questions are approved, except:
 * questions the blind review failed are dropped (and recorded in question_checks), and an image the
 * reviewer judged unclear or not educational, or left with no question, is rejected. Images the
 * review did not sample are approved on the screen and the check alone. P2 publishes real figures
 * with status 'approved' and their figure_questions.
 */
export function approveReal(db: Store, o: { writer: string; job: string }): { approved: number; rejected: number; questionsDropped: number } {
  const figures = (db.prepare(`SELECT f.id FROM figures f JOIN screenings s ON s.figure_id = f.id AND s.keep = 1
    WHERE f.origin <> 'drawn' AND f.status <> 'rejected' AND EXISTS (SELECT 1 FROM figure_questions q WHERE q.figure_id = f.id AND q.model = ?)
    ORDER BY f.id`).all(o.writer) as { id: string }[]).map((r) => r.id)
  const review = db.prepare('SELECT detail FROM reviews WHERE job = ? AND figure_id = ?')
  const dropOne = db.prepare('DELETE FROM figure_questions WHERE figure_id = ? AND model = ? AND n = ?')
  const idOf = db.prepare('SELECT id FROM figure_questions WHERE figure_id = ? AND model = ? AND n = ?')
  const left = db.prepare('SELECT COUNT(*) AS n FROM figure_questions WHERE figure_id = ? AND model = ?')
  const record = db.prepare(`INSERT INTO question_checks (question_id, figure_id, writer, keep, reason, question, at)
    VALUES (?, ?, ?, 0, 'failed the blind review', '{}', ?)
    ON CONFLICT(question_id) DO UPDATE SET keep = 0, reason = excluded.reason, at = excluded.at`)
  const setStatus = db.prepare('UPDATE figures SET status = ?, reason = ? WHERE id = ?')
  const at = new Date().toISOString()
  let approved = 0
  let rejected = 0
  let questionsDropped = 0
  // IMMEDIATE: read-then-write in a deferred transaction fails at once (SQLITE_BUSY) while other processes
  // write, as the drawing runs do; taking the write lock first waits for them instead.
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const id of figures) {
      const row = review.get(o.job, id) as { detail: string } | undefined
      const v = row ? readJson<Partial<Verdict>>(row.detail, {}) : null
      const failing = !v ? [] : (v.figureClear && v.educational)
        ? (v.questions ?? []).filter((q) => !(q.keyCorrect && q.answerable && q.singleAnswer)).map((q) => q.n)
        : (db.prepare('SELECT n FROM figure_questions WHERE figure_id = ? AND model = ?').all(id, o.writer) as { n: number }[]).map((q) => q.n)
      for (const n of failing) {
        const q = idOf.get(id, o.writer, n) as { id: string } | undefined
        if (!q) continue
        record.run(q.id, id, o.writer, at)
        dropOne.run(id, o.writer, n)
        questionsDropped++
      }
      if (Number((left.get(id, o.writer) as { n: number }).n) > 0) {
        setStatus.run('approved', null, id)
        approved++
      } else {
        setStatus.run('rejected', 'failed the blind review', id)
        rejected++
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { approved, rejected, questionsDropped }
}
