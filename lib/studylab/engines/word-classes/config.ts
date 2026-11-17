// lib/studylab/engines/word-classes/config.ts
//
// Word classes (parts of speech) as JOBS, not labels. Two tasks:
//   swap  -- one word in a sentence is highlighted; swap in a tile that does the same job. The sentence
//            reads back with the new word, so a word of another class visibly breaks it.
//   build -- a silly sentence with class-labelled sockets; fill each from the tile bank. Grammar is not meaning.
//
// Research notes: .superpowers/bakeoff/word-classes/research.md. The teaching move (ask what the word is
// DOING in this sentence; "walk" is a noun after "a" and "run" is a verb after "We"; adverbs, prepositions are
// the most confused) comes from a primary grammar toolkit and a learner-error study. No code or artwork copied.
// Left out: determiners, tenses, spelling, punctuation, and dragging (taps are enough and never fiddly).
//
// Every tile's class is its class IN ITS SENTENCE, checked by hand: no decoy also fits the gap.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { WordClassesView } from './View'

export const CLASSES = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction'] as const
export type Cls = (typeof CLASSES)[number]

export const GLOSS: Record<Cls, string> = {
  noun: 'names a person, place or thing',
  verb: 'says what someone does or is',
  adjective: 'describes a noun',
  adverb: 'tells how, when or where',
  pronoun: 'stands in for a noun',
  preposition: 'shows where or when',
  conjunction: 'joins two parts of a sentence',
}

export const anA = (c: Cls) => (c === 'adjective' || c === 'adverb' ? 'an ' : 'a ') + c

export type SwapItem = { text: string; answers: string[]; decoys: [string, Cls][]; why: string }
export type Tile = { w: string; cls: Cls }

/** Hand-written and hand-checked. The `[word]` is the one to swap; `why` says its job here. */
export const SWAP_ITEMS: Record<Cls, SwapItem[]> = {
  noun: [
    { text: 'Mia took a [walk] to the shop.', answers: ['run', 'swim'], decoys: [['quickly', 'adverb'], ['happy', 'adjective'], ['they', 'pronoun']], why: 'it names a thing, "a walk"' },
    { text: 'The [dog] barked at the postman.', answers: ['fox', 'puppy'], decoys: [['jumped', 'verb'], ['loudly', 'adverb'], ['under', 'preposition']], why: 'it names the animal doing the barking' },
    { text: 'My [teacher] reads a story every day.', answers: ['grandad', 'sister'], decoys: [['between', 'preposition'], ['bright', 'adjective'], ['slowly', 'adverb']], why: 'it names the person who reads' },
  ],
  verb: [
    { text: 'The tall boy [kicked] the ball.', answers: ['caught', 'threw'], decoys: [['quickly', 'adverb'], ['red', 'adjective'], ['under', 'preposition']], why: 'it says what the boy did' },
    { text: 'We [run] to school every morning.', answers: ['hurry', 'walk'], decoys: [['happy', 'adjective'], ['teacher', 'noun'], ['with', 'preposition']], why: 'it says what we do; here "run" is an action, not a thing' },
    { text: 'The cat [sleeps] on the warm rug.', answers: ['rests', 'sits'], decoys: [['and', 'conjunction'], ['kitchen', 'noun'], ['soft', 'adjective']], why: 'it says what the cat does' },
  ],
  adjective: [
    { text: 'I saw a [huge] elephant at the zoo.', answers: ['friendly', 'tiny'], decoys: [['slowly', 'adverb'], ['under', 'preposition'], ['ran', 'verb']], why: 'it describes the noun "elephant"' },
    { text: 'The [cold] wind blew across the field.', answers: ['gentle', 'strong'], decoys: [['danced', 'verb'], ['gently', 'adverb'], ['through', 'preposition']], why: 'it describes the noun "wind"' },
    { text: 'She wore a [red] scarf.', answers: ['long', 'woolly'], decoys: [['laughed', 'verb'], ['behind', 'preposition'], ['slowly', 'adverb']], why: 'it describes the noun "scarf"' },
  ],
  adverb: [
    { text: 'The snail moved [slowly] across the leaf.', answers: ['carefully', 'quietly'], decoys: [['green', 'adjective'], ['tiger', 'noun'], ['and', 'conjunction']], why: 'it tells how the snail moved' },
    { text: 'He answered the question [politely].', answers: ['calmly', 'loudly'], decoys: [['tall', 'adjective'], ['teacher', 'noun'], ['under', 'preposition']], why: 'it tells how he answered' },
    { text: '[Yesterday] we visited the museum.', answers: ['Afterwards', 'Later'], decoys: [['museum', 'noun'], ['tall', 'adjective'], ['under', 'preposition']], why: 'it tells when we visited' },
  ],
  pronoun: [
    { text: 'Sam found a coin, so [he] kept it.', answers: ['she', 'they'], decoys: [['quickly', 'adverb'], ['yellow', 'adjective'], ['under', 'preposition']], why: 'it stands in for the noun "Sam"' },
    { text: '[They] played football in the park.', answers: ['He', 'We'], decoys: [['tall', 'adjective'], ['and', 'conjunction'], ['kicked', 'verb']], why: 'it stands in for the noun naming who played' },
    { text: 'The teacher gave [us] some homework.', answers: ['her', 'them'], decoys: [['quickly', 'adverb'], ['yellow', 'adjective'], ['happy', 'adjective']], why: 'it stands in for the noun naming who got the homework' },
  ],
  preposition: [
    { text: 'The cat jumped [onto] the shelf.', answers: ['off', 'over'], decoys: [['fluffy', 'adjective'], ['dog', 'noun'], ['sleeps', 'verb']], why: 'it shows where the cat went, in relation to the shelf' },
    { text: 'We ate our lunch [under] the old oak tree.', answers: ['beside', 'near'], decoys: [['eagerly', 'adverb'], ['sandwich', 'noun'], ['tall', 'adjective']], why: 'it shows where we ate, in relation to the tree' },
  ],
  conjunction: [
    { text: 'I wanted to play outside, [but] it was raining.', answers: ['although', 'and'], decoys: [['happily', 'adverb'], ['rainy', 'adjective'], ['them', 'pronoun']], why: 'it joins two parts of the sentence' },
    { text: 'She was tired [because] she had run all day.', answers: ['and', 'but'], decoys: [['slowly', 'adverb'], ['bed', 'noun'], ['into', 'preposition']], why: 'it joins two parts of the sentence' },
  ],
}

