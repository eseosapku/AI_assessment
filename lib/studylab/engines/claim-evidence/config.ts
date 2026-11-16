// lib/studylab/engines/claim-evidence/config.ts
//
// A claim, a handful of drawn evidence cards and a real balance. The learner picks a card up and puts it on a pan:
// the left pan for evidence that supports the claim, the right pan for evidence against it, and a card that has
// nothing to do with the claim stays off the scale. The beam tips as each card goes on, by the card's strength,
// so the learner watches a case build.
//
// The rules, all computed here and never read from the drawing:
//   a card is right when it sits on the pan the config names for it (or stays off when the config says it bears
//   on nothing); the tilt is only the sum of strengths on each pan, and marking never looks at it.
// What is NOT marked: whether the claim is true, or which side "wins". Weighing is a judgement and the card says so
// once marked. Only what the config can settle is marked: the side each piece of evidence is on.
//
// Ideas taken, never code or art:
//   - the see-saw writing frame, where each argument is scored out of 3 and each side is added up (TES "Weighing up
//     arguments" resource): hence strength 1-3 and a balance that adds them;
//   - the classroom finding that students treat any fact as supporting any claim, and that they confuse "I agree"
//     with "this is evidence for it" (CER lesson write-ups, Montana State and OU K20 pages): hence cards that bear on
//     nothing, and a verdict that is not marked;
//   - the PEEL habit of "quote and run": evidence dropped with no link to the point (GCSE English guides): the card
//     makes the learner decide which way each piece of evidence points before any paragraph is written.
// Refused:
//   - writing or ordering PEEL sentences on this card: ordering is recognition, and free text cannot be marked here;
//   - marking the verdict or the strongest card: arguable, so never the only right answer;
//   - dragging: two taps are enough and never fiddly (a card, then a pan).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ClaimEvidenceView } from './View'

export type Side = 'for' | 'against' | 'neither'
export type Card = { text: string; side: Side; strength: number }
export type ArgConfig = { claim: string; cards: Card[] }
/** Where the learner has put each card, by its place in the config: a pan, or null for off the scale. */
export type ArgState = { put: ('for' | 'against' | null)[] }

export const MIN_CARDS = 4
export const MAX_CARDS = 6
export const MAX_NEITHER = 2
export const MAX_CARD_TEXT = 50
export const MAX_CLAIM = 100
/** Degrees of tilt for each unit of strength between the pans, and the most the beam swings. */
export const DEG_PER_UNIT = 3
export const MAX_TILT = 12

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

// ---------------------------------------------------------------------------
// Rules

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** The order the cards are laid out in: shuffled from their own words, so the tutor's order and the tab order tell nothing. */
export function displayOrder(config: ArgConfig): number[] {
  return config.cards.map((_, i) => i).sort((a, b) => hash(config.cards[a].text + a) - hash(config.cards[b].text + b) || a - b)
}

/** The pans as the state says, read safely: anything else counts as off the scale. */
export function putOf(config: ArgConfig, state: ArgState): ('for' | 'against' | null)[] {
  const raw = state && Array.isArray(state.put) ? state.put : []
  return config.cards.map((_, i) => (raw[i] === 'for' || raw[i] === 'against' ? raw[i] : null))
}

export const weightOn = (config: ArgConfig, state: ArgState, pan: 'for' | 'against'): number =>
  putOf(config, state).reduce((sum, p, i) => sum + (p === pan ? config.cards[i].strength : 0), 0)

/** The beam's angle in degrees: negative lowers the left (supports) pan. */
export function tiltOf(config: ArgConfig, state: ArgState): number {
  const diff = weightOn(config, state, 'for') - weightOn(config, state, 'against')
  return -Math.max(-MAX_TILT, Math.min(MAX_TILT, diff * DEG_PER_UNIT))
}

export const truth = (card: Card): 'for' | 'against' | null => (card.side === 'neither' ? null : card.side)

export function wrongCards(config: ArgConfig, state: ArgState): number[] {
  const put = putOf(config, state)
  return config.cards.map((c, i) => (put[i] === truth(c) ? -1 : i)).filter((i) => i >= 0)
}

const total = (config: ArgConfig, side: 'for' | 'against') => config.cards.filter((c) => c.side === side).reduce((s, c) => s + c.strength, 0)

// ---------------------------------------------------------------------------
// What is said once marked.

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function working(config: ArgConfig): string {
  const f = total(config, 'for')
  const a = total(config, 'against')
  const lean = f === a ? 'They weigh the same' : f > a ? `It tips towards the claim, ${f} to ${a}` : `It tips against the claim, ${a} to ${f}`
  return `Yes. Every card is on its side. ${lean}: weighing is a judgement.`
}

