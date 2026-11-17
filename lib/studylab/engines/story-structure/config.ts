// lib/studylab/engines/story-structure/config.ts
//
// A story mountain the learner shapes with their hands. Five illustrated story events stay in
// narrative order. Pulling an event up or down changes the reader's tension at that point, and
// the line bends through it. A satisfying basic arc rises from a calm opening to one highest
// turning point, then settles as the character solves the problem.
//
// Teaching model: BBC Bitesize's primary story mountain (opening, build-up, problem,
// resolution, ending) and Plazoom's low-to-apex-and-back account of dramatic tension. The
// build-up here contains the problem, so the climax is the turning point at greatest tension,
// not a second problem. Many reasonable mountains pass: this is a shape to understand, not a
// row of exact values to copy. Sources and choices are in research.md.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { StoryStructureView } from './View'

export type StoryTask = 'shape' | 'mend'
export type StoryName = 'kite' | 'lighthouse' | 'robot' | 'turtle' | 'violin'
// Unknown names still parse so faults can give the writer a useful nearby example.
export type StoryConfig = { task: StoryTask; story: string; broken?: string }
export type StoryState = { levels: number[] }

export const STAGE_NAMES = ['Opening', 'Build-up', 'Climax', 'Resolution', 'Ending'] as const
export const MIN_LEVEL = 1
export const MAX_LEVEL = 5
/** One whole notch of change at every important point: visible, never a pixel-hunting task. */
export const ARC_TOLERANCE = 1

export type StoryBeat = { text: string; art: string }
export const STORIES: Record<StoryName, { title: string; beats: StoryBeat[] }> = {
  kite: {
    title: 'The kite in the storm',
    beats: [
      { text: 'Kite by sea', art: 'kite' },
      { text: 'Wind to rocks', art: 'wind' },
      { text: 'Mia turns kite', art: 'pull' },
      { text: 'Mia catches', art: 'catch' },
      { text: 'Calm walk home', art: 'home' },
    ],
  },
  lighthouse: {
    title: 'The lighthouse lamp',
    beats: [
      { text: 'Sam checks', art: 'lamp' },
      { text: 'Lamp fails', art: 'boat' },
      { text: 'Sam turns crank', art: 'crank' },
      { text: 'Boat sees light', art: 'beam' },
      { text: 'Boat sails on', art: 'calm' },
    ],
  },
  robot: {
    title: 'The runaway robot',
    beats: [
      { text: 'Nia builds', art: 'robot' },
      { text: 'Robot rolls', art: 'sunflower' },
      { text: 'Nia stops it', art: 'stop' },
      { text: 'Plant is safe', art: 'safe' },
      { text: 'Robot helps', art: 'garden' },
    ],
  },
  turtle: {
    title: 'The little turtle',
    beats: [
      { text: 'Turtle hatches', art: 'egg' },
      { text: 'Ring blocks path', art: 'ring' },
      { text: 'Ash lifts ring', art: 'lift' },
      { text: 'Into the sea', art: 'waves' },
      { text: 'Beach is clean', art: 'beach' },
    ],
  },
  violin: {
    title: 'The empty music stand',
    beats: [
      { text: 'Jo practises', art: 'violin' },
      { text: 'Music blows', art: 'music' },
      { text: 'Jo plays on', art: 'play' },
      { text: 'Crowd claps', art: 'clap' },
      { text: 'Jo smiles', art: 'smile' },
    ],
  },
}

export const BREAKS = ['early-peak', 'no-build-up', 'weak-climax', 'unsettled-ending'] as const
export const BROKEN_ARCS: Record<string, number[]> = {
  'early-peak': [4, 2, 3, 2, 1],
  'no-build-up': [1, 1, 4, 2, 1],
  'weak-climax': [1, 3, 2, 2, 1],
  'unsettled-ending': [1, 3, 5, 3, 4],
}
/** The highest card is one clear row above everything else. */
export const CLEAR_PEAK = 1

export const storyOf = (config: StoryConfig) => Object.prototype.hasOwnProperty.call(STORIES, config.story) ? STORIES[config.story as StoryName] : STORIES.kite
export const arcOf = (config: StoryConfig) => BROKEN_ARCS[config.broken ?? ''] ?? BROKEN_ARCS['early-peak']

