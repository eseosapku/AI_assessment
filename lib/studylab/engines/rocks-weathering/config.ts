// lib/studylab/engines/rocks-weathering/config.ts
//
// Two hands-on rock tasks.
//   crystals -- slide a pocket of magma up or down through the ground; the close-up shows the
//               crystals it cools into. Slow cooling (deep) gives big crystals, fast (surface) small.
//   fizz     -- drip acid on each rock in a tray, watch which ones fizz, then mark the ones that
//               rain would slowly wear away. Carbonate rocks fizz, and carbonate rocks are the ones
//               chemical weathering dissolves.
//
// Sources (ideas only, no code or artwork): classroom cooling labs (wax / alum / chocolate) where
// crystal size follows cooling TIME, not the starting temperature or the rock's age
// (flipeducation.ai Year 8 igneous rocks); the vinegar-on-chalk fizz test and the rain-on-limestone
// link (teachchemistry.org "Chemical weathering of rocks"; earthlearningidea.com 214 "Weathering
// limestone"). Facts: granite is a coarse intrusive rock formed deep, basalt a fine extrusive rock,
// dolerite medium-grained in shallow sills and dykes; limestone, chalk and marble are calcium
// carbonate and fizz with dilute acid; granite, basalt and slate do not.
// Left out on purpose: freeze-thaw, onion-skin and root weathering (a card that did them would be a
// button that plays a clip), and sandstone (some are calcite-cemented, so the fizz is arguable).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { RocksWeatheringView } from './View'

export const STOPS = [0, 1, 2, 3, 4] as const
export type Grain = 'fine' | 'medium' | 'coarse'

export const STOP_NAMES = ['Lava on the surface', 'Just under the surface', '1 km down', '5 km down', '15 km down'] as const
export const STOP_COOLING = ['cools very fast', 'cools fast', 'cools slowly', 'cools very slowly', 'cools slowest'] as const
/** Which grain each depth makes. */
export const GRAIN_AT: Grain[] = ['fine', 'fine', 'medium', 'coarse', 'coarse']
/** The depth that stands for a grain in the target picture. */
export const TARGET_STOP: Record<Grain, number> = { fine: 0, medium: 2, coarse: 4 }
export const ROCK_OF: Record<Grain, string> = { fine: 'basalt', medium: 'dolerite', coarse: 'granite' }
export const GRAIN_WORD: Record<Grain, string> = { fine: 'tiny', medium: 'medium', coarse: 'large' }
/** Start well outside the accepted depths for each target. */
export const START_STOP: Record<Grain, number> = { fine: 4, medium: 0, coarse: 0 }

export const SAMPLES = {
  limestone: { name: 'Limestone', fizz: true, kind: 'sedimentary' },
  chalk: { name: 'Chalk', fizz: true, kind: 'sedimentary' },
  marble: { name: 'Marble', fizz: true, kind: 'metamorphic' },
  granite: { name: 'Granite', fizz: false, kind: 'igneous' },
  basalt: { name: 'Basalt', fizz: false, kind: 'igneous' },
  slate: { name: 'Slate', fizz: false, kind: 'metamorphic' },
} as const
export type SampleId = keyof typeof SAMPLES
export const SAMPLE_IDS = Object.keys(SAMPLES) as SampleId[]
export const MIN_SAMPLES = 3
export const MAX_SAMPLES = 6

export type CrystalsConfig = { task: 'crystals'; target: Grain }
export type FizzConfig = { task: 'fizz'; samples: string[] }
export type RocksConfig = CrystalsConfig | FizzConfig
export type RocksState = { stop?: number; tested?: string[]; tagged?: string[] }

const isSample = (id: string): id is SampleId => Object.prototype.hasOwnProperty.call(SAMPLES, id)
const list = (names: string[]) => names.length === 0 ? 'none' : names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
const lower = (s: string) => s.toLowerCase()
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

export const stopOf = (state: RocksState | undefined): number => {
  const s = state?.stop
  return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 4 ? s : 0
}
export const grainAcceptsStop = (target: Grain, stop: number) => GRAIN_AT[stop] === target

