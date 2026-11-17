// lib/studylab/engines/plant-growth/config.ts
//
// One living thing answers the learner's care. Drag the watering can to the cotton wool or soil, pull the blind
// cord, and set the air temperature. There is no Run button: the picture is the predicted appearance after the
// named time, so no stages can be skipped. Reduced motion gets the same changed still picture.
//   germinate -- a bean on cotton wool in a warm, dark cupboard. Water makes it sprout, even with the blind shut;
//   healthy   -- a dry young plant in the dark. It needs water, a warm room and an open blind;
//   nitrate / magnesium -- a deficient plant. Drag one named feed bottle to the soil and see which signs change.
//
// Facts (full notes and URLs in research.md):
//   - Page Keeley, NSTA "Needs of Seeds": most seeds need water, air and warmth, using their own stored food;
//     light, soil and fertiliser are not needed for germination, but leaves later need light. This is a bean,
//     not a claim about light-requiring lettuce or specially dormant seeds.
//   - John W. Kimball, Biology LibreTexts 16.4C: dark-grown beans elongate, stay pale through lack of chlorophyll,
//     and die when reserves run out unless illuminated.
//   - Cambridge IGCSE 0610 mineral requirements (BBC Bitesize and Tutopiya summaries): nitrate -> amino acids and
//     proteins, deficiency stunted with yellow older leaves; magnesium -> chlorophyll, yellowing between veins.
// The pictures are qualitative predictions, not measured growth data. Air is present in every setup; flooded seeds,
// species-specific dormancy and quantitative growth rates are deliberately outside this model.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PlantGrowthView } from './View'

export const PANEL_WIDTH = 360
export const PANEL_HEIGHT = 256

export type PlantKind = 'germinate' | 'healthy' | 'nitrate' | 'magnesium'
export type PlantConfig = { kind: PlantKind }
/** One state for every card; only the controls belonging to the kind are shown. */
export type PlantState = { water?: boolean; blind?: boolean; warm?: boolean; feed?: string }
export type Feed = '' | 'nitrate' | 'magnesium'
export type Conditions = { water: boolean; blind: boolean; warm: boolean; feed: Feed }

export const GERM_DAYS = 7
export const GROW_WEEKS = 3
export const COLD_C = 4
export const WARM_C = 22

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const KIND_WORDS: Record<string, PlantKind> = {
  germinate: 'germinate', germination: 'germinate', seed: 'germinate', seeds: 'germinate', bean: 'germinate', sprout: 'germinate', sprouting: 'germinate',
  'seed-germination': 'germinate', 'conditions-for-germination': 'germinate', 'germination-conditions': 'germinate', 'make-it-sprout': 'germinate',
  grow: 'healthy', growth: 'healthy', healthy: 'healthy', 'healthy-plant': 'healthy', 'healthy-plants': 'healthy', 'plant-growth': 'healthy',
  'plant-needs': 'healthy', 'needs-of-plants': 'healthy', 'what-plants-need': 'healthy', 'conditions-for-growth': 'healthy', 'growing-conditions': 'healthy',
  nitrate: 'nitrate', nitrates: 'nitrate', nitrogen: 'nitrate', 'nitrate-deficiency': 'nitrate', 'nitrogen-deficiency': 'nitrate',
  magnesium: 'magnesium', 'magnesium-deficiency': 'magnesium', 'magnesium-ion': 'magnesium', 'magnesium-ions': 'magnesium',
}
const DEFICIENCY_WORDS: Record<string, 'nitrate' | 'magnesium'> = {
  nitrate: 'nitrate', nitrates: 'nitrate', nitrogen: 'nitrate', 'nitrate-ion': 'nitrate', 'nitrate-ions': 'nitrate', protein: 'nitrate', proteins: 'nitrate',
  magnesium: 'magnesium', 'magnesium-ion': 'magnesium', 'magnesium-ions': 'magnesium', chlorophyll: 'magnesium',
}