/** Read stored work defensively: only five whole notches on the card count. */
export function levelsOf(state: StoryState): number[] {
  const raw = Array.isArray(state?.levels) ? state.levels : []
  return Array.from({ length: 5 }, (_, i) => {
    const n = raw[i]
    return typeof n === 'number' && Number.isInteger(n) && n >= MIN_LEVEL && n <= MAX_LEVEL ? n : MIN_LEVEL
  })
}

/** The rules, not the drawing, decide. Each rule has a full notch of room. */
export function arcFaults(levels: number[]): string[] {
  const h = levelsOf({ levels })
  const out: string[] = []
  if (h[0] > 1 + ARC_TOLERANCE) out.push('The opening starts with too much tension: give the reader room to learn who and where first.')
  if (h[1] < h[0] + ARC_TOLERANCE) out.push('The build-up does not rise above the opening: let the problem make the reader more curious or worried.')
  const peak = Math.max(...h)
  if (h[2] !== peak) out.push('The climax is not the highest point: the turning point should carry the most tension.')
  if (h.some((v, i) => i !== 2 && h[2] - v < CLEAR_PEAK)) out.push('Another event is as high as the climax: give the turning point one clear highest peak.')
  if (h[3] > h[2] - ARC_TOLERANCE) out.push('The resolution does not come down from the climax: show the problem being solved and the tension easing.')
  if (h[4] > 1 + ARC_TOLERANCE) out.push('The ending stays too tense: let the answer to the problem settle the story.')
  if (h[4] > h[3]) out.push('The ending rises again after the resolution: keep this simple arc settled once the problem is answered.')
  return out
}

