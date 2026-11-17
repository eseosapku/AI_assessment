// lib/studylab/engines/skeleton-muscles/config.ts
//
// An arm in the "make a muscle" pose, drawn as anatomy: shoulder blade and collar bone, the upper arm bone in its
// socket, the two forearm bones on their hinge, the hand, and over them the biceps and the triceps, each a red belly
// that ends in white tendon fastened to a bone. The learner handles the muscles, the one thing that moves a bone:
// tap a muscle and it contracts (gets shorter and fatter, and its tendon pulls the forearm round the elbow); tap it
// again and it relaxes (goes soft, and is stretched thin when its partner pulls).
//   move -- bend the arm, or straighten it. The arm starts the other way, held there by the other muscle, so the
//           learner has to find the muscle that pulls the right way AND let its partner go;
//   both -- bend the arm, then straighten it again: one muscle cannot do both, because it can only pull.
//
// The rules, all computed here and never read from the drawing:
//   a muscle is contracted or relaxed; the arm moves only when exactly one muscle of the pair is contracted, to that
//   muscle's end (biceps: bent, triceps: straight). Two contracted muscles pull against each other and the elbow stays;
//   two relaxed muscles pull nothing and the elbow stays. A relaxed muscle never moves the arm: it cannot push.
//
// Facts (see .superpowers/bakeoff/skeleton-muscles/research.md):
//   - muscles can only pull, by contracting, and cannot push; antagonistic pairs move a bone at a joint; a tendon joins
//     muscle to bone, a ligament joins bone to bone at a joint (Oak National Academy, KS3 "Movement");
//   - to raise the forearm the biceps contracts and the triceps relaxes, and the reverse to straighten it (BBC Bitesize KS3);
//   - biceps: two heads from the shoulder blade, inserting on the radius just below the elbow; triceps: inserting on the
//     olecranon of the ulna, the point of the elbow; elbow a hinge joint, shoulder a ball and socket (standard anatomy).
//   - Gravity is left out, as in the textbook arm diagrams. The arm is held in the "make a muscle" pose with the upper
//     arm level, where fully bent and locked straight both stay put, so a relaxed arm staying where it is is true there.
//
// Ideas taken, never code or art: the string-pulled model arm of the classroom (BioEd Online, Make:, Bitesize), and its
// teacher's question "Can you straighten your arm by contracting your biceps?". Refused: the knee (another drawing, left
// for later), a weight in the hand (gravity would make the triceps look useless), and the skeleton's support and
// protection jobs (no hands-on act on this card).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SkeletonMusclesView } from './View'

export const JOBS = ['bend', 'straighten'] as const
export type Job = (typeof JOBS)[number]
export type Pose = 'bent' | 'straight'
export type Muscle = 'flexor' | 'extensor'

export type MuscleConfig =
  /** to: the movement to make; the arm starts the other way. limb: only "arm" is drawn; other limbs parse and are refused by faults. */
  | { task: 'move'; to: Job; limb: string }
  | { task: 'both'; limb: string }

/** flexor: the biceps is contracted; extensor: the triceps is; pose: where the forearm is; wasBent: it has been bent. */
export type MuscleState = { flexor?: boolean; extensor?: boolean; pose?: Pose; wasBent?: boolean }
export type Arm = { flexor: boolean; extensor: boolean; pose: Pose; wasBent: boolean }

export const LIMBS = ['arm'] as const
/** The names the card uses: the muscle that bends the joint and the one that straightens it. */
export const NAMES = { flexor: 'biceps', extensor: 'triceps', joint: 'elbow', limb: 'arm' } as const

const poseOf = (job: Job): Pose => (job === 'bend' ? 'bent' : 'straight')

// ---------------------------------------------------------------------------
// The rules.

/** The state, read safely: anything missing or corrupt reads as relaxed and straight; the pose always follows a lone pull. */
export function readArm(config: MuscleConfig, state: MuscleState | null | undefined): Arm {
  const start = config.task === 'move' && config.to === 'straighten' ? 'bent' : 'straight'
  const flexor = state?.flexor === true
  const extensor = state?.extensor === true
  const stored: Pose = state?.pose === 'bent' || state?.pose === 'straight' ? state.pose : start
  const pose: Pose = flexor && !extensor ? 'bent' : extensor && !flexor ? 'straight' : stored
  return { flexor, extensor, pose, wasBent: state?.wasBent === true || pose === 'bent' }
}