/** State may come back from storage, so never trust its types. */
export function conditionsOf(config: PlantConfig, state: PlantState): Conditions {
  const feed = state?.feed === 'nitrate' || state?.feed === 'magnesium' ? state.feed : ''
  return {
    water: state?.water === true,
    blind: typeof state?.blind === 'boolean' ? state.blind : config.kind === 'germinate' || config.kind === 'healthy',
    warm: typeof state?.warm === 'boolean' ? state.warm : true,
    feed,
  }
}

export type Outcome = 'dry-seed' | 'cold-seed' | 'sprout-dark' | 'sprout-light' | 'wilted' | 'slow' | 'etiolated' | 'healthy' | 'nitrate-deficient' | 'magnesium-deficient'

/** The whole model, shared by drawing and prose but never used backwards for marking. */
export function outcomeOf(config: PlantConfig, state: PlantState): Outcome {
  const c = conditionsOf(config, state)
  if (config.kind === 'germinate') {
    if (!c.water) return 'dry-seed'
    if (!c.warm) return 'cold-seed'
    return c.blind ? 'sprout-dark' : 'sprout-light'
  }
  if (!c.water) return 'wilted'
  if (!c.warm) return 'slow'
  if (c.blind) return 'etiolated'
  if (config.kind === 'nitrate' && c.feed !== 'nitrate') return 'nitrate-deficient'
  if (config.kind === 'magnesium' && c.feed !== 'magnesium') return 'magnesium-deficient'
  return 'healthy'
}

export function startOf(config: PlantConfig): PlantState {
  if (config.kind === 'germinate') return { water: false, blind: true, warm: true }
  if (config.kind === 'healthy') return { water: false, blind: true, warm: true }
  return { water: true, blind: false, warm: true, feed: '' }
}

/** Marking is an exact set of required care conditions, never an SVG coordinate or appearance comparison. */
export function caredFor(config: PlantConfig, state: PlantState): boolean {
  const c = conditionsOf(config, state)
  if (!c.water || !c.warm) return false
  if (config.kind === 'germinate') return true
  if (c.blind) return false
  if (config.kind === 'nitrate') return c.feed === 'nitrate'
  if (config.kind === 'magnesium') return c.feed === 'magnesium'
  return true
}

export function missingCare(config: PlantConfig, state: PlantState): string[] {
  const c = conditionsOf(config, state)
  const wrong: string[] = []
  if (!c.water) wrong.push('water')
  if (!c.warm) wrong.push('warmth')
  if (config.kind !== 'germinate' && c.blind) wrong.push('light')
  if ((config.kind === 'nitrate' || config.kind === 'magnesium') && c.feed !== config.kind) wrong.push('feed')
  return wrong
}

export const elapsed = (config: PlantConfig) => (config.kind === 'germinate' ? `${GERM_DAYS} days` : `${GROW_WEEKS} weeks`)

/** A caption on the card itself: what this drawing is and what the care changes. */
export function liveCaption(config: PlantConfig, state: PlantState): string {
  const outcome = outcomeOf(config, state)
  const after = `After ${elapsed(config)}`
  switch (outcome) {
    case 'dry-seed': return `${after}: a dry, unsprouted bean on cotton wool.`
    case 'cold-seed': return `${after}: a cold, moist bean, still unsprouted.`
    case 'sprout-dark': return `${after}: a tall, pale new shoot, even in the dark.`
    case 'sprout-light': return `${after}: a green bean shoot in the light.`
    case 'wilted': return `${after}: a drooping plant in dry soil.`
    case 'slow': return `${after}: a small plant in cold air.`
    case 'etiolated': return `${after}: a tall, thin, pale shoot in the dark.`
    case 'nitrate-deficient': return `${after}: short growth and yellow older leaves.`
    case 'magnesium-deficient': return `${after}: yellow patches between green leaf veins.`
    default: return `${after}: an upright plant with green, open leaves.`
  }
}

