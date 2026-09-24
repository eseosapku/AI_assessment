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
  // Added after a live Stage 9 paper asked "Name the structure that separates
  // the intermembrane space from the matrix." The list had 'cristae' and
  // 'mitochondrial dna' and let this through, because the question used the
  // two labels on the same diagram that were not on it. Whole phrases, not
  // the bare word 'matrix', which is a rock, a soil and a table of numbers.
  'intermembrane space', 'mitochondrial matrix', 'ultrastructure', 'organelle',
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
  'trigonometry', 'trigonometric function', 'derivative',
]

/**
 * One term, matched as a whole word and tolerating a plural.
 *
 * `\borganelle\b` cannot match "organelles": `s` is a word character, so there
 * is no boundary after the `e`. Every singular noun on the list had that hole,
 * `ribosome` included — and "ribosomes" is the word the live mitochondrion
 * figure's own description uses, so the term that was on the list specifically
 * to catch this figure did not catch it.
 */
function termPattern(term: string): string {
  return '\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b'
}

/**
 * Beyond PRIMARY (Stage 6), but perfectly fine at Lower Secondary (Stage 9).
 *
 * A live Primary Science paper — ten- and eleven-year-olds — opened on a
 * periodic table and spent seven of its thirty-one questions on it:
 *
 *   "Using the table, state the atomic number of beryllium."
 *   "Using the table, determine the group number of hydrogen."
 *   "Using the table, explain why lithium and beryllium are in the same
 *    group."
 *
 * Cambridge Primary Science describes materials by their properties. Atomic
 * number, groups and the periodic table arrive at Lower Secondary, which is
 * why these cannot go on the list above: they would then be refused at Stage
 * 9 as well, where they are exactly right.
 *
 * Same fault as the mitochondrion, one stage down, and the same lesson — the
 * figure came first and the questions were written to its labels.
 */
const BEYOND_PRIMARY: readonly string[] = [
  'periodic table', 'atomic number', 'atomic mass', 'mass number',
  'group number', 'proton', 'neutron', 'electron', 'subatomic',
  'molecule', 'chemical formula', 'chemical equation', 'compound',
  'independent variable', 'dependent variable',
]

const PATTERN = new RegExp(
  '(?:' + BEYOND_CHECKPOINT.map(termPattern).join('|') + ')',
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
  // Primary carries the Stage 9 list as well, since anything past Stage 9 is
  // necessarily past Stage 6 too.
  const terms = stage <= 6 ? [...BEYOND_CHECKPOINT, ...BEYOND_PRIMARY] : BEYOND_CHECKPOINT
  for (const term of terms) {
    if (new RegExp(termPattern(term), 'i').test(body) && !found.includes(term)) found.push(term)
  }
  return found
}

/** Is this question written past the stage it is being sat at? */
export function questionIsAboveStage(text: unknown, stage: number | undefined): boolean {
  if (typeof stage !== 'number' || stage > 9) return false
  // Shares the stage-aware list rather than testing PATTERN directly, so the
  // Primary tier applies here too. The two used to disagree about Stage 6.
  return beyondStage(text, stage).length > 0
}
