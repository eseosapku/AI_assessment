/**
 * A figure described, so it can be drawn instead of found.
 *
 * Every figure fault in this codebase comes from the same place: a question is
 * written, then a picture is hunted for in a library of 22,000, and the two are
 * married on a couple of shared words. That produced Maslow's Hierarchy beside
 * a question on human reproduction, a Doppler diagram in a Mathematics paper,
 * "name the part labelled A" on a diagram with no A, and a pie chart printing
 * 90 degrees under a stem that said 108.
 *
 * None of those are matching bugs to be tuned away. They are what matching IS
 * when the thing being matched was drawn for something else.
 *
 * So: the generator writes a SPEC, the spec is drawn, and the question is
 * written against the spec. The figure cannot be from the wrong subject
 * because it was made for this question. It cannot carry a label the question
 * invents, because `declaredLabels` is what the prompt is allowed to name. Its
 * numbers cannot disagree with the stem, because the stem is written from the
 * same numbers.
 *
 * The library does not go away — it covers the kinds nothing here can draw
 * (cells, circuits, photographs, maps). This is tried first.
 */

export interface PolygonSpec {
  kind: 'polygon'
  /** 3 or 4 sides. Anything else is a shape this cannot place honestly. */
  sides: 3 | 4
  /** Edge labels, clockwise from the top edge. '' leaves an edge unlabelled. */
  edges: string[]
  /** Mark a right angle here, as the papers do with a small square. */
  rightAngle?: 'bottom-left' | 'bottom-right' | 'none'
  /** 'trapezium' and 'rectangle' for four sides; 'right' or 'scalene' for three. */
  shape?: 'trapezium' | 'rectangle' | 'right' | 'scalene'
}

export interface SpinnerSpec {
  kind: 'spinners'
  /** One or two spinners side by side. */
  count: 1 | 2
  /** 3 to 10 sides; beyond that the numbers stop fitting. */
  sides: number
  /** Shading, so a question can say "the grey spinner". */
  fills?: ('white' | 'grey')[]
}

export interface AxisSpec {
  label: string
  min: number
  max: number
  step: number
}

export interface GraphSpec {
  kind: 'graph'
  x: AxisSpec
  y: AxisSpec
  points: [number, number][]
  /** Crosses joined by straight lines is the Checkpoint convention. */
  join?: 'straight' | 'none'
}

export interface BarChartSpec {
  kind: 'barchart'
  /** The axis the bars are measured against. */
  y: AxisSpec
  /** One label and one value per bar. Four to eight bars reads well. */
  bars: { label: string; value: number }[]
  xLabel?: string
}

export interface NumberLineSpec {
  kind: 'numberline'
  min: number
  max: number
  step: number
  /** Values to mark with an arrow, each with its own letter. */
  marks?: { at: number; label: string }[]
}

/**
 * Several small figures side by side, each lettered, for a question that asks
 * which one.
 *
 * "Tick to show the triangle where a squared plus b squared equals c squared"
 * over four labelled triangles is a Checkpoint format the platform could not
 * produce at all: the options ARE the figures, so there was nothing to put in
 * an options array and nothing in the library to find. Drawing makes it
 * ordinary -- four triangles from four sets of angles, lettered A to D, and
 * the question becomes a normal multiple choice over those letters.
 */
export interface ChoiceSpec {
  kind: 'choice'
  /** Two to four options. Each is a triangle given by its three angles. */
  options: { angles: [number, number, number]; sideLabels?: string[] }[]
}

export type FigureSpec =
  | PolygonSpec | SpinnerSpec | GraphSpec | BarChartSpec | NumberLineSpec | ChoiceSpec

export const DRAWABLE_KINDS = ['polygon', 'spinners', 'graph', 'barchart', 'numberline', 'choice'] as const

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function axis(v: unknown): AxisSpec | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const min = num(o.min), max = num(o.max), step = num(o.step)
  if (min === null || max === null || step === null) return null
  if (!(max > min) || step <= 0) return null
  // A hundred gridlines is not a Checkpoint graph, it is a wall.
  if ((max - min) / step > 40) return null
  return { label: str(o.label), min, max, step }
}

/**
 * Read a spec the model wrote, or return null.
 *
 * Deliberately strict. A half-understood spec draws a wrong picture, and a
 * wrong picture is worse than none: the question is written against it either
 * way. Returning null falls back to the figure library, which is a known
 * quantity.
 */
