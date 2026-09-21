/**
 * Asking the generator for a figure it can have drawn.
 *
 * Two calls rather than one: describe the picture, then write the question
 * against the picture that came back. The order is the point. Written the
 * other way round — question first, picture hunted for afterwards — the
 * question has already committed to detail the picture may not have, which is
 * every figure fault in this codebase.
 *
 * The spec ask is deliberately tiny. It is one JSON object with no prose
 * around it, because the measured lesson of this work is that prompt size is
 * what breaks adherence: the same model that returns clean JSON at 1,200
 * characters returned five questions of thirty-four at 26,600.
 */
import { parseFigureSpec, declaredLabels, describeFigure, type FigureSpec } from './figure-spec'
import { drawFigure } from './figure-draw'

export interface DrawnFigure {
  svg: string
  spec: FigureSpec
  /** Exactly what the question is allowed to name. */
  labels: string[]
  description: string
  /** "graph", "diagram", "number line" — what the question calls it. */
  noun: string
}

/**
 * Is it worth asking for a spec at all?
 *
 * The ask is a model call, one per figure slot, and most of them are wasted:
 * nothing here draws a cell, a circuit, a map or a food chain, so the reply is
 * "none" and the paper falls back to the library anyway. A Science paper has
 * about fifteen figure slots and perhaps three are drawable.
 *
 * So the focus is read first. Cheap, and wrong only in the safe direction —
 * a focus this does not recognise simply keeps the library figure it already
 * had, which is the behaviour that existed before any of this.
 */
const DRAWABLE_FOCUS = new RegExp(
  [
    // polygons and dimensioned shapes
    String.raw`\b(?:polygon|triangle|quadrilateral|rectangle|trapezium|perimeter|area of|compound shape|angles? in|right angle|scale drawing|pythagoras|properties of 3d|properties of shapes)\b`,
    // plotted and charted data
    String.raw`\b(?:graph|chart|plot|axes|bar chart|frequency|results table|line of best fit|relationship between)\b`,
    // probability apparatus
    String.raw`\b(?:spinner|probability|outcome|chance|fair (?:dice|die|coin))\b`,
    // the number line
    String.raw`\b(?:number line|negative numbers|place value|ordering numbers|rounding)\b`,
    // the scientific-method foci that end in a plotted result
    String.raw`\b(?:pattern in a set of results|drawing a conclusion|anomalous result|present a set of results)\b`,
  ].join('|'),
  'i',
)

export function worthDrawing(focus: unknown): boolean {
  const f = String(focus ?? '')
  return f.trim().length > 0 && DRAWABLE_FOCUS.test(f)
}

/** What a question refers to a figure of this kind AS. */
function nounFor(spec: FigureSpec): string {
  switch (spec.kind) {
    case 'graph': return 'graph'
    case 'barchart': return 'bar chart'
    case 'numberline': return 'number line'
    case 'spinners': return 'diagram'
    case 'polygon': return 'diagram'
    case 'choice': return 'diagram'
  }
}

/**
 * The prompt that asks for a spec.
 *
 * Says what can be drawn and refuses to pretend otherwise: a model asked for
 * "a diagram of a plant cell" will happily describe one, and nothing here can
 * draw it. Better an honest "none" and a figure from the library.
 */
