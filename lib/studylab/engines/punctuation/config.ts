// lib/studylab/engines/punctuation/config.ts
// The learner places the actual marks on a paper sentence. Its words change at once, and a small meaning scene
// answers: Grandma joins the meal or appears on the serving dish, listed foods separate onto shelf spaces, two
// complete thoughts part into two sentences, and a speech bubble closes round a speaker's exact words.
//
// Marking is only the hand-written slot rules below, never the drawing. Every passage is a short, checked instance
// of Cambridge Dictionary's punctuation and reported-speech guidance, and Purdue OWL's apostrophe guidance
// (URLs and design consequences are in research.md). Single inverted commas are used consistently for speech.
// A general sentence parser is deliberately not pretended: unknown passages get a useful fault and a working example.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PunctuationView } from './View'

export const SCENE_WIDTH = 360

export type Mark = 'comma' | 'apostrophe' | 'openQuote' | 'closeQuote' | 'fullStop' | 'question' | 'exclamation'
export type PunctConfig = { task: 'punctuate'; passage: string }
export type PunctState = { slots: (Mark | null)[]; held?: Mark | null }
export type SceneKind = 'grandma' | 'shelf' | 'weather' | 'extra' | 'dogs' | 'rain' | 'tail' | 'speech' | 'ending' | 'boundary'

export type Passage = {
  id: string
  /** Text runs between the slots. Spaces that belong to the sentence are included. */
  parts: string[]
  target: (Mark | null)[]
  start: (Mark | null)[]
  marks: Mark[]
  scene: SceneKind
  /** The visible purpose of the small picture, never a marking verdict. */
  goal: string
  right: string
  prompt: string
}

export const MARK_TEXT: Record<Mark, string> = {
  comma: ',', apostrophe: '’', openQuote: '‘', closeQuote: '’', fullStop: '.', question: '?', exclamation: '!',
}
export const MARK_NAME: Record<Mark, string> = {
  comma: 'comma', apostrophe: 'apostrophe', openQuote: 'opening speech mark', closeQuote: 'closing speech mark',
  fullStop: 'full stop', question: 'question mark', exclamation: 'exclamation mark',
}

