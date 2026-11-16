/**
 * Reads a raw book name ("Cambridge IGCSE™ Chemistry Coursebook with Digital
 * Access (2 Years)") as a short subject and a level, so a subject card can show
 * "Chemistry" big and "Cambridge IGCSE" small. Pure: no server imports.
 */

// Most specific first: Further Mathematics before Mathematics, Computer Science before Science.
const SUBJECTS: [RegExp, string][] = [
  [/further\s+math/i, 'Further Mathematics'],
  [/additional\s+math/i, 'Additional Mathematics'],
  [/computer\s+science/i, 'Computer Science'],
  [/\bcomputing\b/i, 'Computing'],
  [/\bict\b|information\s+(?:and|&)\s+communication/i, 'ICT'],
  [/\bentrep/i, 'Entrepreneurship'],
  [/social\s+studies\s+and\s+religio/i, 'Social Studies and Religious Education'],
  [/global\s+perspectives/i, 'Global Perspectives'],
  [/environmental\s+management/i, 'Environmental Management'],
  [/\bSET\b|elementary\s+(?:science\s+and\s+)?technology/, 'Science and Elementary Technology'],
  [/\bmath/i, 'Mathematics'],
  [/\bbiolog/i, 'Biology'],
  [/\bchemist/i, 'Chemistry'],
  [/\bphysic(?:s|al\s+education)\b/i, 'Physics'],
  [/\bscience/i, 'Science'],
  [/\bIT\b/, 'ICT'],
  [/\bagric/i, 'Agriculture'],
  [/\bSST\b|^social\s+studies\b/i, 'Social Studies'],
  [/\bcreative\s+arts\b/i, 'Creative Arts'],
  [/\bmusic\b/i, 'Music'],
  [/literature\s+in\s+english/i, 'Literature in English'],
  [/\beng(?:lish)?\b/i, 'English'],
  [/\bfrench\b/i, 'French'],
  [/\barabic\b/i, 'Arabic'],
  [/\bkiswahili\b|\bswahili\b/i, 'Kiswahili'],
  [/\bgeograph/i, 'Geography'],
  [/\bhistory\b/i, 'History'],
  [/\beconomic/i, 'Economics'],
  [/\baccount/i, 'Accounting'],
  [/\bbusiness\b/i, 'Business'],
  [/\bagricultur/i, 'Agriculture'],
  [/\bcivic/i, 'Civic Education'],
  [/\bsociology\b/i, 'Sociology'],
  [/\bpsycholog/i, 'Psychology'],
  [/\bgovernment\b/i, 'Government'],
  [/\bkinyarwanda\b/i, 'Kinyarwanda'],
  [/\bspanish\b/i, 'Spanish'],
  [/\bgerman\b/i, 'German'],
  [/\bhausa\b/i, 'Hausa'],
  [/\byoruba\b/i, 'Yoruba'],
  [/\bigbo\b/i, 'Igbo'],
]

function levelOf(raw: string): { level: string | null; rest: string } {
  let s = raw
  const nerdc = /^\s*NERDC\s+(Primary|Junior\s+Secondary|Senior\s+Secondary)\s+(\d+)\s*[—–:\-]+\s*(.*)$/i.exec(s)
  if (nerdc) {
    const stage = nerdc[1].replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return { level: `NERDC ${stage} ${nerdc[2]}`, rest: nerdc[3].replace(/^Trade\s*:\s*/i, '') }
  }
  const lower = /Lower\s+Secondary/i.test(s)
  if (lower) {
    const d = /\b([789])\b/.exec(s)
    return { level: `Cambridge Lower Secondary${d ? ` ${d[1]}` : ''}`, rest: s }
  }
  if (/AS\s*(?:&|and)?\s*A\s+Level/i.test(s)) return { level: 'Cambridge AS & A Level', rest: s }
  if (/\bAS\s+Level/i.test(s)) return { level: 'Cambridge AS Level', rest: s }
  if (/\bA\s+Level/i.test(s)) return { level: 'Cambridge A Level', rest: s }
  if (/IGCSE/i.test(s)) return { level: 'Cambridge IGCSE', rest: s }
  const stage = /(?<![A-Za-z])([SPN])\s?(\d)(?!\d)/i.exec(s)
  if (stage) return { level: `${stage[1].toUpperCase()}${stage[2]}`, rest: s }
  const form = /\b(Form|Grade|Year)\s+(\d+)\b/i.exec(s)
  if (form) return { level: `${form[1][0].toUpperCase()}${form[1].slice(1).toLowerCase()} ${form[2]}`, rest: s }
  return { level: null, rest: s }
}

const BOOK_WORDS = /\b(cambridge|igcse|international|lower\s+secondary|as\s*&\s*a\s+level|as\s+level|a\s+level|coursebook|course\s+book|workbook|student'?s?\s+book|teacher'?s?\s+(?:book|guide)|with\s+digital\s+access|digital\s+access|\d+\s+years?|\d+(?:st|nd|rd|th)|ed(?:ition)?|second|third|fourth|sb|pb|tb|tg|term|general\s+edu|nerdc|experimental\s+version|proofread|final|complete|for)\b/gi

export function bookTitle(raw: string): { subject: string; level: string | null } {
  const original = String(raw ?? '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim()
  const { level, rest } = levelOf(original)
  const hay = rest.replace(/[_]+/g, ' ')
  for (const [re, name] of SUBJECTS) if (re.test(hay)) return { subject: name, level }

  let s = hay.replace(/\([^)]*\)/g, ' ').replace(BOOK_WORDS, ' ')
  s = s.replace(/(?<![A-Za-z])[SPN]\s?\d(?!\d)/gi, ' ').replace(/\b\d+\b/g, ' ').replace(/[-–—_.,:;]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) s = original.replace(/[-–—_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'
  const small = new Set(['and', 'of', 'the', 'in', 'for'])
  if (s.length > 4 && s === s.toUpperCase()) {
    s = s.toLowerCase().split(' ').map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
  }
  return { subject: s, level }
}
