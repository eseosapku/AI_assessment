// Named art the tutor may reference in an ActivitySpec. The model emits a NAME
// (e.g. "asset:balance-scale"), never a URL — an unvalidated src from model
// output is both a broken-image and a tracking-pixel/SSRF risk. Unknown names
// resolve to null and the renderer falls back to the piece's text label.

export interface AssetEntry {
  /** Stable name the tutor references. */
  name: string
  /** Path under public/. */
  path: string
  /** Free-text hint shown to the tutor so it can pick sensibly. */
  hint: string
}

const A = (name: string, dir: string, hint: string): AssetEntry => ({
  name,
  path: `/art/montessori/${dir}/${name}.webp`,
  hint,
})

export const ACTIVITY_ASSETS: AssetEntry[] = [
  // ── Wordless labelled-diagram backplates (for `label`) ──────────────────────
  // These carry NO printed text by design: the student drags the names on.
  A('plant-cell', 'diagrams', 'plant cell section — wall, membrane, vacuole, nucleus, chloroplasts'),
  A('animal-cell', 'diagrams', 'animal cell — membrane, nucleus, mitochondria, ER, ribosomes'),
  A('bacterial-cell', 'diagrams', 'bacterium — wall, circular DNA, plasmid, ribosomes, flagella'),
  A('leaf-section', 'diagrams', 'leaf cross-section — cuticle, palisade, spongy layer, vascular bundle, stoma'),
  A('flower-section', 'diagrams', 'flower half-section — sepal, petal, stamen, carpel, ovary, ovules'),
  A('root-section', 'diagrams', 'root cross-section — epidermis, root hair, cortex, xylem star, phloem'),
  A('heart', 'diagrams', 'heart cross-section — four chambers, valves, vena cava, aorta, pulmonary vessels'),
  A('lungs', 'diagrams', 'breathing system — trachea, bronchi, bronchioles, alveoli, diaphragm'),
  A('digestive-system', 'diagrams', 'digestive tract — oesophagus, stomach, small and large intestine, liver, pancreas'),
  A('nephron', 'diagrams', 'nephron — glomerulus, Bowman capsule, loop of Henle, collecting duct'),
  A('eye', 'diagrams', 'eye horizontal section — cornea, iris, pupil, lens, retina, optic nerve'),
  A('ear', 'diagrams', 'ear section — pinna, canal, eardrum, ossicles, cochlea, semicircular canals'),
  A('skin-section', 'diagrams', 'skin block — epidermis, dermis, fat, hair follicle, sweat gland, receptor'),
  A('neuron', 'diagrams', 'motor neuron — cell body, dendrites, myelinated axon, terminals'),
  A('tooth-section', 'diagrams', 'tooth section — enamel, dentine, pulp, nerve, root, gum'),
  A('skeleton', 'diagrams', 'human skeleton — skull, ribcage, spine, pelvis, limb bones'),
  A('volcano', 'diagrams', 'volcano cross-section — magma chamber, vent, layered cone, crater'),
  A('river-profile', 'diagrams', 'river source to mouth — waterfall, meander, oxbow lake, delta'),
  A('soil-profile', 'diagrams', 'soil horizons — litter, topsoil, subsoil, parent rock, bedrock'),
  A('earth-layers', 'diagrams', 'earth interior — crust, mantle, outer core, inner core'),
  A('circuit-series', 'diagrams', 'series circuit — cell, lamp, switch, resistor'),
  A('lever', 'diagrams', 'lever — beam, fulcrum, load, effort'),
  A('microscope', 'diagrams', 'compound microscope — eyepiece, objectives, stage, focus knobs, base'),
  A('bunsen-burner', 'diagrams', 'Bunsen burner section — base, gas inlet, barrel, air hole, flame'),

  // ── Object tokens (for `sort`, `threePeriod`, `match`, `compare`) ──────────
  A('ice-cube', 'tokens', 'ice cube — solid, states of matter'),
  A('water-drop', 'tokens', 'water droplet — liquid, states of matter'),
  A('steam', 'tokens', 'steam cloud — gas, evaporation'),
  A('candle', 'tokens', 'burning candle — combustion, chemical change, light'),
  A('ice-cream', 'tokens', 'melting ice cream — melting, physical change'),
  A('magnet', 'tokens', 'bar magnet — magnetism, poles, attraction'),
  A('battery', 'tokens', 'battery cell — electricity, energy store'),
  A('light-bulb', 'tokens', 'light bulb — electricity, light energy'),
  A('plug', 'tokens', 'electrical plug — mains electricity, safety'),
  A('spring', 'tokens', 'coiled spring — elasticity, force, compression'),
  A('pulley', 'tokens', 'pulley — simple machine, lifting'),
  A('gear', 'tokens', 'gear wheel — machines, rotation, ratio'),
  A('thermometer', 'tokens', 'thermometer — temperature, measurement'),
  A('balance-scale', 'tokens', 'balance scale — mass, equality, comparison'),
  A('globe', 'tokens', 'globe — earth, geography, continents'),
  A('measuring-cylinder', 'tokens', 'measuring cylinder — volume, measurement'),
  A('test-tube', 'tokens', 'test tube — laboratory, experiment'),
  A('conical-flask', 'tokens', 'conical flask — laboratory, solutions'),
  A('pipette', 'tokens', 'pipette — accurate small volumes'),
  A('funnel', 'tokens', 'funnel — filtration, separation'),
  A('fern', 'tokens', 'fern frond — non-flowering plant, spores'),
  A('moss', 'tokens', 'moss — simple plant, damp habitat'),
  A('sunflower', 'tokens', 'sunflower — flowering plant, pollination'),
  A('cactus', 'tokens', 'cactus — desert adaptation, water storage'),
  A('mushroom', 'tokens', 'mushroom — fungus, decomposer'),
  A('acorn-leaf', 'tokens', 'acorn and oak leaf — seed, dispersal, tree'),
  A('goldfish', 'tokens', 'fish — vertebrate, gills, aquatic'),
  A('frog', 'tokens', 'frog — amphibian, life cycle'),
  A('lizard', 'tokens', 'lizard — reptile, scales'),
  A('sparrow', 'tokens', 'bird — feathers, vertebrate'),
  A('rabbit', 'tokens', 'rabbit — mammal, herbivore'),
  A('cow', 'tokens', 'cow — mammal, livestock, ruminant'),
  A('chicken', 'tokens', 'chicken — poultry, bird, farming'),
  A('butterfly', 'tokens', 'butterfly — insect, metamorphosis, pollinator'),
  A('ant', 'tokens', 'ant — insect, colony'),
  A('spider', 'tokens', 'spider — arachnid, eight legs'),
  A('earthworm', 'tokens', 'earthworm — invertebrate, soil, decomposer'),
  A('snail', 'tokens', 'snail — mollusc, shell'),
  A('rock-igneous', 'tokens', 'reddish igneous rock — volcanic rock'),
  A('rock-granite', 'tokens', 'speckled granite — igneous rock'),
  A('rock-marble', 'tokens', 'marble — metamorphic rock'),
  A('rock-sedimentary', 'tokens', 'layered sedimentary rock — strata'),
  A('crystal-quartz', 'tokens', 'quartz crystal — mineral, crystal structure'),
  A('gold-nugget', 'tokens', 'gold nugget — native metal, mineral resource'),
  A('sun', 'tokens', 'sun — light and heat source, weather'),
  A('rain-cloud', 'tokens', 'rain cloud — precipitation, weather'),
  A('storm-cloud', 'tokens', 'storm cloud with lightning — weather, energy'),
  A('lightning', 'tokens', 'lightning bolt — static electricity, storms'),
  A('snowflake', 'tokens', 'snowflake — freezing, symmetry, weather'),
  A('maize', 'tokens', 'maize cob — cereal crop, agriculture'),
  A('rice', 'tokens', 'rice stalk — cereal crop, agriculture'),
  A('coffee-beans', 'tokens', 'coffee beans — cash crop, agriculture'),

  // ── Scenario scenes (for `scenario`) — wordless, culture-neutral ───────────
  A('workshop-spill', 'scenarios', 'spilled liquid on a workshop floor — hazard, safety'),
  A('frayed-cable', 'scenarios', 'damaged electrical cable — electrical hazard'),
  A('road-crossing', 'scenarios', 'child at a pedestrian crossing — road safety'),
  A('market-transaction', 'scenarios', 'buying at a market stall — money, exchange, trade'),
  A('sharing-food', 'scenarios', 'two children sharing food — generosity, fairness'),
  A('littering', 'scenarios', 'dropping litter beside a bin — environment, responsibility'),
  A('helping-elderly', 'scenarios', 'helping an elderly person carry a bag — kindness, duty'),
  A('arguing-over-toy', 'scenarios', 'two children pulling one toy — conflict, sharing'),
  A('taking-from-desk', 'scenarios', 'taking an item from another desk — honesty, property'),
  A('shopkeeper-change', 'scenarios', 'shopkeeper handing back change — honesty, trade ethics'),
  A('queue-pushing', 'scenarios', 'pushing into a queue — fairness, rules'),
  A('lost-wallet', 'scenarios', 'a wallet found on the ground — honesty, choice'),
  A('group-work', 'scenarios', 'pupils working together at a table — cooperation'),
  A('exam-cheating', 'scenarios', 'looking at another pupil test paper — integrity'),
  A('online-stranger', 'scenarios', 'chatting to a stranger online — digital safety'),
  A('medicine-reach', 'scenarios', 'child reaching for medicine bottles — household safety'),
  A('tap-running', 'scenarios', 'tap left running — water conservation'),
  A('tree-planting', 'scenarios', 'planting a tree seedling — environment, stewardship'),
  A('waste-sorting', 'scenarios', 'sorting waste into bins — recycling, environment'),
  A('handwashing', 'scenarios', 'washing hands at a basin — hygiene, health'),
  A('fire-exit', 'scenarios', 'calm evacuation through a fire exit — emergency procedure'),
  A('feeding-dog', 'scenarios', 'feeding a dog — animal care, responsibility'),
  A('community-circle', 'scenarios', 'community meeting in a circle — citizenship, discussion'),
  A('safety-goggles', 'scenarios', 'pupils wearing safety goggles — laboratory safety'),
  A('bike-helmet', 'scenarios', 'fastening a bicycle helmet — personal safety'),

  // ── Generic teaching illustrations ────────────────────────────────────────
  A('venn', 'illus', 'overlapping circles — sets, comparison, shared traits'),
  A('fraction-circles', 'illus', 'divided circles — fractions, parts of a whole'),
  A('abacus', 'illus', 'abacus — counting, place value, arithmetic'),
  A('bar-chart', 'illus', 'stepped bar chart — data, distribution'),
  A('clock', 'illus', 'analogue clock face — time, angles, fractions'),
  A('sequence-cards', 'illus', 'ordered picture cards — process, life cycle'),
  A('bead-chains', 'illus', 'coloured bead chains — counting, skip counting'),
  A('paper-shapes', 'illus', 'folded paper shapes — geometry, symmetry, nets'),
  A('stacked-cubes', 'illus', 'stacked cubes — volume, place value'),
  A('prism', 'illus', 'prism splitting light — optics, spectrum'),
  A('tuning-fork', 'illus', 'vibrating tuning fork — sound, frequency'),
  A('map-puzzle', 'illus', 'world map puzzle — continents, location'),
]

