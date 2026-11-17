// lib/studylab/engines/life-cycles/config.ts
//
// One living thing, and time. The learner moves a time slider (or taps + and -) and watches one monarch, one common frog
// or one sunflower change in front of them: the egg darkens and hatches, the caterpillar eats the leaf ragged and sheds its
// skin, hangs in a J and becomes a green chrysalis that turns clear to show its wings; the frogspawn's dots curl into
// commas, the tadpole grows back legs, then front legs while its tail shrinks, and climbs out onto a stone; the seed's root
// comes out first, the shoot hooks up through the soil, and the flower makes the seeds that fall back into it. Two tasks:
//   find -- stop on a moment that fits a clue about the living thing's food, home or body ("Stop when it eats leaves");
//   next -- start on one stage and stop as soon as it has become the next one. Growing bigger and shedding a skin are the
//           traps: a new stage means a new body, not a bigger one.
// The last moment closes the cycle: the adult lays the next egg (or the seeds fall into the soil), as its parent did.
//
// The rules, all computed here and never read from the drawing: every moment belongs to one stage, every clue is a set of
// moments, and a stop is right exactly when it is one of them. Every moment that shows the clue passes (if it looks right,
// it is right): a caterpillar eating is a caterpillar eating on day 4 or on day 14.
//
// Facts (see .superpowers/bakeoff/life-cycles/research.md):
//   - monarch: egg about 4 days (3-5), larva 10-14 days in five instars, chrysalis 8-14 days, a cycle of about 30 days;
//     the egg's top darkens before it hatches, the first meal is the eggshell, the larva hangs in a J before its last moult,
//     the chrysalis clears the day before the adult comes out, new wings are soft and crumpled, eggs only on milkweed
//     (Monarch Watch, monarchwatch.org/biology; NDSU Extension E2087; Monarch Joint Venture);
//   - common frog: spawn hatches after about 3 weeks, young tadpoles have feathery outside gills and eat algae, back legs
//     come first and then front legs, the tail is absorbed as lungs form, froglets leave the water at about 14-16 weeks, and
//     frogs breed at 2-3 years (Natural History Museum, "Frogspawn, tadpoles and froglets"; Froglife). Week counts vary a lot
//     with the pond; the card's are typical, and the catalogue entry says so;
//   - sunflower: the root comes first, then a hooked shoot and two seed leaves within about ten days; full flower 70-80 days
//     after sowing, ripe seed about 120 days; an annual, it dies once its seeds are ripe (Manitoba Agriculture; SDSU Extension).
//
// Ideas taken, never code or art:
//   - the classroom butterfly garden and frogspawn tank, and the diary children keep of them: Vanderbilt's life-cycles units
//     found that careful day-by-day watching is what makes children see change, small and large;
//   - the misconceptions it answers: the cycle ends with the adult; the pupa is a pause where nothing happens; a caterpillar
//     and a butterfly are different animals; growing bigger is a new stage (classroom guides; "From caterpillar to butterfly",
//     a study of students' ideas about insect life cycles).
// Refused: ordering stage cards and naming stages from a list (recognition, the quiz this replaces); birds and mammals, whose
// young simply grow, left for later; incomplete metamorphosis; humans and puberty; pollination and germination conditions in
// detail (flower-reproduction and plant-growth draw those).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { LifeCyclesView } from './View'

export const LIVES = ['butterfly', 'frog', 'plant'] as const
export type Life = (typeof LIVES)[number]

export type LifeConfig =
  /** clue: what the learner looks for. A word the card cannot show still parses, and faults says what would work. */
  | { task: 'find'; life: string; clue: string }
  /** from: the stage the card starts on; the learner stops once it has become the next. */
  | { task: 'next'; life: string; from: string }

/** The moment the learner has stopped on. */
export type LifeState = { step?: number }

export type Stage = {
  id: string
  /** As said once marked: "chrysalis (pupa)". */
  name: string
  /** As said in a goal: "the caterpillar". */
  the: string
  /** Words a prompt may not use when this stage is the answer. */
  words: RegExp
}
export type Moment = {
  /** Days since the start. */
  day: number
  stage: string
  /** What is seen, never naming the stage: for a screen reader. */
  seen: string
  /** What it is and does at this moment, said once marked. */
  fact: string
}
export type Clue = { id: string; goal: string; ok: number[]; why: string; words: string[] }
export type LifeInfo = {
  name: string
  caption: string
  stages: Stage[]
  moments: Moment[]
  clues: Clue[]
  /** The stages a `next` card may start on, with what changes into the next one. */
  changes: Record<string, string>
  /** Words for the clues and stages that a writer might use. */
  clueWords: Record<string, string>
  stageWords: Record<string, string>
  defaultClue: string
}

const stage = (id: string, name: string, the: string, words: RegExp): Stage => ({ id, name, the, words })
const at = (day: number, stg: string, seen: string, fact: string): Moment => ({ day, stage: stg, seen, fact })

// ---------------------------------------------------------------------------
// The three lives. Each moment is a frame the view draws; the days are the facts above.