export const PASSAGES: Passage[] = [
  {
    id: 'grandma', parts: ['Let’s eat', ' Grandma.'], target: ['comma'], start: [null], marks: ['comma'], scene: 'grandma',
    goal: 'Who is eating, and who is being eaten?',
    right: 'Yes. “Let’s eat, Grandma.” The comma shows that Grandma is being spoken to.',
    prompt: 'Drag the comma into the sentence, or tap it and then tap the gap. Make the sentence invite Grandma to eat.',
  },
  {
    id: 'packing', parts: ['I packed socks', ' sandwiches', ' fruit and a torch.'], target: ['comma', 'comma'], start: [null, null], marks: ['comma'], scene: 'shelf',
    goal: 'Each packed item needs its own place in the list.',
    right: 'Yes. “I packed socks, sandwiches, fruit and a torch.” Commas separate the items. British lists do not need one before “and”.',
    prompt: 'Drag a comma into each gap, or tap a mark and then a gap. Separate the three things in the list.',
  },
  {
    id: 'storm', parts: ['After the storm', ' we went outside.'], target: ['comma'], start: [null], marks: ['comma'], scene: 'weather',
    goal: 'Watch the opening part meet the main sentence.',
    right: 'Yes. “After the storm, we went outside.” The comma separates the opening phrase from the main sentence.',
    prompt: 'Drag the comma into the gap, or tap it and then tap the gap. Add a pause after the opening phrase.',
  },
  {
    id: 'brother', parts: ['My brother', ' who lives in Leeds', ' is visiting.'], target: ['comma', 'comma'], start: [null, null], marks: ['comma'], scene: 'extra',
    goal: 'The Leeds detail can be lifted out; the visit still makes sense.',
    right: 'Yes. Two commas enclose the extra information. The main sentence is “My brother is visiting.”',
    prompt: 'Drag a comma into each gap, or tap a mark and then a gap. Tuck the extra information inside a pair of commas.',
  },
  {
    id: 'one-dog', parts: ['The dog', 's bone is buried here.'], target: ['apostrophe'], start: [null], marks: ['apostrophe'], scene: 'dogs',
    goal: 'One dog. The bone belongs to it.',
    right: 'Yes. “The dog’s bone.” For one owner, the apostrophe comes before the s: dog → dog’s.',
    prompt: 'Drag the apostrophe into the gap, or tap it and then tap the gap. Show that the bone belongs to one dog.',
  },
  {
    id: 'two-dogs', parts: ['The dogs', ' bones are buried here.'], target: ['apostrophe'], start: [null], marks: ['apostrophe'], scene: 'dogs',
    goal: 'Two dogs. The bones belong to them.',
    right: 'Yes. “The dogs’ bones.” Dogs is already a plural ending in s, so only an apostrophe is added after it.',
    prompt: 'Drag the apostrophe into the gap, or tap it and then tap the gap. Show that the bones belong to two dogs.',
  },
  {
    id: 'raining', parts: ['It', 's raining outside.'], target: ['apostrophe'], start: [null], marks: ['apostrophe'], scene: 'rain',
    goal: 'Two words have been squeezed together: it is.',
    right: 'Yes. “It’s raining outside.” The apostrophe stands in for the missing i in “it is”.',
    prompt: 'Drag the apostrophe into the gap, or tap it and then tap the gap. Join “it” and “is”, leaving out one letter.',
  },
  {
    id: 'its-tail', parts: ['The dog wagged it', 's tail.'], target: [null], start: ['apostrophe'], marks: ['apostrophe'], scene: 'tail',
    goal: 'The tail belongs to the dog.',
    right: 'Yes. “The dog wagged its tail.” Its is a possessive pronoun, like his and hers, so it needs no apostrophe.',
    prompt: 'Tap the apostrophe in the sentence to take it away. Make the word show whose tail it is.',
  },
  {
    id: 'speech', parts: ['Maya said', ' ', 'Where is my book', '', ''], target: ['comma', 'openQuote', 'question', 'closeQuote'], start: [null, null, null, null],
    marks: ['comma', 'openQuote', 'question', 'closeQuote'], scene: 'speech',
    goal: 'The bubble holds Maya’s exact words.',
    right: 'Yes. Inverted commas enclose Maya’s speech. Her question mark sits inside them.',
    prompt: 'Drag the marks into the four gaps, or tap a mark and then a gap. Punctuate Maya’s exact words as direct speech.',
  },
  {
    id: 'asking', parts: ['Where are you going', ''], target: ['question'], start: [null], marks: ['fullStop', 'question', 'exclamation'], scene: 'ending',
    goal: 'Mia is asking. Her face is puzzled.',
    right: 'Yes. “Where are you going?” A question mark shows that Mia is asking a question.',
    prompt: 'Drag an end mark into the gap, or tap a mark and then the gap. Match the punctuation to Mia’s puzzled face.',
  },
  {
    id: 'warning', parts: ['Look out', ''], target: ['exclamation'], start: [null], marks: ['fullStop', 'question', 'exclamation'], scene: 'ending',
    goal: 'Mia is shouting a warning.',
    right: 'Yes. “Look out!” The exclamation mark shows a sudden, forceful warning.',
    prompt: 'Drag an end mark into the gap, or tap a mark and then the gap. Match the punctuation to Mia’s alarmed face.',
  },
  {
    id: 'statement', parts: ['I finished my work', ''], target: ['fullStop'], start: [null], marks: ['fullStop', 'question', 'exclamation'], scene: 'ending',
    goal: 'Mia is telling us calmly.',
    right: 'Yes. “I finished my work.” A full stop ends this calm statement.',
    prompt: 'Drag an end mark into the gap, or tap a mark and then the gap. Match the punctuation to Mia’s calm face.',
  },
  {
    id: 'boundary', parts: ['The rain stopped', ' we went outside.'], target: ['fullStop'], start: ['comma'], marks: ['comma', 'fullStop'], scene: 'boundary',
    goal: 'Both sides are complete thoughts.',
    right: 'Yes. “The rain stopped. We went outside.” A full stop separates the two complete thoughts. A comma alone would make a comma splice.',
    prompt: 'This is two complete thoughts joined by a comma. Drag the full stop to where the first thought ends, or tap it and then that gap.',
  },
]

