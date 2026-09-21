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
 * Whether anything on the menu fits this focus.
 *
 * This used to be its own list of keywords, maintained beside the menu and
 * drifting from it: the menu grew circuits, force diagrams, food chains and
 * apparatus, and this still said a Physics focus was undrawable, so every one
 * of them was skipped before the menu was ever consulted. Two lists that must
 * agree are one list, so it reads the menu.
 */
export function worthDrawing(focus: unknown, subject = ''): boolean {
  return drawableKindsFor(focus, subject).length > 0
}

/**
 * What a question refers to a figure of this kind AS.
 *
 * Keyed on the kind string rather than the spec, because the approved library
 * stores the kind and not the spec that drew it -- the spec was how the
 * picture was made and nothing downstream reads it.
 */
export function nounForKind(kind: string): string {
  switch (kind) {
    case 'graph': return 'graph'
    case 'barchart': return 'bar chart'
    case 'piechart': return 'pie chart'
    case 'numberline': return 'number line'
    case 'datatable': return 'table'
    case 'circuit': return 'circuit diagram'
    case 'foodchain': return 'food chain'
    case 'grid': return 'grid'
    default: return 'diagram'
  }
}

function nounFor(spec: FigureSpec): string {
  return nounForKind(spec.kind)
}

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

/**
 * Every drawable shape, and what each one is FOR.
 *
 * The menu is chosen per question rather than printed whole, for two reasons
 * that turn out to be one reason. The prompt has a hard size budget --
 * adherence measurably falls apart as it grows -- and fourteen shapes will not
 * fit. And a Physics focus offered a spinner sometimes takes it: "the particle
 * model of solids, liquids and gases" came back as a six-sided spinner, which
 * is on the menu, drawable, and nonsense.
 *
 * So each entry carries the topics it serves, and a question is shown only the
 * few shapes that could plausibly answer it.
 */
interface Drawable {
  kind: string
  /** The JSON shape, written as slots. Never filled in -- see the commit log. */
  menu: string
  /**
   * Word STEMS this shape serves, compiled by `servesRe` below.
   *
   * A list rather than a regex because the hand-written regexes were wrong in
   * two ways at once and neither was visible. `\bfood chain\b` does not match
   * "food chains" -- the plural kills the trailing boundary -- and `\bmeasur\b`
   * cannot match anything at all, since there is no word boundary in the
   * middle of "measuring". Half the entries below were dead on arrival, which
   * is exactly the fault this codebase keeps hitting: a rule that cannot fire
   * looks identical to a rule that is never needed.
   */
  serves: readonly string[]
}

/**
 * A stem matches its own word and anything built on it: "force" matches
 * "forces", "measur" matches "measures" and "measuring", and the trailing
 * boundary that broke both is gone.
 */
const RE_CACHE = new Map<readonly string[], RegExp>()
function servesRe(stems: readonly string[]): RegExp {
  // Memoised on the list itself. Compiled fresh, fourteen regexes per focus,
  // a coverage sweep over 189 foci took two minutes — and this runs once per
  // question on the request path.
  let re = RE_CACHE.get(stems)
  if (!re) {
    re = new RegExp(`\\b(?:${stems.join('|')})[a-z]*\\b`, 'i')
    RE_CACHE.set(stems, re)
  }
  return re
}