export function working(config: PlantConfig): string {
  if (config.kind === 'germinate') {
    return 'Yes. Your bean germinated in 7 days. It needed water, warmth and air, but not light: the food stored in the seed fed its first shoot. Once it has leaves, the growing plant will need light to make food.'
  }
  if (config.kind === 'healthy') {
    return 'Yes. After 3 weeks your plant is upright, green and growing. Its roots take in water and hold the plant, its stem carries water and holds it up, and its leaves use light to make food. Warmth lets it grow well.'
  }
  if (config.kind === 'nitrate') {
    return 'Yes. Nitrate lets the plant make amino acids and proteins for growth. Without it, the plant was stunted and its older leaves turned yellow. Magnesium treats a different shortage.'
  }
  return 'Yes. Magnesium is needed to make chlorophyll, so green colour returned between the leaf veins. Without it, the yellow patches remained. Nitrate treats a different shortage.'
}

/** What the learner actually produced; the explanation is allowed only once marked. */
export function madeText(config: PlantConfig, state: PlantState): string {
  const c = conditionsOf(config, state)
  if (config.kind === 'germinate') {
    if (!c.water) return 'After 7 days your bean is still dry and unsprouted. A bean takes in water, which starts germination; it does not need soil or light for this first stage.'
    if (!c.warm) return 'Your bean is moist but still unsprouted in the cold air. Move it to a warm place: water and warmth start germination, while the seed’s own food store feeds it.'
    return 'Your bean has sprouted.'
  }
  if (!c.water) return 'After 3 weeks your plant is drooping in dry soil. Its roots need to take in water, and its stem carries that water up to keep the plant firm.'
  if (!c.warm) return 'Your watered plant has barely grown in the cold air. Give it a warm place as well as light and water.'
  if (c.blind) return 'Your plant has grown tall, thin and pale in the dark. Open the blind: its leaves need light to make food once the seed’s food store has been used.'
  if (config.kind === 'nitrate') {
    return c.feed === 'magnesium'
      ? 'The plant is still stunted with yellow older leaves. Magnesium did not supply the nitrate it needs to make amino acids and proteins for growth.'
      : 'The plant is still stunted with yellow older leaves. It needs nitrate to make amino acids and proteins for growth.'
  }
  if (config.kind === 'magnesium') {
    return c.feed === 'nitrate'
      ? 'The yellow patches between the leaf veins remain. Nitrate did not supply the magnesium needed to make chlorophyll.'
      : 'The yellow patches between the leaf veins remain. The plant needs magnesium to make chlorophyll.'
  }
  return 'The plant is upright and green.'
}

const examplePrompt = (config: PlantConfig) => {
  if (config.kind === 'germinate') return 'Care for this bean for the next 7 days. Drag the watering can to the cotton wool, pull the blind cord to change the light, and set the air temperature. Make the bean sprout.'
  if (config.kind === 'healthy') return 'Care for this plant for the next 3 weeks. Drag the watering can to the soil, pull the blind cord to change the light, and set the air temperature. Make it upright, green and growing well.'
  return `Care for this plant for the next 3 weeks. Drag one feed bottle to the soil and see how the plant responds. Choose the feed that returns it to healthy green growth.`
}