/** The arm after a muscle is tapped: it contracts if it was relaxed, and relaxes if it was contracted. */
export function toggle(config: MuscleConfig, state: MuscleState, muscle: Muscle): Arm {
  const now = readArm(config, state)
  const next = { ...now, [muscle]: !now[muscle] }
  // Only a lone pull moves the bone: a relaxed muscle cannot push, and two pulls cancel.
  const pose: Pose = next.flexor && !next.extensor ? 'bent' : next.extensor && !next.flexor ? 'straight' : now.pose
  return { ...next, pose, wasBent: now.wasBent || pose === 'bent' }
}

export function done(config: MuscleConfig, state: MuscleState): boolean {
  const arm = readArm(config, state)
  if (config.task === 'move') return arm.pose === poseOf(config.to)
  return arm.wasBent && arm.pose === 'straight'
}

/** What is pulling on the forearm now, said as an observation: this changes as the learner taps, and never says right or wrong. */
export function pullingText(arm: Arm): string {
  const { flexor: f, extensor: x } = NAMES
  if (arm.flexor && arm.extensor) return `The ${f} and ${x} are pulling against each other: the elbow cannot move.`
  if (!arm.flexor && !arm.extensor) return 'Both muscles are relaxed: nothing is pulling on the forearm.'
  return `The ${arm.flexor ? f : x} is contracted, pulling on the forearm.`
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card shows the arm and what is pulling, never which muscle the job needs.

/** What a correct card says: what the learner did, and the idea it shows. */
export function working(config: MuscleConfig): string {
  if (config.task === 'both') {
    return 'Yes. The biceps bent the arm, then the triceps straightened it. Each muscle can only pull, one way, so they work as an antagonistic pair: one contracts while the other relaxes.'
  }
  if (config.to === 'bend') {
    return 'Yes. The biceps contracted, got shorter and fatter, and pulled the forearm up. The triceps had to relax, and was stretched long and thin.'
  }
  return 'Yes. The triceps contracted and pulled on the point of the elbow. The biceps relaxed: it could not push the arm straight, because a muscle can only pull.'
}

/** What a wrong card says: what the learner made, never which muscle to use. */
export function madeText(config: MuscleConfig, state: MuscleState): string {
  const arm = readArm(config, state)
  const where = arm.pose === 'bent' ? 'bent' : 'straight'
  const both = `Both muscles are contracted, pulling against each other, so the elbow stayed ${where}.`
  const none = `Both muscles are relaxed. A relaxed muscle cannot push, so nothing moved the arm and it stayed ${where}.`
  if (config.task === 'both') {
    if (!arm.wasBent) {
      if (arm.flexor && arm.extensor) return `The arm never bent. ${both}`
      if (!arm.flexor && !arm.extensor) return 'The arm never bent: nothing pulled on the forearm.'
      return 'The arm never bent: the muscle you contracted can only pull it straight.'
    }
    if (arm.flexor && arm.extensor) return `The arm bent, but it has not been straightened again. ${both}`
    if (!arm.flexor && !arm.extensor) return `The arm bent, but it has not been straightened again. ${none}`
    return 'The arm bent, but it has not been straightened again: the muscle that bent it is still pulling it bent.'
  }
  if (arm.flexor && arm.extensor) return both
  if (!arm.flexor && !arm.extensor) return none
  const holder = arm.flexor ? NAMES.flexor : NAMES.extensor
  return `The ${holder} is contracted, pulling the arm ${where}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

/** A job read from any phrasing: a word for bending, for straightening, both, or a word for the pair as a whole. */
function readJob(key: string): 'bend' | 'straighten' | 'both' | null {
  const words = ` ${key.replace(/-/g, ' ')} `
  const bendish = /\s(?:bend|bends|bent|bending|flex|flexes|flexing|flexion|flexed|raise|raises|raising|lift|lifts|lifting|curl|curls|curling|fold|folds|up)\s/.test(words)
  const straightish = /\s(?:straighten|straightens|straightening|straightened|straight|extend|extends|extending|extension|extended|lower|lowers|lowering|unbend|down)\s/.test(words)
  if (bendish && straightish) return 'both'
  if (bendish) return 'bend'
  if (straightish) return 'straighten'
  if (/\s(?:both|pair|pairs|antagonistic|antagonism|there|back|move|moves|moving|movement|movements|contract|contracts|contraction|relax|squeeze|muscle|muscles)\s/.test(words)) return 'both'
  return null
}

const ARM_WORDS = ['arm', 'arms', 'elbow', 'elbows', 'the-arm', 'upper-arm', 'forearm', 'biceps', 'bicep', 'triceps', 'tricep', 'biceps-and-triceps', 'human-arm']
const LEG_WORDS = ['leg', 'legs', 'knee', 'knees', 'the-leg', 'thigh', 'quadriceps', 'quads', 'hamstring', 'hamstrings', 'quadriceps-and-hamstrings']

function readLimb(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return 'arm'
  if (typeof raw !== 'string') return null
  const key = keyOf(raw)
  if (ARM_WORDS.includes(key)) return 'arm'
  if (LEG_WORDS.includes(key)) return 'leg'
  return key || 'arm'
}

/** What a prompt can safely say: the gesture and the movement, never which muscle makes it. */
export function goodPrompt(config: MuscleConfig): string {
  const how = 'Tap a muscle to contract it, and tap it again to relax it.'
  if (config.task === 'both') return `${how} Bend the arm, then straighten it again.`
  return `${how} ${config.to === 'bend' ? 'Bend the arm at the elbow.' : 'Straighten the arm at the elbow.'}`
}

export const skeletonMusclesEngine: SceneEngine<MuscleConfig, MuscleState> = {
  id: 'skeleton-muscles',
  // Distinctive words only: `covers` matches any one word. "muscles", "joints" and "bones" alone would catch breathing,
  // reflexes and rocks, so they are whole phrases below.
  covers: ['skeleton', 'skeletal', 'biceps', 'triceps', 'tendons', 'ligaments', 'antagonistic'],
  phrases: [
    'muscles and bones', 'bones and muscles', 'muscles and the skeleton', 'skeleton and muscles', 'muscles move bones', 'muscles moving bones', 'how muscles move bones', 'muscles and movement', 'movement and muscles',
    'how muscles work', 'how muscles move', 'muscles work in pairs', 'muscles working in pairs', 'muscle pairs', 'pairs of muscles', 'pair of muscles', 'muscles can only pull', 'muscles pull', 'muscles only pull',
    'muscles contract and relax', 'contract and relax', 'muscle contraction', 'contracting muscles', 'skeletal muscle', 'skeletal muscles', 'bicep', 'tricep',
    'joints', 'the elbow', 'elbow joint', 'hinge joint', 'hinge joints', 'ball and socket', 'ball and socket joint', 'ball and socket joints', 'synovial joint', 'synovial joints', 'moveable joints', 'movable joints',
    'bones', 'human skeleton', 'functions of the skeleton', 'how we move', 'human movement', 'movement in humans', 'locomotion in humans',
  ],
  // Near misses: the same words about something else, and the neighbouring scenes' topics.
  notFor: [
    'skeletal formula', 'skeletal formulae', 'skeletal formulas', 'skeleton formula', 'skeleton formulae', 'carbon skeleton', 'skeleton code', 'skeleton program', 'skeleton programs', 'skeleton key',
    'antagonistic hormones', 'antagonistic hormone', 'antagonistic effects', 'antagonist', 'antagonists', 'protagonist', 'protagonists', 'insulin', 'glucagon',
    'heart muscle', 'cardiac muscle', 'smooth muscle', 'muscle cells', 'muscle cell', 'muscle fatigue', 'lactic acid', 'oxygen debt', 'anaerobic respiration', 'aerobic respiration', 'respiration in muscles',
    'intercostal muscles', 'intercostal', 'diaphragm', 'breathing', 'ventilation', 'ciliary muscles', 'ciliary muscle', 'iris', 'pupil', 'peristalsis', 'circulation', 'circulatory system', 'digestion', 'digestive system',
    'reflex', 'reflexes', 'reflex arc', 'reflex arcs', 'nerve', 'nerves', 'nerve impulses', 'neurone', 'neurones', 'nervous system', 'effector', 'effectors', 'synapse', 'synapses',
    'lever', 'levers', 'moments', 'moment', 'fulcrum', 'pivot', 'turning effect', 'turning effects', 'balanced forces', 'resultant force',
    'fossil', 'fossils', 'fossilised', 'dinosaur', 'dinosaurs', 'bones of the story', 'bare bones',
    'bedding planes', 'joints in rocks', 'joints in rock', 'rock joints', 'weathering', 'freeze thaw', 'wood joints', 'woodwork', 'joinery', 'dovetail', 'mortise', 'welded joints', 'soldered joints', 'expansion joints', 'joint probability', 'joint venture', 'joint ventures',
  ],
  // The learner chooses which muscle pulls, and sees what the pull does to the bone.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawTo = first(src, ['to', 'job', 'movement', 'move', 'action', 'direction', 'goal'])
    const limb = readLimb(first(src, ['limb', 'joint', 'body', 'part']))
    if (limb === null) return null
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    if (rawTo !== undefined && typeof rawTo !== 'string') return null
    const task = keyOf(rawTask)
    const to = keyOf(rawTo)
    const t = task ? readJob(task) : null
    const d = to ? readJob(to) : null
    if ((task && !t) || (to && !d)) return null
    // A direction anywhere makes it one movement; "both", a pair, or a bare "move" with none is the there-and-back task.
    const dir = d === 'bend' || d === 'straighten' ? d : t === 'bend' || t === 'straighten' ? t : null
    return dir ? { task: 'move', to: dir, limb } : { task: 'both', limb }
  },

  faults(config) {
    const out: string[] = []
    if (!(LIMBS as readonly string[]).includes(config.limb)) {
      const example = config.task === 'move' ? `{ "task":"move", "to":"${config.to}", "limb":"arm" }` : '{ "task":"both", "limb":"arm" }'
      out.push(`Only the arm is drawn (the biceps and triceps at the elbow), not the ${config.limb === 'leg' ? 'leg or knee' : `"${config.limb}"`}: use limb "arm", e.g. ${example}.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const muscle = '(?:the\\s+)?(?:biceps?|triceps?|front muscle|back muscle|top muscle|bottom muscle|upper muscle|lower muscle|muscle (?:on|at|in|along) (?:the\\s+)?(?:front|top|back|bottom|underside|underneath|upper|lower)(?: of the (?:upper )?arm)?|other (?:one|muscle))'
    const tells = [
      // "contract the biceps", "relax the triceps", "use the biceps"
      new RegExp(`\\b(?:contract|contracts|contracting|tighten|squeeze|shorten|use|tap|pull with|flex|relax|relaxes|relaxing|loosen|let go of|release)\\s+${muscle}`, 'i'),
      // "the biceps bends the arm", "triceps contracts", "biceps pulls"
      new RegExp(`\\b(?:biceps?|triceps?)\\s+(?:to\\s+)?(?:bends?|straightens?|pulls?|contracts?|relax(?:es)?|lifts?|raises?|lowers?|shortens?|extends?|flexes|must|should|has to|needs? to)\\b`, 'i'),
      /\b(?:one|each)\s+(?:muscle\s+)?(?:at a time|relaxes|must relax|has to relax)\b|\b(?:relax|let go of)\s+(?:one|it) first\b|\btakes? turns\b|\bopposite muscle\b|\bpartner muscle\b/i,
      /\b(?:biceps?|triceps?)\b[^.]*\b(?:bend|straighten)s?\b[^.]*\b(?:biceps?|triceps?)\b[^.]*\b(?:bend|straighten)s?\b/i,
    ]
    if (tells.some((re) => re.test(text))) {
      out.push(`the prompt gives the answer away: it says which muscle to contract or relax, which the learner is to find by tapping -- ask for the movement only ("${example}")`)
    }
    if (/\bdrag\b|\bslide\b|\bslider\b|\bknee\b|\blegs?\b|\bquadriceps\b|\bquads\b|\bhamstrings?\b|\bweights?\b|\bdumbbell|\bcup\b|\bball\b|\bnerves?\b|\bbrain\b|\bprotect|\bsupport(?:s|ing)? the body\b|\brib|\bskull\b|\bshoulder (?:moves|rotates|swings)\b|\brotate\b|\btwist\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws one arm with its biceps and triceps, moved only at the elbow by tapping the muscles -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    if (config.task === 'move' && config.to === 'bend') return { flexor: false, extensor: true, pose: 'straight', wasBent: false }
    if (config.task === 'move') return { flexor: true, extensor: false, pose: 'bent', wasBent: true }
    return { flexor: false, extensor: false, pose: 'straight', wasBent: false }
  },

  check(config, state) {
    const ok = done(config, state)
    if (ok) return { ok, wrongIds: [] }
    const arm = readArm(config, state)
    const want = skeletonMusclesEngine.solve(config) as Arm
    const off = (['flexor', 'extensor'] as const).filter((m) => arm[m] !== want[m])
    // "Both" can end with the right muscles but the arm never bent: then the biceps is the one that never pulled.
    return { ok, wrongIds: off.length ? off : [arm.wasBent ? 'extensor' : 'flexor'] }
  },

  solve(config) {
    if (config.task === 'move' && config.to === 'bend') return { flexor: true, extensor: false, pose: 'bent', wasBent: true }
    return { flexor: false, extensor: true, pose: 'straight', wasBent: true }
  },

  View: SkeletonMusclesView,

  prompt: `SCENE "skeleton-muscles" -- an arm in the "make a muscle" pose, drawn as anatomy on a quiet light panel: the shoulder blade and collar bone, the upper arm bone in its ball and socket joint, the elbow hinge with its ligament, the two forearm bones and the hand. Over the bones lie the biceps (on top) and the triceps (underneath): red muscle bellies with fibres, ending in white tendons fastened to the bones (the biceps on the forearm just past the elbow, the triceps on the point of the elbow). The learner taps a muscle (on the arm, or its row under the picture) to contract it, and taps again to relax it. A contracted muscle darkens, gets shorter and fatter and pulls its tendon: the forearm swings round the elbow over about a second, and the other muscle, if relaxed, is stretched long and thin. A relaxed muscle goes pale and soft and moves nothing. Two contracted muscles pull against each other and the elbow stays put. A faint dashed outline marks where the goal wants the forearm. A line under the picture says what is pulling; rows give each muscle's state, the goal and whether the elbow is bent or straight.
  For: the skeleton and muscles, how muscles move bones at joints, muscles can only pull (contract and relax), antagonistic pairs (biceps and triceps), tendons joining muscle to bone and ligaments joining bone to bone, hinge and ball and socket joints by name. It answers "muscles push", "relaxing a muscle moves the arm back" and "one muscle bends and straightens a joint".
  move: to "bend" (starts straight, held by the triceps) or "straighten" (starts bent, held by the biceps). The learner must contract the muscle that pulls the right way and relax the one holding it. Marked right when the elbow is bent (or straight).
  both: starts straight with both relaxed; the learner bends the arm, then straightens it again, which takes both muscles in turn.
  limb: "arm" only (default). The knee, quadriceps and hamstrings are not drawn.
  Not drawn: the leg, weights or objects in the hand, nerves, the skeleton's support and protection jobs, levers and moments. Do not use it for breathing muscles, the heart, reflexes or respiration in muscles.
  Before marking the card names the biceps, triceps, tendon, ligament and the two joints, and says what is pulling as the learner taps. It never says which muscle bends or straightens the arm. Marking says what the learner made and why. The prompt must say the gesture and the movement only: do NOT say which muscle to contract or relax, that the biceps bends or the triceps straightens, or that one must relax first.
  config: { "task":"move", "to":"bend" }  -- the prompt says "${goodPrompt({ task: 'move', to: 'bend', limb: 'arm' })}"
       or { "task":"move", "to":"straighten" }  -- the prompt says "${goodPrompt({ task: 'move', to: 'straighten', limb: 'arm' })}"
       or { "task":"both" }  -- the prompt says "${goodPrompt({ task: 'both', limb: 'arm' })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'move', to: 'straighten', limb: 'arm' })}",
    "payload": { "engine":"skeleton-muscles", "config": { "task":"move", "to":"straighten" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:skeleton-muscles", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'move', to: 'bend', limb: 'arm' })}",
    "payload": { "engine":"skeleton-muscles", "config": { "task":"move", "to":"bend" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:skeleton-muscles", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'both', limb: 'arm' })}",
    "payload": { "engine":"skeleton-muscles", "config": { "task":"both" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:skeleton-muscles", "why":"..." } }`,
}

registerEngine(skeletonMusclesEngine as SceneEngine<unknown, unknown>)
