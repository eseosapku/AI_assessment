/**
 * Cambridge papers are written in British English.
 *
 * Shipped, on live Checkpoint Science papers:
 *
 *   "Analyzing the grid, when light hits the surface."        x4
 *   "Explain how the particle model explains the behavior of gases..."
 *   "...the process of fertilization in flowering plants."
 *
 * and on a Mathematics paper, "Calculate the distance traveled by a marble".
 * Cambridge International is a British board; its syllabuses, its mark schemes
 * and its papers use -ise, -our and -lled throughout. A learner sitting 0893
 * has never seen "behavior" in a Cambridge document.
 *
 * The model writes American English roughly one word in two hundred, which no
 * amount of prompting has moved, so it comes off here. A substitution table is
 * the right shape for this: it is a closed, known set, and unlike a judgement
 * call it cannot be wrong about a question it does not recognise.
 *
 * Deliberately NOT a general -ize -> -ise rule, which would rewrite "size",
 * "prize" and "capsize" and would still miss "behavior" and "traveled".
 */

/**
 * Stems that may be followed by ANY ending.
 *
 * Only the -ize/-yze verbs are safe this way, because the letters before the
 * ending are not the start of some other word: analyze, analyzes, analyzed,
 * analyzing and analyzer all want the same substitution and nothing else in
 * English begins "analyz".
 *
 * The -our and -re words are NOT here, and that is the point of the split:
 * `\blabor([a-z]*)\b` turns "laboratory" into "labouratory", and
 * `\bcenter([a-z]*)\b` turns "centered" into "centreed". Both were in the
 * first version of this table.
 */
const STEMS: ReadonlyArray<readonly [string, string]> = [
  ['analyz', 'analys'],
  ['catalyz', 'catalys'],
  ['paralyz', 'paralys'],
  ['recogniz', 'recognis'],
  ['organiz', 'organis'],
  ['realiz', 'realis'],
  ['emphasiz', 'emphasis'],
  ['summariz', 'summaris'],
  ['minimiz', 'minimis'],
  ['maximiz', 'maximis'],
  ['categoriz', 'categoris'],
  ['characteriz', 'characteris'],
  ['hypothesiz', 'hypothesis'],
  ['neutraliz', 'neutralis'],
  ['polariz', 'polaris'],
  ['visualiz', 'visualis'],
  ['oxidiz', 'oxidis'],
  ['vaporiz', 'vaporis'],
  ['crystalliz', 'crystallis'],
  ['fertiliz', 'fertilis'],
  ['standardiz', 'standardis'],
  ['generaliz', 'generalis'],
  ['specializ', 'specialis'],
  ['utiliz', 'utilis'],
  ['apologiz', 'apologis'],
  ['memoriz', 'memoris'],
  ['magnetiz', 'magnetis'],
  ['pressuriz', 'pressuris'],
  ['steriliz', 'sterilis'],
  ['equaliz', 'equalis'],
  ['stabiliz', 'stabilis'],
  ['industrializ', 'industrialis'],
]

/**
 * Whole words, with every inflection spelled out.
 *
 * Longer forms come first so "neighborhood" is taken before "neighbor", and
 * words whose American and British spellings are the SAME are simply absent:
 * "humorous", "vigorous", "laboratory", "colorimeter" and "program" are all
 * correct British English, and a rule that rewrote them would be introducing
 * the error it exists to remove. "draft" likewise -- a first draft is a draft
 * here too.
 */
