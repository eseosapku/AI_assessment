/**
 * The kind of question each subject is actually assessed with.
 *
 * The domain classifier already routes passages and interactive formats, but
 * everything else — the shape of the question itself — is the same prompt for
 * every subject. That produces recall questions across the board, which is the
 * weakest genre in most subjects and the wrong genre in several.
 *
 * The clearest case is mathematics. Asked for four options, a model supplies
 * three arbitrary numbers, and a student can often eliminate them by
 * inspection. Real papers build distractors from the mistakes students
 * actually make — a dropped sign, operations in the wrong order, a result left
 * unsimplified — so a wrong answer identifies a misconception instead of just
 * being wrong.
 *
 * Each block below is additive guidance, appended to the existing prompt. It
 * says what to *ask for*, never what to avoid: told not to write recall
 * questions, a model writes recall questions in different words.
 */

import type { SubjectDomain } from './subject-assessment-plan'

const GENRES: Partial<Record<SubjectDomain, string>> = {
  math: `**MATHEMATICS QUESTION DESIGN**
- Exactly one option may be a correct answer to the question as asked. Equations with several roots are the trap here: "which of these is a solution to x^2 - 5x + 6 = 0" with both 2 and 3 among the options has two right answers and no defensible key. Either ask for a specific one — the larger root, the sum of the roots, the positive solution — or keep the other roots out of the options entirely.
- Check every distractor against the question before finalising: substitute it, evaluate it, confirm it is genuinely wrong.
- Build every wrong option from one specific, nameable mistake a student actually makes: a sign dropped, operations applied in the wrong order, a formula misremembered in a common way, a result left unsimplified, or a unit not converted. Each distractor should be the number that mistake produces.
- Name the mistake behind each wrong option in the explanation, one by one. "The other options do not satisfy the equation" is not an explanation — it tells a student who chose one of them nothing about where they went wrong.
- Prefer questions that need a method over questions that need a fact. "Which of these is a prime number" tests recall; "which value of k makes this equation have no real roots" tests the method.
- Include the working in the explanation, line by line, so a student who went wrong can find the step where it happened.`,

  science: `**SCIENCE QUESTION DESIGN**
- Include practical and investigative questions, not only theory. Apparatus, the independent and dependent variables, what is being controlled, why a result is anomalous, and how to improve a method are all examinable and are what distinguishes a science paper from a vocabulary test.
- Ask for consequence and mechanism: what happens to the rate if this changes, why this structure suits that function, what the result would be if a step were omitted.
- Data questions are strong here — give a small table or set of readings in the stem and ask what it shows.
- Keep every value, unit and symbol syllabus-accurate. An invented number is worse than a simpler question.`,

  business: `**BUSINESS AND ENTREPRENEURSHIP QUESTION DESIGN**
- Assessment in this subject is applied, so lead with a situation rather than a definition. One or two sentences describing a real-feeling small business with a stated problem, then the question about the decision.
- Ask what the owner should do and why, what the consequence of a choice would be, or which option best fits the constraint given. Definitions alone should be the minority of questions.
- Use realistic local detail — a market trader, a small workshop, a delivery service — and keep figures plausible and round enough to reason about.
- Where the question involves a calculation (margin, break-even, mark-up), the explanation shows the working.`,

  technology: `**ICT AND COMPUTING QUESTION DESIGN**
- Ask students to read code, not to define words about code. Give a short snippet in the stem and ask what it outputs, which line contains the error, or what value a variable holds after it runs.
- Trace-the-output questions with a small, complete, correct snippet are the strongest format here; keep snippets under about ten lines so they fit in the stem.
- For non-programming topics, prefer a scenario — a network that has stopped working, a file that will not open — over a definition.
- Any code shown must actually run and produce the stated result.`,

  language: `**LANGUAGE QUESTION DESIGN**
- Spread the questions across the three levels a mark scheme distinguishes: literal (what the text says), inferential (what it implies), and evaluative (how well the writer achieves an effect). A paper made only of literal questions tests reading speed, not comprehension.
- For evaluative questions, ask about the effect of a specific word or device on the reader, and require the student to point at the evidence.
- Grammar and vocabulary questions should use the passage's own sentences rather than invented ones wherever possible.`,

  history: `**HISTORY QUESTION DESIGN**
- Prefer causation, consequence and significance over date recall. Why something happened, what followed from it, and why it mattered are the examinable skills.
- Where a source is given, ask about its usefulness, its reliability, or what it reveals about the person who produced it — not only what it says.
- Every name, date and event must be real. A plausible-sounding invented detail is the worst failure mode in this subject.`,

  humanities: `**GEOGRAPHY AND SOCIAL STUDIES QUESTION DESIGN**
- Lead with data or a place where you can: a set of figures, a described map extract, a named region. Ask what the data shows, why the pattern exists, and what it implies.
- Ask for process and consequence — how a landform develops, why a population moves, what follows from a policy — rather than definitions alone.
- Name real places and use plausible real figures.`,

  religious: `**RELIGIOUS STUDIES QUESTION DESIGN**
- Distinguish questions about belief and practice from questions about text. Both are examinable; only the second should quote a passage.
- Ask for the meaning and application of a teaching, and for how different traditions or thinkers respond to the same question.
- Represent every tradition accurately and without judgement. Quote only real texts.`,

  arts: `**ART AND MUSIC QUESTION DESIGN**
- Ask about technique, material and effect: why a medium suits a purpose, what an instrument contributes to a texture, how a choice changes what the audience perceives.
- Where a work is named it must be real, correctly attributed and correctly dated.
- Practical vocabulary — tools, notation, processes — is examinable, but ask it in the context of doing the thing rather than as isolated definitions.`,
}

/**
 * Additive prompt guidance for a subject's domain.
 *
 * Empty for a domain with nothing specific worth saying, because a generic
 * paragraph dilutes the instructions around it.
 */
export function buildSubjectGenreBlock(domain: SubjectDomain): string {
  return GENRES[domain] ?? ''
}

/** Whether a domain has genre guidance, for tests and diagnostics. */
export function hasGenreGuidance(domain: SubjectDomain): boolean {
  return Boolean(GENRES[domain])
}
