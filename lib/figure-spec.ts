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

/**
 * The shapes added after seven hundred drafts turned out to be six pictures.
 *
 * The first six kinds served 25 of the 189 Checkpoint foci and 20 of those 25
 * were Mathematics, so the library came back 65% bar charts and the verdict on
 * it was "these are basically all the same kind of thing". A bar chart of pets
 * and a bar chart of sports are one figure with different words; variety of
 * LABELS is not variety of FIGURES.
 *
 * These seven are chosen for what they unlock rather than for what is easy:
 * Physics gets circuits and force diagrams, Biology gets food chains,
 * Statistics gets something that is not a bar chart, Geometry gets a grid and
 * an angle diagram, and the scientific-method strand gets the apparatus
 * drawing that started all of this -- the marble, the sand and the ruler.
 */

/** A slice chart. The one Statistics figure that is not a bar chart. */
export interface PieChartSpec {
  kind: 'piechart'
  /** Slices, in order clockwise from twelve o'clock. 2-6 of them. */
  slices: { label: string; value: number }[]
  title?: string
}

/**
 * A table of results, which is what most of a real paper's data arrives in.
 *
 * Drawn rather than written as markdown because the question is printed
 * beside it: a table the learner reads off is a figure, and one that arrives
 * as text in the stem is the thing the stem was supposed to stop doing.
 */
export interface DataTableSpec {
  kind: 'datatable'
  /** Column headings, 2-4 of them. */
  columns: string[]
  /** Rows, each as many cells as there are columns. 2-6 rows. */
  rows: string[][]
  title?: string
}

/** A circuit: a battery and components in one loop, or in two branches. */
export interface CircuitSpec {
  kind: 'circuit'
  arrangement: 'series' | 'parallel'
  /**
   * What sits in the loop, in order. 1-3 of them; a parallel circuit puts
   * them on separate branches.
   */
  components: { type: 'lamp' | 'resistor' | 'switch' | 'ammeter' | 'voltmeter' | 'motor'; label?: string }[]
  /** Printed beside the cell, e.g. "6 V". */
  supply?: string
}

/** A block with force arrows on it. The Physics figure, and unmistakable. */
export interface ForcesSpec {
  kind: 'forces'
  /** What the arrows act on. */
  object: string
  /** One arrow per direction named. 2-4 of them. */
  arrows: { direction: 'up' | 'down' | 'left' | 'right'; label: string }[]
  /** Drawn under the block when the surface matters (friction, sliding). */
  surface?: string
}

/** Boxes and arrows: producer to consumer to consumer. */
export interface FoodChainSpec {
  kind: 'foodchain'
  /** 3-5 organisms, in the order energy flows. */
  organisms: string[]
}

/**
 * A coordinate grid with points, and optionally a shape joining them.
 *
 * Covers coordinates, straight lines, and the transformations -- which
 * between them are a good slice of what Geometry actually examines and none
 * of which any of the first six shapes could draw.
 */
export interface GridSpec {
  kind: 'grid'
  /** Axis range. Symmetric about zero when `quadrants` is 4. */
  max: number
  quadrants: 1 | 4
  /** Plotted points, each optionally lettered. 1-6 of them. */
  points: { x: number; y: number; label?: string }[]
  /** Join the points into a closed shape, for the transformation questions. */
  joined?: boolean
}

/** Two lines meeting, or a transversal across parallels. */
export interface AnglesSpec {
  kind: 'angles'
  arrangement: 'straight-line' | 'around-point' | 'parallel-lines' | 'triangle'
  /**
   * The angles marked, each a number of degrees or a letter to find.
   * 2-4 of them.
   */
  marks: { at: number; label: string }[]
}

/**
 * Laboratory apparatus, drawn side-on and labelled.
 *
 * This is the figure that was asked for by name -- "the marble/crater
 * apparatus" -- and the one the first six shapes could not produce at all.
 */
export interface ApparatusSpec {
  kind: 'apparatus'
  /** The vessel the experiment happens in. */
  vessel: 'beaker' | 'tray' | 'cylinder' | 'tube'
  /** What is in it, e.g. "sand", "water". */
  contents?: string
  /** A ruler standing beside it, for a height or depth reading. */
  ruler?: boolean
  /** Something held above, e.g. "marble". */
  dropped?: string
  /** Leader-line labels, 1-4, each naming a part. */
  labels: string[]
}

