// lib/studylab/engines/figurative-language/config.ts
//
// Figurative language as what the reader pictures. A drawn scene on a quiet plate is "what a reader pictures", and the
// learner changes the language and watches the picture answer:
//   carry -- a figurative sentence ("The lake was like a mirror."). Under it, four things a mirror is like. Each tap
//            carries one across into the reader's picture: the ones the writer meant make it vivid (the trees show
//            upside down in the still water), the ones the writer did not mean make it literally silly (a wooden frame
//            round the lake, leaves in dancing shoes). Right is exactly the ones that fit.
//   write -- a plain sentence ("The lake was still.") and four endings. Each tap rewrites the sentence and the picture:
//            a plain ending paints nothing new, "and I like lakes" paints nothing at all (the word like, comparing
//            nothing), a comparison with the wrong effect paints the wrong picture, and one paints the aim.
//
// Three hand-written, hand-checked scenes, one per device: lake (simile), snow (metaphor), leaves (personification).
// Every fit and every "not meant" is chosen so that no teacher could argue it: a lake has no frame, snow is not wool.
//
// Research notes: .superpowers/bakeoff/figurative-language/research.md. Ideas taken, never code or art:
//   - the classroom split page: draw the phrase literally on one side, what it means on the other (ReadWriteThink's
//     idioms lesson); the silly literal picture is what makes the meaning click;
//   - children carry over the qualities of the vehicle that are salient to them, right or wrong, and often fail to
//     notice that a literal reading cannot be meant (Evans & Gamble 1988, J. Child Language 15(2));
//   - the KS2 / Cambridge aim: the impact on the reader; a "like" that compares nothing is not a simile;
//   - metaphor, from Greek metapherein, meta- "across" + pherein "to carry".
// Refused: onomatopoeia and alliteration (sound devices: a picture cannot answer back for a sound), idioms, poetry form,
// typing your own simile (no rule could mark it), dragging (taps are enough and never fiddly).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FigurativeView } from './View'

export const SCENES = ['lake', 'snow', 'leaves'] as const
export type SceneName = (typeof SCENES)[number]
export const TASKS = ['carry', 'write'] as const
export type TaskName = (typeof TASKS)[number]
export type Device = 'simile' | 'metaphor' | 'personification'

/** A word outside the lists still parses, and faults says what would work. */
export type FigConfig = { task: string; scene: string }
/** carry: the qualities carried into the picture, by id. write: the ending chosen, by id. */
export type FigState = { carried?: string[]; ending?: string | null }

export type Quality = { id: string; text: string; fits: boolean }
export type EndingKind = 'right' | 'other' | 'plain' | 'notComparison'
export type Ending = { id: string; text: string; kind: EndingKind; looks: string[]; said: string }

export type FigScene = {
  id: SceneName
  device: Device
  /** carry: the writer's sentence, with the figurative words in the middle. */
  before: string
  figure: string
  after: string
  /** The thing compared to, and how the card asks about it. */
  vehicle: string
  ask: string
  tapWhat: string
  qualities: Quality[]
  /** write: the plain sentence, with its slot in the middle. */
  plainBefore: string
  plainSlot: string
  plainAfter: string
  /** What the plain sentence's reader pictures. */
  plainLooks: string[]
  aim: string
  endings: Ending[]
  /** What the reader pictures, in words: a lead, then the parts, joined. */
  picture: { lead: string; join: 'with' | 'doing'; base: string; moving: string[]; parts: Record<string, string> }
  noun: string
  rightCarry: [string, string]
  rightWrite: [string, string]
}

