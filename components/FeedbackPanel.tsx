'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react'
import { LatexText as L } from '@/lib/latex-text'
import { splitQuestionRefs } from '@/lib/feedback-question-refs'

/**
 * Turn "review questions 4 and 6" into buttons that scroll to those questions.
 *
 * Returns the plain string untouched when the review can't jump anywhere, so
 * the panel renders identically wherever it is used without a handler.
 */
function linkifyQuestions(
  text: string,
  onJumpToQuestion: ((n: number) => void) | undefined,
  questionCount: number | undefined,
  keyBase: string,
): ReactNode[] {
  if (!onJumpToQuestion || !questionCount) return [text]

  return splitQuestionRefs(text, questionCount).map((seg, i) => {
    if (seg.type === 'text') return seg.value
    return (
      <button
        key={`${keyBase}-ref-${i}`}
        type="button"
        // Jumps to the first question named; the phrase stays verbatim so the
        // sentence still reads as written.
        onClick={() => onJumpToQuestion(seg.questions[0])}
        title={
          seg.questions.length > 1
            ? `Jump to question ${seg.questions[0]} (of ${seg.questions.join(', ')})`
            : `Jump to question ${seg.questions[0]}`
        }
        className="mx-0.5 rounded-md bg-ss-accent/12 px-1.5 py-0.5 font-semibold text-ss-accent underline decoration-dotted underline-offset-2 transition-colors hover:bg-ss-accent/20"
      >
        {seg.value}
      </button>
    )
  })
}

function parseInline(
  text: string,
  onJumpToQuestion?: (n: number) => void,
  questionCount?: number,
): ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...linkifyQuestions(text.slice(last, match.index), onJumpToQuestion, questionCount, `s${match.index}`))
    }
    const seg = match[0]
    if (seg.startsWith('**')) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-gray-900 dark:text-white">
          {seg.slice(2, -2)}
        </strong>,
      )
    } else {
      const inner = seg.slice(1, -1)
      const looksMath = /[=+\-*/^\\]/.test(inner) || /[a-z]\s*=\s*/i.test(inner)
      nodes.push(
        looksMath ? (
          <span key={match.index} className="font-medium text-gray-800 dark:text-gray-100">
            <L>{inner}</L>
          </span>
        ) : (
          <em key={match.index}>{inner}</em>
        ),
      )
    }
    last = match.index + seg.length
  }

  if (last < text.length) {
    nodes.push(...linkifyQuestions(text.slice(last), onJumpToQuestion, questionCount, 'tail'))
  }
  return nodes.length ? nodes : [text]
}

type SectionKind = 'well' | 'improve' | 'tips' | 'other'

type FeedbackSection = {
  title: string
  kind: SectionKind
  items: string[]
}

function classifySection(title: string): SectionKind {
  const t = title.toLowerCase()
  if (/did well|strengths|what went well/.test(t)) return 'well'
  if (/improve|weak|focus on/.test(t)) return 'improve'
  if (/how to improve|next steps|tips/.test(t)) return 'tips'
  return 'other'
}

function parseFeedback(text: string): FeedbackSection[] {
  const sections: FeedbackSection[] = []
  let current: FeedbackSection | null = null

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    const header = line.match(/^\*\*(.+)\*\*$/)
    if (header) {
      current = { title: header[1], kind: classifySection(header[1]), items: [] }
      sections.push(current)
      continue
    }

    if (!current) {
      current = { title: 'Overview', kind: 'other', items: [] }
      sections.push(current)
    }
    current.items.push(line)
  }

  return sections
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[✅⚠️💡]\s*/, '')
}

function bulletKind(line: string, sectionKind: SectionKind): SectionKind {
  if (line.startsWith('✅')) return 'well'
  if (line.startsWith('⚠️')) return 'improve'
  if (line.startsWith('💡')) return 'tips'
  return sectionKind
}

const SECTION_STYLES: Record<
  SectionKind,
  { card: string; title: string; icon: typeof CheckCircle2; item: string; iconWrap: string }
> = {
  well: {
    card: 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40',
    title: 'text-emerald-900 dark:text-emerald-200',
    icon: CheckCircle2,
    item: 'bg-white/70 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50',
    iconWrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  improve: {
    card: 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40',
    title: 'text-amber-950 dark:text-amber-200',
    icon: AlertTriangle,
    item: 'bg-white/70 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40',
    iconWrap: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  tips: {
    card: 'bg-violet-50/80 dark:bg-violet-950/25 border-violet-200/80 dark:border-violet-800/40',
    title: 'text-violet-950 dark:text-violet-200',
    icon: Lightbulb,
    item: 'bg-white/70 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40',
    iconWrap: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  },
  other: {
    card: 'bg-gray-50/90 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700/60',
    title: 'text-gray-900 dark:text-gray-100',
    icon: Sparkles,
    item: 'bg-white/80 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800',
    iconWrap: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
}

type Props = {
  feedback: string
  loading?: boolean
  loadingMessage?: string
  compact?: boolean
  /** Supply both to make question references in the feedback tappable. */
  onJumpToQuestion?: (n: number) => void
  questionCount?: number
}

export default function FeedbackPanel({ feedback, loading, loadingMessage, compact, onJumpToQuestion, questionCount }: Props) {
  const sections = parseFeedback(feedback)

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#141416] ${
        compact ? '' : 'text-left'
      }`}
    >
      <div className="flex items-center gap-2.5 border-b border-gray-200/80 bg-gradient-to-r from-gray-50 to-white px-5 py-4 dark:border-white/10 dark:from-[#1a1a1d] dark:to-[#141416]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">AI Feedback</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Personalised review of your attempt</p>
        </div>
      </div>

      <div className={`space-y-4 ${compact ? 'p-4' : 'p-5'}`}>
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600 dark:border-gray-600 dark:border-t-emerald-400" />
            <p>{loadingMessage ?? 'Analysing your performance…'}</p>
          </div>
        ) : sections.length === 0 ? (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{feedback}</p>
        ) : (
          sections.map((section) => {
            const style = SECTION_STYLES[section.kind]
            const SectionIcon = style.icon
            return (
              <section key={section.title} className={`rounded-xl border p-4 ${style.card}`}>
                <div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${style.title}`}>
                  <SectionIcon className="h-4 w-4 shrink-0" />
                  {section.title}
                </div>
                <ul className="space-y-2.5">
                  {section.items.map((item, idx) => {
                    const kind = bulletKind(item, section.kind)
                    const itemStyle = SECTION_STYLES[kind]
                    const ItemIcon = itemStyle.icon
                    return (
                      <li
                        key={idx}
                        className={`flex gap-3 rounded-xl border p-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200 ${itemStyle.item}`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${itemStyle.iconWrap}`}
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">{parseInline(stripBulletPrefix(item), onJumpToQuestion, questionCount)}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
