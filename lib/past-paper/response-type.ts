/**
 * What the student has to do to answer one part of a past-paper question.
 *
 * A part is tagged and kept. Tagging does not delete it. A part that can be
 * typed is servable. A plot is held until the plot marker exists. Drawing,
 * practical work, labelling a diagram, and an essay are not generated.
 */

export const RESPONSE_TYPES = [
  'text',
  'numeric',
  'algebraic',
  'multiple_choice',
  'table_fill',
  'graph_read',
  'plot_points',
  'plot_line',
  'plot_read_off',
  'freehand_draw',
  'practical',
  'annotate_diagram',
  'extended_write',
] as const

export type ResponseType = (typeof RESPONSE_TYPES)[number]

const TYPED = new Set<ResponseType>(['text', 'numeric', 'algebraic', 'multiple_choice', 'table_fill', 'graph_read'])
const HELD = new Set<ResponseType>(['plot_points', 'plot_line', 'plot_read_off', 'extended_write'])
/** The whole unsupported list. Keyboard, mouse, or touch stays in scope. */
const UNSUPPORTED = new Set<ResponseType>(['freehand_draw', 'practical', 'annotate_diagram'])

export function isTypedAnswer(type: ResponseType): boolean {
  return TYPED.has(type)
}

export function isHeldPendingMarker(type: ResponseType): boolean {
  return HELD.has(type)
}

export function isUnsupported(type: ResponseType): boolean {
  return UNSUPPORTED.has(type)
}

const MCQ = /\bA\b[\s\S]{0,180}\bB\b[\s\S]{0,180}\bC\b[\s\S]{0,220}\bD\b/
const PART_REF = /\(([a-h]|i{1,3}|iv|vi{0,3})\)/i

export function classifyResponse(text: string): ResponseType {
  const t = String(text ?? '')
  if (/\b(carry out|perform) the experiment\b|\btake (?:your )?measurements\b/i.test(t)) return 'practical'
  if (/\blabel\b[\s\S]{0,40}\b(diagram|drawing|figure)\b/i.test(t)) return 'annotate_diagram'
  if (/\b(draw|sketch)\b[\s\S]{0,50}\b(cell|apparatus|ray diagram|circuit|field lines)\b/i.test(t)) return 'freehand_draw'
  if (/\bline of best fit\b|\bdraw a tangent\b/i.test(t)) return 'plot_line'
  if (/\bplot\b[\s\S]{0,80}\b(read|determine|find)\b/i.test(t)) return 'plot_read_off'
  if (/\b(plot|draw)\b[\s\S]{0,30}\b(graph|points)\b/i.test(t)) return 'plot_points'
  if (/\b(from the graph|read off|determine the gradient)\b/i.test(t)) return 'graph_read'
  if (MCQ.test(t)) return 'multiple_choice'
  if (/\b(complete|fill in) the table\b/i.test(t)) return 'table_fill'
  if (/\b(discuss|write an essay|write an account|to what extent)\b/i.test(t)) return 'extended_write'
  if (/\b(expression|equation|formula)\b/i.test(t) && /\b(find|write|deduce|derive|obtain)\b/i.test(t)) return 'algebraic'
  if (/\b(calculat\w*|work out|how many)\b/i.test(t)) return 'numeric'
  return 'text'
}

export interface ClassifiedPart {
  label: string | null
  response_type: ResponseType
  /** Labels this part needs from earlier parts. */
  depends_on: string[]
  /** True when this part is kept out of generation because it needs an unservable part. */
  excluded_by_dependency: boolean
  servable: boolean
}

export interface ClassifiedQuestion {
  parts: ClassifiedPart[]
  /** The printed stem needs apparatus the student does not have. */
  stem_blocked: boolean
  usable: 'full' | 'partial' | 'held' | 'none'
}

function refsIn(text: string): string[] {
  return [...String(text ?? '').matchAll(new RegExp(PART_REF, 'g'))].map((m) => m[1].toLowerCase())
}

function needsEarlierWork(text: string): boolean {
  return /using your (?:graph|line|plot|answer|value|result)|from your line of best fit|from your graph/i.test(text)
}

export function classifyQuestion(question: {
  stem?: string
  parts?: { label: string | null; text: string }[]
}): ClassifiedQuestion {
  const stem = String(question.stem ?? '')
  const stemBlocked = /you are provided with the apparatus shown/i.test(stem)
  const source = question.parts?.length
    ? question.parts.map((part) => ({ label: part.label, text: `${stem}\n${part.text}` }))
    : [{ label: null, text: stem }]

  const typed = source.map((part) => ({
    label: part.label ? part.label.toLowerCase() : null,
    response_type: classifyResponse(part.text),
    mentioned: needsEarlierWork(part.text) ? refsIn(part.text) : [],
  }))

  const byLabel = new Map(typed.filter((part) => part.label).map((part) => [part.label, part.response_type]))

  const parts: ClassifiedPart[] = typed.map((part) => {
    const depends = part.mentioned.filter((label) => label !== part.label && byLabel.has(label))
    const blocked = depends.some((label) => {
      const earlier = byLabel.get(label)
      return earlier ? isUnsupported(earlier) : false
    })
    const servable = !stemBlocked && !blocked && (isTypedAnswer(part.response_type) || isHeldPendingMarker(part.response_type))
    return {
      label: part.label,
      response_type: part.response_type,
      depends_on: depends,
      excluded_by_dependency: blocked,
      servable,
    }
  })

  const inScope = parts.filter((part) => part.servable)
  const publishable = inScope.filter((part) => isTypedAnswer(part.response_type))
  const heldOnly = inScope.length > 0 && publishable.length === 0 && inScope.every((part) => isHeldPendingMarker(part.response_type))
  const usable: ClassifiedQuestion['usable'] = stemBlocked || inScope.length === 0
    ? 'none'
    : heldOnly
      ? 'held'
      : publishable.length === parts.length
        ? 'full'
        : 'partial'

  return { parts, stem_blocked: stemBlocked, usable }
}
