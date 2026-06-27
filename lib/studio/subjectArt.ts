// Map a free-text subject name to its glossy subject icon in /public/art.
// Falls back to the generic "brain" element when nothing matches.
const MAP: [RegExp, string][] = [
  [/math/i, 'maths'],
  [/physic/i, 'physics'],
  [/chem/i, 'chemistry'],
  [/bio/i, 'biology'],
  [/religio|divinity|ethic|moral|\brs\b|\bcrs\b|\bire\b|\bcre\b|christian|islam/i, 'religious'],
  [/histor/i, 'history'],
  [/geograph/i, 'geography'],
  [/ict|comput|information|technolog/i, 'ict'],
  [/account|bookkeep/i, 'accounting'],
  [/econom|business|commerc|financ|entrepreneur/i, 'economics'],
  [/govern|civic|politic/i, 'government'],
  [/agricultur|farming/i, 'agriculture'],
  [/music/i, 'music'],
  [/\barts?\b|drawing|painting/i, 'art'],
  [/social/i, 'social'],
  [/general/i, 'general'],
  [/english|literatur/i, 'english'],
  [/kiswahili|swahili|french|spanish|german|arabic|lingui|\blanguages?\b|\blang\b/i, 'language'],
]

export function subjectArt(subject?: string | null): string {
  const s = subject ?? ''
  for (const [re, name] of MAP) if (re.test(s)) return `/art/subj-${name}.png`
  return '/art/brain.png'
}