const WORDS: ReadonlyArray<readonly [string, string]> = [
  // -our
  ['behavioral', 'behavioural'], ['behaviors', 'behaviours'], ['behavior', 'behaviour'],
  ['colorless', 'colourless'], ['colorful', 'colourful'], ['coloring', 'colouring'],
  ['colored', 'coloured'], ['colors', 'colours'], ['color', 'colour'],
  ['favorite', 'favourite'], ['favorable', 'favourable'], ['favored', 'favoured'],
  ['favors', 'favours'], ['favor', 'favour'],
  ['flavored', 'flavoured'], ['flavors', 'flavours'], ['flavor', 'flavour'],
  ['harbors', 'harbours'], ['harbor', 'harbour'],
  ['honored', 'honoured'], ['honors', 'honours'], ['honor', 'honour'],
  ['humors', 'humours'], ['humor', 'humour'],
  ['labored', 'laboured'], ['labors', 'labours'], ['labor', 'labour'],
  ['neighborhood', 'neighbourhood'], ['neighboring', 'neighbouring'],
  ['neighbors', 'neighbours'], ['neighbor', 'neighbour'],
  ['odorless', 'odourless'], ['odors', 'odours'], ['odor', 'odour'],
  ['rumors', 'rumours'], ['rumor', 'rumour'],
  ['vapors', 'vapours'], ['vapor', 'vapour'],
  ['vigor', 'vigour'],
  // -re
  ['centered', 'centred'], ['centering', 'centring'],
  ['centers', 'centres'], ['center', 'centre'],
  ['fibers', 'fibres'], ['fiber', 'fibre'],
  ['liters', 'litres'], ['liter', 'litre'],
  ['theaters', 'theatres'], ['theater', 'theatre'],
  // "meter" is handled separately -- see UNIT_RULES below.
  // -lled before a suffix
  ['traveled', 'travelled'], ['traveling', 'travelling'], ['traveler', 'traveller'],
  ['labeled', 'labelled'], ['labeling', 'labelling'],
  ['modeled', 'modelled'], ['modeling', 'modelling'],
  ['fueled', 'fuelled'], ['fueling', 'fuelling'],
  ['signaled', 'signalled'], ['signaling', 'signalling'],
  ['marvelous', 'marvellous'],
  // Odds and ends
  ['defense', 'defence'], ['offense', 'offence'], ['pretense', 'pretence'],
  ['practicing', 'practising'], ['practiced', 'practised'],
  ['aluminum', 'aluminium'], ['sulfur', 'sulphur'], ['sulfuric', 'sulphuric'],
  ['gray', 'grey'], ['plow', 'plough'], ['mold', 'mould'],
]

/** Give the replacement the capitalisation the original had. */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase()
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }
  return replacement
}

const STEM_RULES = STEMS.map(([us, uk]) => ({
  pattern: new RegExp('\\b' + us + '([a-z]*)\\b', 'gi'),
  uk,
}))

const WORD_RULES = WORDS.map(([us, uk]) => ({
  pattern: new RegExp('\\b' + us + '\\b', 'gi'),
  uk,
}))

/**
 * "metre" is the unit; "meter" is the instrument, in British English too.
 *
 * A voltmeter and an ammeter are safe on a word boundary, being one word
 * each, but "gas meter" and "parking meter" are open compounds and a bare
 * \bmeter\b rewrote them. What actually separates the two is a NUMBER in
 * front, or a dimension word: "5 meters", "square meters". Everything else
 * stays as it is, which is the conservative direction -- an unconverted unit
 * reads as a typo, a converted instrument reads as nonsense.
 */
const UNIT_RULES = [
  { pattern: /(\d\s*|\b(?:square|cubic|per)\s+)meters\b/gi, uk: 'metres' },
  { pattern: /(\d\s*|\b(?:square|cubic|per)\s+)meter\b/gi, uk: 'metre' },
]

/** The same text, spelled the way a Cambridge paper spells it. */
export function toBritish(text: unknown): string {
  let out = String(text ?? '')
  if (!out) return out

  for (const { pattern, uk } of STEM_RULES) {
    out = out.replace(pattern, (whole: string, ending: string) => {
      const head = whole.slice(0, whole.length - ending.length)
      return matchCase(head, uk) + ending
    })
  }
  for (const { pattern, uk } of WORD_RULES) {
    out = out.replace(pattern, (whole: string) => matchCase(whole, uk))
  }
  for (const { pattern, uk } of UNIT_RULES) {
    out = out.replace(pattern, (_whole: string, lead: string) => lead + uk)
  }
  return out
}

/** The American spellings this text uses, for a check that reports rather than edits. */
export function americanSpellings(text: unknown): string[] {
  const body = String(text ?? '')
  if (!body) return []
  const found: string[] = []
  for (const { pattern } of [...STEM_RULES, ...WORD_RULES, ...UNIT_RULES]) {
    for (const m of body.matchAll(new RegExp(pattern.source, 'gi'))) {
      if (!found.includes(m[0])) found.push(m[0])
    }
  }
  return found
}