export function parseFigureSpec(raw: unknown): FigureSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = str(o.kind)

  if (kind === 'polygon') {
    const sides = num(o.sides)
    if (sides !== 3 && sides !== 4) return null
    const edges = Array.isArray(o.edges) ? o.edges.map(str) : []
    if (edges.length !== sides) return null
    const ra = str(o.rightAngle)
    const shape = str(o.shape)
    return {
      kind: 'polygon',
      sides,
      edges,
      rightAngle: ra === 'bottom-left' || ra === 'bottom-right' ? ra : 'none',
      shape: (['trapezium', 'rectangle', 'right', 'scalene'] as const).find((x) => x === shape),
    }
  }

  if (kind === 'spinners') {
    const count = num(o.count) === 2 ? 2 : 1
    const sides = num(o.sides)
    if (sides === null || sides < 3 || sides > 10) return null
    const fills = Array.isArray(o.fills)
      ? o.fills.map((f) => (str(f) === 'grey' ? 'grey' : 'white') as 'grey' | 'white')
      : undefined
    return { kind: 'spinners', count, sides: Math.round(sides), fills }
  }

  if (kind === 'graph') {
    const x = axis(o.x), y = axis(o.y)
    if (!x || !y) return null
    const pts = Array.isArray(o.points) ? o.points : []
    const points: [number, number][] = []
    for (const p of pts) {
      if (!Array.isArray(p) || p.length < 2) continue
      const px = num(p[0]), py = num(p[1])
      if (px === null || py === null) continue
      // A point off the axes cannot be read off them.
      if (px < x.min || px > x.max || py < y.min || py > y.max) return null
      points.push([px, py])
    }
    if (points.length < 2 || points.length > 12) return null
    return { kind: 'graph', x, y, points, join: str(o.join) === 'none' ? 'none' : 'straight' }
  }

  if (kind === 'barchart') {
    const y = axis(o.y)
    if (!y) return null
    const raws = Array.isArray(o.bars) ? o.bars : []
    const bars: { label: string; value: number }[] = []
    for (const b of raws) {
      if (!b || typeof b !== 'object') continue
      const label = str((b as Record<string, unknown>).label)
      const value = num((b as Record<string, unknown>).value)
      if (!label || value === null) continue
      if (value < y.min || value > y.max) return null
      bars.push({ label, value })
    }
    if (bars.length < 2 || bars.length > 8) return null
    return { kind: 'barchart', y, bars, xLabel: str(o.xLabel) || undefined }
  }

  if (kind === 'numberline') {
    const min = num(o.min), max = num(o.max), step = num(o.step)
    if (min === null || max === null || step === null) return null
    if (!(max > min) || step <= 0 || (max - min) / step > 30) return null
    const raws = Array.isArray(o.marks) ? o.marks : []
    const marks: { at: number; label: string }[] = []
    for (const m of raws) {
      if (!m || typeof m !== 'object') continue
      const at = num((m as Record<string, unknown>).at)
      const label = str((m as Record<string, unknown>).label)
      if (at === null || !label) continue
      if (at < min || at > max) return null
      marks.push({ at, label })
    }
    // A mark on every division is a ruler. Asked for one to three marks, the
    // model returned "0, 100, 200, 300, 400, 500" on a line from 0 to 1000 --
    // drawable, on topic, and nothing a question can be asked about, because
    // there is nothing left for the learner to read off. Refused rather than
    // trimmed: trimming to the first three invents a figure nobody described.
    if (marks.length === 0 || marks.length > 3) return null
    return { kind: 'numberline', min, max, step, marks }
  }

  if (kind === 'choice') {
    const raws = Array.isArray(o.options) ? o.options : []
    const options: ChoiceSpec['options'] = []
    for (const r of raws) {
      if (!r || typeof r !== 'object') continue
      const a = (r as Record<string, unknown>).angles
      if (!Array.isArray(a) || a.length !== 3) continue
      const nums = a.map(num)
      if (nums.some((x) => x === null || (x as number) < 15 || (x as number) > 150)) continue
      // A triangle whose angles do not sum to 180 cannot be drawn, and a
      // question asking which one is right-angled needs them exact.
      const total = (nums as number[]).reduce((t, x) => t + x, 0)
      if (Math.abs(total - 180) > 0.6) continue
      const labels = Array.isArray((r as Record<string, unknown>).sideLabels)
        ? ((r as Record<string, unknown>).sideLabels as unknown[]).map(str).slice(0, 3)
        : undefined
      options.push({ angles: nums as [number, number, number], sideLabels: labels })
    }
    if (options.length < 2 || options.length > 4) return null
    return { kind: 'choice', options }
  }

  return null
}

/**
 * Is this figure labelled with placeholders rather than with things?
 *
 * Taking the worked examples out of the spec prompt fixed one fault and
 * created another: with no instance to copy, the labels went abstract —
 * "Category A, Category B, Category C, Category D", "Measurement (cm) against
 * Trial Number". Every one of those is on topic and none of them is a figure.
 * A Cambridge bar chart names the four drinks.
 *
 * Asked for in the prompt and checked here, because asking has not once been
 * enough on its own in this codebase.
 */