const DRAWABLES: readonly Drawable[] = [
  {
    kind: 'polygon',
    menu: '{"kind":"polygon","sides":3 or 4,"shape":"trapezium|rectangle|right|scalene","edges":[<length with unit>, one per side clockwise from the top],"rightAngle":"bottom-left|bottom-right|none"}',
    serves: ['polygon', 'triangle', 'quadrilateral', 'rectangle', 'trapezium', 'perimeter', 'area', 'compound shape', 'right angle', 'pythagoras'],
  },
  {
    kind: 'angles',
    menu: '{"kind":"angles","arrangement":"straight-line|around-point|parallel-lines|triangle","marks":[{"at":<degrees>,"label":<the number, or a letter to find>}, ...]} - 2-4 marks, totalling 180, or 360 around a point',
    serves: ['angle', 'parallel', 'polygon', 'degree'],
  },
  {
    kind: 'grid',
    menu: '{"kind":"grid","max":<2-20>,"quadrants":1 or 4,"points":[{"x":<n>,"y":<n>,"label":<letter>}, ...],"joined":true to join them into a shape}',
    serves: ['coordinate', 'quadrant', 'straight line', 'equation of', 'reflection', 'rotation', 'translation', 'transformation', 'plot'],
  },
  {
    kind: 'spinners',
    menu: '{"kind":"spinners","count":1 or 2,"sides":<3-10>,"fills":[<"white" or "grey">, one per spinner]}',
    serves: ['spinner', 'probability', 'outcome', 'chance', 'fair dice', 'fair die', 'fair coin', 'relative frequency'],
  },
  {
    kind: 'graph',
    menu: '{"kind":"graph","x":{"label":<what is measured, with unit>,"min":<n>,"max":<n>,"step":<n>},"y":{same},"points":[[<x>,<y>], ...]}',
    serves: ['graph', 'plot', 'axes', 'line of best fit', 'relationship between', 'pattern in a set of results', 'anomalous', 'conclusion'],
  },
  {
    kind: 'barchart',
    menu: '{"kind":"barchart","y":{"label":<what is counted>,"min":<n>,"max":<n>,"step":<n>},"bars":[{"label":<category>,"value":<n>}, ...],"xLabel":<what the categories are>}',
    serves: ['bar chart', 'chart', 'frequency', 'data', 'average', 'mean', 'median', 'mode', 'range', 'compar'],
  },
  {
    kind: 'piechart',
    menu: '{"kind":"piechart","slices":[{"label":<category>,"value":<n>}, ...],"title":<what it shows>} - 2-6 slices',
    serves: ['pie chart', 'proportion', 'percentage', 'fraction of', 'share', 'data'],
  },
  {
    kind: 'datatable',
    menu: '{"kind":"datatable","columns":[<2-4 headings>],"rows":[[<cell>, one per column], ...],"title":<what it shows>} - 2-6 rows',
    serves: ['table', 'result', 'record', 'data', 'frequency', 'survey', 'measur', 'compar'],
  },
  {
    kind: 'numberline',
    menu: '{"kind":"numberline","min":<n>,"max":<n>,"step":<n>,"marks":[{"at":<n>,"label":<letter or number>}, ...]} - one to three marks, not one per division',
    serves: ['number line', 'negative number', 'place value', 'ordering', 'rounding', 'decimal', 'integer', 'scale'],
  },
  {
    kind: 'choice',
    menu: '{"kind":"choice","options":[{"angles":[<a>,<b>,<c>]}, ...]} - 2-4 triangles side by side, lettered A on, for a "which one" question. Each set totals 180.',
    serves: ['triangle', 'which one', 'identify', 'classify', 'properties of shape'],
  },
  {
    kind: 'circuit',
    menu: '{"kind":"circuit","arrangement":"series|parallel","components":[{"type":"lamp|resistor|switch|ammeter|voltmeter|motor","label":<e.g. A1>}, ...],"supply":<e.g. 6 V>} - 1-3 components',
    serves: ['circuit', 'current', 'voltage', 'resistance', 'electric', 'lamp', 'battery', 'series', 'parallel', 'conductor'],
  },
  {
    kind: 'forces',
    menu: '{"kind":"forces","object":<what the arrows act on>,"arrows":[{"direction":"up|down|left|right","label":<e.g. weight 12 N>}, ...],"surface":<what it rests on, if that matters>} - 2-4 arrows, one per direction',
    serves: ['force', 'friction', 'weight', 'gravity', 'balanced', 'unbalanced', 'air resistance', 'push', 'pull', 'motion', 'moving', 'float', 'sink', 'pressure'],
  },
  {
    kind: 'foodchain',
    menu: '{"kind":"foodchain","organisms":[<3-5 organisms, in the order energy flows>]}',
    serves: ['food chain', 'food web', 'predator', 'prey', 'producer', 'consumer', 'energy flow', 'ecosystem', 'interdependence', 'habitat'],
  },
  {
    kind: 'apparatus',
    menu: '{"kind":"apparatus","vessel":"beaker|tray|cylinder|tube","contents":<what is in it>,"ruler":true for a scale beside it,"dropped":<something held above>,"labels":[<1-4 parts, lettered A, B, C>]}',
    serves: ['apparatus', 'experiment', 'investigat', 'equipment', 'method', 'fair test', 'volume', 'mass', 'temperature', 'dissolv', 'evaporat', 'filter', 'separat', 'crater', 'measur'],
  },
]

/** Which shapes are worth offering for this focus. */
function menuFor(focus: string, subject: string): Drawable[] {
  const hay = `${focus} ${subject}`
  const fits = DRAWABLES.filter((d) => servesRe(d.serves).test(hay))
  // Five is the most the size budget takes. One good match is enough, and
  // padding it was actively harmful: "food chains and food webs" matches only
  // the food chain, and offering it three chart shapes alongside got back
  // charts. A real choice between the right shape and three wrong ones is
  // worse than no choice at all.
  if (fits.length >= 1) return fits.slice(0, 5)
  const general = DRAWABLES.filter((d) => ['barchart', 'datatable', 'graph'].includes(d.kind))
  return [...fits, ...general.filter((d) => !fits.includes(d))].slice(0, 4)
}

/**
 * The shapes that fit this focus, for callers deciding whether to ask at all.
 *
 * English draws nothing, whatever the words say. Three Reading foci matched
 * on "table" and "compar", and a bar chart printed beside a comprehension is
 * the Amelia fault from the other direction: an English figure has to belong
 * to the PASSAGE, and a drawn one never can.
 */
export function drawableKindsFor(focus: unknown, subject = ''): string[] {
  const f = String(focus ?? '')
  if (!f.trim()) return []
  if (/\benglish\b|\besl\b|\bliterature\b/i.test(subject)) return []
  const hay = `${f} ${subject}`
  return DRAWABLES.filter((d) => servesRe(d.serves).test(hay)).map((d) => d.kind)
}

export function buildFigureSpecPrompt(
  subject: string,
  level: string,
  focus: string,
  setting?: string,
): string {
  const menu = menuFor(focus, subject)
  return [
    `A ${subject} question at ${level} about: ${focus}.`,
    'If a printed figure would help, describe ONE as a single JSON object. If it would not, or if the figure needed is not below, return {"kind":"none"}.',
    '',
    'What can be drawn. Every <...> is a slot to fill:',
    ...menu.map((d) => d.menu),
    '',
    `The figure must be ABOUT ${focus}; one that is not is worse than none.`,
    'Cells, maps, the water cycle and the particle model cannot be drawn here:',
    'for those, {"kind":"none"}.',
    'Labels name real things - the four metals, the four sports - never',
    '"Category A", "Item 1" or "Trial number". Every point sits inside its axes.',
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
