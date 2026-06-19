/** Topic-aware planning for language / English assessments. */

const LANGUAGE_ARTS_SUBJECTS = [
  'english',
  'english language',
  'english literature',
  'literature',
  'literature in english',
  'french',
  'kinyarwanda',
  'swahili',
  'language arts',
  'reading',
]

/** Topics that should be tested with direct skill questions — not long reading passages. */
const DIRECT_SKILL_TOPIC =
  /\b(oral english|phonetic|phonology|consonant|vowel|diphthong|stress pattern|intonation|rhyme scheme|essay writing|narrative essay|argumentative|composition|letter writing|report writing|grammar|punctuation|parts of speech|noun phrase|verb tense|clause|syntax|spelling|homophone|synonym|antonym|prefix|suffix|affix|word formation|speech writing|debate|summary writing|paragraph writing|punctuation mark|capitalization|grammatical level|approaching texts on a grammatical|figures of speech|metaphor|simile|personification|register|tone and mood|writing skills|directed writing)\b/i

/** Topics where a shared reading extract is appropriate. */
const PASSAGE_TOPIC =
  /\b(reading comprehension|comprehension passage|comprehension and inference|comprehension and summary|listening comprehension|\bcomprehension\b|\binference\b|unseen prose|unseen poetry|unseen extract|unseen passage|literary analysis|literature appreciation|prose analysis|poetry analysis|drama analysis|close reading|inference from (the )?(text|passage|extract)|writer'?s (craft|technique|style)|character analysis|extract-based|based on the (passage|extract|text)|literary text|prose extract|set text|prescribed text|reading passage|text analysis|analysing texts|analyzing texts|responding to texts|african literature|literature in english|reading fiction|fiction -|non-fiction -|playscript|narrative poem|\bpoetry\b|\bpoem\b|short story|\bnovel\b|\bdrama\b|summary skills)\b/i

export function isLanguageArtsSubject(subject: string): boolean {
  const s = String(subject || '').toLowerCase()
  return LANGUAGE_ARTS_SUBJECTS.some((name) => s.includes(name))
}

/** @deprecated Prefer assessLanguagePassagePlan — kept for history / social studies. */
export function subjectTraditionallyUsesPassages(subject: string): boolean {
  const s = String(subject || '').toLowerCase()
  return (
    isLanguageArtsSubject(subject) ||
    ['history', 'general paper', 'global perspectives', 'social studies'].some((name) => s.includes(name))
  )
}

export interface LanguagePassagePlan {
  /** Generate any questions via passage-first flow */
  usePassageFlow: boolean
  passageQuestionCount: number
  directQuestionCount: number
  /** When true, every question in a batch should carry needs_passage */
  requirePassageOnAll: boolean
}

export function assessLanguagePassagePlan(opts: {
  subject: string
  topics: string[]
  count: number
  hasSourceText: boolean
}): LanguagePassagePlan {
  const { subject, topics, count, hasSourceText } = opts
  const empty = { usePassageFlow: false, passageQuestionCount: 0, directQuestionCount: count, requirePassageOnAll: false }

  if (!isLanguageArtsSubject(subject) || hasSourceText || count <= 0) return empty

  const blob = topics.join(' ').toLowerCase()
  const wantsPassage = PASSAGE_TOPIC.test(blob)
  const wantsDirect = DIRECT_SKILL_TOPIC.test(blob)

  if (wantsDirect && !wantsPassage) return empty

  if (wantsPassage && !wantsDirect) {
    return {
      usePassageFlow: true,
      passageQuestionCount: count,
      directQuestionCount: 0,
      requirePassageOnAll: true,
    }
  }

  if (wantsPassage && wantsDirect) {
    const passageQuestionCount = Math.max(1, Math.min(count - 1, Math.ceil(count * 0.35)))
    return {
      usePassageFlow: true,
      passageQuestionCount,
      directQuestionCount: count - passageQuestionCount,
      requirePassageOnAll: false,
    }
  }

  // Default for language subjects: skill questions aligned to curriculum topics, not generic passages.
  return empty
}

function normalizeText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantWords(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 3)
}

