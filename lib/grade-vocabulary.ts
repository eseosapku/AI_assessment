/**
 * Terminology beyond the stage the learner is sitting.
 *
 * From a live Stage 9 Science paper:
 *
 *   "Referring to the diagram, name the structure where ATP is produced."
 *   "Referring to the diagram, name the component that contains
 *    mitochondrial DNA."
 *
 * Cambridge Lower Secondary Science teaches the mitochondrion as the place
 * respiration happens. Cristae, ATP and mitochondrial DNA are A Level. The
 * questions arrived because the figure did: an IGCSE coursebook diagram, well
 * described, whose labels the question then used. `figureFitsLevel` refuses
 * A Level books at Checkpoint but allows IGCSE, on the measured grounds that
 * refusing it would empty the papers — and IGCSE detail is a stretch a good
 * question can usually carry. Usually is not always, and the figure is only
 * one of the ways this gets in.
 *
 * So the check is on the WORDS, wherever they came from. A term on this list
 * cannot appear on a Checkpoint paper whatever produced it.
 *
 * Deliberately a short list of things that are unambiguously past the
 * syllabus. It is not a vocabulary ceiling and must not become one: a hard
 * question in plain words is exactly what a good paper is made of.
 */

/**
 * Beyond Cambridge Lower Secondary (Stage 9) and Primary (Stage 6).
 *
 * Each entry is a whole word or phrase, matched case-insensitively. Where a
 * term is legitimate in a simpler sense the SPECIFIC phrase is listed rather
 * than the bare word: "mitochondrion" is Stage 9, "mitochondrial DNA" is not;
 * "energy" is Stage 6, "activation energy" is not.
 */
const BEYOND_CHECKPOINT: readonly string[] = [
  // Biochemistry
  'atp', 'adenosine triphosphate', 'mitochondrial dna', 'cristae', 'ribosome',
  'golgi', 'endoplasmic reticulum', 'lysosome', 'enzyme kinetics',
  'active site', 'denaturation', 'substrate concentration',
  // Genetics past inheritance basics
  'allele frequency', 'genotype', 'phenotype', 'homozygous', 'heterozygous',
  'meiosis', 'mitosis', 'codominance', 'monohybrid',
  // Chemistry past the particle model and word equations
  'stoichiometry', 'mole ratio', 'avogadro', 'molar mass', 'empirical formula',
  'covalent bond', 'ionic bond', 'electron configuration', 'electronegativity',
  'activation energy', 'exothermic reaction profile', 'oxidation state',
  'redox', 'titration', 'transition state', 'carbocation',
  // Physics past forces, energy and circuits
  'ohms law', "ohm's law", 'resistivity', 'terminal velocity', 'momentum',
  'kinetic energy formula', 'gravitational potential energy formula',
  'specific heat capacity', 'refractive index', 'electromagnetic induction',
  'half-life', 'ionisation', 'ionization',
  // Mathematics past the Checkpoint syllabus
  'quadratic formula', 'simultaneous equations', 'trigonometric ratio',
  'sine rule', 'cosine rule', 'standard deviation', 'logarithm',
  'differentiate', 'integrate', 'surd', 'vector notation',
]

const PATTERN = new RegExp(
  '\\b(?:' + BEYOND_CHECKPOINT.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i',
)

/**
 * Which above-stage terms this text uses.
 *
 * Only applies below IGCSE — at IGCSE and above every one of these is on the
 * syllabus and flagging them would be nonsense.
 */
export function beyondStage(text: unknown, stage: number | undefined): string[] {
  if (typeof stage !== 'number' || stage > 9) return []
  const body = String(text ?? '')
  if (!body.trim()) return []

  const found: string[] = []
  for (const term of BEYOND_CHECKPOINT) {
    const re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
    if (re.test(body) && !found.includes(term)) found.push(term)
  }
  return found
}

/** Is this question written past the stage it is being sat at? */
export function questionIsAboveStage(text: unknown, stage: number | undefined): boolean {
  if (typeof stage !== 'number' || stage > 9) return false
  return PATTERN.test(String(text ?? ''))
}