const byId = new Map(PASSAGES.map((p) => [p.id, p]))
export function passageOf(config: PunctConfig): Passage {
  return byId.get(config.passage) ?? PASSAGES[0]
}

/** Safe state for any stored work: only marks this passage offers, one per slot. */
export function slotsOf(config: PunctConfig, state: PunctState): (Mark | null)[] {
  const p = passageOf(config)
  const raw = state && Array.isArray(state.slots) ? state.slots : []
  return p.target.map((_, i) => {
    const m = raw[i]
    return p.marks.includes(m as Mark) ? (m as Mark) : null
  })
}

export function displayParts(config: PunctConfig, state: PunctState): string[] {
  const p = passageOf(config)
  const parts = [...p.parts]
  if (p.scene === 'boundary' && slotsOf(config, state)[0] === 'fullStop') parts[1] = parts[1].replace(/^ w/, ' W')
  return parts
}

export function sentenceText(config: PunctConfig, state: PunctState, gaps = false): string {
  const parts = displayParts(config, state)
  const slots = slotsOf(config, state)
  return parts.map((part, i) => {
    const mark = i < slots.length ? (slots[i] ? MARK_TEXT[slots[i]!] : gaps ? ' [gap] ' : '') : ''
    return part + mark
  }).join('')
}

/** The observable, not a verdict. It is safe to show this before marking. */
export function meaningText(config: PunctConfig, state: PunctState): string {
  const p = passageOf(config)
  const s = slotsOf(config, state)
  switch (p.scene) {
    case 'grandma': return s[0] === 'comma' ? 'Grandma has a bowl too. She is being invited to eat.' : 'Grandma is on the serving dish. She sounds like the food.'
    case 'shelf': {
      const n = s.filter((m) => m === 'comma').length
      return n === 0 ? 'The foods are bunched together in the list.' : n === 1 ? 'One separation is made; two foods are still bunched together.' : 'Each food has its own space on the shelf.'
    }
    case 'weather': return s[0] === 'comma' ? 'There is a clear pause between the storm and going outside.' : 'The storm opening runs straight into going outside.'
    case 'extra': {
      const n = s.filter((m) => m === 'comma').length
      return n === 2 ? 'The Leeds detail is enclosed on both sides.' : n === 1 ? 'The Leeds detail is enclosed on only one side.' : 'The Leeds detail has no comma around it.'
    }
    case 'dogs': return s[0] === 'apostrophe' ? 'The owner word and the bone are linked.' : 'The owner word and the bone are not linked yet.'
    case 'rain': return s[0] === 'apostrophe' ? 'The shortened words read “it’s raining”.' : 'The full words read “it is raining”.'
    case 'tail': return s[0] === null ? 'The dog wags its tail.' : 'The written word has an apostrophe in it.'
    case 'speech': {
      const opens = s.includes('openQuote')
      const closes = s.includes('closeQuote')
      return opens && closes ? 'The speech bubble wraps Maya’s exact words.' : opens ? 'One side of the speech bubble is in place.' : closes ? 'The other side of the speech bubble is in place.' : 'Maya’s exact words are not enclosed yet.'
    }
    case 'boundary': return s[0] === 'fullStop' ? 'The two complete thoughts stand in separate sentences.' : 'One comma joins the two complete thoughts.'
    case 'ending': return s[0] ? `The words now end with a ${MARK_NAME[s[0]!]}.` : 'The words have no end mark yet.'
    default: return p.goal
  }
}

export function madeText(config: PunctConfig, state: PunctState): string {
  const empty = slotsOf(config, state).filter((m) => m === null).length
  const wrote = sentenceText(config, state, true)
  return `You wrote “${wrote}”${/[.!?]$/.test(wrote) ? '' : '.'} ${empty ? `${empty === 1 ? 'One gap is' : `${empty} gaps are`} still empty.` : 'Read the sentence and picture above.'}`
}

// ---------------------------------------------------------------------------
// Broad reading, narrow and actionable refusal.

