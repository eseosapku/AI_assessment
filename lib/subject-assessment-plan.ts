/**
 * Unified subject-aware assessment planning.
 * Ensures each subject gets appropriate question styles, passage policies,
 * and guards against English-literature patterns leaking into other subjects.
 */

import {
  assessLanguagePassagePlan,
  buildEnglishTopicAlignmentRules,
  isLanguageArtsSubject,
  topicFocusedPassageHint,
} from '@/lib/language-assessment-plan'
import {
  assessHistoryPassagePlan,
  buildHistoryPassagePrompt,
  buildHistorySourceQuestionPrompt,
  buildHistoryTopicAlignmentRules,
  historyPassageHint,
  isHistorySubject,
} from '@/lib/history-assessment-plan'

export type SubjectDomain =
  | 'language'
  | 'history'
  | 'religious'
  | 'humanities'
  | 'science'
  | 'math'
  | 'technology'
  | 'business'
  | 'arts'
  | 'default'

export interface SubjectPassagePlan {
  domain: SubjectDomain
  usePassageFlow: boolean
  passageQuestionCount: number
  directQuestionCount: number
  requirePassageOnAll: boolean
}

const HUMANITIES_PASSAGE_TOPIC =
  /\b(case study|data response|source analysis|interpret the (data|map|diagram|chart|table)|read the (extract|article|report)|geographical enquiry|fieldwork report|economic (article|report)|business case|policy document|newspaper article|statistical data|population data|map extract)\b/i

const HUMANITIES_DIRECT_TOPIC =
  /\b(definition|types of|features of|factors affecting|causes of|effects of|importance of|distribution of|formation of|landform|climate type|trade|inflation|demand and supply|ledger|balance sheet|debit|credit|constitution|democracy|election|voting)\b/i

