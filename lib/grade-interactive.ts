import type {
  InteractiveAnswer,
  InteractiveGrade,
  InteractiveQuestion,
} from '@/types/interactive'

function norm(s: string): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isInteractiveAnswerComplete(
  q: InteractiveQuestion,
  answer: InteractiveAnswer | undefined,
): boolean {
  if (!answer || answer.kind !== q.kind) return false

  switch (q.kind) {
    case 'match':
      if (answer.kind !== 'match') return false
      return q.left_items.every((_, i) => answer.pairs[i] !== undefined)
    case 'order':
      if (answer.kind !== 'order') return false
      return answer.order.length === q.items.length
    case 'categorize':
      if (answer.kind !== 'categorize') return false
      return q.items.every((_, i) => answer.assignments[i] !== undefined)
    case 'fill_blank':
      if (answer.kind !== 'fill_blank') return false
      return q.blanks.every((b) => (answer.values[b.id] ?? '').trim().length > 0)
    case 'true_false':
      if (answer.kind !== 'true_false') return false
      return q.statements.every((_, i) => answer.answers[i] !== undefined)
    case 'multi_select':
      if (answer.kind !== 'multi_select') return false
      return answer.selected.length > 0
    case 'odd_one_out':
      if (answer.kind !== 'odd_one_out') return false
      return Number.isFinite(answer.selected)
    default:
      return false
  }
}

export function gradeInteractiveQuestion(
  q: InteractiveQuestion,
  answer: InteractiveAnswer | undefined,
): InteractiveGrade {
  if (!answer || answer.kind !== q.kind) {
    return { marks_awarded: 0, marks_total: q.marks, item_results: [] }
  }

  const item_results: { label: string; correct: boolean }[] = []

  switch (q.kind) {
    case 'match': {
      if (answer.kind !== 'match') break
      for (const [leftIdx, rightIdx] of q.correct_pairs) {
        const studentRight = answer.pairs[leftIdx]
        const correct = studentRight === rightIdx
        item_results.push({
          label: `${q.left_items[leftIdx]} → ${q.right_items[rightIdx]}`,
          correct,
        })
      }
      break
    }
    case 'order': {
      if (answer.kind !== 'order') break
      q.correct_order.forEach((itemIdx, pos) => {
        const studentItem = answer.order[pos]
        const correct = studentItem === itemIdx
        item_results.push({ label: q.items[itemIdx], correct })
      })
      break
    }
    case 'categorize': {
      if (answer.kind !== 'categorize') break
      q.items.forEach((item, i) => {
        const correct = answer.assignments[i] === q.correct_category[i]
        const cat = q.categories[q.correct_category[i]] ?? '?'
        item_results.push({ label: `${item} → ${cat}`, correct })
      })
      break
    }
    case 'fill_blank': {
      if (answer.kind !== 'fill_blank') break
      for (const blank of q.blanks) {
        const student = norm(answer.values[blank.id] ?? '')
        const correct = student === norm(blank.correct)
        item_results.push({ label: blank.correct, correct })
      }
      break
    }
    case 'true_false': {
      if (answer.kind !== 'true_false') break
      q.statements.forEach((stmt, i) => {
        const correct = answer.answers[i] === q.correct_answers[i]
        item_results.push({
          label: `${stmt} → ${q.correct_answers[i] ? 'True' : 'False'}`,
          correct,
        })
      })
      break
    }
    case 'multi_select': {
      if (answer.kind !== 'multi_select') break
      const selectedSet = new Set(answer.selected)
      const correctSet = new Set(q.correct_indices)
      q.options.forEach((opt, i) => {
        const shouldSelect = correctSet.has(i)
        const didSelect = selectedSet.has(i)
        item_results.push({
          label: `${opt} (${shouldSelect ? 'should select' : 'should not'})`,
          correct: shouldSelect === didSelect,
        })
      })
      break
    }
    case 'odd_one_out': {
      if (answer.kind !== 'odd_one_out') break
      q.items.forEach((item, i) => {
        if (i === q.correct_index) {
          item_results.push({ label: `${item} (odd one out)`, correct: answer.selected === i })
        }
      })
      if (item_results.length === 0) {
        item_results.push({
          label: q.items[q.correct_index] ?? 'Correct item',
          correct: answer.selected === q.correct_index,
        })
      }
      break
    }
  }

  const correctCount = item_results.filter((r) => r.correct).length
  const totalItems = item_results.length || q.marks
  const marks_awarded =
    totalItems > 0 ? Math.round((correctCount / totalItems) * q.marks * 10) / 10 : 0

  return { marks_awarded, marks_total: q.marks, item_results }
}