export function madeText(config: ArgConfig, state: ArgState): string {
  const put = putOf(config, state)
  const placed = put.filter(Boolean).length
  const wrong = wrongCards(config, state).length
  if (placed === 0) return 'Nothing is on the scale yet.'
  return `${plural(wrong, 'card is', 'cards are')} not where the evidence puts ${wrong === 1 ? 'it' : 'them'}.`
}

export const sideName = (s: Side) => (s === 'for' ? 'Supports' : s === 'against' ? 'Against' : 'Off topic')

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const SIDE_WORDS: Record<string, Side> = {
  for: 'for', support: 'for', supports: 'for', supporting: 'for', agree: 'for', agrees: 'for', pro: 'for', yes: 'for', 'in-favour': 'for', 'in-favor': 'for', 'supports-the-claim': 'for',
  against: 'against', oppose: 'against', opposes: 'against', opposing: 'against', challenge: 'against', challenges: 'against', disagree: 'against', disagrees: 'against', con: 'against', no: 'against', contradicts: 'against', 'counter-evidence': 'against', counter: 'against',
  neither: 'neither', irrelevant: 'neither', unrelated: 'neither', none: 'neither', off: 'neither', 'off-topic': 'neither', 'not-relevant': 'neither', 'red-herring': 'neither', 'no-bearing': 'neither', neutral: 'neither',
}

const STRENGTH_WORDS: Record<string, number> = { weak: 1, low: 1, slight: 1, moderate: 2, medium: 2, ok: 2, strong: 3, high: 3, powerful: 3 }

function readStrength(raw: unknown): number | null {
  if (raw === undefined) return 2
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const k = keyOf(raw)
  if (has(STRENGTH_WORDS, k)) return STRENGTH_WORDS[k]
  const n = typeof raw === 'string' ? Number(raw.trim()) : NaN
  return Number.isFinite(n) ? n : null
}

function readCard(raw: unknown, side?: Side): Card | null {
  if (typeof raw === 'string') return side ? { text: raw.trim().replace(/\s+/g, ' '), side, strength: 2 } : null
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const text = first(o, ['text', 'card', 'evidence', 'label', 'statement'])
  if (typeof text !== 'string') return null
  const rawSide = side ?? (typeof first(o, ['side', 'bearing', 'supports', 'role', 'type']) === 'string' ? SIDE_WORDS[keyOf(first(o, ['side', 'bearing', 'supports', 'role', 'type']))] : undefined)
  if (!rawSide) return null
  const strength = readStrength(first(o, ['strength', 'weight', 'power']))
  if (strength === null) return null
  return { text: text.trim().replace(/\s+/g, ' '), side: rawSide, strength }
}

