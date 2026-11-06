const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Solve narrowly identifiable calendar-offset questions exactly, including month boundaries. */
export function repairCalendarAnswer(q: Record<string, any>): boolean {
  if (q.type !== 'longform' || !q.scenario) return false
  const scenario = String(q.scenario)
  const date = scenario.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTHS.join('|')})\\b`, 'i'))
  const offset = scenario.match(/\b(\d+)\s+(weeks?|days?)\s+(before|after)\b/i)
  if (!date || !offset || !/\b(invitation|party|meeting|event|appointment)\b/i.test(scenario)) return false
  const asksDate = /\b(calculate|find|determine|work out)\b.*\b(date|day)\b/i.test(q.question)
  const asksMonth = /\b(name|state|give|identify)\b.*\bmonth\b/i.test(q.question)
  if (!asksDate && !asksMonth) return false
  const year = Number(scenario.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || 2001)
  const month = MONTHS.findIndex((m) => m.toLowerCase() === date[2].toLowerCase())
  const start = new Date(Date.UTC(year, month, Number(date[1])))
  if (start.getUTCMonth() !== month || Number(offset[1]) > 366) return false
  const days = Number(offset[1]) * (/^week/i.test(offset[2]) ? 7 : 1)
  const end = new Date(start.getTime() + (offset[3].toLowerCase() === 'before' ? -1 : 1) * days * 86400000)
  const result = `${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]}`
  q.model_answer = asksDate ? `${date[1]} ${MONTHS[month]}, ${days} days ${offset[3].toLowerCase()}, gives ${result}.` : `The calculated date is ${result}, so the month is ${MONTHS[end.getUTCMonth()]}.`
  q.explanation = `Count ${days} days ${offset[3].toLowerCase()} ${date[1]} ${MONTHS[month]}, using the actual number of days in each month. The resulting date is ${result}.`
  const marks = Math.max(1, Math.min(8, Number(q.marks) || 1))
  const steps = asksDate ? [`Convert the interval correctly: ${days} days.`, 'Account for the correct number of days in each month.', `State the date ${result}.`] : ['Use the date calculated in part (a).', `Identify ${MONTHS[end.getUTCMonth()]} as the month.`]
  q.marking_criteria = marks <= steps.length ? [...steps.slice(0, marks - 1), steps[steps.length - 1]] : steps
  return true
}
