/** History / social studies assessment planning and prompts. */

export function isHistorySubject(subject: string): boolean {
  return /\b(history|historical|social studies|global perspectives|general paper)\b/i.test(
    String(subject || ''),
  )
}

export interface HistoryPassagePlan {
  usePassageFlow: boolean
  passageQuestionCount: number
  directQuestionCount: number
}

/**
 * History assessments mix direct syllabus questions with source-analysis questions.
 * Passages are historical sources — not English literature extracts.
 */
export function assessHistoryPassagePlan(opts: {
  count: number
  hasSourceText: boolean
}): HistoryPassagePlan {
  const empty = { usePassageFlow: false, passageQuestionCount: 0, directQuestionCount: opts.count }
  if (opts.hasSourceText || opts.count <= 0) return empty

  const passageQuestionCount = Math.max(1, Math.min(opts.count - 1, Math.ceil(opts.count * 0.45)))
  return {
    usePassageFlow: true,
    passageQuestionCount,
    directQuestionCount: opts.count - passageQuestionCount,
  }
}

export function historyPassageHint(topics: string[], groupIdx: number): string {
  const focus = topics.filter(Boolean).slice(0, 3).join('; ') || 'the selected historical topic'
  const styles = [
    `A textbook-style historical account excerpt on: ${focus}. Factual narrative with dates, names, policies, and cause/effect — not a fictional story.`,
    `A primary historical source (speech, letter, memoir, government report, or newspaper article) about: ${focus}. Clearly dated; includes explicit historical claims.`,
    `A historian's analytical commentary OR contemporary witness account on: ${focus}. Assessable perspective and evidence — no invented characters or literary scenes.`,
  ]
  return styles[groupIdx % styles.length]
}

export function buildHistoryPassagePrompt(opts: {
  topics: string[]
  hint: string
  grade?: number | string
}): string {
  const gradeLabel = opts.grade ? `Grade ${opts.grade}` : 'secondary school'
  const topicLine = opts.topics.length ? opts.topics.join(', ') : 'the syllabus topic'

  return `You are writing a HISTORICAL SOURCE extract for a ${gradeLabel} HISTORY exam — NOT an English literature comprehension.

SYLLABUS TOPICS: ${topicLine}
WHAT TO WRITE: ${opts.hint}

REQUIREMENTS:
- 350–550 words of historical content directly relevant to the topics
- Acceptable forms: textbook excerpt, speech transcript, political pamphlet, diary/letter, government report, memoir, newspaper article, historian's analysis
- FORBIDDEN: fictional stories, invented characters (no watchmakers, farmers on porches, fictional towns), literary fiction tone, "original passage written for students"
- Include concrete historical detail: dates, names, places, policies, events, causes, consequences
- Students must be able to answer HISTORY questions (significance, causation, change, reliability, perspective, evidence)
- Use natural paragraph breaks

Return EXACTLY this format (no markdown):
PASSAGE:
[full extract text]

SOURCE:
[e.g. "Extract from a speech by [figure], [year]" or "Textbook account of [event], [period]" — never "Original passage written for Grade X"]`
}

export function buildHistoryTopicAlignmentRules(topics: string[]): string[] {
  const topicText = topics.join(' ').toLowerCase()
  const rules: string[] = [
    'HISTORY: Questions must test historical knowledge and skills — causes, consequences, significance, chronology, change and continuity, comparison, and source evaluation.',
    'Use topic-specific vocabulary (people, events, policies, dates, places) from the selected syllabus.',
    'Do NOT write English-literature questions (no "how does the author use imagery/simile", no analysis of fictional characters, no creative-writing tone).',
    'For source-based questions: ask about historical inference, reliability, usefulness, perspective, bias, and what the source reveals about events — quote only words that appear in the source.',
    'For direct questions (no source): use exam-style stems — "Explain why…", "Assess the significance of…", "To what extent…", "What were the causes of…", "How did X change…".',
  ]

  if (topics.length > 1) {
    rules.push('Cover all selected topics; include at least one question per topic.')
  }

  if (/bismarck|germany|unification|nationalism|liberalism/i.test(topicText)) {
    rules.push("German history: focus on unification, Bismarck's policies, wars, constitution, nationalism/liberalism tensions — not metaphorical fiction.")
  }
  if (/depression|new deal|crash|gilded|usa|america|1920|1930/i.test(topicText)) {
    rules.push('US interwar history: focus on economic collapse, Hoover/Roosevelt policies, New Deal programmes, social impact — use historical framing.')
  }

  return rules
}

