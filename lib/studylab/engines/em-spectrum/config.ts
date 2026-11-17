// lib/studylab/engines/em-spectrum/config.ts
//
// One tuner for the whole electromagnetic spectrum. The learner slides it through seven broad regions and watches
// the crest spacing squeeze while frequency rises. The drawn wave always crosses the monitor at the same pace:
// every electromagnetic wave has the same speed in a vacuum. Region names are held back until marking.
//
//   region -- find a named region of the spectrum;
//   use    -- tune a real receiver until its event happens (a picture appears, food warms, a scan shows bones).
//
// The values are representative wavelengths, NOT boundaries: school textbooks differ at the soft edges of regions.
// They use c = f λ = 3.0 x 10^8 m/s exactly. Sources: Cambridge 0625 lesson notes compiled by Tutopiya (order,
// representative uses and recorded learner errors); NASA Imagine the Universe (one family of EM radiation);
// NASA Science, Anatomy of an Electromagnetic Wave (wavelength, frequency and travel through a vacuum).
// https://www.tutopiya.com/lesson-notes/igcse-cambridge-physics/electromagnetic-spectrum/
// https://imagine.gsfc.nasa.gov/science/toolbox/emspectrum1.html
// https://science.nasa.gov/ems/02_anatomy
//
// Design ideas, never code or art: PhET Radio Waves puts the transmitter frequency in the learner's hand and makes
// a receiver answer; NASA pairs each region with a detector; tactile spectrum lessons make spacing physically.
// This card keeps only the tune-and-watch act, with generous whole-region stops and no precise band boundaries.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EmSpectrumView } from './View'

export const REGION_IDS = ['radio', 'microwave', 'infrared', 'visible', 'ultraviolet', 'xray', 'gamma'] as const
export type RegionId = (typeof REGION_IDS)[number]
export type UseId = 'broadcasting' | 'cooking' | 'remote-control' | 'photography' | 'security-marking' | 'medical-imaging' | 'sterilising-equipment'

export type Region = {
  id: RegionId
  name: string
  /** Representative wavelength in metres. */
  wavelength: number
  use: UseId
  receiver: string
  goal: string
  event: string
  otherUses: string
  hazard: string
}

export const REGIONS: Region[] = [
  { id: 'radio', name: 'radio waves', wavelength: 100, use: 'broadcasting', receiver: 'Radio receiver', goal: 'make the radio play', event: 'The radio is playing a broadcast.', otherUses: 'television broadcasting', hazard: 'no significant harm at everyday levels' },
  // About 12 cm is the usual 2.45 GHz oven wavelength; a TV remote uses near-IR around 940 nm (NASA).
  { id: 'microwave', name: 'microwaves', wavelength: 0.12, use: 'cooking', receiver: 'Microwave oven', goal: 'warm the food in the oven', event: 'The food is warming inside the oven.', otherUses: 'satellites and mobile phones', hazard: 'exposure can heat internal body tissue' },
  { id: 'infrared', name: 'infrared', wavelength: 9.4e-7, use: 'remote-control', receiver: 'Television and remote', goal: 'switch on the television with its remote', event: 'The television has switched on.', otherUses: 'thermal imaging and grills', hazard: 'too much infrared can burn skin' },
  { id: 'visible', name: 'visible light', wavelength: 5e-7, use: 'photography', receiver: 'Camera', goal: 'take a photograph', event: 'A photograph has appeared on the camera.', otherUses: 'seeing and optical fibres', hazard: 'very intense light can damage the eyes' },
  // Security inks fluoresce in near-UV, commonly around 365 nm, not in the extreme-UV part of the spectrum.
  { id: 'ultraviolet', name: 'ultraviolet', wavelength: 3.65e-7, use: 'security-marking', receiver: 'Banknote checker', goal: 'make the hidden security mark appear', event: 'The hidden security mark is glowing.', otherUses: 'sterilising water', hazard: 'too much ultraviolet can damage skin and eyes' },
  { id: 'xray', name: 'X-rays', wavelength: 1e-10, use: 'medical-imaging', receiver: 'X-ray screen', goal: 'make the bones appear on the X-ray screen', event: 'An image of the bones has appeared.', otherUses: 'airport security scanners', hazard: 'exposure can cause cell mutations and cancer' },
  { id: 'gamma', name: 'gamma rays', wavelength: 1e-12, use: 'sterilising-equipment', receiver: 'Sterilisation pouch', goal: 'sterilise the sealed medical equipment', event: 'The sterilisation indicator has changed colour.', otherUses: 'treating cancer', hazard: 'exposure can cause cell mutations and cancer' },
]