/**
 * A bar's category. "A" here is the fourth unnamed thing; on an axis, "d"
 * is distance, so the two lists are kept apart.
 */
const PLACEHOLDER_CATEGORY = new RegExp(
  [
    // Any noun followed by a lone A-D: "Category A", "Drink B", "Option C".
    // Naming the nouns was the first attempt and "Drink A" walked straight
    // through it -- the trailing letter is the tell, not the noun. This does
    // cost the occasional real label ("Vitamin A"), which is the cheaper
    // mistake: one draft fewer out of several hundred, and a human sees the
    // rest anyway.
    // The space is load-bearing: without it "tea" is a noun plus a trailing
    // "a", and so are soda, pasta and banana.
    String.raw`^[a-z]+\s+[a-d]$`,
    String.raw`^[a-d]$`,
    // With a digit the noun has to be one of the empty ones, or "Year 6" and
    // "Grade 5" -- which are real categories -- would go too.
    String.raw`^(?:category|item|option|group|type|class|sample|trial|test|object|thing|value)\s*[0-9]$`,
  ].join('|'),
  'i',
)

/** An axis that names no quantity. "Trial number" measures nothing. */
const PLACEHOLDER_AXIS = new RegExp(
  [
    String.raw`^(?:trial|item|sample|test)\s*(?:number|no\.?)?$`,
    String.raw`^(?:measurement|result|reading|amount|quantity|data)(?:\s*\(.*\))?$`,
  ].join('|'),
  'i',
)

export function hasPlaceholderLabels(spec: FigureSpec): boolean {
  const bad = (re: RegExp, w: unknown) => re.test(String(w ?? '').trim())
  switch (spec.kind) {
    case 'barchart':
      return spec.bars.some((b) => bad(PLACEHOLDER_CATEGORY, b.label))
        || bad(PLACEHOLDER_AXIS, spec.y.label)
        || bad(PLACEHOLDER_AXIS, spec.xLabel)
    case 'graph':
      return bad(PLACEHOLDER_AXIS, spec.x.label) || bad(PLACEHOLDER_AXIS, spec.y.label)
    default:
      return false
  }
}

/**
 * Exactly what a question may refer to in this figure.
 *
 * This is the list the prompt is given and the list the checker enforces. A
 * question naming anything else is naming something that is not there, which
 * is the fault that produced "name the part labelled A" on a diagram whose
 * labels were all words.
 */
export function declaredLabels(spec: FigureSpec): string[] {
  switch (spec.kind) {
    case 'polygon':
      return spec.edges.filter(Boolean)
    case 'spinners':
      return [
        ...(spec.count === 2 ? ['the white spinner', 'the grey spinner'] : ['the spinner']),
        ...Array.from({ length: spec.sides }, (_, i) => String(i + 1)),
      ]
    case 'graph':
      return [spec.x.label, spec.y.label].filter(Boolean)
    case 'barchart':
      return [...spec.bars.map((b) => b.label), spec.y.label].filter(Boolean)
    case 'numberline':
      return (spec.marks ?? []).map((m) => m.label)
    case 'choice':
      return spec.options.map((_, i) => String.fromCharCode(65 + i))
  }
}

/** A sentence for the prompt describing what the learner is looking at. */
export function describeFigure(spec: FigureSpec): string {
  switch (spec.kind) {
    case 'polygon': {
      const named = spec.edges.filter(Boolean)
      const shape = spec.sides === 3 ? 'triangle' : 'quadrilateral'
      return `A ${shape}${spec.rightAngle !== 'none' ? ' with a right angle marked' : ''}` +
        (named.length ? `, its sides labelled ${named.join(', ')}.` : '.')
    }
    case 'spinners':
      return spec.count === 2
        ? `Two fair ${spec.sides}-sided spinners numbered 1 to ${spec.sides}, one white and one grey.`
        : `A fair ${spec.sides}-sided spinner numbered 1 to ${spec.sides}.`
    case 'graph':
      return `A graph of ${spec.y.label || 'the y values'} against ${spec.x.label || 'the x values'}, ` +
        `with ${spec.points.length} points plotted as crosses.`
    case 'barchart':
      return `A bar chart of ${spec.y.label || 'values'} for ${spec.bars.map((b) => b.label).join(', ')}.`
    case 'numberline': {
      const marks = spec.marks ?? []
      return `A number line from ${spec.min} to ${spec.max}` +
        (marks.length ? `, with arrows labelled ${marks.map((m) => m.label).join(', ')}.` : '.')
    }
    case 'choice':
      return `${spec.options.length} triangles side by side, lettered ` +
        `${spec.options.map((_, i) => String.fromCharCode(65 + i)).join(', ')}, each with its angles marked.`
  }
}