export function madeArc(config: StoryConfig, state: StoryState): { lead: string; detail: string } {
  const found = arcFaults(levelsOf(state))
  if (!found.length) {
    return {
      lead: 'Yes — a clear story mountain.',
      detail: 'Calm start, one highest climax, then a settled ending. Many shapes work.',
    }
  }
  return { lead: 'This arc is not quite a story mountain yet.', detail: found[0] }
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config.

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const STORY_WORDS: Record<string, StoryName> = {
  kite: 'kite', storm: 'kite', mia: 'kite', 'kite-in-the-storm': 'kite', 'the-kite-in-the-storm': 'kite', seaside: 'kite',
  lighthouse: 'lighthouse', lamp: 'lighthouse', sam: 'lighthouse', 'lighthouse-lamp': 'lighthouse', 'the-lighthouse-lamp': 'lighthouse', boat: 'lighthouse',
  robot: 'robot', nia: 'robot', 'runaway-robot': 'robot', 'the-runaway-robot': 'robot', sunflower: 'robot', garden: 'robot',
  turtle: 'turtle', ash: 'turtle', 'little-turtle': 'turtle', 'the-little-turtle': 'turtle', beach: 'turtle', plastic: 'turtle',
  violin: 'violin', jo: 'violin', music: 'violin', concert: 'violin', 'empty-music-stand': 'violin', 'the-empty-music-stand': 'violin',
}
const TASK_WORDS: Record<string, StoryTask> = {
  shape: 'shape', build: 'shape', make: 'shape', create: 'shape', plan: 'shape', arc: 'shape', mountain: 'shape', 'story-mountain': 'shape',
  'shape-arc': 'shape', 'shape-the-arc': 'shape', 'build-arc': 'shape', 'build-a-story-mountain': 'shape', tension: 'shape', 'tension-arc': 'shape',
  mend: 'mend', fix: 'mend', repair: 'mend', revise: 'mend', improve: 'mend', edit: 'mend', 'mend-arc': 'mend', 'mend-the-arc': 'mend',
  'fix-arc': 'mend', 'fix-the-arc': 'mend', 'broken-arc': 'mend', 'repair-the-mountain': 'mend',
}
const BREAK_WORDS: Record<string, string> = {
  'early-peak': 'early-peak', early: 'early-peak', 'peak-too-early': 'early-peak', 'climax-too-early': 'early-peak',
  'no-build-up': 'no-build-up', 'flat-build-up': 'no-build-up', 'missing-build-up': 'no-build-up', build: 'no-build-up',
  'weak-climax': 'weak-climax', weak: 'weak-climax', 'low-climax': 'weak-climax', 'no-clear-peak': 'weak-climax',
  'unsettled-ending': 'unsettled-ending', ending: 'unsettled-ending', 'tense-ending': 'unsettled-ending', 'ending-too-tense': 'unsettled-ending',
}
const readStory = (raw: unknown): string => {
  const key = keyOf(raw)
  return STORY_WORDS[key] ?? (key || 'kite')
}
const nearestStory = (raw: unknown): StoryName => {
  const key = keyOf(raw)
  const found = Object.keys(STORY_WORDS).find((k) => key.includes(k))
  return found ? STORY_WORDS[found] : 'kite'
}
const goodPrompt = (config: StoryConfig) => config.task === 'mend'
  ? 'Drag each event up or down to change the reader’s tension. Mend the story mountain: build to one highest climax, then let the resolution and ending settle. You can also use the + and − buttons.'
  : 'Drag each event up or down to change the reader’s tension. Shape a story mountain: start calmly, build to one highest climax, then let the resolution and ending settle. You can also use the + and − buttons.'

export const storyStructureEngine: SceneEngine<StoryConfig, StoryState> = {
  id: 'story-structure',
  // No bare everyday words: "story", "plot" and "structure" all catch unrelated stations.
  covers: ['climax', 'narrative'],
  phrases: [
    'story structure', 'story structures', 'narrative structure', 'narrative structures', 'story mountain', 'story mountains',
    'plot structure', 'plot structures', 'plot mountain', 'plot mountains', 'story arc', 'story arcs', 'narrative arc', 'narrative arcs',
    'plot arc', 'plot arcs', 'plot diagram', 'plot diagrams', 'narrative writing', 'story writing', 'writing stories', 'story planning',
    'planning a story', 'plan a story', 'planning stories', 'planning a narrative', 'narrative planning', 'fiction writing',
    'beginning middle and end', 'beginning, middle and end', 'beginnings middles and ends', 'climax and resolution',
    'rising action', 'falling action', 'turning point', 'turning points', 'building tension', 'build tension', 'tension in stories',
    'opening build up problem resolution ending', 'opening build-up problem resolution ending', 'parts of a story', 'shape of a story',
  ],
  notFor: [
    'climax community', 'climax communities', 'ecological succession', 'succession',
    'figurative language', 'simile', 'similes', 'metaphor', 'metaphors', 'personification', 'word classes', 'parts of speech',
    'noun', 'nouns', 'verb', 'verbs', 'adjective', 'adjectives', 'adverb', 'adverbs', 'punctuation', 'direct speech', 'speech marks',
    'persuasive writing', 'argument writing', 'argumentative writing', 'claim and evidence', 'claims and evidence', 'essay structure',
    'timeline', 'timelines', 'historical events', 'chronology', 'flashback', 'flashbacks', 'in medias res', 'multiple climaxes',
    'character description', 'setting description', 'poetry', 'poem', 'poems', 'play script', 'play scripts',
  ],
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (word && !TASK_WORDS[word]) return null
    const rawStory = first(src, ['story', 'tale', 'scenario', 'example', 'title'])
    if (rawStory !== undefined && typeof rawStory !== 'string') return null
    const story = readStory(rawStory)
    const rawBroken = first(src, ['broken', 'fault', 'flaw', 'problem', 'start'])
    const broken = rawBroken === undefined ? undefined : BREAK_WORDS[keyOf(rawBroken)] ?? keyOf(rawBroken)
    const task: StoryTask = word ? TASK_WORDS[word] : broken !== undefined ? 'mend' : 'shape'
    return task === 'mend' ? { task, story, broken: broken ?? 'early-peak' } : { task, story }
  },

  faults(config) {
    const out: string[] = []
    if (!Object.prototype.hasOwnProperty.call(STORIES, config.story)) {
      const near = nearestStory(config.story)
      out.push(`There is no "${config.story}" story drawn here: use kite, lighthouse, robot, turtle or violin, e.g. story "${near}".`)
    }
    if (config.task === 'mend' && !BROKEN_ARCS[config.broken ?? '']) {
      out.push(`There is no "${config.broken}" broken arc: use early-peak, no-build-up, weak-climax or unsettled-ending, e.g. broken "early-peak".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    // The task names the wanted shape, but may not supply a curve to copy or locate a fault.
    const values = /\b(?:opening|build[ -]?up|climax|resolution|ending)\b[^a-z]{0,12}[1-5]\b|\b(?:opening|build[ -]?up|climax|resolution|ending)\b[^.?!]{0,45}\b(?:level|height|notch|row|value)\s*[1-5]\b/i.test(text)
    const heights = /\b(?:[1-5]|one|two|three|four|five)\s+(?:notches?|levels?|rows?)\b|\bset\s+(?:the\s+)?(?:opening|build[ -]?up|climax|resolution|ending)\s+to\b/i.test(text)
    const fault = config.task === 'mend' && new RegExp(`\\b${(config.broken ?? '').replace(/-/g, '[ -]?')}\\b|\\bpeak (?:is |comes )?too early\\b|\\bno build[ -]?up\\b|\\bweak climax\\b|\\bending (?:is |stays )?too tense\\b`, 'i').test(text)
    if (values || heights || fault) out.push(`the prompt gives away the tension pattern or the fault the learner is to find: ask for the shape only ("${example}")`)
    if (/\border\s+the\s+events\b|\bsequence\s+the\s+events\b|\bwrite\s+(?:a|the|your)\s+(?:story|paragraph|opening|ending)\b|\bchoose\s+the\s+best\s+(?:opening|ending|climax)\b/i.test(text)) {
      out.push(`the prompt promises a different task: the events are already in story order and the learner changes their heights, not their order or wording ("${example}")`)
    }
    return out
  },

  initial(config) {
    return { levels: config.task === 'mend' ? [...arcOf(config)] : [1, 1, 1, 1, 1] }
  },

  check(config, state) {
    return { ok: arcFaults(levelsOf(state)).length === 0, wrongIds: [] }
  },

  solve() {
    return { levels: [1, 3, 5, 3, 1] }
  },

  View: StoryStructureView,

  prompt: `SCENE "story-structure" -- five small illustrated story events in reading order on a quiet light panel: opening, build-up, climax, resolution and ending. Each event sits on a vertical track. The learner drags an event up or down, and the blue line through all five events bends with it. Higher means more reader tension; low means calm. Tapping an event also selects it for one shared + and − stepper, so the task needs no precise dragging. The supplied story is already written on the five event cards. It includes a problem in the build-up, a turning point caused by the character at the climax, and an ending that answers that problem.
  For: story mountains, narrative and plot structure, the basic tension arc, rising and falling tension, climax and resolution, and planning a story. It answers "the biggest event can happen anywhere", "the ending should stay as tense as the climax" and "story structure means putting events in order". It accepts many reasonable mountains, not one exact set of heights. It is not for writing prose, ordering events, flashbacks, in medias res, multiple peaks, or analysing a long text.
  task: "shape" starts with five calm events; make a story mountain. "mend" starts with a visibly broken mountain; mend it. broken (mend only): early-peak (default), no-build-up, weak-climax or unsettled-ending.
  story: kite (Mia's kite blows towards rocks), lighthouse (Sam must relight the lamp), robot (Nia's robot threatens a sunflower), turtle (Ash clears a turtle's path), or violin (Jo loses his concert music). All five are suitable for primary and lower secondary English.
  Before marking the card shows only the five events, their part names, the live tension line and low/high labels. It does not say whether the shape is right, name a fault, or reveal target heights. Marking says whether the arc works and, if not, explains the first structural problem. The prompt must not give heights, a sequence of numbers, or name the broken arc's fault. It must say the drag gesture. Do not ask pupils to order or rewrite the events.
  config: { "task":"shape", "story":"kite" } -- the prompt says "Drag each event up or down to change the reader’s tension. Shape a story mountain: start calmly, build to one highest climax, then let the resolution and ending settle. Or tap an event and use its + and − buttons."
       or { "task":"shape", "story":"robot" } -- the same prompt
       or { "task":"mend", "story":"lighthouse", "broken":"weak-climax" } -- the prompt says "Drag each event up or down to change the reader’s tension. Mend the story mountain: build to one highest climax, then let the resolution and ending settle. Or tap an event and use its + and − buttons."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each event up or down to change the reader’s tension. Shape a story mountain: start calmly, build to one highest climax, then let the resolution and ending settle. Or tap an event and use its + and − buttons.",
    "payload": { "engine":"story-structure", "config": { "task":"shape", "story":"kite" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:story-structure", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each event up or down to change the reader’s tension. Shape a story mountain: start calmly, build to one highest climax, then let the resolution and ending settle. Or tap an event and use its + and − buttons.",
    "payload": { "engine":"story-structure", "config": { "task":"shape", "story":"robot" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:story-structure", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each event up or down to change the reader’s tension. Mend the story mountain: build to one highest climax, then let the resolution and ending settle. Or tap an event and use its + and − buttons.",
    "payload": { "engine":"story-structure", "config": { "task":"mend", "story":"lighthouse", "broken":"weak-climax" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:story-structure", "why":"..." } }`,
}

registerEngine(storyStructureEngine as SceneEngine<unknown, unknown>)