export const plantGrowthEngine: SceneEngine<PlantConfig, PlantState> = {
  id: 'plant-growth',
  // Distinctive syllabus words only: "plant", "growth", "light", "water" and "mineral" are too broad alone.
  covers: ['germination', 'etiolation'],
  phrases: [
    'plant growth', 'plants grow', 'plant growing', 'growing plants', 'grow plants', 'what plants need', 'what a plant needs', 'plants need',
    'needs of plants', 'plant needs', 'needs of a plant', 'conditions for growth', 'conditions for plant growth', 'conditions needed for growth',
    'healthy plants', 'healthy plant', 'keeping plants healthy', 'plant health', 'conditions for germination', 'seed germination', 'seeds germinate',
    'germination of seeds', 'germinating seeds', 'germinate a seed', 'seed needs', 'what seeds need', 'needs of seeds',
    'mineral deficiencies in plants', 'mineral deficiency in plants', 'plant mineral deficiencies', 'plant mineral deficiency',
    'mineral ions in plants', 'plant mineral ions', 'mineral nutrition in plants', 'plant mineral nutrition', 'nitrate deficiency', 'magnesium deficiency',
    'nitrate ions for growth', 'magnesium for chlorophyll', 'mineral requirements of plants', 'plant mineral requirements',
  ],
  notFor: [
    'rate of photosynthesis', 'photosynthesis rate', 'limiting factor', 'limiting factors', 'pondweed', 'light intensity and photosynthesis',
    'transpiration', 'translocation', 'water transport', 'water uptake rate', 'xylem', 'phloem', 'potometer', 'root hair cells', 'active transport',
    'pollination', 'fertilisation', 'fertilization', 'seed dispersal', 'flower reproduction', 'reproduction in plants', 'flowers and reproduction',
    'fair test', 'fair tests', 'planning an investigation', 'control variables', 'independent variable', 'dependent variable',
    'food chain', 'food chains', 'food web', 'food webs', 'trophic level', 'human nutrition', 'plant hormones', 'phototropism', 'gravitropism',
  ],
  // The learner decides which care conditions belong to the organism at this stage of its life.
  isolates: 'membership',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const deficiency = keyOf(first(src, ['deficiency', 'mineral', 'ion', 'nutrient']))
    let kind: PlantKind | undefined
    if (task && KIND_WORDS[task]) kind = KIND_WORDS[task]
    else if (!task || task === 'mineral' || task === 'minerals' || task === 'feed' || task === 'feed-plant' || task === 'mineral-deficiency' || task === 'mineral-ions') {
      kind = DEFICIENCY_WORDS[deficiency] ?? (!task || task === 'mineral' || task === 'minerals' || task === 'feed' || task === 'feed-plant' || task === 'mineral-deficiency' || task === 'mineral-ions' ? 'nitrate' : undefined)
      // An unrecognised ion still parses, so faults can give a useful nearby choice.
      if (deficiency && !DEFICIENCY_WORDS[deficiency]) return { kind: deficiency as PlantKind }
    }
    if (!kind) return null
    return { kind }
  },

  faults(config) {
    if (!['germinate', 'healthy', 'nitrate', 'magnesium'].includes(config.kind)) {
      return [`There is no "${String(config.kind)}" plant-care card: use germinate, healthy, nitrate or magnesium, e.g. { "kind":"nitrate" }.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = examplePrompt(config)
    const out: string[] = []
    const germAnswer = config.kind === 'germinate' && (/\b(?:not|without|no)\s+(?:need\s+(?:for\s+)?)?light\b|\bdark(?:ness)?\b|\bfood\s+store\b|\bcotyledon|\bsoil\s+is\s+not\b|\bwater\s+and\s+warmth\b/i.test(text))
    const growAnswer = config.kind === 'healthy' && (/\bopen\s+the\s+blind\b|\bneeds?\s+(?:water|light|warmth)\b|\bwater\s+and\s+(?:light|warmth)\b|\bleaves?\s+make\s+food\b|\betiolat/i.test(text))
    const mineralAnswer = (config.kind === 'nitrate' || config.kind === 'magnesium') && (/\bnitrat|\bnitrogen\b|\bmagnesium\b|\bamino\s+acids?\b|\bproteins?\b|\bchlorophyll\b/i.test(text))
    if (germAnswer || growAnswer || mineralAnswer) out.push(`the prompt gives the answer away: ask for the plant's appearance, not which conditions or feed it needs ("${example}")`)
    if (/\bgraph|\bchart|\bphotosynthesis\s+rate|\blimiting\s+factor|\btranspir|\bxylem|\bphloem|\bpollinat|\bday\s+by\s+day|\bpress\s+(?:run|grow|play)|\bdrag\s+the\s+(?:root|stem|leaf|leaves)/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws one bean or plant, a watering can, a blind and care controls, with no rate graph or transport task ("${example}")`)
    }
    return out
  },

  initial: startOf,
  check(config, state) { return { ok: caredFor(config, state), wrongIds: missingCare(config, state) } },
  solve(config) {
    if (config.kind === 'germinate') return { water: true, blind: true, warm: true }
    if (config.kind === 'healthy') return { water: true, blind: false, warm: true }
    return { water: true, blind: false, warm: true, feed: config.kind }
  },
  View: PlantGrowthView,

  prompt: `SCENE "plant-growth" -- one real bean or young bean plant on a quiet light panel, with cotton wool in a glass germination dish or soil in a terracotta pot, a window blind, an air thermometer and a watering can. The learner drags the can onto the cotton wool or soil to pour, and pulls the blind cord to open or close it. Atom-style buttons set the air to cold (4 °C) or warm (22 °C). Mineral cards have only two draggable, named feed bottles: their water, light and warmth are already correct and those controls are not shown. The picture itself is the prediction after the stated time: there is no Run button and no day-by-day process to skip. A short caption says what the bean or plant looks like now. Reduced motion gives changed still pictures.
  For: what plants need to grow well, water and warmth for germination, why most seeds can germinate in the dark using their food store, wilting without water, tall thin pale growth in the dark, and the roles of roots, stem and leaves. Mineral variants cover nitrate for amino acids/proteins (stunted growth and yellow older leaves) and magnesium for chlorophyll (yellowing between the veins).
  kind: "germinate" (a dry bean in a warm dark cupboard, prediction after 7 days; watering makes it sprout with the blind open OR closed, cold prevents sprouting), "healthy" (a dry plant in the dark, prediction after 3 weeks; it needs water, warmth and the blind open), "nitrate" or "magnesium" (a deficient plant already watered, warm and lit; drag one feed bottle to the soil). Config is only { "kind": ... }.
  Not drawn: photosynthesis rate, limiting factors, quantitative growth charts, transpiration, xylem or active transport, flowers, seed dispersal, or planning a fair test. Do not claim that every seed species germinates in darkness; this is a bean. Air is present in every setup and named on the marked explanation, not a control. No flooded-seed or dormancy model.
  Before marking the card shows the observable appearance, the goal and current settings. It holds back the explanation and which care combination passes. Marking names the food store, etiolation effects, plant-part jobs or mineral role, and says what the learner made. The prompt must name the gestures and desired appearance, but NOT say that germination needs no light, that a seed uses its food store, which feed to choose, or the roles of nitrate/magnesium.
  config: { "kind":"germinate" } -- the prompt says "${examplePrompt({ kind: 'germinate' })}"
       or { "kind":"healthy" } -- the prompt says "${examplePrompt({ kind: 'healthy' })}"
       or { "kind":"nitrate" } -- the prompt says "${examplePrompt({ kind: 'nitrate' })}"
       or { "kind":"magnesium" } -- the prompt says "${examplePrompt({ kind: 'magnesium' })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${examplePrompt({ kind: 'germinate' })}",
    "payload": { "engine":"plant-growth", "config": { "kind":"germinate" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:plant-growth", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${examplePrompt({ kind: 'healthy' })}",
    "payload": { "engine":"plant-growth", "config": { "kind":"healthy" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:plant-growth", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${examplePrompt({ kind: 'nitrate' })}",
    "payload": { "engine":"plant-growth", "config": { "kind":"nitrate" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:plant-growth", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${examplePrompt({ kind: 'magnesium' })}",
    "payload": { "engine":"plant-growth", "config": { "kind":"magnesium" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:plant-growth", "why":"..." } }`,
}

registerEngine(plantGrowthEngine as SceneEngine<unknown, unknown>)
