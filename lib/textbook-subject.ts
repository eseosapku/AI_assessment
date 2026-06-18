/** Derive a short subject label from a full textbook title. */
export function subjectFromTextbookName(textbookName: string): string {
  const n = String(textbookName || '').trim()
  if (!n) return 'Subject'

  const rules: Array<[RegExp, string]> = [
    [/english as a second language|esl workbook|esl coursebook/i, 'English as a Second Language'],
    [/english as a first language|first language course/i, 'English First Language'],
    [/english language/i, 'English Language'],
    [/additional mathematics|additional math/i, 'Additional Mathematics'],
    [/further mathematics|further math/i, 'Further Mathematics'],
    [/probability.*statistics|statistics.*probability/i, 'Mathematics — Probability & Statistics'],
    [/pure mathematics/i, 'Mathematics — Pure'],
    [/mechanics.*coursebook|mathematics.*mechanics/i, 'Mathematics — Mechanics'],
    [/mathematics|maths/i, 'Mathematics'],
    [/computer science/i, 'Computer Science'],
    [/information and communication|(?<![a-z])ict(?![a-z])|it coursebook/i, 'ICT'],
    [/environmental management/i, 'Environmental Management'],
    [/enterprise/i, 'Enterprise'],
    [/global perspectives/i, 'Global Perspectives'],
    [/business studies|business coursebook/i, 'Business Studies'],
    [/accounting|accounts/i, 'Accounting'],
    [/economics/i, 'Economics'],
    [/coordinated sciences/i, 'Coordinated Sciences'],
    [/chemistry/i, 'Chemistry'],
    [/physics/i, 'Physics'],
    [/biology/i, 'Biology'],
    [/marine science/i, 'Marine Science'],
    [/food and nutrition/i, 'Food & Nutrition'],
    [/french/i, 'French'],
    [/german/i, 'German'],
    [/spanish/i, 'Spanish'],
    [/geography/i, 'Geography'],
    [/history/i, 'History'],
    [/literature in english|literature/i, 'Literature'],
    [/art and design|art & design/i, 'Art & Design'],
    [/design and technology/i, 'Design & Technology'],
    [/physical education|(?<![a-z])pe(?![a-z])/i, 'Physical Education'],
    [/music/i, 'Music'],
    [/travel and tourism/i, 'Travel & Tourism'],
    [/sociology/i, 'Sociology'],
    [/psychology/i, 'Psychology'],
    [/computing coursebook/i, 'Computing'],
    [/primary mathematics|learners book.*math/i, 'Mathematics'],
    [/primary computing/i, 'Computing'],
  ]

  for (const [re, label] of rules) {
    if (re.test(n)) return label
  }

  const stripped = n
    .replace(/^cambridge\s+/i, '')
    .replace(/cambridge\s+international\s+/i, '')
    .replace(/cambridge\s+igcse[™®]?\s*/i, '')
    .replace(/cambridge\s+primary\s+/i, '')
    .replace(/\s+coursebook.*$/i, '')
    .replace(/\s+student book.*$/i, '')
    .replace(/\s+learners? book.*$/i, '')
    .replace(/\s+workbook.*$/i, '')
    .replace(/\s+with digital access.*$/i, '')
    .trim()

  if (stripped.length >= 3 && stripped.length <= 48) return stripped
  return n.length > 48 ? n.slice(0, 45) + '…' : n
}

/** Drop only obvious duplicate aliases (not distinct subjects). */
export function filterAliasTextbooks<T extends { id: number; name: string }>(items: T[]): T[] {
  const hasIgcseAccounts = items.some((tb) => /igcse accounts/i.test(tb.name))
  return items.filter((tb) => {
    if (hasIgcseAccounts && /^accounting$/i.test(tb.name.trim())) return false
    return true
  })
}

/** Short suffix to tell apart two books under the same subject (e.g. two ICT coursebooks). */
function inferVariantHint(textbookName: string): string {
  const n = textbookName.trim()
  const lower = n.toLowerCase()

  if (/as\s*[&/]?\s*a\s*level|a\s*level|alevel/i.test(lower)) return 'AS/A Level'
  if (/\bit\s+for\s+cambridge/i.test(lower)) return 'AS/A Level IT'
  if (/\bo\s*level\b|olevel/i.test(lower) && /igcse/i.test(lower)) return 'IGCSE & O Level'
  if (/\bo\s*level\b|olevel/i.test(lower)) return 'O Level'
  if (/igcse/i.test(lower)) return 'IGCSE'
  if (/stage\s*(\d+)/i.test(lower)) {
    const m = lower.match(/stage\s*(\d+)/i)
    return m ? `Stage ${m[1]}` : 'Primary'
  }
  if (/primary|lower secondary/i.test(lower)) return 'Primary'

  if (/workbook/i.test(lower)) return 'Workbook'
  if (/revision|study guide/i.test(lower)) return 'Revision Guide'
  if (/grammar/i.test(lower)) return 'Grammar'
  if (/complete\s+/i.test(n)) return 'Complete'
  if (/second edition|2nd edition/i.test(lower)) return '2nd Edition'
  if (/fifth edition|5th edition/i.test(lower)) return '5th Edition'
  if (/fourth edition|4th edition/i.test(lower)) return '4th Edition'
  if (/algorithms|programming|logic/i.test(lower)) return 'Programming'
  if (/computer systems/i.test(lower)) return 'Computer Systems'

  const stripped = n
    .replace(/^cambridge\s+(international\s+)?/i, '')
    .replace(/^cambridge\s+igcse[™®]?\s*/i, '')
    .replace(/^(and\s+)?o\s+level\s+/i, '')
    .replace(/\s+(coursebook|student book|learners? book|workbook|e-book).*$/i, '')
    .replace(/\s+with digital access.*$/i, '')
    .replace(/\s+\(z-lib\.org\)\s*(\(\d+\))?/i, '')
    .replace(/\s+\(\d+\)\s*$/i, '')
    .trim()

  if (stripped.length >= 4) {
    return stripped.length > 32 ? `${stripped.slice(0, 29)}…` : stripped
  }

  return 'Coursebook'
}

/** Add displayName — appends a variant when several books share one subject. */
export function withDisplaySubjectNames<T extends { id: number; name: string; subjectName?: string }>(
  items: T[]
): Array<T & { subjectName: string; displayName: string }> {
  const mapped = items.map((tb) => ({
    ...tb,
    subjectName: tb.subjectName || subjectFromTextbookName(tb.name),
  }))

  const groups = new Map<string, typeof mapped>()
  for (const tb of mapped) {
    const list = groups.get(tb.subjectName) || []
    list.push(tb)
    groups.set(tb.subjectName, list)
  }

  const usedHints = new Map<string, Set<string>>()

  return mapped.map((tb) => {
    const group = groups.get(tb.subjectName)!
    if (group.length === 1) {
      return { ...tb, displayName: tb.subjectName }
    }

    let hint = inferVariantHint(tb.name)
    const used = usedHints.get(tb.subjectName) || new Set<string>()
    let suffix = hint
    let i = 2
    while (used.has(suffix)) {
      suffix = `${hint} ${i}`
      i++
    }
    used.add(suffix)
    usedHints.set(tb.subjectName, used)

    return { ...tb, displayName: `${tb.subjectName} (${suffix})` }
  })
}