export const SPEED_OF_LIGHT = 3e8
export type EmConfig = { task: 'region'; region: string } | { task: 'use'; use: string }
export type EmState = { at: number }

export const regionAt = (index: number): Region => REGIONS[Math.max(0, Math.min(REGIONS.length - 1, Math.round(index)))] ?? REGIONS[0]
export const regionById = (id: string): Region | undefined => REGIONS.find((r) => r.id === id)
export const regionForUse = (use: string): Region | undefined => REGIONS.find((r) => r.use === use)
export const targetRegion = (config: EmConfig): Region => config.task === 'region' ? regionById(config.region) ?? REGIONS[0] : regionForUse(config.use) ?? REGIONS[1]
export const targetIndex = (config: EmConfig): number => REGIONS.indexOf(targetRegion(config))
export const frequencyOf = (region: Region): number => SPEED_OF_LIGHT / region.wavelength

export function madeAt(state: EmState): number {
  const at = state && typeof state.at === 'number' && Number.isFinite(state.at) ? Math.round(state.at) : -1
  return at >= 0 && at < REGIONS.length ? at : -1
}

/** A start well away from the target, so no configuration opens already solved. */
export function startIndex(config: EmConfig): number {
  return targetIndex(config) <= 3 ? REGIONS.length - 1 : 0
}

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const REGION_WORDS: Record<string, RegionId> = {
  radio: 'radio', 'radio-wave': 'radio', 'radio-waves': 'radio', radiowaves: 'radio', broadcast: 'radio', broadcasting: 'radio',
  microwave: 'microwave', microwaves: 'microwave', 'micro-wave': 'microwave', 'micro-waves': 'microwave',
  infrared: 'infrared', 'infra-red': 'infrared', ir: 'infrared', heat: 'infrared', 'thermal-imaging': 'infrared',
  visible: 'visible', light: 'visible', 'visible-light': 'visible', 'visible-waves': 'visible', optical: 'visible',
  ultraviolet: 'ultraviolet', 'ultra-violet': 'ultraviolet', uv: 'ultraviolet',
  xray: 'xray', xrays: 'xray', 'x-ray': 'xray', 'x-rays': 'xray', 'x-radiation': 'xray', roentgen: 'xray',
  gamma: 'gamma', 'gamma-ray': 'gamma', 'gamma-rays': 'gamma', 'gamma-radiation': 'gamma',
}

const USE_WORDS: Record<string, UseId> = {
  broadcast: 'broadcasting', broadcasting: 'broadcasting', radio: 'broadcasting', 'radio-broadcasting': 'broadcasting', 'radio-receiver': 'broadcasting', 'play-the-radio': 'broadcasting',
  cooking: 'cooking', cook: 'cooking', oven: 'cooking', 'microwave-oven': 'cooking', 'warm-food': 'cooking', 'heating-food': 'cooking',
  remote: 'remote-control', 'remote-control': 'remote-control', 'remote-controls': 'remote-control', television: 'remote-control', tv: 'remote-control', 'tv-remote': 'remote-control',
  photography: 'photography', photograph: 'photography', camera: 'photography', 'take-a-photograph': 'photography', seeing: 'photography',
  security: 'security-marking', 'security-marking': 'security-marking', 'security-mark': 'security-marking', banknote: 'security-marking', banknotes: 'security-marking', 'banknote-checker': 'security-marking', 'hidden-mark': 'security-marking',
  imaging: 'medical-imaging', 'medical-imaging': 'medical-imaging', xray: 'medical-imaging', 'x-ray': 'medical-imaging', 'x-rays': 'medical-imaging', bones: 'medical-imaging', radiography: 'medical-imaging',
  sterilising: 'sterilising-equipment', sterilizing: 'sterilising-equipment', sterilisation: 'sterilising-equipment', sterilization: 'sterilising-equipment', 'sterilising-equipment': 'sterilising-equipment', 'sterilizing-equipment': 'sterilising-equipment', 'sterilise-equipment': 'sterilising-equipment', 'medical-equipment': 'sterilising-equipment',
}