// A Map keyed by name: the lookup key comes from model output, and indexing an
// object literal would reach Object.prototype ('__proto__' etc. resolving to a
// truthy non-entry).
const BY_NAME = new Map(ACTIVITY_ASSETS.map((a) => [a.name, a]))

export function assetNames(): string[] {
  return ACTIVITY_ASSETS.map((a) => a.name)
}

/** Resolve a tutor-supplied asset name to a bundled path, or null. */
export function assetUrl(name: string): string | null {
  if (typeof name !== 'string') return null
  const key = name.trim().replace(/^asset:/, '')
  if (!key) return null
  return BY_NAME.get(key)?.path ?? null
}

/** Catalogue listing appended to the Montessori tutor prompt. */
export function assetCatalogPromptBlock(): string {
  const lines = ACTIVITY_ASSETS.map((a) => `- ${a.name}: ${a.hint}`)
  return `
ACTIVITY ARTWORK — make activities VISUAL, not walls of text.
Set "imageUrl" on an item/hotspot/choice to one of these NAMES, written as "asset:<name>".
Use art whenever it carries meaning; omit it when a word is clearer (e.g. a chemical formula).
NEVER invent a URL or a name that is not on this list — anything else is ignored and the
activity falls back to plain text.
${lines.join('\n')}
`
}