export const LIFE: Record<Life, LifeInfo> = {
  butterfly: {
    name: 'monarch butterfly',
    caption: 'One monarch butterfly on a milkweed plant. Not to scale.',
    stages: [
      stage('egg', 'egg', 'the egg', /\beggs?\b/i),
      stage('caterpillar', 'caterpillar (larva)', 'the caterpillar', /\bcaterpillars?\b|\blarva[e]?\b|\blarval\b|\binstars?\b/i),
      stage('chrysalis', 'chrysalis (pupa)', 'the chrysalis', /\bchrysal[a-z]*|\bpupa[el]?\b|\bpupat[a-z]*|\bcocoons?\b/i),
      stage('butterfly', 'butterfly (adult)', 'the butterfly', /\badults?\b|\bwings?\b/i),
    ],
    moments: [
      at(0, 'egg', 'A butterfly has just laid one tiny egg on a milkweed leaf, and is flying away.', 'it is an egg, smaller than a pinhead, laid on the milkweed its caterpillar will eat'),
      at(3, 'egg', 'The egg has gone dark at the top.', 'it is still an egg: the dark top is the head of the caterpillar inside, nearly ready to hatch'),
      at(4, 'caterpillar', 'A tiny striped animal has crawled out of the egg, eaten most of the shell, and made a first small hole in the leaf.', 'it has hatched into a tiny caterpillar (larva), which ate its own eggshell first and now eats the leaf'),
      at(7, 'caterpillar', 'The striped animal is longer, and is chewing holes in the leaf.', 'it is a caterpillar (larva), eating milkweed leaves all day'),
      at(11, 'caterpillar', 'It has crawled out of its old skin, which lies crumpled behind it, and it is bigger.', 'it has shed its skin to grow, but it is still a caterpillar: bigger, with the same body'),
      at(14, 'caterpillar', 'It is long and fat, and most of the leaf has gone.', 'it is a full-grown caterpillar, about 45 mm long and still eating'),
      at(15, 'caterpillar', 'It has stopped eating, and hangs upside down in a J shape under a leaf.', 'it is still a caterpillar: it has stopped eating and hung itself up, ready to shed its skin one last time'),
      at(16, 'chrysalis', 'A smooth green case with gold dots hangs under the leaf.', 'it is a chrysalis (pupa), which does not eat or move'),
      at(21, 'chrysalis', 'The green case hangs still.', 'it is a chrysalis (pupa): inside, its body is being taken apart and rebuilt'),
      at(25, 'chrysalis', 'The case has turned see-through, and orange and black wings show inside it.', 'it is still a chrysalis (pupa), so thin now that the wings show through'),
      at(26, 'butterfly', 'A butterfly has come out of the case and hangs from it, its wings small and crumpled.', 'it has come out as a butterfly (adult), but its wings are still soft, so it cannot fly yet'),
      at(27, 'butterfly', 'Its wings are open, and it drinks nectar from the milkweed flowers.', 'it is a butterfly (adult): it flies, and drinks nectar from flowers instead of eating leaves'),
      at(31, 'butterfly', 'The butterfly lays an egg on a milkweed leaf.', 'it is a butterfly (adult) laying an egg of its own, so the life cycle starts again'),
    ],
    clues: [
      { id: 'eats-leaves', goal: 'Stop when it eats leaves.', ok: [2, 3, 4, 5], words: ['eats leaves'], why: 'A caterpillar does almost nothing but eat milkweed leaves, and grows from about 2 mm to 45 mm long in two weeks.' },
      { id: 'in-case', goal: 'Stop when it has stopped eating and changes inside a case.', ok: [7, 8, 9], words: ['case'], why: 'A chrysalis cannot eat or move. Inside its case the caterpillar’s body is taken apart and rebuilt as a butterfly.' },
      { id: 'flies', goal: 'Stop when it can fly.', ok: [11, 12], words: ['fly'], why: 'Only the adult has wings. Just out of the chrysalis they are soft and crumpled; it can fly once they have opened and dried.' },
      { id: 'like-parent', goal: 'Stop when it looks like its parent.', ok: [10, 11, 12], words: ['parent'], why: 'A caterpillar looks nothing like its parent. Its whole body changes in the chrysalis, a change called metamorphosis.' },
      { id: 'next-cycle', goal: 'Stop when the next life cycle begins.', ok: [12], words: ['next life cycle'], why: 'The adult lays eggs, so the cycle never ends: each egg starts another caterpillar on the milkweed.' },
    ],
    changes: {
      egg: 'The egg hatched: a tiny caterpillar crawled out and ate its own eggshell before starting on the leaf.',
      caterpillar: 'It stopped eating, hung upside down and shed its skin one last time, showing a hard green case. Getting bigger never counted: a new stage is a new body.',
      chrysalis: 'The case split and a butterfly climbed out. Its wings were soft and crumpled at first, and opened to full size as it pumped blood into them.',
    },
    clueWords: {
      'eats-leaves': 'eats-leaves', eats: 'eats-leaves', eating: 'eats-leaves', 'eating-leaves': 'eats-leaves', 'eats-milkweed': 'eats-leaves', food: 'eats-leaves', feeds: 'eats-leaves', feeding: 'eats-leaves', grows: 'eats-leaves', growing: 'eats-leaves',
      'in-case': 'in-case', case: 'in-case', 'changes-inside-a-case': 'in-case', resting: 'in-case', rests: 'in-case', 'does-not-eat': 'in-case', 'stops-eating': 'in-case', 'no-food': 'in-case', rebuilt: 'in-case', 'body-rebuilt': 'in-case',
      flies: 'flies', fly: 'flies', flying: 'flies', 'can-fly': 'flies', wings: 'flies', 'has-wings': 'flies', nectar: 'flies', 'drinks-nectar': 'flies',
      'like-parent': 'like-parent', 'looks-like-its-parent': 'like-parent', 'looks-like-parent': 'like-parent', 'like-its-parent': 'like-parent', parent: 'like-parent', 'same-as-parent': 'like-parent', 'like-adult': 'like-parent', metamorphosis: 'like-parent',
      'next-cycle': 'next-cycle', 'next-life-cycle': 'next-cycle', 'new-cycle': 'next-cycle', 'starts-again': 'next-cycle', 'cycle-starts-again': 'next-cycle', 'lays-eggs': 'next-cycle', 'new-eggs': 'next-cycle', reproduces: 'next-cycle', reproduction: 'next-cycle', 'next-generation': 'next-cycle',
    },
    stageWords: { egg: 'egg', eggs: 'egg', caterpillar: 'caterpillar', larva: 'caterpillar', larvae: 'caterpillar', chrysalis: 'chrysalis', pupa: 'chrysalis', cocoon: 'chrysalis', butterfly: 'butterfly', adult: 'butterfly' },
    defaultClue: 'eats-leaves',
  },

  frog: {
    name: 'common frog',
    caption: 'One common frog in a garden pond. Not to scale.',
    stages: [
      stage('frogspawn', 'frogspawn (eggs)', 'the frogspawn', /\bfrog-?spawn\b|\bspawn\b|\beggs?\b/i),
      stage('tadpole', 'tadpole', 'the tadpole', /\btadpoles?\b|\bpolliwogs?\b/i),
      stage('froglet', 'froglet', 'the froglet', /\bfroglets?\b/i),
      stage('frog', 'frog (adult)', 'the frog', /\badults?\b/i),
    ],
    moments: [
      at(0, 'frogspawn', 'A frog sits on a lily pad beside a clump of jelly balls with a black dot in each, just under the water.', 'it is frogspawn: eggs in jelly, each black dot a living egg'),
      at(7, 'frogspawn', 'The black dots in the jelly have grown into curled commas.', 'it is still frogspawn: the young frog is growing inside its egg'),
      at(21, 'tadpole', 'A tiny animal with a tail clings to the pond weed, with feathery frills on its head.', 'it has hatched into a tadpole, breathing with feathery gills on the outside of its head'),
      at(35, 'tadpole', 'It swims with its tail and nibbles green slime off the weed.', 'it is a tadpole: it lives under water, breathes with gills and eats algae'),
      at(63, 'tadpole', 'It is bigger, and has grown two back legs.', 'it has grown back legs, but it is still a tadpole: it lives under water and swims with its tail'),
      at(84, 'froglet', 'It has four legs, its tail is shorter, and it comes up to the surface to gulp air.', 'it is a froglet: four legs, a shrinking tail, and new lungs that breathe air'),
      at(98, 'froglet', 'It climbs out of the water onto a stone, with only a stub of tail left.', 'it is a froglet leaving the water, with a stub of tail'),
      at(112, 'frog', 'A tiny animal with no tail sits in the grass on the bank.', 'it is a young frog: its tail has gone, and it lives on land'),
      at(365, 'frog', 'A year on, it is bigger, and catches a fly with its long tongue.', 'it is a frog, living on land and eating insects'),
      at(1095, 'frog', 'Three years on, it is back in the pond, on the lily pad, beside a new clump of jelly eggs.', 'it is an adult frog, back in a pond to lay frogspawn, so the life cycle starts again'),
    ],
    clues: [
      { id: 'gills', goal: 'Stop when it breathes with gills under water.', ok: [2, 3, 4], words: ['gills'], why: 'A tadpole lives only in water. It breathes with gills, as a fish does, and swims with its tail.' },
      { id: 'legs-and-tail', goal: 'Stop when it has legs and a tail.', ok: [4, 5, 6], words: ['legs and a tail'], why: 'Back legs grow first, then front legs, while the tail is taken back into its body.' },
      { id: 'on-land', goal: 'Stop when it lives on land.', ok: [6, 7, 8], words: ['on land'], why: 'Once its lungs work, it leaves the water. A frog lives on land near water, and goes back to a pond to breed.' },
      { id: 'like-parent', goal: 'Stop when it looks like its parent.', ok: [7, 8, 9], words: ['parent'], why: 'A tadpole looks nothing like a frog. Its whole body changes, a change called metamorphosis, before it looks like its parent.' },
      { id: 'next-cycle', goal: 'Stop when the next life cycle begins.', ok: [9], words: ['next life cycle'], why: 'Adult frogs lay frogspawn, so the cycle never ends: each egg starts another tadpole.' },
    ],
    changes: {
      frogspawn: 'The eggs hatched: the tadpole has a tail for swimming and feathery gills for breathing under water.',
      tadpole: 'It grew front legs as well as back legs, its tail began to shrink, and it now gulps air with new lungs. Back legs alone never counted: it was still a tadpole.',
      froglet: 'Its tail has gone, taken back into its body, and it lives on land. It will go back to a pond only to breed.',
    },
    clueWords: {
      gills: 'gills', 'breathes-with-gills': 'gills', 'gills-under-water': 'gills', 'breathes-under-water': 'gills', 'lives-in-water': 'gills', 'under-water': 'gills', underwater: 'gills', swims: 'gills', water: 'gills',
      'legs-and-tail': 'legs-and-tail', 'legs-and-a-tail': 'legs-and-tail', 'has-legs-and-a-tail': 'legs-and-tail', legs: 'legs-and-tail', 'grows-legs': 'legs-and-tail', tail: 'legs-and-tail',
      'on-land': 'on-land', land: 'on-land', 'lives-on-land': 'on-land', 'leaves-the-water': 'on-land', 'leaves-water': 'on-land', lungs: 'on-land', 'breathes-air': 'on-land', 'eats-insects': 'on-land',
      'like-parent': 'like-parent', 'looks-like-its-parent': 'like-parent', 'looks-like-parent': 'like-parent', 'like-its-parent': 'like-parent', parent: 'like-parent', 'same-as-parent': 'like-parent', 'like-adult': 'like-parent', metamorphosis: 'like-parent',
      'next-cycle': 'next-cycle', 'next-life-cycle': 'next-cycle', 'new-cycle': 'next-cycle', 'starts-again': 'next-cycle', 'cycle-starts-again': 'next-cycle', 'lays-eggs': 'next-cycle', 'lays-spawn': 'next-cycle', 'new-eggs': 'next-cycle', reproduces: 'next-cycle', reproduction: 'next-cycle', 'next-generation': 'next-cycle',
    },
    stageWords: { frogspawn: 'frogspawn', spawn: 'frogspawn', 'frog-spawn': 'frogspawn', egg: 'frogspawn', eggs: 'frogspawn', tadpole: 'tadpole', tadpoles: 'tadpole', froglet: 'froglet', froglets: 'froglet', frog: 'frog', adult: 'frog', 'adult-frog': 'frog' },
    defaultClue: 'legs-and-tail',
  },

  plant: {
    name: 'sunflower',
    caption: 'One sunflower, with the soil cut away. Not to scale.',
    stages: [
      stage('seed', 'seed', 'the seed', /\bseeds?\b/i),
      stage('germination', 'sprouting seed (germination)', 'the sprouting seed', /\bgerminat[a-z]*|\bsprout[a-z]*/i),
      stage('seedling', 'seedling', 'the seedling', /\bseedlings?\b|\bseed leaves\b|\bcotyledons?\b/i),
      stage('adult', 'adult plant', 'the plant', /\badults?\b|\bbuds?\b/i),
      stage('flowering', 'flowering', 'the flower', /\bflowering\b|\bblooms?\b|\bblossom[a-z]*|\bpollinat[a-z]*|\bbees?\b/i),
      stage('seeds', 'seed head', 'the seed head', /\bseed ?heads?\b|\bripe[a-z]*\b|\bfruits?\b/i),
      stage('dispersal', 'seed dispersal', 'the falling seeds', /\bdispers[a-z]*|\bscatter[a-z]*|\bseeds? (?:fall|drop)[a-z]*|\b(?:fall|drop)[a-z]* seeds?\b/i),
    ],
    moments: [
      at(0, 'seed', 'One striped seed lies in the soil.', 'it is a seed, with a tiny plant and its food store inside'),
      at(3, 'germination', 'The seed has swollen and split, and a white root grows down from it.', 'it is germinating: the root comes out first and grows down'),
      at(6, 'germination', 'The root has branched, and a bent shoot pushes up through the soil.', 'it is still germinating: the bent shoot is pushing up to the light'),
      at(10, 'seedling', 'Two small green leaves have opened just above the soil.', 'it is a seedling, with its two seed leaves open'),
      at(21, 'seedling', 'It is taller, with its first rough leaves above the two small ones.', 'it is a seedling, growing its first true leaves'),
      at(45, 'adult', 'A tall plant with many leaves, and a green bud at the top.', 'it is an adult plant, with a flower bud at the top'),
      at(70, 'flowering', 'A big yellow flower has opened at the top, and a bee is visiting it.', 'it is flowering: bees carry pollen from flower to flower'),
      at(95, 'seeds', 'The petals have dried up, and the heavy head hangs down, full of seeds.', 'it is making new seeds in its flower head'),
      at(120, 'dispersal', 'The plant is brown and dry, and its seeds are falling onto the soil.', 'its seeds are falling onto the soil, and the old plant dies'),
    ],
    clues: [
      { id: 'root', goal: 'Stop when it grows its first root.', ok: [1, 2], words: ['root'], why: 'Germination starts with water: the seed swells and splits, and the root comes out first to hold the plant in the soil and take in water.' },
      { id: 'first-leaves', goal: 'Stop when its first leaves open.', ok: [3, 4], words: ['leaves'], why: 'A seedling opens two seed leaves first, then grows true leaves. From now on its leaves make its food, using light.' },
      { id: 'flower', goal: 'Stop when it has a flower.', ok: [6], words: ['flower'], why: 'A plant flowers once it is fully grown. Bees carry pollen from flower to flower, so that seeds can form.' },
      { id: 'new-seeds', goal: 'Stop when it makes new seeds.', ok: [7, 8], words: ['new seeds'], why: 'Once the flower has been pollinated, its petals die and new seeds grow in the flower head.' },
      { id: 'next-cycle', goal: 'Stop when the next life cycle begins.', ok: [8], words: ['next life cycle'], why: 'The plant scatters its seeds: each one that lands in soil can grow into a new sunflower, so the cycle never ends.' },
    ],
    changes: {
      seed: 'Water made the seed swell and split: the root came out first and grew down, before any shoot.',
      germination: 'The shoot broke through the soil and opened its first leaves, the seed leaves, to the light.',
      flowering: 'After the bees had been, the petals died and the flower head filled with new seeds.',
    },
    clueWords: {
      root: 'root', roots: 'root', 'first-root': 'root', 'grows-a-root': 'root', 'grows-its-first-root': 'root', germinates: 'root', germination: 'root', sprouts: 'root',
      'first-leaves': 'first-leaves', leaves: 'first-leaves', 'opens-leaves': 'first-leaves', 'first-leaf': 'first-leaves', 'seed-leaves': 'first-leaves', 'green-leaves': 'first-leaves', shoot: 'first-leaves',
      flower: 'flower', flowers: 'flower', flowering: 'flower', 'has-a-flower': 'flower', blooms: 'flower', pollination: 'flower', pollinated: 'flower', bee: 'flower',
      'new-seeds': 'new-seeds', seeds: 'new-seeds', 'makes-seeds': 'new-seeds', 'makes-new-seeds': 'new-seeds', 'seed-head': 'new-seeds', fruit: 'new-seeds',
      'next-cycle': 'next-cycle', 'next-life-cycle': 'next-cycle', 'new-cycle': 'next-cycle', 'starts-again': 'next-cycle', 'cycle-starts-again': 'next-cycle', dispersal: 'next-cycle', 'seed-dispersal': 'next-cycle', scatters: 'next-cycle', 'scatters-seeds': 'next-cycle', 'next-generation': 'next-cycle', reproduction: 'next-cycle',
    },
    stageWords: {
      seed: 'seed', germination: 'germination', germinating: 'germination', sprouting: 'germination', sprout: 'germination', seedling: 'seedling', 'young-plant': 'seedling',
      adult: 'adult', 'adult-plant': 'adult', plant: 'adult', 'mature-plant': 'adult', flowering: 'flowering', flower: 'flowering', 'flowering-plant': 'flowering', bloom: 'flowering',
      seeds: 'seeds', 'seed-head': 'seeds', 'making-seeds': 'seeds', fruit: 'seeds', dispersal: 'dispersal', 'seed-dispersal': 'dispersal',
    },
    defaultClue: 'first-leaves',
  },
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const isLife = (life: string): life is Life => (LIVES as readonly string[]).includes(life)

/** The life a config draws. A refused config still gets one, so nothing can crash on it. */
export const lifeOf = (config: LifeConfig): LifeInfo => LIFE[isLife(config.life) ? config.life : 'butterfly']
export const stageOf = (info: LifeInfo, id: string): Stage | undefined => info.stages.find((s) => s.id === id)
export const clueOf = (config: LifeConfig): Clue | undefined => (config.task === 'find' ? lifeOf(config).clues.find((c) => c.id === config.clue) : undefined)

/** The moments of a stage, in time order. */
export const momentsOf = (info: LifeInfo, stageId: string): number[] => info.moments.flatMap((m, i) => (m.stage === stageId ? [i] : []))

/** The stage after this one, if a `next` card may start on it. */
export function nextStage(info: LifeInfo, from: string): Stage | undefined {
  if (!has(info.changes, from)) return undefined
  const k = info.stages.findIndex((s) => s.id === from)
  return k >= 0 ? info.stages[k + 1] : undefined
}

/** Where time starts, and how far it goes: a `next` card cannot go back before its first stage. */
export function rangeOf(config: LifeConfig): { min: number; max: number } {
  const info = lifeOf(config)
  const max = info.moments.length - 1
  if (config.task === 'next') {
    const first = momentsOf(info, config.from)[0]
    return { min: first === undefined || first >= max ? 0 : first, max }
  }
  return { min: 0, max }
}

/** The moments that pass. */
export function goodMoments(config: LifeConfig): number[] {
  const info = lifeOf(config)
  if (config.task === 'find') return clueOf(config)?.ok ?? []
  const to = nextStage(info, config.from)
  return to ? momentsOf(info, to.id) : []
}

/** The learner's moment, read safely: a whole number inside the card's range, or its start. */
export function stepOf(config: LifeConfig, state: LifeState): number {
  const { min, max } = rangeOf(config)
  const s = state?.step
  return typeof s === 'number' && Number.isInteger(s) && s >= min && s <= max ? s : min
}

export const done = (config: LifeConfig, state: LifeState): boolean => {
  const s = state?.step
  if (typeof s !== 'number' || !Number.isInteger(s)) return false
  const { min, max } = rangeOf(config)
  return s >= min && s <= max && goodMoments(config).includes(s)
}

/** Time since the start, as the card shows it: days for a monarch or a sunflower, weeks and then years for a frog. */
export function timeText(life: string, day: number): string {
  if (life !== 'frog') return `Day ${day}`
  if (day < 365) return `Week ${Math.round(day / 7)}`
  const y = Math.round(day / 365)
  return `${y} ${y === 1 ? 'year' : 'years'}`
}

/** What the goal line on the card says. */
export function goalOf(config: LifeConfig): string {
  const info = lifeOf(config)
  if (config.task === 'find') return clueOf(config)?.goal ?? info.clues[0].goal
  const from = stageOf(info, config.from)
  return `Stop when ${from ? from.the : 'it'} has changed into its next stage.`
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card names no stage but the one a `next` card starts on.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const when = (life: string, day: number) => {
  if (life !== 'frog') return `On day ${day}`
  return day >= 365 ? `After ${timeText(life, day)},` : `In week ${Math.round(day / 7)}`
}
const article = (name: string) => (/^[aeiou]/i.test(name) ? 'an' : 'a')

/** What a correct card says: the stage, and the idea the clue or the change was about. */
export function working(config: LifeConfig, state: LifeState): string {
  const info = lifeOf(config)
  const s = stepOf(config, state)
  const m = info.moments[s]
  if (config.task === 'find') {
    const clue = clueOf(config)
    return `Yes. ${when(config.life, m.day)} ${m.fact}. ${clue ? clue.why : ''}`.trim()
  }
  const from = stageOf(info, config.from)
  const to = nextStage(info, config.from)
  return `Yes. ${cap(from ? from.the : 'it')} has become ${to ? `${article(to.name)} ${to.name}` : 'something new'}. ${info.changes[config.from] ?? ''}`.trim()
}

/** What a wrong card says: what the learner stopped on, never where the answer is. */
export function madeText(config: LifeConfig, state: LifeState): string {
  const info = lifeOf(config)
  const s = stepOf(config, state)
  const m = info.moments[s]
  const said = `${when(config.life, m.day)} ${m.fact}.`
  if (config.task === 'next' && m.stage === config.from) {
    const from = stageOf(info, config.from)
    return `${said} ${cap(from ? from.the : 'it')} has not changed into a new stage yet.`
  }
  return said
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'find' | 'next'> = {
  find: 'find', stop: 'find', spot: 'find', clue: 'find', 'stop-when': 'find', watch: 'find', 'find-the-stage': 'find', 'find-a-stage': 'find', observe: 'find', explore: 'find', 'life-cycle': 'find', 'life-cycles': 'find',
  next: 'next', change: 'next', changes: 'next', 'next-stage': 'next', 'what-next': 'next', 'whats-next': 'next', 'what-comes-next': 'next', becomes: 'next', 'turns-into': 'next', transition: 'next', 'stage-change': 'next', 'change-of-stage': 'next',
}

const LIFE_WORDS: Record<string, Life> = {
  butterfly: 'butterfly', butterflies: 'butterfly', monarch: 'butterfly', 'monarch-butterfly': 'butterfly', 'a-butterfly': 'butterfly', 'the-butterfly': 'butterfly', insect: 'butterfly', 'butterfly-life-cycle': 'butterfly', 'life-cycle-of-a-butterfly': 'butterfly',
  frog: 'frog', frogs: 'frog', 'common-frog': 'frog', 'a-frog': 'frog', 'the-frog': 'frog', amphibian: 'frog', 'frog-life-cycle': 'frog', 'life-cycle-of-a-frog': 'frog',
  plant: 'plant', plants: 'plant', 'flowering-plant': 'plant', 'a-flowering-plant': 'plant', 'flowering-plants': 'plant', sunflower: 'plant', sunflowers: 'plant', 'a-plant': 'plant', 'the-plant': 'plant', 'plant-life-cycle': 'plant', 'life-cycle-of-a-plant': 'plant', 'life-cycle-of-a-flowering-plant': 'plant',
}

/** A stage named on its own says which life it is in: a tadpole is a frog's. */
function lifeFromStage(word: string): Life | undefined {
  return LIVES.find((l) => has(LIFE[l].stageWords, word) && !['egg', 'eggs', 'adult', 'seed', 'seeds'].includes(word))
}
/** So does a clue only one life has: gills are a frog's, a root a plant's. */
function lifeFromClue(word: string): Life | undefined {
  const lives = LIVES.filter((l) => has(LIFE[l].clueWords, word))
  return lives.length === 1 ? lives[0] : undefined
}

const goodPrompt = (config: LifeConfig) => `Drag the time slider, or tap + and −, and watch it grow. ${goalOf(config)}`

export const lifeCyclesEngine: SceneEngine<LifeConfig, LifeState> = {
  id: 'life-cycles',
  // Distinctive words only: "life" alone would catch half-life and life processes, "cycle" the water cycle, and "caterpillar"
  // a food chain. Everything else is a whole phrase.
  covers: ['metamorphosis', 'tadpoles', 'frogspawn', 'froglets', 'chrysalis'],
  phrases: [
    'life cycle', 'life cycles', 'lifecycle', 'lifecycles', 'stages of growth', 'growth stages', 'stages of a life cycle',
    'caterpillar to butterfly', 'caterpillars to butterflies', 'butterfly life cycle', 'frog life cycle', 'plant life cycle', 'from seed to plant', 'from seed to flower', 'seed to seed',
    'complete metamorphosis', 'egg larva pupa adult', 'animals grow and change', 'how animals grow and change',
  ],
  // Near misses: other cycles and other lives the card cannot draw.
  notFor: [
    'star', 'stars', 'stellar', 'nebula', 'supernova', 'red giant',
    'product', 'products', 'product life cycle', 'business', 'marketing', 'industry life cycle', 'brand',
    'life cycle assessment', 'life cycle assessments', 'life cycle analysis', 'lca', 'environmental impact of a product',
    'software', 'systems life cycle', 'system life cycle', 'development life cycle', 'sdlc', 'data life cycle', 'program development',
    'cell cycle', 'cell', 'cells', 'mitosis', 'meiosis', 'water cycle', 'carbon cycle', 'nitrogen cycle', 'rock cycle',
    'human', 'humans', 'puberty', 'adolescence', 'pregnancy', 'human reproduction', 'baby', 'babies', 'old age',
    'malaria', 'plasmodium', 'parasite', 'parasites', 'virus', 'viruses', 'viral', 'bacteriophage', 'lytic', 'lysogenic',
    'fern', 'ferns', 'moss', 'mosses', 'spores', 'alternation of generations',
    'resort', 'tourist', 'tourism', 'butler', 'family life cycle', 'economic growth', 'rostow',
    'kafka', 'metamorphic', 'metamorphoses', 'ovid', 'incomplete metamorphosis', 'grasshopper', 'grasshoppers', 'dragonfly', 'dragonflies',
    'life cycle of a chicken', 'chicken life cycle', 'life cycle of a bird', 'bird life cycle', 'life cycle of a mammal', 'mammal life cycle', 'life cycle of a hen',
  ],
  // The learner moves through time and stops on a stage: where a moment sits in the sequence of a life.
  isolates: 'order',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawLife = first(src, ['life', 'organism', 'living', 'livingThing', 'creature', 'animal', 'species', 'cycle', 'subject'])
    const rawClue = first(src, ['clue', 'find', 'look', 'lookFor', 'goal', 'when', 'property'])
    const rawFrom = first(src, ['from', 'stage', 'start', 'startStage', 'after'])
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    if (rawLife !== undefined && typeof rawLife !== 'string') return null
    if (rawClue !== undefined && typeof rawClue !== 'string') return null
    if (rawFrom !== undefined && typeof rawFrom !== 'string') return null
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const task = word ? TASK_WORDS[word] : rawFrom !== undefined ? 'next' : 'find'
    const lifeKey = keyOf(rawLife).replace(/-?life-?cycles?$/, '')
    const fromKey = keyOf(rawFrom)
    const life = lifeKey ? (has(LIFE_WORDS, lifeKey) ? LIFE_WORDS[lifeKey] : lifeKey) : lifeFromStage(fromKey) ?? lifeFromClue(keyOf(rawClue)) ?? 'butterfly'
    const info = isLife(life) ? LIFE[life] : null
    if (task === 'next') {
      if (!fromKey) return info ? { task, life, from: info.stages[0].id } : { task, life, from: '' }
      return { task, life, from: info && has(info.stageWords, fromKey) ? info.stageWords[fromKey] : fromKey }
    }
    const clueKey = keyOf(rawClue)
    if (!clueKey) return { task, life, clue: info ? info.defaultClue : '' }
    return { task, life, clue: info && has(info.clueWords, clueKey) ? info.clueWords[clueKey] : clueKey }
  },

  faults(config) {
    if (!isLife(config.life)) {
      return [`There is no "${config.life}" life cycle drawn here: use one of ${LIVES.join(', ')}, e.g. life "frog".`]
    }
    const info = LIFE[config.life]
    if (config.task === 'find') {
      if (!info.clues.some((c) => c.id === config.clue)) {
        return [`The ${info.name} card cannot show "${config.clue}": use one of ${info.clues.map((c) => c.id).join(', ')}, e.g. clue "${info.defaultClue}".`]
      }
      return []
    }
    if (!has(info.changes, config.from)) {
      const starts = Object.keys(info.changes)
      const known = info.stages.some((s) => s.id === config.from)
      const why = known ? `"${config.from}" has no next stage this card can stop on` : `the ${info.name} card has no stage "${config.from}"`
      return [`For a next card, ${why}: start from one of ${starts.join(', ')}, e.g. from "${starts[1] ?? starts[0]}".`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const info = lifeOf(config)
    const out: string[] = []
    // The goal itself may be said; the name of the stage that answers it, its time, or what it becomes may not.
    const good = new Set(goodMoments(config).map((i) => info.moments[i].stage))
    const goal = goalOf(config).toLowerCase()
    const secret = info.stages.filter((s) => good.has(s.id)).some((s) => {
      const said = text.match(new RegExp(s.words.source, 'gi')) ?? []
      return said.some((w) => !goal.includes(w.toLowerCase()))
    })
    const becomes = /\b(?:becomes?|becoming|turns? into|turning into|changes? into|changing into|grows? into|growing into|develops? into)\s+(?:a|an|the)?\s*[a-z]/i.test(text)
    const time = /\b(?:day|week|month|year)s?\s+\d|\b\d+\s*(?:days?|weeks?|months?|years?)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|sixteen|twenty|thirty)\s+(?:days?|weeks?|months?|years?)\b|\bfortnight/i.test(text)
    if (secret || becomes || time) {
      out.push(`the prompt gives the answer away: it names the stage the learner is to find, what it becomes, or when -- give the goal only ("${example}")`)
    }
    const dragOther = /\bdrag\b(?!\s+(?:the\s+)?(?:time\s+)?slider)/i.test(text)
    if (dragOther || /\b(?:put|place|arrange|sort|order)\b[^.?!]{0,30}\b(?:stages?|cards?|pictures?|order)\b|\bin (?:the right )?order\b|\bsequence\b|\blabel\b|\bname (?:each|every|the) stages?\b|\btype\b|\bwrite\b|\bchick(?:en|s)?\b|\bhens?\b|\bbirds?\b|\bmammals?\b|\bhumans?\b|\bbab(?:y|ies)\b|\bgrasshoppers?\b|\bladybirds?\b|\bdragonfl|\btoads?\b|\bbeans?\b/i.test(text)) {
      out.push(`the prompt promises something the card does not do: it shows one ${info.name} changing as the learner moves time, and nothing to drag, sort, label or name -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return { step: rangeOf(config).min }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    const good = goodMoments(config)
    return { step: good.length ? good[0] : rangeOf(config).min }
  },

  View: LifeCyclesView,

  prompt: `SCENE "life-cycles" -- one living thing, and time. A carefully drawn monarch butterfly on a milkweed plant, a common frog in a garden pond, or a sunflower with the soil cut away, on a quiet light panel. A goal line sits over the picture. The learner drags a time slider (or taps − and +) and the picture changes in front of them, easing from moment to moment, while a readout gives the time since the start (days, or weeks then years for the frog). The monarch: an egg on a leaf, which darkens and hatches; a striped caterpillar that eats the leaf ragged and sheds its skin as it grows; a J hanging under a leaf; a green chrysalis with gold dots that turns clear to show its wings; a butterfly with crumpled wings, then flying to the flowers, then laying the next egg. The frog: frogspawn whose dots curl into commas; a tadpole with feathery gills, then back legs, then front legs and a shrinking tail; a froglet climbing out onto a stone; a frog in the grass catching a fly; three years on, back on the lily pad by new frogspawn. The sunflower: the seed's root first, a hooked shoot, two seed leaves, a tall plant, a flower with a bee, a drooping head of seeds, the seeds falling into the soil. The monarch and frog cards show the parent at the start, so "looks like its parent" can be judged. Typical times; real ones vary with the weather and the pond.
  For: life cycles in primary science and lower secondary: the life cycle of a butterfly (egg, caterpillar or larva, chrysalis or pupa, adult), of a frog (frogspawn, tadpole, froglet, adult), of a flowering plant (seed, germination, seedling, adult plant, flower, seeds, dispersal), metamorphosis, stages of growth, what changes from stage to stage (body, food, home), and the cycle starting again. It answers "the life cycle ends with the adult", "nothing happens in the chrysalis", "the caterpillar and the butterfly are different animals" and "growing bigger is a new stage".
  find: stop on a moment that fits a clue. life "butterfly": clue eats-leaves (any caterpillar moment), in-case (the chrysalis), flies, like-parent, next-cycle (laying the next egg). life "frog": clue gills (the tadpole), legs-and-tail (back legs to froglet), on-land, like-parent, next-cycle (new frogspawn). life "plant": clue root (germination), first-leaves (the seedling), flower, new-seeds, next-cycle (seeds falling). Every moment that shows the clue passes.
  next: the card starts on a stage and the learner stops once it has changed into the next one; moulting, back legs alone, and a chrysalis turning clear are not new stages and are marked wrong with what was made. from: butterfly egg, caterpillar or chrysalis; frog frogspawn, tadpole or froglet; plant seed, germination or flowering.
  Not drawn: birds and mammals, humans, incomplete metamorphosis, the parts of a flower or pollination in detail, germination conditions, the cell cycle. Do not use it for the life cycle of a star, product life cycles, life cycle assessment or the systems life cycle.
  Before marking the card shows the goal, the picture, the time and short names of the places and things (milkweed, flowers, pond, pond weed, lily pad, stone, soil, bee) and of the start (egg, frogspawn, seed, parent). It names no stage the learner is to find. Marking names the stage stopped on and why. The prompt must give the gesture and the goal only: do NOT name the stage that answers it (caterpillar, chrysalis, tadpole, froglet, seedling, germination...), say what it becomes, or give a day, week or year.
  config: { "task":"find", "life":"butterfly", "clue":"eats-leaves" }  -- the prompt says "${goodPrompt({ task: 'find', life: 'butterfly', clue: 'eats-leaves' })}"
       or { "task":"next", "life":"frog", "from":"tadpole" }  -- the prompt says "${goodPrompt({ task: 'next', life: 'frog', from: 'tadpole' })}"
       or { "task":"find", "life":"plant", "clue":"root" }  -- the prompt says "${goodPrompt({ task: 'find', life: 'plant', clue: 'root' })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'find', life: 'butterfly', clue: 'eats-leaves' })}",
    "payload": { "engine":"life-cycles", "config": { "task":"find", "life":"butterfly", "clue":"eats-leaves" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:life-cycles", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'next', life: 'frog', from: 'tadpole' })}",
    "payload": { "engine":"life-cycles", "config": { "task":"next", "life":"frog", "from":"tadpole" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:life-cycles", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'find', life: 'plant', clue: 'root' })}",
    "payload": { "engine":"life-cycles", "config": { "task":"find", "life":"plant", "clue":"root" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:life-cycles", "why":"..." } }`,
}

registerEngine(lifeCyclesEngine as SceneEngine<unknown, unknown>)