export type Frame = { parts: (string | { cls: Cls })[]; tiles: Tile[]; name: string }
const T = (w: string, cls: Cls): Tile => ({ w, cls })
export const FRAMES: Frame[] = [
  { name: 'describing', parts: ['The', { cls: 'adjective' }, { cls: 'noun' }, { cls: 'verb' }, { cls: 'adverb' }, '.'],
    tiles: [T('sleepy', 'adjective'), T('tiger', 'noun'), T('jumped', 'verb'), T('quietly', 'adverb'), T('under', 'preposition'), T('and', 'conjunction')] },
  { name: 'noun phrase', parts: ['The', { cls: 'adjective' }, { cls: 'adjective' }, { cls: 'noun' }, { cls: 'verb' }, '.'],
    tiles: [T('tiny', 'adjective'), T('golden', 'adjective'), T('dragon', 'noun'), T('sneezed', 'verb'), T('slowly', 'adverb'), T('over', 'preposition')] },
  { name: 'where', parts: [{ cls: 'pronoun' }, { cls: 'verb' }, { cls: 'preposition' }, 'the', { cls: 'noun' }, '.'],
    tiles: [T('she', 'pronoun'), T('climbed', 'verb'), T('up', 'preposition'), T('tree', 'noun'), T('happy', 'adjective'), T('quickly', 'adverb')] },
  { name: 'joining', parts: ['The', { cls: 'noun' }, { cls: 'verb' }, { cls: 'conjunction' }, 'the', { cls: 'noun' }, { cls: 'verb' }, '.'],
    tiles: [T('bird', 'noun'), T('cat', 'noun'), T('sang', 'verb'), T('purred', 'verb'), T('and', 'conjunction'), T('quietly', 'adverb'), T('under', 'preposition')] },
]

export type SwapConfig = { task: 'swap'; focus: Cls | 'other'; item: number; asked?: string }
export type BuildConfig = { task: 'build'; frame: number }
export type WCConfig = SwapConfig | BuildConfig
/** swap: pick = the tile's word. build: placed[i] = the tile index in socket i, or null. */
export type WCState = { pick?: string | null; placed?: (number | null)[] }

export const sortedTiles = (tiles: Tile[]) => [...tiles].sort((a, b) => a.w.localeCompare(b.w))

export function splitItem(item: SwapItem): { before: string; target: string; after: string } {
  const m = item.text.match(/^(.*?)\[(.+?)\](.*)$/)!
  return { before: m[1], target: m[2], after: m[3] }
}
export const swapTiles = (focus: Cls, item: SwapItem): Tile[] =>
  sortedTiles([...item.answers.map((w) => T(w, focus)), ...item.decoys.map(([w, c]) => T(w, c))])

