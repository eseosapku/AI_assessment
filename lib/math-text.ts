/**
 * Question text is supposed to be a string. A matrix option came back as
 * [[1, 2], [3, 4]], and the quiz page called .split on it and crashed.
 */

/** A value from a question, as text a maths renderer can draw. */
export function mathText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null || value === false) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((row) => Array.isArray(row))) {
      const body = value
        .map((row) => (row as unknown[]).map((cell) => mathText(cell)).join(' & '))
        .join(' \\\\ ')
      return `$\\begin{pmatrix} ${body} \\end{pmatrix}$`
    }
    return value.map((item) => mathText(item)).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['text', 'label', 'value', 'content', 'latex']) {
      if (typeof record[key] === 'string' || typeof record[key] === 'number') return String(record[key])
    }
  }
  return ''
}
