/** Map syllabus subject names to alternate labels used in synced/imported paper banks. */
const ALIASES: Record<string, string[]> = {
  'Use of English': ['english', 'english language'],
  'English Language': ['english', 'use of english'],
  Mathematics: ['math', 'general mathematics', 'maths'],
  'General Mathematics': ['mathematics', 'math', 'maths'],
  'Principles of Accounts': ['accounting', 'financial accounting', 'accounts'],
  'Financial Accounting': ['accounting', 'principles of accounts', 'accounts'],
  'Book Keeping': ['bookkeeping', 'book keeping', 'accounts'],
  Agriculture: ['agricultural science', 'agric'],
  'Agricultural Science': ['agriculture', 'agric'],
  'Christian Religious Studies': ['crk', 'crs', 'religious studies'],
  'Islamic Studies': ['irs', 'islamic religious studies'],
  'Literature in English': ['englishlit', 'literature'],
  'Physical and Health Education': ['phe', 'physical education'],
  'Home Economics': ['home ec', 'food and nutrition'],
  'Computer Studies': ['ict', 'computer science', 'digital technologies', 'computer studies'],
  'Data Processing': ['data processing', 'ict', 'computer studies'],
  'Office Practice': ['office practice', 'clerical office duties'],
  Art: ['visual arts', 'fine art', 'fine arts'],
  'Visual Arts': ['art', 'fine art'],
  Arabic: ['arabic language', 'arabic studies'],
  'Arabic Language': ['arabic', 'arabic studies'],
}

/**
 * The same paper, not a longer name that merely contains a shorter one.
 *
 * "Principles of Accounts" and "Financial Accounting" are the same paper.
 * "Further Mathematics" is not "Mathematics", even though one contains the other.
 */
export function sameExamPaperSubject(requested: string, candidate: string): boolean {
  const req = requested.trim().toLowerCase()
  const cand = candidate.trim().toLowerCase()
  if (!req || !cand) return false
  if (req === cand) return true
  return Object.entries(ALIASES).some(([canonical, list]) => {
    const group = [canonical.toLowerCase(), ...list.map((a) => a.toLowerCase())]
    return group.includes(req) && group.includes(cand)
  })
}

export function examSubjectMatches(requested: string, candidate: string): boolean {
  const req = requested.trim().toLowerCase()
  const cand = candidate.trim().toLowerCase()
  if (!req || !cand) return false
  if (cand.includes(req) || req.includes(cand)) return true

  const aliases = ALIASES[requested] ?? []
  if (aliases.some((a) => cand.includes(a) || a.includes(cand))) return true

  for (const [canonical, list] of Object.entries(ALIASES)) {
    if (canonical.toLowerCase() === req) {
      if (list.some((a) => cand.includes(a))) return true
    }
    if (list.some((a) => a === req) && canonical.toLowerCase().includes(cand)) return true
  }

  return false
}