const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').trim() : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const TOPIC_IDS: [RegExp, string][] = [
  [/grandma|direct address|address comma|vocative/, 'grandma'],
  [/list|packing|serial comma/, 'packing'],
  [/opening|introduc|starter/, 'storm'],
  [/extra information|non defining|non essential|relative clause|embedded clause/, 'brother'],
  [/plural possess|two dogs|dogs. bones/, 'two-dogs'],
  [/possess|ownership|one dog|dog.s bone/, 'one-dog'],
  [/its tail|possessive its/, 'its-tail'],
  [/contract|missing letters|omission|it is raining|it.s raining/, 'raining'],
  [/speech|inverted comma|quotation/, 'speech'],
  [/question|asking/, 'asking'],
  [/exclamation|warning/, 'warning'],
  [/statement|full stop|sentence ending/, 'statement'],
  [/run on|comma splice|sentence boundar/, 'boundary'],
]

function readPassage(raw: unknown): string | null {
  if (raw === undefined) return 'grandma'
  if (typeof raw === 'number' && Number.isFinite(raw)) return Number.isInteger(raw) && raw >= 1 && raw <= PASSAGES.length ? PASSAGES[raw - 1].id : String(raw)
  if (typeof raw !== 'string') return null
  const k = keyOf(raw)
  if (k === 'punctuate' || k === 'punctuation') return 'grandma'
  const exact = PASSAGES.find((p) => keyOf(p.id) === k || keyOf(p.parts.join('')) === k)
  if (exact) return exact.id
  const n = Number(k)
  if (Number.isInteger(n) && n >= 1 && n <= PASSAGES.length) return PASSAGES[n - 1].id
  return TOPIC_IDS.find(([re]) => re.test(k))?.[1] ?? k
}

function goodPrompt(config: PunctConfig): string {
  return passageOf(config).prompt
}

