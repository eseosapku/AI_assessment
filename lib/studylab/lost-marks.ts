/** One question a student got wrong, small enough to read as a single line. */
export interface LostMark { question: string; said: string; right: string }

function parse(v: unknown): unknown {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return undefined }
}

// A dollar sign or a backslash means maths markup, which does not read as one plain line.
const BACKSLASH = String.fromCharCode(92)
const mathy = (s: string) => s.includes('$') || s.includes(BACKSLASH)
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Wrong answers in this chapter, newest result first, one line each. */
export function lostMarksFrom(
  results: { answers: unknown; questions_data: unknown }[],
  where: { subtopicIds: number[]; topicId: number },
  limit = 2,
): LostMark[] {
  const out: LostMark[] = []
  const seen = new Set<string>()
  for (const r of results) {
    const questions = parse(r?.questions_data)
    if (!Array.isArray(questions)) continue
    const a: any = parse(r?.answers)
    const mcq = a && typeof a === 'object' && a.mcq ? a.mcq : (a ?? {})
    for (let i = 0; i < questions.length; i++) {
      const q: any = questions[i]
      if (!q || q.type !== 'mcq' || !Array.isArray(q.options)) continue
      const sid = Number(q.subtopic_id) || 0
      const tid = Number(q.topic_id) || 0
      const here = (sid > 0 && where.subtopicIds.includes(sid)) || (tid === where.topicId && (sid <= 0 || where.subtopicIds.length === 0))
      if (!here) continue
      if (q.image_url || q.figureGroup || q.passage || q.diagram_svg || q.scenario) continue
      const question = text(q.question)
      if (!question || question.length > 140 || mathy(question) || seen.has(question)) continue
      const picked = mcq?.[i] ?? mcq?.[String(i)]
      if (picked === undefined || picked === null || picked === '') continue
      const said = text(q.options[Number(picked)])
      const right = text(q.options[Number(q.correct_answer)])
      if (!said || !right || Number(picked) === Number(q.correct_answer)) continue
      if (said.length > 80 || right.length > 80 || mathy(said + right)) continue
      seen.add(question)
      out.push({ question, said, right })
      if (out.length >= limit) return out
    }
  }
  return out
}
