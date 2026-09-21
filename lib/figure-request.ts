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
import { parseFigureSpec, declaredLabels, describeFigure, hasPlaceholderLabels, type FigureSpec } from './figure-spec'
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
/**
 * Settings to hang a figure's data on.
 *
 * Asked the same focus six times at rising temperature, the model returned
 * eleven bar charts in twenty and every one of them was about juice. Apple,
 * orange, pineapple, mango, grape. Temperature moves the wording; it does not
 * move the idea. A library of seven hundred near-identical juice charts is
 * the same failure as no library.
 *
 * So the setting is named in the ask and rotated by the caller. Copying the
 * setting is the intended behaviour here -- it is the data that must vary,
 * and a list the caller walks is how it does.
 */
export const FIGURE_SETTINGS: readonly string[] = [
  'how learners travel to school', 'sports played at break', 'pets kept at home',
  'favourite school subjects', 'books borrowed from the library', 'weather over a week',
  'crops grown on a farm', 'instruments in a school band', 'fruit sold at a market',
  'languages spoken at home', 'recycling collected by class', 'birds seen in a garden',
  'heights of plants in a tray', 'water used each day', 'goals scored in a season',
  'temperature through the day', 'distance walked each day', 'shoes sold in a shop',
  'time spent on homework', 'masses of parcels at a post office',
]

export function buildFigureSpecPrompt(
  subject: string,
  level: string,
  focus: string,
  setting?: string,
): string {
  return [
    `A ${subject} question at ${level} about: ${focus}.`,
    'If a printed figure would help, describe ONE as a single JSON object. If it would not, or if the figure needed is not in the list below, return {"kind":"none"}.',
    '',
    'The only figures that can be drawn. Every <...> is a slot to fill:',
    '{"kind":"polygon","sides":3 or 4,"shape":"trapezium|rectangle|right|scalene","edges":[<length with unit>, ... one per side, clockwise from the top],"rightAngle":"bottom-left|bottom-right|none"}',
    '{"kind":"spinners","count":1 or 2,"sides":<3-10>,"fills":[<"white" or "grey">, ... one per side]}',
    '{"kind":"graph","x":{"label":<what is measured, with unit>,"min":<n>,"max":<n>,"step":<n>},"y":{same},"points":[[<x>,<y>], ...]}',
    '{"kind":"barchart","y":{"label":<what is counted>,"min":<n>,"max":<n>,"step":<n>},"bars":[{"label":<category>,"value":<n>}, ...],"xLabel":<what the categories are>}',
    '{"kind":"numberline","min":<n>,"max":<n>,"step":<n>,"marks":[{"at":<n>,"label":<letter or number>}, ...]}',
    '{"kind":"choice","options":[{"angles":[<a>,<b>,<c>]}, ...]} — 2-4 triangles side by side, lettered A on, for a "which one" question. Each set totals 180.',
    '',
    '',
    `The figure must be ABOUT ${focus}; one that is not is worse than none.`,
    'Cells, circuits, maps, apparatus, food chains, particles and the water',
    'cycle cannot be drawn here: for those, {"kind":"none"}.',
    'Every point sits inside its own axes. Labels name real things — the four',
    'metals, the four sports — never "Category A", "Item 1" or "Trial number".',
    'A number line carries one to three marks, not one per division.',
    ...(setting ? [`Where the figure carries data, make it about: ${setting}.`] : []),
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
  if (hasPlaceholderLabels(spec)) return null

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