export const punctuationEngine: SceneEngine<PunctConfig, PunctState> = {
  id: 'punctuation',
  // Distinctive words only. Everything whose other words matter is a whole phrase.
  covers: ['punctuation', 'apostrophes', 'commas'],
  phrases: [
    'using commas', 'commas in lists', 'commas after opening phrases', 'commas for extra information', 'direct address commas',
    'direct speech', 'inverted commas', 'speech marks', 'quotation marks', 'punctuating speech',
    'sentence punctuation', 'sentence endings', 'full stops', 'question marks', 'exclamation marks',
    'run-on sentences', 'run on sentences', 'comma splices', 'sentence boundaries',
    'apostrophes for possession', 'possessive apostrophes', 'apostrophes for contraction', 'apostrophes for missing letters', 'its and it’s',
  ],
  notFor: [
    'spelling', 'word classes', 'parts of speech', 'nouns', 'verbs', 'adjectives', 'argument writing', 'persuasive writing', 'claim evidence',
    'punctuated equilibrium', 'musical punctuation', 'breath marks', 'decimal punctuation', 'programming punctuation', 'regular expressions',
    'semicolons', 'colons', 'dashes', 'brackets', 'reported speech tense', 'indirect speech',
  ],
  isolates: 'position',

  parse(raw) {
    if (typeof raw === 'string') return { task: 'punctuate', passage: readPassage(raw) ?? 'grandma' }
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const value = first(src, ['passage', 'item', 'example', 'sentence', 'text', 'id', 'variant', 'topic', 'focus'])
      ?? (nested ? first(src, ['kind', 'task', 'type']) : first(o, ['task', 'kind', 'type', 'mode']))
    const passage = readPassage(value)
    return passage === null ? null : { task: 'punctuate', passage }
  },

  faults(config) {
    if (byId.has(config.passage)) return []
    return [`There is no hand-checked passage called “${config.passage}”. Choose one of ${PASSAGES.map((p) => p.id).join(', ')}, or use e.g. { "task":"punctuate", "passage":"grandma" }.`]
  },

  promptFaults(config, prompt) {
    const p = passageOf(config)
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const example = goodPrompt(config)
    const solution = sentenceText(config, { slots: p.target })
    if (text.includes(solution)) out.push(`The prompt prints the completed answer (“${solution}”): give the gesture and aim, not the finished sentence (“${example}”)`)
    const placed = p.scene === 'grandma' ? /after (?:the word )?eat|before (?:the word )?Grandma/i.test(text)
      : p.id === 'one-dog' || p.id === 'two-dogs' || p.id === 'raining' ? /before (?:the )?s\b|after (?:the )?s\b|between (?:the )?[a-z] and (?:the )?s\b/i.test(text)
      : p.id === 'its-tail' ? /no apostrophe|without an apostrophe/i.test(text)
      : p.scene === 'ending' ? new RegExp(`(?:use|add|choose|needs?|with) (?:a |an |the )?${MARK_NAME[p.target[0]!]}`, 'i').test(text)
      : p.scene === 'boundary' ? /replace (?:the )?comma|change (?:the )?comma|full stop (?:after|between)/i.test(text)
      : false
    if (placed) out.push(`The prompt says where the mark belongs, which the learner is to work out from the sentence and picture: ask for the outcome only (“${example}”)`)
    if (/\b(?:type|write|rewrite|copy|spell)\b|\bchoose from four\b|\bmultiple choice\b/i.test(text)) {
      out.push(`The prompt promises typing, writing or a quiz: this card only drags or taps real marks into the sentence (“${example}”)`)
    }
    return out
  },

  initial(config) {
    return { slots: [...passageOf(config).start], held: null }
  },

  check(config, state) {
    const p = passageOf(config)
    const slots = slotsOf(config, state)
    const wrongIds = p.target.flatMap((m, i) => slots[i] === m ? [] : [String(i)])
    return { ok: wrongIds.length === 0, wrongIds }
  },

  solve(config) {
    return { slots: [...passageOf(config).target], held: null }
  },

  View: PunctuationView,

  prompt: `SCENE "punctuation" -- a real paper sentence with small gaps and a crafted light meaning picture. The learner drags a punctuation tile into a gap, or taps a tile and then a gap. Every placement visibly changes the words and the picture: a comma can turn Grandma from food into a guest, separate foods onto shelf spaces, add a pause after an opening phrase, or enclose extra information; apostrophes move within owner words or contractions; speech marks close a bubble around exact spoken words; a full stop physically parts two complete thoughts into two sentences. No correctness colour or verdict appears before marking.
  For: commas in lists, after openings, around extra information and direct address; possessive apostrophes for one or several owners; apostrophes for omitted letters and its versus it's; direct speech with inverted commas; full stops, question marks and exclamation marks; run-ons and comma splices. The act is always placing the mark, never typing or choosing a written answer.
  config: { "task":"punctuate", "passage": one of "grandma" (address comma), "packing" (2 list commas), "storm" (opening comma), "brother" (2 commas around extra information), "one-dog" (dog’s), "two-dogs" (dogs’), "raining" (it’s), "its-tail" (remove the initial apostrophe: its needs none), "speech" (4 marks: Maya said, ‘Where is my book?’), "asking", "warning", "statement" (choose the end mark from 3), "boundary" (replace an initial comma splice with a full stop).
  These are hand-written and hand-checked passages, not arbitrary text. An unknown passage is refused with the full list. Not drawn: colons, semicolons, brackets, dashes, indirect speech, spelling or word classes.
  Before marking the card shows only the sentence, marks, the picture and what the learner has made it mean. It never says right or wrong. Marking quotes the learner's exact sentence and explains the rule. Prompts must name the drag-or-tap gesture, but must NOT print the completed answer or name its position/end mark.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the comma into the sentence, or tap it and then tap the gap. Make the sentence invite Grandma to eat.",
    "payload": { "engine":"punctuation", "config": { "task":"punctuate", "passage":"grandma" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:punctuation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the apostrophe into the gap, or tap it and then tap the gap. Show that the bones belong to two dogs.",
    "payload": { "engine":"punctuation", "config": { "task":"punctuate", "passage":"two-dogs" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:punctuation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the marks into the four gaps, or tap a mark and then a gap. Punctuate Maya’s exact words as direct speech.",
    "payload": { "engine":"punctuation", "config": { "task":"punctuate", "passage":"speech" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:punctuation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"This is two complete thoughts joined by a comma. Drag the full stop to where the first thought ends, or tap it and then that gap.",
    "payload": { "engine":"punctuation", "config": { "task":"punctuate", "passage":"boundary" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:punctuation", "why":"..." } }`,
}

registerEngine(punctuationEngine as SceneEngine<unknown, unknown>)