export function buildHistorySourceQuestionPrompt(opts: {
  passage: string
  passageSource: string
  subject: string
  topics: string[]
  count: number
  startId: number
  style: string
  curriculumName: string
  curriculumBlock: string
  questionType: 'mcq' | 'longform' | 'mixed'
  difficultyLevel?: string
  grade?: number | string
}): string {
  const {
    passage,
    passageSource,
    subject,
    topics,
    count,
    startId,
    style,
    curriculumName,
    curriculumBlock,
    questionType,
    difficultyLevel,
    grade,
  } = opts

  const topicRules = buildHistoryTopicAlignmentRules(topics)
  const difficultyInstruction = difficultyLevel ? `**${difficultyLevel}**` : ''

  const mcqSchema = `{ "id": <number>, "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correct_answer": <0-3>, "explanation": "100-150 words with historical reasoning" }`
  const lfSchema = `{ "id": <number>, "type": "longform", "question": "...", "marks": <4-8>, "marking_criteria": ["one mark per point — each grounded in the source or historical context"], "model_answer": "80-120 words using verbatim quotes from the source where needed", "explanation": "40-60 words: historical skill tested" }`

  const schemaBlock =
    questionType === 'mcq' ? mcqSchema : questionType === 'longform' ? lfSchema : `${mcqSchema},\n${lfSchema}`

  const mcqCount = questionType === 'mixed' ? Math.ceil(count * 0.6) : questionType === 'mcq' ? count : 0
  const lfCount = questionType === 'mixed' ? Math.floor(count * 0.4) : questionType === 'longform' ? count : 0
  const taskLine =
    questionType === 'mcq'
      ? `Generate exactly ${count} MCQ questions using the historical source below.`
      : questionType === 'longform'
        ? `Generate exactly ${count} long-form history questions using the source below.`
        : `Generate exactly ${count} questions: ${mcqCount} MCQ and ${lfCount} long-form.`

  const gradeNote = grade ? `Grade ${grade}` : 'secondary level'

  return `You are a ${curriculumName} HISTORY examiner. Write ${style} ${subject} questions for ${gradeNote}.

${curriculumBlock}

**Syllabus topics:** ${topics.join(', ') || subject}
**Source attribution:** ${passageSource}
**Topic rules:**
- ${topicRules.join('\n- ')}

━━━ HISTORICAL SOURCE ━━━
${passage}
━━━ END OF SOURCE ━━━

TASK: ${taskLine}

━━━ HISTORY SOURCE RULES (STRICT) ━━━
1. This is a HISTORY source-analysis task — NOT English literature.
2. ONLY reference words, claims, and details that ACTUALLY appear in the source above. Never invent quotations or phrases.
3. Allowed question types:
   • What does the source suggest/reveal about [event/policy/situation]?
   • How useful/reliable is this source for studying [topic]?
   • What can a historian learn from this source about [causes/consequences/attitudes]?
   • Which inference is best supported by the source?
   • Explain the significance of a specific claim in the source (with quote).
4. FORBIDDEN: "how does the author use imagery/simile/metaphor", fictional character analysis, literary craft questions unless analysing rhetoric in a speech for historical persuasion.
5. model_answer: quote verbatim from the source when citing evidence.
6. Vary skills: comprehension of historical content, inference, reliability, perspective/bias, usefulness for an enquiry.
${difficultyInstruction ? `7. ${difficultyInstruction}` : ''}

Return ONLY valid JSON:
{ "questions": [ ${schemaBlock} ] }

IDs: ${startId} to ${startId + count - 1}.`
}