const TASK_WORDS: Record<string, EmConfig['task']> = {
  region: 'region', find: 'region', locate: 'region', tune: 'region', identify: 'region', name: 'region', spectrum: 'region', order: 'region', 'find-region': 'region', 'find-the-region': 'region',
  use: 'use', uses: 'use', application: 'use', applications: 'use', receiver: 'use', activate: 'use', danger: 'use', dangers: 'use', hazard: 'use', hazards: 'use', 'find-use': 'use',
}

export function goodPrompt(config: EmConfig): string {
  if (config.task === 'region') return `Drag the tuner, or use its + and − buttons, to find ${targetRegion(config).name}.`
  return `Drag the tuner, or use its + and − buttons, to ${targetRegion(config).goal}.`
}

const nearestRegion = (raw: string): RegionId => {
  const words = keyOf(raw)
  const found = REGIONS.find((r) => words.includes(r.id) || (r.id === 'xray' && words.includes('x-ray')) || (r.id === 'radio' && words.includes('broadcast')))
  return found?.id ?? 'infrared'
}

export const emSpectrumEngine: SceneEngine<EmConfig, EmState> = {
  id: 'em-spectrum',
  // "electromagnetic" is distinctive; "spectrum", "radiation" and "light" alone are not.
  covers: ['electromagnetic'],
  phrases: ['EM spectrum', 'EM waves', 'order of the spectrum', 'spectrum order', 'regions of the spectrum', 'uses of the spectrum', 'dangers of the spectrum'],
  notFor: [
    'electromagnetic induction', 'electromagnet', 'electromagnets', 'motor effect', 'electric motors',
    'sound', 'ultrasound', 'infrasound', 'refraction', 'lenses', 'prism', 'prisms', 'dispersion', 'visible spectrum through a prism',
    'colour mixing', 'color mixing', 'art studio', 'half-life', 'half life', 'radioactivity', 'radioactive decay', 'nuclear radiation', 'nuclear decay',
    'heat transfer', 'thermal transfer', 'thermal radiation', 'heat radiation', 'blackbody', 'black body', 'photoelectric', 'emission spectrum', 'absorption spectrum', 'line spectrum', 'diffraction grating',
  ],
  // The learner moves a position along the spectrum; the engine derives its region, wavelength and frequency.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const taskWord = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    if (taskWord && !Object.prototype.hasOwnProperty.call(TASK_WORDS, taskWord)) return null
    const rawRegion = first(src, ['region', 'wave', 'waves', 'target', 'name'])
    const rawUse = first(src, ['use', 'application', 'receiver', 'device'])
    const task = taskWord ? TASK_WORDS[taskWord] : rawUse !== undefined ? 'use' : rawRegion !== undefined ? 'region' : null
    if (!task) return null
    if (task === 'region') {
      if (rawRegion !== undefined && typeof rawRegion !== 'string') return null
      const key = keyOf(rawRegion ?? 'infrared')
      return { task, region: Object.prototype.hasOwnProperty.call(REGION_WORDS, key) ? REGION_WORDS[key] : key.replace(/-/g, ' ') }
    }
    if (rawUse !== undefined && typeof rawUse !== 'string') return null
    const key = keyOf(rawUse ?? 'security-marking')
    return { task, use: Object.prototype.hasOwnProperty.call(USE_WORDS, key) ? USE_WORDS[key] : key.replace(/-/g, ' ') }
  },

  faults(config) {
    if (config.task === 'region' && !regionById(config.region)) {
      const near = nearestRegion(config.region)
      return [`There is no "${config.region}" region on this seven-stop tuner: use radio, microwave, infrared, visible, ultraviolet, X-rays or gamma, e.g. region "${near}".`]
    }
    if (config.task === 'use' && !regionForUse(config.use)) {
      // Useful nearby syllabus applications are deliberately refused when their event is not the one drawn.
      const key = keyOf(config.use)
      if (/satellite|mobile|phone/.test(key)) return [`The card draws food warming in an oven, not a satellite or phone: use "cooking" for microwaves, e.g. { "task":"use", "use":"cooking" }.`]
      if (/thermal|grill/.test(key)) return [`The card draws a television responding to its remote, not a thermal camera or grill: use "remote-control" for infrared.`]
      if (/fibre|fiber/.test(key)) return [`The card draws a camera taking a photograph, not an optical fibre: use "photography" for visible light.`]
      if (/water|steril/.test(key) && /ultra|uv|water/.test(key)) return [`The card draws a banknote's hidden mark, not water sterilisation: use "security-marking" for ultraviolet. Gamma equipment sterilisation is available as "sterilising-equipment".`]
      if (/airport|scanner/.test(key)) return [`The card draws bones on a medical X-ray screen, not an airport scanner: use "medical-imaging" for X-rays.`]
      if (/cancer|radiotherapy/.test(key)) return [`The card draws a sterilisation indicator on sealed medical equipment, not cancer treatment: use "sterilising-equipment" for gamma rays.`]
      return [`There is no "${config.use}" receiver drawn here: use broadcasting, cooking, remote-control, photography, security-marking, medical-imaging or sterilising-equipment, e.g. use "security-marking".`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const target = targetRegion(config)
    // "X-ray screen" names the apparatus in a medical-imaging goal, not the answer "X-rays".
    const withoutTarget = config.task === 'region'
      ? text.replace(new RegExp(target.name.replace('-', '[- ]?'), 'gi'), '')
      : text.split(target.receiver).join('')
    const names = /\bradio waves?\b|\bmicrowaves?\b|\binfra[- ]?red\b|\bvisible light\b|\bultra[- ]?violet\b|\bX[- ]?rays?\b|\bgamma rays?\b/i.test(withoutTarget)
    const position = /\blongest\b|\bshortest\b|\bhighest frequency\b|\blowest frequency\b|\blast stop\b|\bleft end\b|\bright end\b|\bmiddle stop\b|\bnext to\b|\bbetween\b|\bafter\b|\bbefore\b|\b(?:first|second|third|fourth|fifth|sixth|seventh|1st|2nd|3rd|4th|5th|6th|7th|[1-7])\s+stop\b/i.test(text)
    const relation = /\bv\s*=\s*f|\bc\s*=\s*f|\bspeed\s*=\s*frequency|\bfrequency\s*(?:x|times|×|\*)\s*wavelength|\bhigher frequency\b|\blower frequency\b|\bshorter wavelength\b|\blonger wavelength\b/i.test(text)
    const numbers = /\b\d+(?:\.\d+)?\s*(?:×\s*10|e[+-]?\d+|m\b|cm\b|mm\b|µm\b|nm\b|pm\b|Hz\b|kHz\b|MHz\b|GHz\b|THz\b)/i.test(text)
    if (names || position || relation || numbers) {
      out.push(`the prompt gives the answer away: it names another region, its position or its measurements, which the learner is to find by tuning -- ask for the outcome only ("${example}")`)
    }
    if (!/\bdrag\b|\bslide\b|\bmove the tuner\b|\b\+ and −\b|\b\+ and -\b/i.test(text)) {
      out.push(`the prompt must say the gesture: the learner drags the tuner or uses its + and − buttons ("${example}")`)
    }
    if (/\btype\b|\benter (?:your|the|a)\b|\bmultiple.choice\b|\border all seven\b|\bdrag (?:the )?(?:labels|names|cards)\b|\bphoton\b|\benergy in electron/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it has one tuner and one receiver, not typed answers, label ordering or photon calculations ("${example}")`)
    }
    return out
  },

  initial: (config) => ({ at: startIndex(config) }),
  check(config, state) {
    const at = madeAt(state)
    return { ok: at === targetIndex(config), wrongIds: at === targetIndex(config) ? [] : ['tuner'] }
  },
  solve: (config) => ({ at: targetIndex(config) }),
  View: EmSpectrumView,

  prompt: `SCENE "em-spectrum" -- a working electromagnetic-spectrum tuner on a quiet light panel. One wave crosses a vacuum monitor at a steady pace. Dragging its large white tuner knob through seven generous stops squeezes the crest spacing and changes the receiver; a bracket names one wavelength. Below, live readouts show typical wavelength, frequency and the unchanging speed in vacuum (3.0 x 10^8 m/s). Small − and + buttons and arrow keys do the same as dragging. Region names are never shown before marking.
  For: the electromagnetic spectrum and its seven regions in order (radio waves, microwaves, infrared, visible light, ultraviolet, X-rays, gamma rays); wavelength getting shorter as frequency gets higher; all EM waves travelling at the same vacuum speed and speed = frequency x wavelength; syllabus uses and harmful effects. It answers "gamma rays travel faster", "frequency and wavelength rise together", "a remote uses radio", and "visible light is the whole spectrum".
  region: find the region named in the prompt. region: radio, microwave, infrared, visible, ultraviolet, xray or gamma (common spellings such as UV and X-rays also parse). The drawn receiver changes at every stop but does not name the region or say whether it is right.
  use: make one application's event happen. use: broadcasting (a radio plays), cooking (food warms in an oven), remote-control (a television switches on), photography (a photograph appears), security-marking (a hidden banknote mark glows), medical-imaging (bones appear on an X-ray screen), or sterilising-equipment (a real sterilisation indicator changes colour). The target application stays drawn throughout and responds only at its region; other signals leave it inactive. The wrong explanation describes the signal actually made. Other syllabus uses and the matching hazard are given after marking. Unsupported applications are refused with the nearest drawn one.
  The wavelengths are representative, not exact band boundaries: 100 m, 0.12 m (a 2.45 GHz oven), 940 nm (a TV remote), 500 nm, 365 nm (security-marking near-UV), 10^-10 m and 10^-12 m. The picture is a monitor of spacing, not a metre scale. No photon energies, field vectors, band-edge calculations, medium-dependent speeds, prism colours or seven-label ordering puzzle.
  Before marking the card shows the goal in plain words, the moving wave, one-wavelength bracket, the receiver and live measurements. It holds back every region name, the order as a list, and the formula. The receiver's event is an observable, not a tick. Marking names what the learner tuned to, the exact representative values, c = f λ, other uses and the hazard. The prompt must ask for the outcome and say the gesture; do NOT name the answer region for a use task, another region for a region task, its position, the order, wavelength/frequency values or the inverse relationship.
  config: { "task":"region", "region":"ultraviolet" }  -- the prompt says "Drag the tuner, or use its + and − buttons, to find ultraviolet."
       or { "task":"use", "use":"security-marking" }  -- the prompt says "Drag the tuner, or use its + and − buttons, to make the hidden security mark appear."
       or { "task":"use", "use":"remote-control" }  -- the prompt says "Drag the tuner, or use its + and − buttons, to switch on the television with its remote."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the tuner, or use its + and − buttons, to find ultraviolet.",
    "payload": { "engine":"em-spectrum", "config": { "task":"region", "region":"ultraviolet" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:em-spectrum", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the tuner, or use its + and − buttons, to make the hidden security mark appear.",
    "payload": { "engine":"em-spectrum", "config": { "task":"use", "use":"security-marking" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:em-spectrum", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the tuner, or use its + and − buttons, to switch on the television with its remote.",
    "payload": { "engine":"em-spectrum", "config": { "task":"use", "use":"remote-control" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:em-spectrum", "why":"..." } }`,
}

registerEngine(emSpectrumEngine as SceneEngine<unknown, unknown>)
