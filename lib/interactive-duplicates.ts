/** Compare the exercise content, not just generic instructions such as "Match each term". */
const norm = (value: unknown) => String(value ?? '').toLowerCase().replace(/\s+/g, '').replace(/[.!?]$/, '')
const sorted = (values: unknown[]) => values.map(norm).sort()

export function interactiveContentKey(q: Record<string, any>): string | null {
  if (q.type !== 'interactive') return null
  let content: unknown
  switch (q.kind) {
    case 'match': content = [sorted(q.left_items || []), sorted(q.right_items || [])]; break
    case 'order': content = (q.correct_order || []).map((i: number) => norm(q.items?.[i])); break
    case 'categorize': content = [sorted(q.categories || []), sorted(q.items || [])]; break
    case 'true_false': content = sorted(q.statements || []); break
    case 'multi_select': content = sorted(q.options || []); break
    case 'odd_one_out': content = sorted(q.items || []); break
    case 'fill_blank': {
      const answers = (q.blanks || []).map((b: any) => norm(b.correct))
      const numbers = String(q.template || '').replace(/\{\{[^}]*\}\}/g, '').match(/-?\d+(?:\.\d+)?/g) || []
      content = [answers, sorted(q.word_bank || []), numbers]
      break
    }
    default: return null
  }
  return `${q.kind}:${JSON.stringify(content)}`
}

export function uniqueInteractiveExercises<T extends Record<string, any>>(questions: T[]): T[] {
  const seen = new Set<string>()
  return questions.filter((q) => {
    const key = interactiveContentKey(q)
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