export const SCENE_DATA: Record<SceneName, FigScene> = {
  lake: {
    id: 'lake',
    device: 'simile',
    before: 'The lake was ',
    figure: 'like a mirror',
    after: '.',
    vehicle: 'a mirror',
    ask: 'What is a mirror like?',
    tapWhat: 'what a mirror is like',
    qualities: [
      { id: 'frame', text: 'has a frame round it', fits: false },
      { id: 'reflect', text: 'shows what is in front', fits: true },
      { id: 'crack', text: 'cracks if you drop it', fits: false },
      { id: 'still', text: 'is flat and still', fits: true },
    ],
    plainBefore: 'The lake was ',
    plainSlot: 'still',
    plainAfter: '.',
    plainLooks: ['still'],
    aim: 'Make the reader see how still and clear the water was, using a comparison.',
    endings: [
      { id: 'plain', text: 'very, very still', kind: 'plain', looks: ['still'], said: 'That says it plainly, with no comparison, so the reader pictures the same still water as before.' },
      { id: 'mirror', text: 'like a mirror', kind: 'right', looks: ['still', 'reflect'], said: '' },
      { id: 'enjoy', text: 'still, and I like lakes', kind: 'notComparison', looks: ['still'], said: 'Here "like" means enjoy: nothing is compared, so the reader’s picture stays the same.' },
      { id: 'washer', text: 'like a washing machine', kind: 'other', looks: ['churn'], said: 'That is a simile, but it makes the reader see swirling, foamy water.' },
    ],
    picture: {
      lead: 'a lake', join: 'with', base: 'small ripples', moving: ['still', 'churn'],
      parts: { still: 'flat water', churn: 'swirling, foamy water', reflect: 'the trees upside down in it', frame: 'a wooden frame round it', crack: 'cracks across it' },
    },
    noun: 'lake',
    rightCarry: [
      'Yes. A reader carries across only what fits a lake.',
      'Like a mirror, the water is flat and still and shows the trees upside down; the frame and the cracking glass stay behind. This is a simile: it compares using "like". In plain words, the lake was so still it reflected the trees.',
    ],
    rightWrite: [
      'Yes. "Like a mirror" makes the reader see it.',
      'This simile shows water so still that it holds the trees upside down. "Very, very still" paints nothing new, and in "I like lakes", like means enjoy: nothing is compared.',
    ],
  },
  snow: {
    id: 'snow',
    device: 'metaphor',
    before: 'The snow was ',
    figure: 'a blanket',
    after: ' over the town.',
    vehicle: 'a blanket',
    ask: 'What is a blanket like?',
    tapWhat: 'what a blanket is like',
    qualities: [
      { id: 'cover', text: 'covers everything', fits: true },
      { id: 'wool', text: 'is knitted from wool', fits: false },
      { id: 'fold', text: 'can be folded back', fits: false },
      { id: 'thick', text: 'is thick and soft', fits: true },
    ],
    plainBefore: 'The snow was ',
    plainSlot: 'white',
    plainAfter: '.',
    plainLooks: [],
    aim: 'Make the reader see snow so deep and soft that it covers everything, using a comparison.',
    endings: [
      { id: 'sugar', text: 'a dusting of icing sugar', kind: 'other', looks: ['dust'], said: 'That is a metaphor, but it makes the reader see only a thin sprinkle of snow.' },
      { id: 'plain', text: 'very, very white', kind: 'plain', looks: [], said: 'That says it plainly, with no comparison, so the reader pictures the same snow as before.' },
      { id: 'blanket', text: 'a thick blanket', kind: 'right', looks: ['cover', 'thick'], said: '' },
      { id: 'enjoy', text: 'white, and I like snow', kind: 'notComparison', looks: [], said: 'Here "like" means enjoy: nothing is compared, so the reader’s picture stays the same.' },
    ],
    picture: {
      lead: 'a town', join: 'with', base: 'a little snow on the roofs', moving: ['thick', 'dust', 'cover'],
      parts: { thick: 'deep, soft snow', dust: 'a thin sprinkle of snow', cover: 'the car and the bench hidden under snow', wool: 'snow knitted from wool', fold: 'a corner of the snow folded back' },
    },
    noun: 'snow',
    rightCarry: [
      'Yes. A reader carries across only what fits snow.',
      'Like a blanket, the snow lies thick and soft over everything; the wool and the folding stay behind. This is a metaphor: it says the snow was a blanket, which is not true, but shows what it was like. Metaphor is Greek for carrying across.',
    ],
    rightWrite: [
      'Yes. "A thick blanket" makes the reader see it.',
      'This metaphor lays snow deep and soft over everything. "Icing sugar" paints only a thin sprinkle, and in "I like snow", like means enjoy: nothing is compared.',
    ],
  },
  leaves: {
    id: 'leaves',
    device: 'personification',
    before: 'The leaves ',
    figure: 'danced',
    after: ' in the wind.',
    vehicle: 'a dancer',
    ask: 'What does a dancer do?',
    tapWhat: 'what a dancer does',
    qualities: [
      { id: 'shoes', text: 'wears dancing shoes', fits: false },
      { id: 'spin', text: 'spins and twirls', fits: true },
      { id: 'leap', text: 'leaps lightly', fits: true },
      { id: 'hands', text: 'holds a partner’s hand', fits: false },
    ],
    plainBefore: 'The leaves ',
    plainSlot: 'fell',
    plainAfter: ' in the wind.',
    plainLooks: [],
    aim: 'Make the reader see the leaves as light and playful, as if they were people.',
    endings: [
      { id: 'march', text: 'marched', kind: 'other', looks: ['march'], said: 'That gives the leaves a person’s action, but it makes the reader see them stiff and tidy, marching in a line.' },
      { id: 'rain', text: 'fell like rain', kind: 'other', looks: ['rain'], said: 'That is a simile, but it makes the reader see the leaves pouring straight down.' },
      { id: 'slow', text: 'fell slowly', kind: 'plain', looks: ['slow'], said: 'That says it plainly: the reader pictures ordinary falling leaves, only slower.' },
      { id: 'dance', text: 'danced', kind: 'right', looks: ['spin', 'leap'], said: '' },
    ],
    picture: {
      lead: 'leaves', join: 'doing', base: 'falling to the ground', moving: ['spin', 'leap', 'march', 'rain', 'slow'],
      parts: { spin: 'spinning and twirling', leap: 'leaping lightly up and down', march: 'marching in a stiff line', rain: 'pouring straight down', slow: 'falling slowly', shoes: 'wearing little dancing shoes', hands: 'holding hands in pairs' },
    },
    noun: 'leaf',
    rightCarry: [
      'Yes. A reader carries across only what fits leaves.',
      'Like dancers, the leaves spin and leap lightly, as if having fun; the shoes and the partners stay behind. Leaves are not people, so giving them a person’s action is personification.',
    ],
    rightWrite: [
      'Yes. "Danced" makes the reader see it.',
      'Leaves are not people, so giving them a dancer’s moves is personification: they spin and leap as if having fun. "Marched" makes them stiff, and "like rain" pours them down.',
    ],
  },
}