export const itemOf = (c: SwapConfig): SwapItem | null => (c.focus === 'other' ? null : SWAP_ITEMS[c.focus][c.item - 1] ?? null)
export const frameOf = (c: BuildConfig): Frame | null => FRAMES[c.frame - 1] ?? null
export const socketsOf = (f: Frame) => f.parts.flatMap((p) => (typeof p === 'string' ? [] : [p.cls]))

/** The placed list as a safe array of length n. */
export function placedOf(c: BuildConfig, s: WCState): (number | null)[] {
  const f = frameOf(c)
  const n = f ? socketsOf(f).length : 0
  const raw = Array.isArray(s?.placed) ? s.placed : []
  const out: (number | null)[] = []
  const used = new Set<number>()
  for (let i = 0; i < n; i++) {
    const v = raw[i]
    if (typeof v === 'number' && Number.isInteger(v) && f && v >= 0 && v < f.tiles.length && !used.has(v)) { out.push(v); used.add(v) } else out.push(null)
  }
  return out
}

export function pickedTile(c: SwapConfig, s: WCState): Tile | null {
  const item = itemOf(c)
  if (!item || typeof s?.pick !== 'string') return null
  return swapTiles(c.focus as Cls, item).find((t) => t.w === s.pick) ?? null
}

export function check(c: WCConfig, s: WCState): { ok: boolean; wrongIds: string[] } {
  if (c.task === 'swap') {
    const t = pickedTile(c, s)
    const ok = !!t && t.cls === c.focus
    return { ok, wrongIds: ok ? [] : ['slot'] }
  }
  const f = frameOf(c)
  if (!f) return { ok: false, wrongIds: [] }
  const sockets = socketsOf(f)
  const placed = placedOf(c, s)
  const wrong = sockets.flatMap((cls, i) => (placed[i] !== null && f.tiles[placed[i]!].cls === cls ? [] : [`s${i}`]))
  return { ok: wrong.length === 0, wrongIds: wrong }
}

export const sentenceCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

export function working(c: WCConfig, s: WCState): string {
  if (c.task === 'swap') {
    const item = itemOf(c)!
    const { target } = splitItem(item)
    const t = pickedTile(c, s)
    const cls = c.focus as Cls
    const others = item.answers.filter((w) => w !== t?.w)
    return `Yes. "${target}" is ${anA(cls)} here: ${item.why}. "${t?.w ?? item.answers[0]}" is ${anA(cls)} too, so it does the same job and the sentence still works. ${others.length ? `"${others[0]}" would work as well.` : ''}`
  }
  const f = frameOf(c)!
  const placed = placedOf(c, s)
  const words = socketsOf(f).map((cls, i) => `${f.tiles[placed[i] ?? 0]?.w} (${cls})`)
  return `Yes. Every word is doing the right job: ${words.join(', ')}. The sentence is silly but it is grammatical: the class of a word is its job, not its meaning.`
}

export function madeText(c: WCConfig, s: WCState): string {
  if (c.task === 'swap') {
    const item = itemOf(c)!
    const { target } = splitItem(item)
    const t = pickedTile(c, s)
    const cls = c.focus as Cls
    if (!t) return `You have not swapped a word in yet. "${target}" is ${anA(cls)} here: ${item.why}.`
    return `You swapped in "${t.w}", ${anA(t.cls)}. "${target}" is ${anA(cls)} here: ${item.why}. Only ${cls}s do that job.`
  }
  const f = frameOf(c)!
  const placed = placedOf(c, s)
  const sockets = socketsOf(f)
  const bad = sockets.flatMap((cls, i) => {
    const p = placed[i]
    if (p === null) return [`Socket ${i + 1} is empty: it needs ${anA(cls)}, which ${GLOSS[cls]}.`]
    const t = f.tiles[p]
    return t.cls === cls ? [] : [`"${t.w}" is ${anA(t.cls)}, but socket ${i + 1} needs ${anA(cls)}, which ${GLOSS[cls]}.`]
  })
  return `Not yet. ${bad.join(' ')}`
}

// ---------------------------------------------------------------------------
// Broad reading of the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/\s+/g, ' ') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') { const m = raw.match(/-?\d+(?:\.\d+)?/); if (m) return Number(m[0]) }
  return null
}