/** Pull a coherent excerpt from textbook / curriculum source text when available. */
export function excerptFromTextbookSource(
  sourceText: string,
  topics: string[],
  sourceLabel: string,
  minWords = 100,
  maxWords = 450,
): { text: string; source: string } | null {
  const raw = String(sourceText || '').trim()
  if (raw.length < 200) return null

  const topicWords = new Set(significantWords(topics.join(' ')))
  const paragraphs = raw
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 80)

  if (!paragraphs.length) return null

  const scored = paragraphs.map((p, idx) => {
    const words = significantWords(p)
    let overlap = 0
    for (const w of words) if (topicWords.has(w)) overlap++
    return { p, idx, score: topicWords.size ? overlap / topicWords.size : 0 }
  })
  scored.sort((a, b) => b.score - a.score || b.p.length - a.p.length)

  const chunks: string[] = []
  let wordCount = 0
  const used = new Set<number>()

  for (const { p, idx } of scored) {
    if (used.has(idx)) continue
    used.add(idx)
    chunks.push(p)
    wordCount += p.split(/\s+/).filter(Boolean).length
    if (wordCount >= minWords) break
  }

  if (wordCount < minWords) {
    for (let i = 0; i < paragraphs.length && wordCount < minWords; i++) {
      if (used.has(i)) continue
      chunks.push(paragraphs[i])
      wordCount += paragraphs[i].split(/\s+/).filter(Boolean).length
    }
  }

  let text = chunks.join('\n\n').trim()
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < minWords) return null
  if (words.length > maxWords) {
    text = words.slice(0, maxWords).join(' ') + '…'
  }

  return {
    text,
    source: sourceLabel ? `${sourceLabel} (curriculum extract)` : 'Curriculum textbook extract',
  }
}

export function topicFocusedPassageHint(topics: string[], groupIdx: number): string {
  const focus = topics.filter(Boolean).slice(0, 3).join(', ')
  if (focus) {
    return `A curriculum-aligned reading extract directly supporting these topics: ${focus}. Content, vocabulary, and style must match what students study in these units — not unrelated generic fiction.`
  }
  const fallbacks = [
    'A short curriculum-style informational or literary extract suitable for comprehension practice',
    'A brief passage with clear factual or narrative content appropriate to the grade level',
  ]
  return fallbacks[groupIdx % fallbacks.length]
}

export function buildEnglishTopicAlignmentRules(subject: string | undefined, topics: string[]): string[] {
  if (!isLanguageArtsSubject(String(subject || ''))) return []

  const topicText = topics.join(' ').toLowerCase()
  const rules: string[] = [
    'ENGLISH: Every question must test the SELECTED topics directly (grammar, oral English, essay skills, vocabulary, or comprehension as named).',
    'Do NOT default to random reading-comprehension about unrelated characters unless the topic explicitly requires literary or comprehension work.',
  ]

  if (topics.length > 1) {
    rules.push('Spread questions across all selected topics — at least one question per topic.')
  }

  if (DIRECT_SKILL_TOPIC.test(topicText)) {
    rules.push(
      'These are SKILL-BASED topics: use standalone questions. Embed short examples inside the question when needed (e.g. one sentence to correct or analyse). Do NOT require a long reading passage.',
    )
  }

  if (/\b(oral|phonetic|consonant|vowel|diphthong|stress|intonation)\b/i.test(topicText)) {
    rules.push(
      'Oral English: test sound identification, stress, vowel/consonant distinctions, minimal pairs, or syllable structure using examples from the curriculum.',
    )
  }

  if (/\b(essay|narrative|argumentative|composition|directed writing)\b/i.test(topicText)) {
    rules.push(
      'Writing topics: test structure, planning, thesis, paragraphing, register, audience, or features of the named writing type — not unrelated fiction comprehension.',
    )
  }

  if (/\b(grammar|syntax|clause|tense|punctuation|phrase)\b/i.test(topicText)) {
    rules.push(
      'Grammar topics: test rules, correction, identification, or transformation. Use short inline sentences — not passage-based inference unless the topic is comprehension.',
    )
  }

  return rules
}