// ---------------------------------------------------------------------------
// The config as drawn, read safely.

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
export const isScene = (s: string): s is SceneName => has(SCENE_DATA, s)
export const isTask = (t: string): t is TaskName => (TASKS as readonly string[]).includes(t)

/** The scene a config draws. A refused config still gets one, so nothing can crash on it. */
export const sceneOf = (c: FigConfig): FigScene => SCENE_DATA[isScene(c.scene) ? c.scene : 'lake']
export const taskOf = (c: FigConfig): TaskName => (isTask(c.task) ? c.task : 'carry')

export const fitsOf = (s: FigScene) => s.qualities.filter((q) => q.fits).map((q) => q.id)

/** The qualities carried, each once, in the scene's own order; anything else counts for nothing. */
export function carriedOf(c: FigConfig, state: FigState): string[] {
  const raw = state?.carried
  if (!Array.isArray(raw)) return []
  return sceneOf(c).qualities.filter((q) => raw.includes(q.id)).map((q) => q.id)
}

export function endingOf(c: FigConfig, state: FigState): Ending | null {
  const id = state?.ending
  if (typeof id !== 'string') return null
  return sceneOf(c).endings.find((e) => e.id === id) ?? null
}

/** What the picture shows: the qualities carried, or the chosen ending's picture, or the plain sentence's. */
export function looksOf(c: FigConfig, state: FigState): string[] {
  const s = sceneOf(c)
  if (taskOf(c) === 'carry') return carriedOf(c, state)
  return endingOf(c, state)?.looks ?? s.plainLooks
}

/** The sentence as it reads now, split so the view can mark the part that changes. */
export function sentenceOf(c: FigConfig, state: FigState): { before: string; middle: string; after: string } {
  const s = sceneOf(c)
  if (taskOf(c) === 'carry') return { before: s.before, middle: s.figure, after: s.after }
  const e = endingOf(c, state)
  return { before: s.plainBefore, middle: e ? e.text : s.plainSlot, after: s.plainAfter }
}

const listed = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)