export function buildFigureSpecPrompt(subject: string, level: string, focus: string): string {
  return [
    `A ${subject} question at ${level} about: ${focus}.`,
    'If a printed figure would help, describe ONE as a single JSON object. If it would not, or if the figure needed is not in the list below, return {"kind":"none"}.',
    '',
    'The only figures that can be drawn:',
    '{"kind":"polygon","sides":3|4,"shape":"trapezium|rectangle|right|scalene","edges":["18 cm","20 cm","30 cm","16 cm"],"rightAngle":"bottom-left|bottom-right|none"}  — edges clockwise from the top, one per side',
    '{"kind":"spinners","count":1|2,"sides":3-10,"fills":["white","grey"]}',
    '{"kind":"graph","x":{"label":"mass of marble (g)","min":0,"max":50,"step":10},"y":{"label":"diameter of crater (cm)","min":0,"max":8,"step":2},"points":[[5,1],[15,1.5],[25,2.7]]}',
    '{"kind":"barchart","y":{"label":"number of learners","min":0,"max":20,"step":5},"bars":[{"label":"walk","value":12},{"label":"bus","value":7}],"xLabel":"how they travel"}',
    '{"kind":"numberline","min":0,"max":10,"step":1,"marks":[{"at":3,"label":"A"}]}',
    '{"kind":"choice","options":[{"angles":[24,76,80]},{"angles":[56,34,90]},{"angles":[24,66,90]},{"angles":[36,64,80]}]} — several triangles side by side, lettered A onwards, for a "which one" question. Each set of angles must total 180, and the question then asks about A, B, C or D.',
    '',
    'Every point must sit inside its own axes. Every label must be one the learner can read off the drawing.',
    'Return ONLY the JSON object.',
  ].join('\n')
}

/**
 * Turn a model reply into a drawn figure, or null.
 *
 * Null is a normal outcome — most questions need no figure, and some need one
 * nothing here draws. The caller falls back to the figure library.
 */
export function drawFromReply(raw: unknown): DrawnFigure | null {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return null
    }
  }

  const spec = parseFigureSpec(parsed)
  if (!spec) return null

  const svg = drawFigure(spec)
  if (!svg) return null

  const labels = declaredLabels(spec)
  return { svg, spec, labels, description: describeFigure(spec), noun: nounFor(spec) }
}

/**
 * Does this question name something the drawn figure does not have?
 *
 * The same rule as `figure-question-match.ts`, but exact rather than inferred:
 * a drawn figure knows its own labels, so this is a list check rather than a
 * guess about what a description implies.
 */
/**
 * Has the prompt's own wording been copied into the question?
 *
 * Shipped, verbatim, to a learner:
 *
 *   "Work out the perimeter of the diagram. Refer to it as 'the diagram'.
 *    Do NOT restate what it shows."
 *   "Work out the area of the diagram. ... 10 cm | 15 cm | 10 cm | 15 cm"
 *   "Calculate the relative frequency ... walk | bus | number of learners
 *    walk | 30 bus | 70 [4]"
 *
 * The second and third are the LABEL LIST being pasted in — which is why the
 * list is no longer pipe-separated, since a pipe-separated run is exactly what
 * a model repeats when it is unsure whether a line is instruction or content.
 *
 * Rewording alone is trust rather than a fix, so this checks. A question
 * carrying the instructions is unusable whatever else is right about it.
 */
const INSTRUCTION_LEAK = new RegExp(
  [
    String.raw`\brefer to it as\b`,
    String.raw`\bdo not restate\b`,
    String.raw`\bit carries these\b`,
    String.raw`\byou may refer only\b`,
    String.raw`\bexactly as written\b`,
    String.raw`\bthe question should send\b`,
    // A run of pipe-separated fragments is the label list, not a sentence.
    // Two separators minimum, each spaced — one bare pair is "|-8| + |3|",
    // which is a modulus and a perfectly good question.
    String.raw`(?:\s\|\s[^|]{1,40}){2,}`,
  ].join('|'),
  'i',
)

export function questionLeaksInstructions(stem: unknown): boolean {
  return INSTRUCTION_LEAK.test(String(stem ?? ''))
}

export function questionNamesUndrawn(stem: unknown, figure: DrawnFigure): string[] {
  const text = String(stem ?? '')
  if (!text.trim()) return []

  const missing: string[] = []
  // Single capitals are how a figure labels a point, and the drawn ones only
  // carry those where the spec asked for them.
  for (const m of text.matchAll(/\b(?:part|point|angle|region|vertex|side|label)s?\s+(?:labell?ed\s+|marked\s+)?([A-Z])\b/g)) {
    const letter = m[1]
    if (figure.labels.includes(letter)) continue
    if (!missing.includes(letter)) missing.push(letter)
  }
  return missing
}