export function readClass(raw: unknown): Cls | 'other' | null {
  const k = keyOf(raw)
  if (!k) return null
  if (/pronoun/.test(k)) return 'pronoun'
  if (/preposition/.test(k)) return 'preposition'
  if (/conjunction|connective/.test(k)) return 'conjunction'
  if (/adverb/.test(k)) return 'adverb'
  if (/adjective|describing word/.test(k)) return 'adjective'
  if (/verb|doing word|action/.test(k)) return 'verb'
  if (/noun|naming word|proper/.test(k)) return 'noun'
  return 'other'
}

function readFrame(src: Record<string, unknown>): number | null {
  const n = readNumber(first(src, ['frame', 'sentence', 'item', 'example', 'variant']))
  if (n !== null) return n
  const k = keyOf(first(src, ['focus', 'class', 'wordClass', 'word_class', 'topic', 'name']))
  if (!k) return 1
  if (/noun phrase|expanded/.test(k)) return 2
  if (/pronoun|preposition/.test(k)) return 3
  if (/conjunction|connective|join/.test(k)) return 4
  return 1
}

function goodPrompt(c: WCConfig): string {
  return c.task === 'swap'
    ? 'Tap a tile to swap it in for the amber word. Pick a word that does the same job, so the sentence still works.'
    : 'Tap a socket, then tap a tile to fill it. Fill every socket with a word that does the job named under it.'
}

const CLASS_WORDS: Record<Cls, RegExp> = {
  noun: /\bnouns?\b|\bnaming words?\b/i,
  verb: /\bverbs?\b|\bdoing words?\b|\baction words?\b/i,
  adjective: /\badjectives?\b|\bdescribing words?\b/i,
  adverb: /\badverbs?\b/i,
  pronoun: /\bpronouns?\b/i,
  preposition: /\bprepositions?\b/i,
  conjunction: /\bconjunctions?\b|\bconnectives?\b|\bjoining words?\b/i,
}

