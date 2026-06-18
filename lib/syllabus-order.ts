/** Sort chapter/unit topics in syllabus order (1, 2, 3 … not 1, 10, 17, 2). */

const SYLLABUS_NUM_RE = /^(?:unit|chapter|module|part|section)\s*(\d+)/i

export function syllabusSortKey(name: string): [number, number, string] {
  const n = String(name || '').trim()
  const m = n.match(SYLLABUS_NUM_RE)
  if (m) {
    const num = parseInt(m[1], 10)
    if (Number.isFinite(num)) return [0, num, n.toLowerCase()]
  }
  return [1, 9999, n.toLowerCase()]
}

export function compareSyllabusNames(a: string, b: string): number {
  const [ga, na, sa] = syllabusSortKey(a)
  const [gb, nb, sb] = syllabusSortKey(b)
  if (ga !== gb) return ga - gb
  if (na !== nb) return na - nb
  return sa.localeCompare(sb)
}

export function sortBySyllabusOrder<T extends { name?: string; topic?: string; subtopic?: string }>(
  rows: T[],
  field: 'name' | 'topic' | 'subtopic' = 'name'
): T[] {
  return [...rows].sort((a, b) => {
    const av = String((a as any)[field] ?? '')
    const bv = String((b as any)[field] ?? '')
    return compareSyllabusNames(av, bv)
  })
}