/** What the reader pictures, in words: for the screen reader, and for a wrong card. Never says right or wrong. */
export function picturedOf(scene: FigScene, looks: string[]): string {
  const p = scene.picture
  const order = Object.keys(p.parts)
  const on = order.filter((k) => looks.includes(k))
  const parts = [...(on.some((k) => p.moving.includes(k)) ? [] : [p.base]), ...on.map((k) => p.parts[k])]
  return p.join === 'with' ? `${p.lead} with ${listed(parts)}` : `${p.lead} ${listed(parts)}`
}

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(c: FigConfig, state: FigState): boolean {
  const s = sceneOf(c)
  if (taskOf(c) === 'carry') {
    const made = carriedOf(c, state)
    const fits = fitsOf(s)
    return made.length === fits.length && fits.every((id) => made.includes(id))
  }
  return endingOf(c, state)?.kind === 'right'
}

export function working(c: FigConfig): [string, string] {
  const s = sceneOf(c)
  return taskOf(c) === 'carry' ? s.rightCarry : s.rightWrite
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** What a wrong card says, as a lead and the rest: what the learner made, and a nudge that never names the answer. */
export function madeLines(c: FigConfig, state: FigState): [string, string] {
  const s = sceneOf(c)
  if (taskOf(c) === 'carry') {
    const made = carriedOf(c, state)
    if (!made.length) return ['Nothing is carried across yet.', `Your reader pictures just ${picturedOf(s, [])}.`]
    const silly = made.some((id) => !s.qualities.find((q) => q.id === id)!.fits)
    const said = `Your reader pictures ${picturedOf(s, made)}.`
    if (silly) return [said, `Could a real ${s.noun} be like that?`]
    return [said, `${cap(s.vehicle)} has more to give the ${s.noun === 'leaf' ? 'leaves' : s.noun}.`]
  }
  const e = endingOf(c, state)
  if (!e) return ['You have not chosen an ending yet.', 'The sentence still says it plainly.']
  return [`You chose "${e.text}".`, e.said]
}

export const madeText = (c: FigConfig, state: FigState): string => madeLines(c, state).join(' ')

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, TaskName> = {
  carry: 'carry', 'carry-across': 'carry', 'carry-over': 'carry', meaning: 'carry', 'what-it-means': 'carry', interpret: 'carry', interpreting: 'carry', 'interpret-figurative-language': 'carry',
  explain: 'carry', effect: 'carry', 'effect-on-the-reader': 'carry', picture: 'carry', imagery: 'carry', imagine: 'carry', read: 'carry', understand: 'carry', 'literal-reading': 'carry', qualities: 'carry',
  write: 'write', rewrite: 'write', 'write-figuratively': 'write', choose: 'write', 'choose-an-ending': 'write', finish: 'write', 'finish-the-sentence': 'write', complete: 'write', ending: 'write', endings: 'write',
  'make-figurative': 'write', 'literal-to-figurative': 'write', 'plain-to-figurative': 'write', create: 'write', improve: 'write', upgrade: 'write', 'writers-choice': 'write', 'word-choice': 'write',
}

/** Which scene a word names: the sentence, its subject, its comparison or its device. */
function readScene(raw: string): string {
  const k = keyOf(raw)
  if (/lake|mirror|simile/.test(k)) return 'lake'
  if (/snow|blanket|metaphor/.test(k)) return 'snow'
  if (/lea(f|ves)|danc|personif/.test(k)) return 'leaves'
  return k
}

const goodPrompt = (c: FigConfig) => {
  const s = sceneOf(c)
  return taskOf(c) === 'carry'
    ? `Tap ${s.tapWhat} to carry it into the reader's picture, and tap again to take it out. Carry across only what the writer meant.`
    : `Tap an ending to finish the sentence, and tap another to change it. ${s.aim}`
}

/** Words that name what the learner is to judge, by scene and task. */
const GIVEAWAY: Record<SceneName, { carry: RegExp; write: RegExp }> = {
  lake: {
    carry: /\breflect|\bupside[- ]down\b|\bin front\b|\bshows? (?:the )?(?:trees|things|what)\b|\bflat\b|\bsmooth\b|\bcalm\b|\bripples?\b|\bstill\b|\bframes?\b|\bcrack|\bbreak|\bshatter|\bdrop\b|\bglass\b/i,
    write: /\bmirror|\bwashing\b|\bvery,? very\b|\bi like\b/i,
  },
  snow: {
    carry: /\bcovers?\b|\bcovering\b|\bhid(?:e|es|den|ing)\b|\beverything\b|\bthick|\bsoft\b|\bdeep\b|\bwool|\bknit|\bfold/i,
    write: /\bblanket|\bicing\b|\bsugar\b|\bdusting\b|\bvery,? very\b|\bi like\b/i,
  },
  leaves: {
    carry: /\bspin|\btwirl|\bturn(?:s|ing)?\b|\bleap|\bjump|\bup and down\b|\blight(?:ly)?\b|\bshoes?\b|\bhands?\b|\bpartners?\b/i,
    write: /\bdanc|\bmarch|\blike rain\b|\bslowly\b/i,
  },
}

export const figurativeEngine: SceneEngine<FigConfig, FigState> = {
  id: 'figurative-language',
  // Every telling word here is shared by a stem with another subject ("simil" with similar triangles, "metap" with
  // metaphase, "perso" with personal, "figur" with plane figures, "image" with mirror images), so all are whole phrases.
  covers: [],
  phrases: [
    'figurative language', 'figurative writing', 'figurative meaning', 'figurative meanings', 'figurative expressions', 'figurative phrases',
    'figurative and literal', 'literal and figurative', 'literal or figurative', 'figure of speech', 'figures of speech',
    'simile', 'similes', 'metaphor', 'metaphors', 'personification', 'personify', 'personifying', 'personified',
    'imagery', 'language devices', 'language device', 'literary devices', 'literary device', 'descriptive devices', 'descriptive language',
  ],
  notFor: [
    'satellite imagery', 'aerial imagery', 'remote sensing', 'medical imagery', 'guided imagery', 'motor imagery', 'religious imagery', 'imagery in art',
    'word classes', 'word class', 'parts of speech', 'punctuation', 'persuasive writing', 'persuasive techniques', 'persuasive devices', 'argument writing',
    'rhyme scheme', 'rhyme schemes', 'poetic form', 'poetic forms', 'poetry forms',
  ],
  // The learner chooses the language; what follows is the reader's picture.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawScene = first(src, ['scene', 'sentence', 'example', 'picture', 'device', 'figure', 'comparison', 'subject', 'topic'])
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    if (rawScene !== undefined && typeof rawScene !== 'string') return null
    const word = keyOf(rawTask)
    // A scene's name or a device as the task is the carry task on that scene.
    const sceneAsTask = word && !has(TASK_WORDS, word) && isScene(readScene(word)) ? readScene(word) : ''
    const task = !word ? 'carry' : has(TASK_WORDS, word) ? TASK_WORDS[word] : sceneAsTask ? 'carry' : word
    const scene = rawScene !== undefined && keyOf(rawScene) ? readScene(rawScene) : sceneAsTask || 'lake'
    return { task, scene }
  },

  faults(c) {
    const out: string[] = []
    if (!isTask(c.task)) out.push(`There is no "${c.task}" task here: use carry (tap what a comparison lends the picture) or write (finish a plain sentence), e.g. task "carry".`)
    if (!isScene(c.scene)) out.push(`There is no "${c.scene}" sentence drawn here: use lake (a simile, like a mirror), snow (a metaphor, a blanket) or leaves (personification, danced), e.g. scene "lake".`)
    return out
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const s = sceneOf(c)
    const task = taskOf(c)
    const example = goodPrompt(c)
    const out: string[] = []
    const count = task === 'carry' && /\b(?:one|two|three|four|both|1|2|3|4)\s+(?:of (?:them|these|the cards)|qualities|things|cards|ideas|parts|chips)\b/i.test(text)
    if (GIVEAWAY[s.id][task].test(text) || count || /\bnot (?:a |the )?(?:simile|metaphor|comparison)\b/i.test(text)) {
      out.push(`the prompt gives the answer away: it names what the learner is to judge on the card, or how many -- ask for the aim only ("${example}")`)
    }
    if (/\bdrag\b|\btype\b|\bwrite (?:your|a|an|their) own\b|\bdraw\b|\bunderline\b|\bhighlight\b|\bcircle\b|\bsort\b|\bread (?:it )?aloud\b|\blisten\b|\bhear\b|\bonomatop|\balliterat|\brhym/i.test(text)) {
      out.push(`the prompt promises something the card does not do: the learner taps word cards and watches the reader's picture, with no dragging, typing, drawing, sorting or sound -- ask for that ("${example}")`)
    }
    return out
  },

  initial(c) {
    return taskOf(c) === 'carry' ? { carried: [] } : { ending: null }
  },

  check(c, state) {
    const ok = done(c, state)
    if (ok) return { ok, wrongIds: [] }
    if (taskOf(c) === 'write') return { ok, wrongIds: ['ending'] }
    const s = sceneOf(c)
    const made = carriedOf(c, state)
    return { ok, wrongIds: s.qualities.filter((q) => made.includes(q.id) !== q.fits).map((q) => q.id) }
  },

  solve(c) {
    const s = sceneOf(c)
    return taskOf(c) === 'carry' ? { carried: fitsOf(s) } : { ending: s.endings.find((e) => e.kind === 'right')!.id }
  },

  View: FigurativeView,

  prompt: `SCENE "figurative-language" -- what a reader pictures. A figurative or plain sentence sits above a drawn scene on a quiet light plate, captioned "What a reader pictures", and the learner changes the language with word cards (real buttons) under it while the picture answers: still water fills with the trees upside down, snow rises over a parked car, leaves spin and leap. Language a writer did not mean is drawn literally, and looks silly: a wooden frame round the lake, snow knitted from wool, leaves in dancing shoes.
  For: figurative language, similes, metaphors, personification, imagery, figures of speech, and the effect of a writer's comparison on the reader (Cambridge Primary stages 4 to 6, Lower Secondary). It answers "a metaphor is a lie" (the reader keeps only what fits), "any sentence with like is a simile" ("and I like lakes" changes nothing) and "a plain sentence paints the same picture".
  scene: lake (simile, "The lake was like a mirror."), snow (metaphor, "The snow was a blanket over the town.") or leaves (personification, "The leaves danced in the wind."). A device name picks its scene.
  carry: four things the comparison is like (a mirror, a blanket, a dancer). Each tap carries one into the picture; tap again to take it out. Right is exactly the ones the writer meant (two in each scene); the others draw a literal, silly picture.
  write: the plain sentence ("The lake was still.", "The snow was white.", "The leaves fell in the wind.") and an aim on the card. Four ending cards each rewrite it and repaint the picture: one comparison makes the aim, one makes a different picture, one says it plainly, and one uses the word like or a plain verb with no comparison. Right is the one that makes the aim.
  Not drawn: onomatopoeia, alliteration and other sound devices, idioms, rhyme and poetry form, the learner's own sentences. Not for word classes, punctuation or persuasive writing.
  Before marking the card shows the sentence, the aim, the picture and the cards; it never says which cards fit, names no device and gives no count. Marking says why, names the device, and when wrong says what the learner's reader pictures. The prompt must give the gesture and the aim only: do NOT name a quality on the card (reflection, still, frame, wool, spin, shoes ...), an ending, how many to carry, or which use of like is not a simile.
  config: { "task":"carry", "scene":"lake" }  -- the prompt says "Tap what a mirror is like to carry it into the reader's picture, and tap again to take it out. Carry across only what the writer meant."
       or { "task":"carry", "scene":"leaves" }  -- the prompt says "Tap what a dancer does to carry it into the reader's picture, and tap again to take it out. Carry across only what the writer meant."
       or { "task":"write", "scene":"snow" }  -- the prompt says "Tap an ending to finish the sentence, and tap another to change it. Make the reader see snow so deep and soft that it covers everything, using a comparison."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap what a mirror is like to carry it into the reader's picture, and tap again to take it out. Carry across only what the writer meant.",
    "payload": { "engine":"figurative-language", "config": { "task":"carry", "scene":"lake" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:figurative-language", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap what a dancer does to carry it into the reader's picture, and tap again to take it out. Carry across only what the writer meant.",
    "payload": { "engine":"figurative-language", "config": { "task":"carry", "scene":"leaves" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:figurative-language", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap an ending to finish the sentence, and tap another to change it. Make the reader see snow so deep and soft that it covers everything, using a comparison.",
    "payload": { "engine":"figurative-language", "config": { "task":"write", "scene":"snow" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:figurative-language", "why":"..." } }`,
}

registerEngine(figurativeEngine as SceneEngine<unknown, unknown>)