export const wordClassesEngine: SceneEngine<WCConfig, WCState> = {
  id: 'word-classes',
  covers: ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction'],
  phrases: [
    'word classes', 'word class', 'parts of speech', 'types of word', 'expanded noun phrases', 'expanded noun phrase',
    'noun phrases', 'noun phrase', 'powerful verbs', 'powerful adverbs', 'sentence grammar', 'grammar of sentences',
  ],
  notFor: [
    'punctuation', 'apostrophe', 'apostrophes', 'spelling', 'argument writing', 'persuasive writing', 'persuasive speech',
    'french verbs', 'spanish verbs', 'german verbs', 'verbs in french', 'verbs in spanish', 'verbs in german',
    'verb tenses', 'verb tense', 'irregular verbs', 'subject verb agreement', 'conjugation', 'conjugating verbs',
    'logical conjunction', 'planetary conjunction', 'logic gates', 'truth tables', 'boolean',
    'french pronouns', 'spanish pronouns', 'german pronouns', 'relative pronouns in french',
  ],
  isolates: 'category',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const src = raw as Record<string, unknown>
    const taskKey = keyOf(first(src, ['task', 'kind', 'type', 'mode']))
    const rawFocus = first(src, ['focus', 'class', 'wordClass', 'word_class', 'wordclass', 'topic', 'target'])
    const wantsBuild = /build|sentence|socket|fill|assemble/.test(taskKey) || (!taskKey && rawFocus === undefined && src.frame !== undefined)
    if (wantsBuild) {
      const frame = readFrame(src)
      return frame === null ? null : { task: 'build', frame }
    }
    const focus = readClass(rawFocus)
    if (!focus) return null
    const item = readNumber(first(src, ['item', 'example', 'variant', 'number', 'n', 'index'])) ?? 1
    return { task: 'swap', focus, item, ...(focus === 'other' ? { asked: String(rawFocus) } : {}) }
  },

  faults(c) {
    if (c.task === 'build') {
      if (!Number.isInteger(c.frame) || c.frame < 1 || c.frame > FRAMES.length) return [`There are ${FRAMES.length} sentences to build, numbered 1 to ${FRAMES.length}: use e.g. { "task":"build", "frame":1 }.`]
      return []
    }
    if (c.focus === 'other') return [`"${c.asked ?? ''}" is not one of the word classes this card swaps: use noun, verb, adjective, adverb, pronoun, preposition or conjunction, e.g. { "task":"swap", "focus":"noun", "item":1 }.`]
    const n = SWAP_ITEMS[c.focus].length
    if (!Number.isInteger(c.item) || c.item < 1 || c.item > n) return [`There ${n === 1 ? 'is 1 sentence' : `are ${n} sentences`} for ${c.focus}s, numbered 1 to ${n}: use e.g. { "task":"swap", "focus":"${c.focus}", "item":1 }.`]
    return []
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const example = goodPrompt(c)
    if (/\bdrag\b|\bdrop\b|\bunderline\b|\bhighlight\b|\bcircle\b|\bsort\b|\bspell|\bpunctuat|\bcolour (?:in|the)\b|\bcolor (?:in|the)\b|\bsay aloud\b|\bwrite\b|\btype\b/i.test(text)) {
      out.push(`The prompt promises something this card does not do: it only taps tiles into a sentence, with no dragging, highlighting, sorting, typing or spelling ("${example}")`)
    }
    if (c.task === 'swap' && c.focus !== 'other') {
      if (CLASS_WORDS[c.focus].test(text)) out.push(`The prompt names the class of the highlighted word, which the learner is to work out from the sentence: ask for "a word that does the same job" ("${example}")`)
      const item = itemOf(c)
      if (item) {
        const given = item.answers.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text))
        if (given.length) out.push(`The prompt names a word that belongs in the gap ("${given[0]}"): leave the choice to the learner ("${example}")`)
      }
    }
    if (c.task === 'build') {
      const f = frameOf(c)
      const given = f?.tiles.filter((t) => t.w.length > 3 && new RegExp(`\\b${t.w}\\b`, 'i').test(text)) ?? []
      if (given.length) out.push(`The prompt names a tile ("${given[0].w}"): say only how to fill the sockets ("${example}")`)
    }
    return out
  },

  initial(c) {
    return c.task === 'swap' ? { pick: null } : { placed: Array(socketsOf(frameOf(c)!).length).fill(null) }
  },

  check,

  solve(c) {
    if (c.task === 'swap') return { pick: itemOf(c)!.answers[0] }
    const f = frameOf(c)!
    const used = new Set<number>()
    const placed = socketsOf(f).map((cls) => {
      const i = f.tiles.findIndex((t, k) => t.cls === cls && !used.has(k))
      used.add(i)
      return i
    })
    return { placed }
  },

  View: WordClassesView,

  prompt: `SCENE "word-classes" -- a sentence on a quiet light panel, with word tiles under it. Word classes are jobs: a word's class is what it does in THIS sentence. The learner taps tiles into the sentence and reads it back; a word of the wrong job visibly breaks it, but the card never says so until it is marked.
  swap: one word in a real sentence is highlighted in amber. Five word tiles wait below (two do the same job, three do other jobs). Tapping a tile swaps it into the sentence; tapping another changes the swap; tapping the amber slot puts it back. The class of the highlighted word is NOT shown before marking. focus: noun, verb, adjective, adverb, pronoun, preposition or conjunction (which class the highlighted word is). item: 1 to 3 (which sentence for that class; preposition and conjunction have 2). Items include the same word doing two jobs, such as "walk" as a noun after "a" and "run" as a verb after "We".
  build: a silly but grammatical sentence with sockets, each labelled with a class name and what it does. The learner taps a socket, then a tile, to fill it. Tiles of other jobs are in the bank as decoys. frame: 1 describing (adjective noun verb adverb), 2 expanded noun phrase (two adjectives), 3 where (pronoun verb preposition noun), 4 joining (conjunction between two clauses).
  For: word classes, parts of speech, nouns, verbs, adjectives, adverbs, pronouns, prepositions, conjunctions, expanded noun phrases and choosing words by their job. Not for punctuation or apostrophes, spelling, argument or persuasive writing, verb tenses, other languages, or determiners (not drawn).
  Before marking it shows only the sentence and the tiles; marking names the class of the highlighted word, says why, and (when wrong) names the class of the word the learner chose. Prompts must give the gesture and must NOT name the class of the highlighted word or a word that fits.
  config: { "task":"swap", "focus":"noun", "item":1 }
       or { "task":"swap", "focus":"adverb", "item":2 }
       or { "task":"build", "frame":3 }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a tile to swap it in for the amber word. Pick a word that does the same job, so the sentence still works.",
    "payload": { "engine":"word-classes", "config": { "task":"swap", "focus":"noun", "item":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:word-classes", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a tile to swap it in for the amber word. Pick a word that does the same job, so the sentence still works.",
    "payload": { "engine":"word-classes", "config": { "task":"swap", "focus":"adverb", "item":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:word-classes", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a socket, then tap a tile to fill it. Fill every socket with a word that does the job named under it.",
    "payload": { "engine":"word-classes", "config": { "task":"build", "frame":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"category", "apparatus":"scene:word-classes", "why":"..." } }`,
}

registerEngine(wordClassesEngine as SceneEngine<unknown, unknown>)