export const claimEvidenceEngine: SceneEngine<ArgConfig, ArgState> = {
  id: 'claim-evidence',
  // Distinctive on their own: scenesFor matches the first five letters, so "argument" would catch function arguments.
  covers: ['rebuttal', 'rebuttals', 'counterargument', 'counterarguments'],
  phrases: [
    'claim and evidence', 'claims and evidence', 'claim, evidence and reasoning', 'claim evidence reasoning', 'evidence and reasoning', 'evidence and argument', 'using evidence', 'use of evidence',
    'building an argument', 'build an argument', 'constructing an argument', 'construct an argument', 'writing an argument', 'argument writing', 'argumentative writing', 'argumentative essay', 'argumentative essays',
    'developing an argument', 'making an argument', 'making a case', 'supporting a claim', 'supporting claims', 'supporting an argument', 'evidence for and against', 'arguments for and against', 'for and against',
    'weighing evidence', 'weighing the evidence', 'weighing up evidence', 'weighing arguments', 'weighing up arguments', 'judging evidence', 'evaluating evidence', 'evaluating arguments',
    'PEEL paragraph', 'PEEL paragraphs', 'PEEL structure', 'point evidence explain link', 'point, evidence, explain, link', 'writing the essay', 'writing an essay', 'essay writing', 'essay planning', 'planning an essay', 'historical argument', 'historical arguments',
    'persuasive writing', 'persuasive essay', 'discursive writing', 'debate skills','reasoned argument', 'reasoned arguments', 'sustained argument',
  ],
  // Near misses: the words are common ones. "Argument" in computing and maths, "evidence" in science, "claim" in law and money.
  notFor: [
    'function argument', 'function arguments', 'arguments of a function', 'argument of a function', 'command line argument', 'command line arguments', 'command-line arguments', 'parameters and arguments', 'passing arguments',
    'argument of a complex number', 'complex argument', 'modulus and argument', 'modulus-argument', 'argand', 'arguments and parameters', 'logical argument', 'valid argument', 'validity of arguments',
    'insurance claim', 'insurance claims', 'claiming', 'land claim', 'land claims', 'territorial claims', 'territorial claim', 'claim a refund', 'tax claim', 'expenses claim',
    'evidence for evolution', 'evidence of evolution', 'evidence for plate tectonics', 'evidence for continental drift', 'fossil evidence', 'evidence for the big bang', 'forensic evidence', 'evidence from fossils', 'evidence for natural selection',
    'evidence of climate change', 'evidence for climate change', 'orange peel',
  ],
  // The learner decides which way each piece of evidence points.
  isolates: 'category',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const claim = first(o, ['claim', 'statement', 'thesis', 'hypothesis', 'proposition', 'question'])
    if (typeof claim !== 'string' || claim.trim() === '') return null
    const cards: Card[] = []
    const list = first(o, ['cards', 'evidence', 'items', 'points'])
    if (list !== undefined) {
      if (!Array.isArray(list)) return null
      for (const item of list) {
        const c = readCard(item)
        if (!c) return null
        cards.push(c)
      }
    }
    // The same cards written as three lists.
    const groups: [string[], Side][] = [[['supports', 'for', 'supporting'], 'for'], [['against', 'opposes', 'opposing'], 'against'], [['neither', 'irrelevant', 'unrelated'], 'neither']]
    for (const [keys, side] of groups) {
      const g = first(o, keys)
      if (g === undefined) continue
      if (!Array.isArray(g)) return null
      for (const item of g) {
        const c = readCard(item, side)
        if (!c) return null
        cards.push(c)
      }
    }
    if (cards.length === 0) return null
    return { claim: claim.trim().replace(/\s+/g, ' '), cards }
  },

  faults(config) {
    const out: string[] = []
    const n = config.cards.length
    const f = config.cards.filter((c) => c.side === 'for').length
    const a = config.cards.filter((c) => c.side === 'against').length
    const z = config.cards.filter((c) => c.side === 'neither').length
    if (config.claim.length > MAX_CLAIM) out.push(`The claim is ${config.claim.length} characters; the card shows ${MAX_CLAIM}: shorten it, e.g. "Rationing was the best way to feed Britain in the war."`)
    if (n < MIN_CARDS || n > MAX_CARDS) out.push(`${n} cards is ${n < MIN_CARDS ? 'too few to weigh' : 'more than the scale holds'} (${MIN_CARDS} to ${MAX_CARDS}): use e.g. 2 supporting, 2 against.`)
    if (f < 1 || a < 1) out.push(`A balance needs at least one card on each side: ${f < 1 ? 'none supports' : 'none opposes'} the claim -- add one that ${f < 1 ? 'supports' : 'opposes'} it.`)
    if (z > MAX_NEITHER) out.push(`${z} cards bear on nothing; at most ${MAX_NEITHER} can: make the rest support or oppose the claim.`)
    config.cards.forEach((c, i) => {
      if (c.text === '') out.push(`Card ${i + 1} has no text: write a short piece of evidence, e.g. "Rationed families ate more vegetables".`)
      else if (c.text.length > MAX_CARD_TEXT) out.push(`Card ${i + 1} is ${c.text.length} characters, over the ${MAX_CARD_TEXT} a card holds: shorten it to a single fact, e.g. "Rationed families ate more vegetables".`)
      if (![1, 2, 3].includes(c.strength)) out.push(`Card ${i + 1} has strength ${c.strength}: use 1 (weak), 2 or 3 (strong).`)
    })
    const texts = config.cards.map((c) => c.text.toLowerCase())
    if (new Set(texts).size !== texts.length) out.push('Two cards say the same thing: make each card its own piece of evidence.')
    return out
  },

  promptFaults(config, prompt) {
    void config
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const example = GOOD_PROMPT
    const count = /\b(?:\d+|one|two|three|four|five|six)\s+(?:of\s+the\s+)?(?:cards?|pieces?|points?|sources?|facts?)\s+(?:of evidence\s+)?(?:support|oppose|are\s+(?:for|against)|go(?:es)?\s+(?:for|against)|bears?\s+on|is\s+(?:for|against))/i.test(text)
    const verdict = /\b(?:the\s+)?(?:evidence|case|scale|argument)\s+(?:mostly\s+|strongly\s+|clearly\s+|overwhelmingly\s+)?(?:supports?|proves?|favou?rs|tips|shows|is\s+stronger|outweighs|wins)\b|\b(?:so|therefore)\s+the claim is\b|\bthe claim is (?:true|false|right|wrong|correct|weak|strong)\b/i.test(text)
    const irrelevant = /\birrelevant\b|\bnot relevant\b|\bred herring|\bone (?:card|piece)\b[^.]*\b(?:does not|doesn['’]t|is not|isn['’]t)\b|\bunrelated\b|\bhas nothing to do\b[^.]*\bone\b/i.test(text)
    if (count || verdict || irrelevant) {
      out.push(`the prompt gives the answer away: it says how many cards go each way, which way the case tips, or that a card is irrelevant, which the learner is to find on the scale -- ask for the task only ("${example}")`)
    }
    if (/\bdrag\b|\bslide\b|\bwrite\b|\btype\b|\bcomplete the (?:paragraph|sentence)|\bPEEL (?:paragraph )?(?:below|here)|\border the\b|\bchoose the strongest\b|\bpick the strongest\b|\bwhich is (?:the )?(?:best|strongest)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not do: the learner taps a card and then a pan, and nothing is written, dragged or ranked -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return { put: config.cards.map(() => null) }
  },

  check(config, state) {
    const wrong = wrongCards(config, state)
    return { ok: wrong.length === 0, wrongIds: wrong.map(String) }
  },

  solve(config) {
    return { put: config.cards.map(truth) }
  },

  View: ClaimEvidenceView,

  prompt: `SCENE "claim-evidence" -- a claim on a plaque above a real brass balance with two pans, and a tray of evidence cards, each a short numbered piece of evidence with dots for its strength (more dots, stronger). The learner taps a card, then taps the left pan (evidence that supports the claim) or the right pan (evidence against it); a card that has nothing to do with the claim is left off. The beam tips with each card, by strength, so the case visibly builds. Tapping the same pan again takes a card off, and a Take off button does too.
  For: building an argument from a claim, evidence for and against, weighing evidence, the first steps of a PEEL paragraph (the point and the evidence for it), in history, English, science, geography and social studies. It answers "any fact supports any claim" and "evidence I agree with is evidence for it".
  claim: the statement to argue about, up to 100 characters, a debatable one ("Rationing was the best way to feed Britain in the war").
  cards: 4 to 6 pieces of evidence, each { "text": up to 50 characters, one fact, "side": "for" | "against" | "neither", "strength": 1, 2 or 3 (default 2) }. At least one "for" and one "against"; at most 2 "neither". "neither" is for a card that is true but bears on nothing in the claim. Write each card as a plain fact, never with "this supports" in it.
  Marked: only the pan each card is on (or off). The card never marks which side wins or whether the claim is true; once marked it shows the totals and says weighing is a judgement.
  Before marking the card shows the claim, the cards, the pans (Supports, Against), the tilt and how many cards are on each pan. It holds back which pan each card belongs on. The prompt must not say how many cards go each way, which way the case tips, or that any card is irrelevant. It must say the gesture: tap a card, then tap a pan.
  Not drawn: writing sentences, ordering PEEL parts, ranking the strongest card, source provenance (use source-compare), or cause and effect (use cause-chain).
  config: { "claim":"Rationing was the best way to feed Britain in the war.", "cards":[ { "text":"Every family got the same weekly food amounts", "side":"for", "strength":3 }, { "text":"Rationed families ate more vegetables", "side":"for", "strength":2 }, { "text":"A black market sold extra food to the rich", "side":"against", "strength":2 }, { "text":"Ration books were printed in 1939", "side":"neither", "strength":1 } ] }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a card, then tap the pan it belongs on: the left pan for evidence that supports the claim, the right pan for evidence against it. Leave off any card that does not bear on the claim.",
    "payload": { "engine":"claim-evidence", "config": { "claim":"Rationing was the best way to feed Britain in the war.", "cards":[ { "text":"Every family got the same weekly food amounts", "side":"for", "strength":3 }, { "text":"Rationed families ate more vegetables", "side":"for", "strength":2 }, { "text":"A black market sold extra food to the rich", "side":"against", "strength":2 }, { "text":"Ration books were printed in 1939", "side":"neither", "strength":1 } ] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:claim-evidence", "why":"..." } }`,
}

export const GOOD_PROMPT =
  'Tap a card, then tap the pan it belongs on: the left pan for evidence that supports the claim, the right pan for evidence against it. Leave off any card that does not bear on the claim.'

registerEngine(claimEvidenceEngine as SceneEngine<unknown, unknown>)
