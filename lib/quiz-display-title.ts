const SUBJECTS = [
  'Further Mathematics', 'Computer Science', 'Environmental Management',
  'Economics', 'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Science',
  'Geography', 'History', 'Literature', 'English', 'Kiswahili',
]

/** Turns an ingestion/source filename into a title intended for a learner. */
export function quizDisplayTitle(raw: unknown): string {
  const source = String(raw ?? '').trim()
  if (!source) return 'Practice quiz'
  const words = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const subject = SUBJECTS.find((name) => new RegExp(`\\b${name.replace(' ', '\\s+')}\\b`, 'i').test(words))
  const level = /igcse/i.test(words)
    ? 'Cambridge IGCSE'
    : /\bas\b.*\ba level\b|\ba level\b/i.test(words)
      ? 'Cambridge AS & A Level'
      : /lower secondary/i.test(words)
        ? 'Cambridge Lower Secondary'
        : /primary/i.test(words)
          ? 'Cambridge Primary'
          : ''
  if (subject) return `${level ? `${level} ` : ''}${subject} quiz`
  return words.length > 64 ? `${words.slice(0, 61).trimEnd()}…` : words
}