export type FigureSpec =
  | PolygonSpec | SpinnerSpec | GraphSpec | BarChartSpec | NumberLineSpec | ChoiceSpec
  | PieChartSpec | DataTableSpec | CircuitSpec | ForcesSpec | FoodChainSpec | GridSpec
  | AnglesSpec | ApparatusSpec

export const DRAWABLE_KINDS = [
  'polygon', 'spinners', 'graph', 'barchart', 'numberline', 'choice',
  'piechart', 'datatable', 'circuit', 'forces', 'foodchain', 'grid', 'angles', 'apparatus',
] as const

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
/** The number in "12.5 cm", or null when the label is not a measurement. */
function lengthOf(label: string): number | null {
  const m = String(label ?? '').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Could this shape exist?
 *
 * Only checks labels that are actually measurements -- "x cm" and "a" are
 * perfectly good edge labels and say nothing about the geometry. Where every
 * side is a number, the numbers have to agree with the shape being drawn.
 */
export function polygonIsPossible(spec: PolygonSpec): boolean {
  const lengths = spec.edges.map(lengthOf)
  if (lengths.some((x) => x === null)) return true
  const n = lengths as number[]

  if (spec.sides === 4) {
    // Drawn as a rectangle, so opposite sides must match. A trapezium is
    // drawn with two unequal parallel sides and is free.
    if (spec.shape === 'rectangle') {
      return Math.abs(n[0] - n[2]) < 0.01 && Math.abs(n[1] - n[3]) < 0.01
    }
    return true
  }

  // A triangle: the two shorter sides must be longer than the longest.
  const sorted = [...n].sort((a, b) => a - b)
  if (sorted[0] + sorted[1] <= sorted[2] + 0.001) return false

  // And one marked with a right angle has to satisfy Pythagoras, near enough
  // that a reader measuring it would not object.
  const marked = spec.rightAngle && spec.rightAngle !== 'none'
  if (marked || spec.shape === 'right') {
    const [a, b, c] = sorted
    return Math.abs(a * a + b * b - c * c) <= c * c * 0.06
  }
  return true
}

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
    const spec: PolygonSpec = {
      kind: 'polygon',
      sides,
      edges,
      rightAngle: ra === 'bottom-left' || ra === 'bottom-right' ? ra : 'none',
      shape: (['trapezium', 'rectangle', 'right', 'scalene'] as const).find((x) => x === shape),
    }
    // The shape has to be possible.
    //
    // This accepted any four labels and the drawer pinned them on a real
    // rectangle, so a learner was shown a rectangle with sides 5 cm, 5 cm,
    // 3 cm and 4 cm and asked to work with it. A rectangle's opposite sides
    // are equal; a triangle's two shorter sides exceed its longest. A figure
    // that cannot exist is worse than no figure, because the question is
    // written against it either way.
    if (!polygonIsPossible(spec)) return null
    return spec
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

  if (kind === 'piechart') {
    const raws = Array.isArray(o.slices) ? o.slices : []
    const slices: { label: string; value: number }[] = []
    for (const r of raws) {
      if (!r || typeof r !== 'object') continue
      const label = str((r as Record<string, unknown>).label)
      const value = num((r as Record<string, unknown>).value)
      if (!label || value === null || value <= 0) continue
      slices.push({ label, value })
    }
    // Two slices is a chart; one is a circle, and seven is unreadable at the
    // size a paper prints it.
    if (slices.length < 2 || slices.length > 6) return null
    return { kind: 'piechart', slices, title: str(o.title) || undefined }
  }

  if (kind === 'datatable') {
    const columns = (Array.isArray(o.columns) ? o.columns : []).map(str).filter(Boolean)
    if (columns.length < 2 || columns.length > 4) return null
    const raws = Array.isArray(o.rows) ? o.rows : []
    const rows: string[][] = []
    for (const r of raws) {
      if (!Array.isArray(r)) continue
      const cells = r.map(str)
      // A ragged row draws a broken table. Pad a short one, refuse a long
      // one: the first is an omission, the second means the model was
      // describing a different table than its own headings.
      if (cells.length > columns.length) return null
      while (cells.length < columns.length) cells.push('')
      rows.push(cells)
    }
    if (rows.length < 2 || rows.length > 6) return null
    // A table with no data in it.
    //
    // "Recycling Collected by Class" shipped with Class 1 to Class 4 down the
    // side and every value cell blank, under the question "Which average best
    // represents the recycling collected by the classes?" -- which cannot be
    // answered from an empty table. Ragged rows are padded a few lines above,
    // and that padding is what let an empty one through.
    const valueCells = rows.flatMap((r) => r.slice(1))
    if (valueCells.length > 0 && valueCells.every((c) => !c.trim())) return null
    return { kind: 'datatable', columns, rows, title: str(o.title) || undefined }
  }

  if (kind === 'circuit') {
    const arrangement = str(o.arrangement) === 'parallel' ? 'parallel' : 'series'
    const TYPES = ['lamp', 'resistor', 'switch', 'ammeter', 'voltmeter', 'motor'] as const
    const raws = Array.isArray(o.components) ? o.components : []
    const components: CircuitSpec['components'] = []
    for (const r of raws) {
      if (!r || typeof r !== 'object') continue
      const t = str((r as Record<string, unknown>).type).toLowerCase()
      const type = TYPES.find((x) => x === t)
      if (!type) continue
      components.push({ type, label: str((r as Record<string, unknown>).label) || undefined })
    }
    if (components.length < 1 || components.length > 3) return null
    if (arrangement === 'parallel' && components.length < 2) return null
    return { kind: 'circuit', arrangement, components, supply: str(o.supply) || undefined }
  }

  if (kind === 'forces') {
    const object = str(o.object)
    if (!object) return null
    const DIRS = ['up', 'down', 'left', 'right'] as const
    const raws = Array.isArray(o.arrows) ? o.arrows : []
    const arrows: ForcesSpec['arrows'] = []
    const used = new Set<string>()
    for (const r of raws) {
      if (!r || typeof r !== 'object') continue
      const d = str((r as Record<string, unknown>).direction).toLowerCase()
      const direction = DIRS.find((x) => x === d)
      const label = str((r as Record<string, unknown>).label)
      // Two arrows the same way sit on top of each other.
      if (!direction || !label || used.has(direction)) continue
      used.add(direction)
      arrows.push({ direction, label })
    }
    if (arrows.length < 2 || arrows.length > 4) return null
    return { kind: 'forces', object, arrows, surface: str(o.surface) || undefined }
  }

  if (kind === 'foodchain') {
    const organisms = (Array.isArray(o.organisms) ? o.organisms : []).map(str).filter(Boolean)
    if (organisms.length < 3 || organisms.length > 5) return null
    return { kind: 'foodchain', organisms }
  }

  if (kind === 'grid') {
    const max = num(o.max)
    if (max === null || max < 2 || max > 20) return null
    const quadrants = num(o.quadrants) === 4 ? 4 : 1
    const raws = Array.isArray(o.points) ? o.points : []
    const points: GridSpec['points'] = []
    const lo = quadrants === 4 ? -max : 0
    for (const r of raws) {
      if (!r || typeof r !== 'object') continue
      const x = num((r as Record<string, unknown>).x)
      const y = num((r as Record<string, unknown>).y)
      if (x === null || y === null) continue
      // A point off the grid is the graph fault again: the question is
      // written to a coordinate the learner cannot see.
      if (x < lo || x > max || y < lo || y > max) return null
      points.push({ x, y, label: str((r as Record<string, unknown>).label) || undefined })
    }
    if (points.length < 1 || points.length > 6) return null
    const joined = o.joined === true
    if (joined && points.length < 3) return null
    return { kind: 'grid', max, quadrants, points, joined: joined || undefined }
  }

  if (kind === 'angles') {
    const ARR = ['straight-line', 'around-point', 'parallel-lines', 'triangle'] as const
    const arrangement = ARR.find((x) => x === str(o.arrangement))
    if (!arrangement) return null
    const raws = Array.isArray(o.marks) ? o.marks : []
    const marks: AnglesSpec['marks'] = []
    for (const r of raws) {
      if (!r || typeof r !== 'object') continue
      const at = num((r as Record<string, unknown>).at)
      const label = str((r as Record<string, unknown>).label)
      if (at === null || !label) continue
      if (at <= 0 || at >= 360) return null
      marks.push({ at, label })
    }
    if (marks.length < 2 || marks.length > 4) return null
    const total = marks.reduce((t, m) => t + m.at, 0)
    // The geometry has to hold, or the question has no answer. Angles on a
    // line make 180 and a triangle's do too; around a point they make 360.
    const want = arrangement === 'around-point' ? 360 : arrangement === 'parallel-lines' ? null : 180
    if (want !== null && Math.abs(total - want) > 0.6) return null
    return { kind: 'angles', arrangement, marks }
  }

  if (kind === 'apparatus') {
    const VESSELS = ['beaker', 'tray', 'cylinder', 'tube'] as const
    const vessel = VESSELS.find((x) => x === str(o.vessel).toLowerCase())
    if (!vessel) return null
    const labels = (Array.isArray(o.labels) ? o.labels : []).map(str).filter(Boolean)
    if (labels.length < 1 || labels.length > 4) return null
    return {
      kind: 'apparatus',
      vessel,
      contents: str(o.contents) || undefined,
      ruler: o.ruler === true,
      dropped: str(o.dropped) || undefined,
      labels,
    }
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
    case 'piechart':
      return spec.slices.map((x) => x.label).filter(Boolean)
    case 'datatable':
      return [...spec.columns, ...spec.rows.map((r) => r[0] ?? '')].filter(Boolean)
    case 'circuit':
      return spec.components.map((c, i) => c.label || `the ${c.type}`).concat(spec.supply ? [spec.supply] : [])
    case 'forces':
      return [spec.object, ...spec.arrows.map((a) => a.label)].filter(Boolean)
    case 'foodchain':
      return [...spec.organisms]
    case 'grid': {
      const lettered = spec.points.map((pt) => pt.label ?? '').filter(Boolean)
      // An unlettered point is still nameable — by where it is. Returning
      // nothing here left a plotted shape with no handle at all, and a
      // question cannot be written about a figure it may not refer to.
      return lettered.length ? lettered : spec.points.map((pt) => `(${pt.x}, ${pt.y})`)
    }
    case 'angles':
      return spec.marks.map((m) => m.label).filter(Boolean)
    case 'apparatus':
      return [
        // The drawing letters each part A, B, C beside its name, so both are
        // on the page and both must be nameable. Declaring only the words
        // would have `questionNamesUndrawn` reject "name the part labelled A"
        // on a figure that plainly carries an A -- which is the same check
        // that exists to catch the opposite mistake.
        ...spec.labels.map((_, i) => String.fromCharCode(65 + i)),
        ...spec.labels,
        ...(spec.dropped ? [spec.dropped] : []),
        ...(spec.contents ? [spec.contents] : []),
      ].filter(Boolean)
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
    case 'piechart':
      return `A pie chart divided into ${spec.slices.length} slices, labelled ` +
        `${spec.slices.map((x) => x.label).join(', ')}.`
    case 'datatable':
      return `A table with columns ${spec.columns.join(', ')} and ${spec.rows.length} rows of results.`
    case 'circuit': {
      const parts = spec.components.map((c) => c.label || c.type).join(', ')
      return `A ${spec.arrangement} circuit with a cell${spec.supply ? ` marked ${spec.supply}` : ''} and ${parts}.`
    }
    case 'forces':
      return `A ${spec.object} with force arrows on it, labelled ` +
        `${spec.arrows.map((a) => a.label).join(', ')}${spec.surface ? `, resting on ${spec.surface}` : ''}.`
    case 'foodchain':
      return `A food chain: ${spec.organisms.join(' to ')}, drawn as boxes joined by arrows.`
    case 'grid': {
      const named = spec.points.filter((pt) => pt.label)
      return `A coordinate grid from ${spec.quadrants === 4 ? -spec.max : 0} to ${spec.max} on both axes` +
        (named.length ? `, with points ${named.map((pt) => pt.label).join(', ')} plotted.` : `, with ${spec.points.length} points plotted.`)
    }
    case 'angles': {
      const where = spec.arrangement === 'parallel-lines' ? 'a line crossing two parallel lines'
        : spec.arrangement === 'around-point' ? 'lines meeting at a point'
        : spec.arrangement === 'triangle' ? 'a triangle'
        : 'angles on a straight line'
      return `A diagram of ${where}, with angles marked ${spec.marks.map((m) => m.label).join(', ')}.`
    }
    case 'apparatus': {
      const bits = [spec.contents ? `containing ${spec.contents}` : '', spec.ruler ? 'with a ruler beside it' : '',
        spec.dropped ? `and a ${spec.dropped} held above` : ''].filter(Boolean)
      return `A ${spec.vessel} ${bits.join(', ')}, labelled ${spec.labels.join(', ')}.`.replace(/\s+/g, ' ')
    }
  }
}