const RELIGIOUS_PASSAGE_TOPIC =
  /\b(scripture|scriptural|bible passage|quranic|qur'an|hadith|gospel|epistle|parable|religious text|sacred text|source analysis|interpret the (passage|text|verse))\b/i

const RELIGIOUS_DIRECT_TOPIC =
  /\b(belief|doctrine|worship|ritual|festival|ethics|moral|ten commandments|pillars of|sacrament)\b/i

/**
 * Subject values are textbook filenames, so the patterns have to survive
 * "Biology S4  SB" and "P1-SST-PB." as readily as "Biology". Punctuation is
 * flattened to spaces first: without it, \bscience\b misses
 * "Cambridge-Science-9" and the subject falls through to the default prompt.
 */
export function classifySubjectDomain(subject: string): SubjectDomain {
  const s = String(subject || '')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (isLanguageArtsSubject(subject) || /\bliterature in english\b/.test(s)) return 'language'
  if (isHistorySubject(subject)) return 'history'
  if (/\b(religio(?:n|us)|islamic|christian|morality|ethics|crs|irs|scripture|bible|qur'?an)\b/.test(s)) {
    return 'religious'
  }
  if (/\b(math|maths|mathematics|further math|additional math)\b/.test(s)) return 'math'

  // Business before science and humanities: "agribusiness" would otherwise be
  // pulled toward agriculture, and entrepreneurship — the largest unclassified
  // group in the corpus — would land in humanities alongside geography.
  // agribusiness is listed on its own: it is one word, so \bbusiness\b finds
  // no boundary in it, and \bagric\b does not either — it would fall through.
  if (/\b(entrepreneur|entrepreneurship|agribusiness|business studies|business|commerce|accounting|accounts|book ?keeping|marketing|finance|financial)\b/.test(s)) {
    return 'business'
  }

  // The bare word "science" belongs here. Leaving it out sent every subject
  // literally named "Science" — and every Cambridge "… Science 9" book — down
  // the default path. "set" is the Rwandan primary code for Science and
  // Elementary Technology.
  if (
    /\b(science|sciences|physics|chemistry|biology|integrated science|science and technology|agriculture|agricultural|agric|environmental|food and nutrition|human biology|set)\b/.test(
      s,
    )
  ) {
    return 'science'
  }

  if (/\b(computer|computing|ict|information and communication|programming|coding|hardware|software|micropython|python|javascript|php|technical drawing)\b/.test(s)) {
    return 'technology'
  }

  if (/\b(art|arts|fine art|crafts|music|drama|theatre|design|creative)\b/.test(s)) return 'arts'

  // "sst" is the Rwandan primary code for Social Studies.
  if (/\b(geography|social studies|sst|economics|economic|government|civic|citizenship|sociology|psychology|management|political)\b/.test(s)) {
    return 'humanities'
  }

  return 'default'
}

function emptyPlan(count: number, domain: SubjectDomain): SubjectPassagePlan {
  return {
    domain,
    usePassageFlow: false,
    passageQuestionCount: 0,
    directQuestionCount: count,
    requirePassageOnAll: false,
  }
}

function topicAwareHybrid(
  count: number,
  domain: SubjectDomain,
  topics: string[],
  passageTopicRe: RegExp,
  directTopicRe: RegExp,
  ratio = 0.35,
): SubjectPassagePlan {
  const blob = topics.join(' ').toLowerCase()
  const wantsPassage = passageTopicRe.test(blob)
  const wantsDirect = directTopicRe.test(blob) || !wantsPassage

  if (!wantsPassage) return emptyPlan(count, domain)

  if (wantsPassage && !directTopicRe.test(blob)) {
    const passageQuestionCount = Math.max(1, Math.min(count, Math.ceil(count * Math.max(ratio, 0.5))))
    return {
      domain,
      usePassageFlow: true,
      passageQuestionCount,
      directQuestionCount: count - passageQuestionCount,
      requirePassageOnAll: passageQuestionCount >= count,
    }
  }

  const passageQuestionCount = Math.max(1, Math.min(count - 1, Math.ceil(count * ratio)))
  return {
    domain,
    usePassageFlow: true,
    passageQuestionCount,
    directQuestionCount: count - passageQuestionCount,
    requirePassageOnAll: false,
  }
}

export function assessSubjectPassagePlan(opts: {
  subject: string
  topics: string[]
  count: number
  hasSourceText: boolean
}): SubjectPassagePlan {
  const domain = classifySubjectDomain(opts.subject)
  if (opts.hasSourceText || opts.count <= 0) return emptyPlan(opts.count, domain)

  if (domain === 'language') {
    const lang = assessLanguagePassagePlan(opts)
    return { domain, ...lang }
  }

  if (domain === 'history') {
    const hist = assessHistoryPassagePlan({ count: opts.count, hasSourceText: false })
    return { domain, ...hist, requirePassageOnAll: false }
  }

  if (domain === 'religious') {
    return topicAwareHybrid(
      opts.count,
      domain,
      opts.topics,
      RELIGIOUS_PASSAGE_TOPIC,
      RELIGIOUS_DIRECT_TOPIC,
      0.4,
    )
  }

  if (domain === 'humanities') {
    return topicAwareHybrid(
      opts.count,
      domain,
      opts.topics,
      HUMANITIES_PASSAGE_TOPIC,
      HUMANITIES_DIRECT_TOPIC,
      0.35,
    )
  }

  // STEM and general subjects: no AI-generated reading passages
  return emptyPlan(opts.count, domain)
}

export function passageHintForSubject(
  domain: SubjectDomain,
  subject: string,
  topics: string[],
  groupIdx: number,
): string {
  const focus = topics.filter(Boolean).slice(0, 3).join('; ') || subject

  switch (domain) {
    case 'history':
      return historyPassageHint(topics, groupIdx)
    case 'language':
      return topicFocusedPassageHint(topics, groupIdx)
    case 'humanities': {
      const styles = [
        `A factual case-study or report extract on: ${focus}. Real-world data, places, policies, or economic/geographical claims — not a fictional story.`,
        `A short newspaper article, policy summary, or textbook factual account about: ${focus}. Include specific names, figures, or places students can analyse.`,
        `An informational extract (survey results, business report, or geographical description) on: ${focus}. Suitable for data/source interpretation.`,
      ]
      return styles[groupIdx % styles.length]
    }
    case 'religious': {
      const styles = [
        `A scriptural or sacred-text excerpt relevant to: ${focus}. Include verse/section references and clear religious teaching or narrative.`,
        `A religious teaching passage or parable extract on: ${focus}. Factual religious content students can interpret — not secular fiction.`,
        `An excerpt from a religious commentary or primary religious source about: ${focus}.`,
      ]
      return styles[groupIdx % styles.length]
    }
    default:
      return `A factual curriculum-aligned informational extract on: ${focus}. No fictional characters or literary fiction.`
  }
}

function buildHumanitiesPassagePrompt(opts: {
  topics: string[]
  hint: string
  grade?: number | string
}): string {
  const gradeLabel = opts.grade ? `Grade ${opts.grade}` : 'secondary school'
  return `Write a FACTUAL SOURCE EXTRACT for a ${gradeLabel} ${opts.topics[0] ? 'humanities/social science' : ''} exam — NOT English literature.

TOPICS: ${opts.topics.join(', ') || 'syllabus topic'}
BRIEF: ${opts.hint}

REQUIREMENTS:
- 300–500 words, factual and syllabus-relevant
- Forms: case study, report, article, data commentary, policy summary, geographical description
- FORBIDDEN: fictional stories, invented characters, literary imagery analysis, "original passage written for students"
- Include concrete facts, figures, places, or policies where appropriate

Format:
PASSAGE:
[text]

SOURCE:
[e.g. "Case study: urbanisation in Lagos, 2020" or "Extract from an economics report on inflation, 2023"]`
}

function buildReligiousPassagePrompt(opts: {
  topics: string[]
  hint: string
  grade?: number | string
}): string {
  const gradeLabel = opts.grade ? `Grade ${opts.grade}` : 'secondary school'
  return `Write a RELIGIOUS SOURCE EXTRACT for a ${gradeLabel} Religious Studies exam.

TOPICS: ${opts.topics.join(', ') || 'syllabus topic'}
BRIEF: ${opts.hint}

REQUIREMENTS:
- 200–450 words from or about sacred/scriptural material relevant to the topics
- May be scripture excerpt, parable, teaching passage, or clearly labelled religious commentary
- FORBIDDEN: secular fiction, literary analysis tone, "original passage written for students"
- Respectful, syllabus-appropriate content

Format:
PASSAGE:
[text]

SOURCE:
[e.g. "Gospel of Luke, chapter 15 (adapted)" or "Extract on Islamic teachings on charity"]`
}

export function buildSubjectPassagePrompt(opts: {
  domain: SubjectDomain
  topics: string[]
  hint: string
  grade?: number | string
}): string | null {
  switch (opts.domain) {
    case 'history':
      return buildHistoryPassagePrompt({ topics: opts.topics, hint: opts.hint, grade: opts.grade })
    case 'humanities':
      return buildHumanitiesPassagePrompt(opts)
    case 'religious':
      return buildReligiousPassagePrompt(opts)
    default:
      return null
  }
}

function buildHumanitiesSourceQuestionPrompt(
  opts: Parameters<typeof buildHistorySourceQuestionPrompt>[0],
): string {
  const topicRules = buildHumanitiesTopicAlignmentRules(opts.topics)
  const base = buildHistorySourceQuestionPrompt(opts)
  return base
    .replace(/HISTORY examiner/g, 'HUMANITIES examiner')
    .replace(/HISTORICAL SOURCE/g, 'SOURCE MATERIAL')
    .replace(/HISTORY SOURCE RULES/g, 'SOURCE ANALYSIS RULES')
    .replace(
      'This is a HISTORY source-analysis task — NOT English literature.',
      'This is a humanities source-analysis task (geography/economics/business/government) — NOT English literature.',
    )
    .replace(
      `**Topic rules:**\n- ${buildHistoryTopicAlignmentRules(opts.topics).join('\n- ')}`,
      `**Topic rules:**\n- ${topicRules.join('\n- ')}`,
    )
}

function buildReligiousSourceQuestionPrompt(
  opts: Parameters<typeof buildHistorySourceQuestionPrompt>[0],
): string {
  const topicRules = buildReligiousTopicAlignmentRules(opts.topics)
  const base = buildHistorySourceQuestionPrompt(opts)
  return base
    .replace(/HISTORY examiner/g, 'RELIGIOUS STUDIES examiner')
    .replace(/HISTORICAL SOURCE/g, 'RELIGIOUS SOURCE')
    .replace(/HISTORY SOURCE RULES/g, 'RELIGIOUS SOURCE RULES')
    .replace(
      'This is a HISTORY source-analysis task — NOT English literature.',
      'This is a religious source interpretation task — NOT English literature.',
    )
    .replace(
      `**Topic rules:**\n- ${buildHistoryTopicAlignmentRules(opts.topics).join('\n- ')}`,
      `**Topic rules:**\n- ${topicRules.join('\n- ')}`,
    )
}

export function buildSubjectSourceQuestionPrompt(
  domain: SubjectDomain,
  opts: Parameters<typeof buildHistorySourceQuestionPrompt>[0],
): string | null {
  switch (domain) {
    case 'history':
      return buildHistorySourceQuestionPrompt(opts)
    case 'humanities':
      return buildHumanitiesSourceQuestionPrompt(opts)
    case 'religious':
      return buildReligiousSourceQuestionPrompt(opts)
    default:
      return null
  }
}

export function buildHumanitiesTopicAlignmentRules(topics: string[]): string[] {
  const topicText = topics.join(' ').toLowerCase()
  const rules = [
    'HUMANITIES: Test syllabus concepts directly — definitions, processes, causes/effects, data interpretation, and applied knowledge.',
    'Do NOT write English-literature or fictional narrative questions.',
    'Embed short data tables or scenarios in the question text when needed — do not rely on a separate reading passage unless this is a source-analysis item.',
  ]
  if (/geograph|climate|river|population|urban|migration|tectonic|weather/i.test(topicText)) {
    rules.push('Geography: use place-specific examples, processes, and spatial reasoning. Describe maps/diagrams fully in words if needed.')
  }
  if (/econom|commerce|business|account|trade|market|inflation|gdp/i.test(topicText)) {
    rules.push('Economics/Business: use realistic scenarios, calculations, and policy/business reasoning — not fictional literary scenes.')
  }
  if (/government|civic|constitution|democracy|election/i.test(topicText)) {
    rules.push('Government/Civics: test institutions, rights, processes, and policy — not creative writing.')
  }
  return rules
}

export function buildReligiousTopicAlignmentRules(topics: string[]): string[] {
  return [
    'RELIGIOUS STUDIES: Test beliefs, teachings, practices, ethics, and scripture knowledge from the syllabus.',
    'For source items: interpret meaning, significance, and application of the religious text — not literary imagery analysis.',
    'Do NOT use secular fiction or English comprehension framing.',
    ...topics.map((t) => `Include content relevant to: ${t}`),
  ]
}

export function buildScienceTopicAlignmentRules(subject: string, topics: string[]): string[] {
  const topicText = topics.join(' ').toLowerCase()
  const rules = [
    `${subject.toUpperCase()}: Questions must test scientific concepts, laws, processes, definitions, and problem-solving from the selected topics.`,
    'Do NOT use reading passages, stories, or "author/writer" framing. Each question must be self-contained.',
    'Include all numerical values, units, and descriptions needed to answer in the question text.',
    'Use correct scientific terminology and symbols. LaTeX for formulas where needed.',
  ]
  if (/physics|force|motion|energy|circuit|wave/i.test(topicText)) {
    rules.push('Physics: prioritise calculations, unit conversion, graph interpretation described in text, and explanation of physical principles.')
  }
  if (/chem|reaction|mole|acid|bond|periodic/i.test(topicText)) {
    rules.push('Chemistry: include balanced equations, stoichiometry, and particle-level explanations where appropriate.')
  }
  if (/bio|cell|organism|ecosystem|genetic|photosyn/i.test(topicText)) {
    rules.push('Biology: test structures, functions, processes, and diagrams described in words — no fictional narratives.')
  }
  return rules
}

export function buildMathTopicAlignmentRules(topics: string[]): string[] {
  return [
    'MATHEMATICS: Every question must require calculation, proof, or mathematical reasoning aligned to the selected topics.',
    'No reading passages or word problems unrelated to the topic. Include all data in the question.',
    'Show clear numerical values. MCQ distractors must reflect common mistakes.',
    ...topics.map((t) => `Cover topic: ${t}`),
  ]
}

export function buildTechnologyTopicAlignmentRules(topics: string[]): string[] {
  return [
    'TECHNOLOGY/ICT: Test concepts, hardware/software knowledge, troubleshooting, and applied ICT skills from the syllabus.',
    'No fictional narratives or reading passages. Questions must be practical and syllabus-specific.',
    'Describe interfaces, components, or steps in words when needed — never require unseen screenshots.',
  ]
}

export function buildDefaultTopicAlignmentRules(subject: string, topics: string[]): string[] {
  return [
    `Subject discipline: ${subject}. Every question must test the selected syllabus topics directly.`,
    'Do not default to generic reading comprehension or unrelated creative writing.',
    'Keep questions self-contained unless the subject explicitly requires a source extract.',
    ...topics.map((t) => `Cover topic: ${t}`),
  ]
}

export function buildSubjectTopicAlignmentRules(subject: string, topics: string[]): string[] {
  const domain = classifySubjectDomain(subject)
  switch (domain) {
    case 'history':
      return buildHistoryTopicAlignmentRules(topics)
    case 'language':
      return buildEnglishTopicAlignmentRules(subject, topics)
    case 'humanities':
      return buildHumanitiesTopicAlignmentRules(topics)
    case 'religious':
      return buildReligiousTopicAlignmentRules(topics)
    case 'science':
      return buildScienceTopicAlignmentRules(subject, topics)
    case 'math':
      return buildMathTopicAlignmentRules(topics)
    case 'technology':
      return buildTechnologyTopicAlignmentRules(topics)
    default:
      return buildDefaultTopicAlignmentRules(subject, topics)
  }
}

const LITERARY_QUESTION_RE =
  /\b(how does the author|author uses (the )?imagery|literary device|writer uses (the )?|figurative language|convey a deeper meaning|character voice|symbolism in the passage|original passage written)\b/i

export function isMisalignedQuestion(q: unknown, subject: string): boolean {
  const domain = classifySubjectDomain(subject)
  const text = `${(q as { question?: string })?.question || ''} ${(q as { explanation?: string })?.explanation || ''}`.toLowerCase()

  if (LITERARY_QUESTION_RE.test(text) && domain !== 'language') return true

  if (['science', 'math', 'technology'].includes(domain)) {
    if (/\b(read the passage|reading extract|the author|the writer|according to the story)\b/.test(text)) return true
  }

  return false
}