const sampleIds = (config: FizzConfig): SampleId[] => config.samples.filter(isSample)
export const fizzers = (config: FizzConfig): SampleId[] => sampleIds(config).filter((id) => SAMPLES[id].fizz)
const idsOf = (v: unknown, config: FizzConfig): SampleId[] => {
  const ok = new Set(sampleIds(config))
  return Array.isArray(v) ? [...new Set(v.filter((x): x is SampleId => typeof x === 'string' && ok.has(x as SampleId)))] : []
}
export const testedOf = (config: FizzConfig, state: RocksState | undefined) => idsOf(state?.tested, config)
/** Only a rock that has been tested can be marked. */
export const taggedOf = (config: FizzConfig, state: RocksState | undefined) => {
  const tested = testedOf(config, state)
  return idsOf(state?.tagged, config).filter((id) => tested.includes(id))
}

function done(config: RocksConfig, state: RocksState): boolean {
  if (config.task === 'crystals') return grainAcceptsStop(config.target, stopOf(state))
  const tested = testedOf(config, state)
  const tagged = taggedOf(config, state)
  const ids = sampleIds(config)
  const want = fizzers(config)
  return ids.every((id) => tested.includes(id)) && tagged.length === want.length && want.every((id) => tagged.includes(id))
}

export function working(config: RocksConfig, state: RocksState): string {
  if (config.task === 'crystals') {
    const slow = config.target === 'coarse'
    const mid = config.target === 'medium'
    return slow
      ? 'Yes. Deep underground the magma is surrounded by hot rock and loses heat very slowly, so its crystals have time to grow large. That makes granite.'
      : mid
        ? 'Yes. A thin sheet of magma a little way down loses its heat at a middling pace, so its crystals grow to a medium size. That makes dolerite.'
        : 'Yes. Near the surface the magma cools fast, so crystals have no time to grow and stay tiny. That makes basalt.'
  }
  const hit = fizzers(config).map((id) => lower(SAMPLES[id].name))
  const miss = sampleIds(config).filter((id) => !SAMPLES[id].fizz).map((id) => lower(SAMPLES[id].name))
  const fizzed = hit.length === 0
    ? 'None of these rocks fizzed, so none contains calcium carbonate and rain will not dissolve them.'
    : `${cap(list(hit))} fizzed because ${hit.length === 1 ? 'it is' : 'they are'} calcium carbonate. Rain is a weak acid, so over years it slowly dissolves ${hit.length === 1 ? 'it' : 'them'}: that is chemical weathering.`
  return miss.length && hit.length ? `Yes. ${fizzed} ${list(miss).replace(/^./, (c) => c.toUpperCase())} did not fizz, so rain leaves ${miss.length === 1 ? 'it' : 'them'} alone.` : `Yes. ${fizzed}`
}

export function madeText(config: RocksConfig, state: RocksState): string {
  if (config.task === 'crystals') {
    const stop = stopOf(state)
    const g = GRAIN_AT[stop]
    const need = config.target === 'coarse' ? 'slower cooling, so deeper down' : config.target === 'fine' ? 'faster cooling, so nearer the surface' : g === 'fine' ? 'a little slower cooling, so a bit deeper' : 'a little faster cooling, so a bit higher'
    return `You made ${GRAIN_WORD[g]} crystals, like ${ROCK_OF[g]}: the magma ${STOP_COOLING[stop]}. The target has ${GRAIN_WORD[config.target]} crystals, which needs ${need}.`
  }
  const tested = testedOf(config, state)
  const tagged = taggedOf(config, state)
  const untested = sampleIds(config).filter((id) => !tested.includes(id))
  if (untested.length) return `You have not tested ${list(untested.map((id) => lower(SAMPLES[id].name)))} yet. Add acid to every rock before you decide.`
  const extra = tagged.filter((id) => !SAMPLES[id].fizz)
  const missing = fizzers(config).filter((id) => !tagged.includes(id))
  const parts: string[] = []
  if (extra.length) parts.push(`${cap(list(extra.map((id) => lower(SAMPLES[id].name))))} did not fizz, so rain will not dissolve ${extra.length === 1 ? 'it' : 'them'}`)
  if (missing.length) parts.push(`${cap(list(missing.map((id) => lower(SAMPLES[id].name))))} fizzed, so rain will wear ${missing.length === 1 ? 'it' : 'them'} away`)
  return `You marked ${list(tagged.map((id) => lower(SAMPLES[id].name)))}. ${parts.join('. ')}.`
}

// ---------------------------------------------------------------------------

