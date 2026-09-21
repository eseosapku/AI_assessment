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

/** What a question refers to a figure of this kind AS. */
function nounFor(spec: FigureSpec): string {
  switch (spec.kind) {
    case 'graph': return 'graph'
    case 'barchart': return 'bar chart'
    case 'numberline': return 'number line'
    case 'spinners': return 'diagram'
    case 'polygon': return 'diagram'
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