const GRAIN_WORDS: [RegExp, Grain][] = [
  [/basalt|extrusive|fine|small|tiny|fast|quick|surface|lava/, 'fine'],
  [/dolerite|medium|middle|mid|sill|dyke|dike/, 'medium'],
  [/granite|intrusive|coarse|large|big|slow|deep|huge/, 'coarse'],
]
function readGrain(raw: unknown): Grain | null {
  if (typeof raw !== 'string') return null
  const k = raw.trim().toLowerCase()
  return GRAIN_WORDS.find(([re]) => re.test(k))?.[1] ?? null
}
const readSample = (raw: unknown): string | null => {
  if (typeof raw === 'object' && raw && typeof (raw as { name?: unknown }).name === 'string') return readSample((raw as { name: string }).name)
  if (typeof raw !== 'string') return null
  const k = raw.trim().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ')
  return k || null
}

const goodFizz = ['limestone', 'granite', 'marble', 'basalt']
const goodPrompt = (config: RocksConfig) => config.task === 'crystals'
  ? 'Drag the magma up or down through the ground until the rock it cools into looks like the target, then check.'
  : 'Tap Add acid on each rock to test it, then tap Wears away on the rocks that acid rain would slowly eat into.'

export const rocksWeatheringEngine: SceneEngine<RocksConfig, RocksState> = {
  id: 'rocks-weathering',
  covers: ['igneous'],
  phrases: [
    'types of rock', 'types of rocks', 'rock types', 'three types of rock', 'kinds of rock', 'how rocks form', 'how rocks are formed', 'rock formation', 'rocks and weathering',
    'igneous rocks', 'igneous rock', 'sedimentary rocks', 'sedimentary rock', 'metamorphic rocks', 'metamorphic rock', 'weathering', 'weathering of rocks',
    'chemical weathering', 'acid rain and limestone', 'testing rocks', 'testing rocks with acid', 'rocks and minerals', 'crystal size in rocks', 'granite and basalt',
  ],
  notFor: [
    'rock cycle', 'rock cycles', 'freeze thaw', 'physical weathering', 'mechanical weathering', 'biological weathering', 'onion skin', 'exfoliation', 'root action',
    'plate tectonics', 'volcanic eruptions', 'earthquakes', 'rivers', 'river erosion', 'coastal erosion', 'coasts', 'soil', 'fossils', 'fossil', 'rock music', 'rock climbing', 'rock pool', 'rock pools',
    'weather and climate', 'weather forecast', 'space weathering', 'weathering the storm', 'sedimentary basin', 'sedimentation',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const taskKey = String(o.task ?? o.kind ?? o.type ?? o.mode ?? '').toLowerCase()
    const rawSamples = o.samples ?? o.rocks ?? o.tray ?? o.items
    const task = /crystal|cool|magma|grain|igneous/.test(taskKey) ? 'crystals'
      : /fizz|acid|test|chemical|weather/.test(taskKey) ? 'fizz'
        : Array.isArray(rawSamples) ? 'fizz' : (o.target ?? o.rock ?? o.grain ?? o.crystals) !== undefined ? 'crystals' : null
    if (task === 'crystals') {
      const target = readGrain(o.target ?? o.rock ?? o.grain ?? o.crystals ?? o.size)
      return target ? { task, target } : null
    }
    if (task === 'fizz') {
      if (!Array.isArray(rawSamples)) return null
      const samples = rawSamples.map(readSample)
      if (samples.some((s) => s === null)) return null
      return { task, samples: samples as string[] }
    }
    return null
  },

  faults(config) {
    if (config.task === 'crystals') return []
    const unknown = config.samples.filter((s) => !isSample(s))
    const example = `samples ${JSON.stringify(goodFizz)}`
    if (unknown.length) return [`The card cannot draw ${list(unknown)}. It has ${SAMPLE_IDS.join(', ')}: use e.g. ${example}.`]
    if (new Set(config.samples).size !== config.samples.length) return [`Each rock can appear once: use e.g. ${example}.`]
    if (config.samples.length < MIN_SAMPLES || config.samples.length > MAX_SAMPLES) return [`Use ${MIN_SAMPLES} to ${MAX_SAMPLES} rocks in the tray: use e.g. ${example}.`]
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'crystals') {
      if (/\b(granite|basalt|dolerite|gabbro|obsidian|intrusive|extrusive)\b/i.test(text)) out.push(`The prompt names the rock, which the card names when it marks: ask for a rock that matches the target ("${example}")`)
      if (/\b(deep|deeper|deepest|slow(?:ly|er)?|fast(?:er)?|quick(?:ly)?|big|bigger|large|larger|coarse|tiny|small|slowest)\b[^.?!]{0,30}\b(crystals?|cool\w*|magma|rock)\b|\b(crystals?|cool\w*)\b[^.?!]{0,30}\b(deep|slow(?:ly)?|fast|quick(?:ly)?|big|large|coarse|tiny|small)\b/i.test(text)) out.push(`The prompt says how deep, how fast or how big, which is what the learner works out: ask only for a match with the target ("${example}")`)
    } else {
      if (/\b(calcium carbonate|carbonates?)\b/i.test(text) || /\b(limestone|chalk|marble)\b[^.?!]{0,40}\b(fizz\w*|dissolv\w*|wear\w*|weather\w*)\b/i.test(text)) out.push(`The prompt says which rocks react, which the acid test shows: ask for the rocks acid rain would wear away ("${example}")`)
      if (/\bfizz\w*\b[^.?!]{0,40}\b(means|because|so)\b/i.test(text)) out.push(`The prompt explains what a fizz means: leave that for the marking ("${example}")`)
    }
    if (/\b(freez\w*|frozen|ice|roots?|onion|rock cycle|heat and pressure|cooled magma|compress\w*|cement\w*)\b/i.test(text)) out.push(`The prompt mentions something the card does not show: it has magma cooling at different depths, and acid dripped on rocks ("${example}")`)
    return out
  },

  initial(config) {
    return config.task === 'crystals' ? { stop: START_STOP[config.target] } : { tested: [], tagged: [] }
  },

  check(config, state) {
    const ok = done(config, state)
    if (ok) return { ok, wrongIds: [] }
    if (config.task === 'crystals') return { ok, wrongIds: ['magma'] }
    const tested = testedOf(config, state)
    const tagged = taggedOf(config, state)
    return {
      ok,
      wrongIds: sampleIds(config).filter((id) => !tested.includes(id) || tagged.includes(id) !== SAMPLES[id].fizz),
    }
  },

  solve(config) {
    return config.task === 'crystals'
      ? { stop: TARGET_STOP[config.target] }
      : { tested: sampleIds(config), tagged: fizzers(config) }
  },

  View: RocksWeatheringView,

  prompt: `SCENE "rocks-weathering" -- two hands-on rock tasks on a quiet light panel.
  crystals: a cross-section of the ground with a glowing pocket of magma on a vertical scale of five depths (lava on the surface, just under the surface, 1 km, 5 km, 15 km down), each labelled with how fast it cools. The learner drags the magma (or taps a depth) up and down; two close-ups sit below: "Your rock", showing the crystals the magma cools into at that depth, and "Target rock", a sample to match. Same minerals, different crystal size. target: "fine" (tiny crystals), "medium" or "coarse" (large). Words like basalt, dolerite, granite, small and large are read too.
  fizz: a tray of 3 to 6 rocks. Each has an "Add acid" button: an acid drop falls on the rock and it fizzes with bubbles or does nothing, then says "Fizzes" or "No fizz". After testing a rock, "Wears away" unlocks to mark it; the learner marks the rocks that rain would slowly dissolve. Every rock must be tested. samples: any of "limestone", "chalk", "marble" (all fizz) and "granite", "basalt", "slate" (none fizz); use 3 to 6, each once. All-fizz and none-fizz trays are allowed.
  For: types of rock and how they form (igneous crystal size from cooling speed), chemical weathering, testing rocks with acid. Not for freeze-thaw, physical or biological weathering, the rock cycle, rivers and coasts, tectonics, fossils or soil.
  Before marking it shows only what the learner did: where the magma is, its crystals, whether a drop fizzed. The rock names (granite, basalt, dolerite), the words "chemical weathering" and the reason appear only when marked. Prompts must give the gesture (drag the magma / tap Add acid, then Wears away) and must not name the rock, say how deep, fast or big, or say which rocks react.
  config: { "task":"crystals", "target":"coarse" }
       or { "task":"fizz", "samples":["limestone","granite","marble","basalt"] }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the magma up or down through the ground until the rock it cools into looks like the target, then check.",
    "payload": { "engine":"rocks-weathering", "config": { "task":"crystals", "target":"coarse" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:rocks-weathering", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap Add acid on each rock to test it, then tap Wears away on the rocks that acid rain would slowly eat into.",
    "payload": { "engine":"rocks-weathering", "config": { "task":"fizz", "samples":["limestone","granite","marble","basalt"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:rocks-weathering", "why":"..." } }`,
}

registerEngine(rocksWeatheringEngine as SceneEngine<unknown, unknown>)
