'use client'

import { useEffect, useRef, useState } from 'react'
import Latex from 'react-latex-next'
import { PlanCard } from './PlanCard'
import { QuestionPicker } from './QuestionPicker'
import { Brain, Send, Sparkles, ImagePlus, X, ArrowRight } from 'lucide-react'
import type { ChatMessage, TutorAction } from '@/lib/studylab/types'
import { plainTitle } from '@/lib/studylab/actions'
import { toDollarMath } from '@/lib/studylab/mathText'
import type { Pace } from '@/lib/studylab/lessonPolicy'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function SafeLatex({ children }: { children?: string }) {
  if (!children) return null
  const text = toDollarMath(children)
  try {
    return <Latex>{text}</Latex>
  } catch {
    return <>{text}</>
  }
}

interface ChatMouthpieceProps {
  messages: ChatMessage[]
  suggestions: string[]
  /** Accept the plan proposed in the conversation, at the chosen pace. */
  onAcceptPlan?: (pace: Pace) => void
  /** Answer the plan's questions, or say what to change, and re-draft. */
  onAnswerPlan?: (answer: string) => void
  busy: boolean
  done: boolean
  /** Optional: start a real assessment on the studied topic once done. */
  onProveIt?: () => void
  provingIt?: boolean
  onSend: (text: string, opts?: { image?: string; silent?: boolean }) => void
  pendingCheckpoint?: { total: number; remaining: number; nextId: string | null } | null
  onGoToCheck?: (nodeId: string) => void
  onQuizMe?: () => void
  /** What the tutor is doing right now, shown while busy. */
  working?: string
  /** Bring a card the tutor just made into view. */
  onFocusCard?: (nodeId: string) => void
  /** The lesson policy's pace, so the plan card opens on the same one the rail would. */
  defaultPace?: Pace
  /**
   * A question already written into the box, ready to send.
   *
   * Used by the demo, which has no model to answer anything typed. An input
   * that silently swallows what you write would teach that the tutor ignores
   * you; showing the question written out, and letting you send it,
   * demonstrates the same thing honestly. `null` means the box is the
   * learner's own.
   */
  composed?: string | null
  /** Locks the box and the attach button. The demo scripts what can be sent. */
  locked?: boolean
  /** Shown in the locked box when there is nothing composed to send. */
  lockedHint?: string
  /** Homework: begin on the questions the learner picked off their own sheet. */
  onStartHomework?: (questionIds: string[]) => void
}

/**
 * The cards a turn actually put on the board.
 *
 * Listing them is what makes "see the card" checkable. A turn that narrated a
 * card it never created used to look exactly like one that did — the chat said
 * the same sentence either way, and the only way to find out was to go hunting
 * on the canvas.
 */
function builtCards(actions: TutorAction[] | undefined) {
  return (actions ?? [])
    .filter((a): a is Extract<TutorAction, { type: 'createCard' }> => a.type === 'createCard')
    .map((a) => ({ id: a.id, title: plainTitle((a.title ?? '').trim()) }))
    .filter((c) => c.title.length > 0)
}

export default function ChatMouthpiece({ messages, suggestions, busy, done, onSend, pendingCheckpoint, onGoToCheck, onQuizMe, onProveIt, provingIt = false, onAcceptPlan, onAnswerPlan, working = 'Thinking…', onFocusCard, defaultPace, composed = null, locked = false, lockedHint, onStartHomework }: ChatMouthpieceProps) {
  // A plan is awaiting a decision when the newest plan card is still live.
  const awaitingPlan = [...messages].reverse().find((m) => m.kind === 'plan')?.plan?.live === true

  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // A composed question owns the box while it is on offer.
  const value = composed ?? input
  const canSend = composed !== null ? true : !locked && (!!input.trim() || !!attachment)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const ingestFile = async (file: File | null | undefined) => {
    if (!file) return
    setAttachError(null)
    if (!file.type.startsWith('image/')) {
      setAttachError('Only image files can be attached.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAttachError('Image is too large (max 5 MB).')
      return
    }
    try {
      setAttachment(await readFileAsDataUrl(file))
    } catch {
      setAttachError('Could not read that image.')
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'))
    if (item) {
      e.preventDefault()
      ingestFile(item.getAsFile())
    }
  }

  // Typed messages stay visible in the transcript.
  const send = (text: string) => {
    const trimmed = text.trim()
    if ((!trimmed && !attachment) || busy) return
    onSend(trimmed || "Here's my work — can you take a look?", { image: attachment ?? undefined })
    // A composed question belongs to the caller, which clears it by no longer
    // offering one; wiping local state here would leave the box showing it.
    setInput('')
    setAttachment(null)
    setAttachError(null)
  }

  // Continue advances the lesson. It is deliberately the only control that
  // does: suggestions used to travel this path too, which discarded their text
  // and fired the same "next beat" — so "Show an example", "Go deeper" and
  // "Continue" were three differently worded buttons doing one thing.
  const advance = () => {
    if (busy) return
    onSend("I'm ready — let's continue.", { silent: true })
  }

  // A suggestion is a request about the material in front of the student, so it
  // is asked, and it shows in the transcript as something they said.
  const askSuggestion = (text: string) => {
    if (busy) return
    onSend(text)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#161617]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 rounded-xl bg-[color:var(--ss-accent)]/10 flex items-center justify-center">
          <Brain className="w-4.5 h-4.5 text-ss-accent" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-[14px]">AI Study Assistant</p>
          <p className="text-[12px] text-ss-slate">Brain Ink AI</p>
        </div>
      </div>

      {/* Messages */}
      <div data-tour="lesson-chat" ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-ss-slate text-center mt-8">Starting your session…</p>
        )}
        {messages.map((m, i) =>
          // A turn that said nothing and built nothing is not a turn. One left
          // a bare avatar floating in the transcript with no bubble beside it,
          // which reads as the tutor having failed rather than as nothing
          // having happened. The plan card carries no text of its own, so it
          // is exempt.
          m.role === 'assistant' &&
          m.kind !== 'plan' &&
          !m.content?.trim() &&
          builtCards(m.actions).length === 0 ? null :
          // A status line is the system reporting what an action did, not the
          // tutor speaking. It gets no avatar and no bubble, so the transcript
          // still reads as a conversation with the run's bookkeeping beside it.
          m.kind === 'status' ? (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="h-px w-4 shrink-0 bg-ss-line" />
              {/* Wraps. A nowrap rule pushed the whole transcript sideways as
                  soon as an acknowledgement ran past the panel width. */}
              <span className="min-w-0 text-center text-[12px] font-semibold leading-snug text-ss-slate">
                {m.content}
              </span>
              <span className="h-px w-4 shrink-0 bg-ss-line" />
            </div>
          ) : m.role === 'assistant' ? (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[color:var(--ss-accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-4 h-4 text-ss-accent" />
              </div>
              {/* Rendered by kind. A proposed plan, a refusal, an error and an
                  ordinary teaching line used to be the same grey bubble, so
                  nothing in the conversation read as more important than
                  anything else. */}
              {m.kind === 'homework' && m.sheet ? (
                <div className="max-w-[92%] w-full space-y-2">
                  {m.content && (
                    <div className="rounded-2xl rounded-tl-sm bg-ss-chip dark:bg-white/5 px-3.5 py-2.5 text-[13.5px] leading-relaxed">
                      {m.content}
                    </div>
                  )}
                  <QuestionPicker
                    questions={m.sheet.questions}
                    live={m.sheet.live === true}
                    busy={busy}
                    onStart={(ids) => onStartHomework?.(ids)}
                  />
                </div>
              ) : m.kind === 'plan' && m.plan ? (
                <div data-tour="lesson-plan-card" className="max-w-[92%] w-full">
                  <PlanCard
                    plan={m.plan}
                    busy={busy}
                    onAccept={(pace) => onAcceptPlan?.(pace)}
                    defaultPace={defaultPace}
                    onAnswer={(answer) => onAnswerPlan?.(answer)}
                  />
                </div>
              ) : m.kind === 'refusal' ? (
                <div className="rounded-2xl rounded-tl-sm border border-[color:var(--ss-warn)]/40 bg-[color:var(--ss-warn)]/10 px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed text-ss-ink max-w-[85%] whitespace-pre-wrap">
                  <SafeLatex>{m.content}</SafeLatex>
                </div>
              ) : m.kind === 'error' ? (
                <div className="rounded-2xl rounded-tl-sm border border-[color:var(--ss-bad)]/40 bg-[color:var(--ss-bad)]/10 px-3.5 py-2.5 text-[13.5px] font-medium leading-relaxed text-ss-ink max-w-[85%] whitespace-pre-wrap">
                  <SafeLatex>{m.content}</SafeLatex>
                </div>
              ) : (
                <div className="max-w-[85%] space-y-1.5">
                  {m.content && (
                    <div className="rounded-2xl rounded-tl-sm bg-ss-chip dark:bg-white/5 px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      <SafeLatex>{m.content}</SafeLatex>
                    </div>
                  )}
                  {/* What this turn put on the board, and a way to get to it.
                      "Here's how it ionizes — see the card" is only useful if
                      the card is findable; and a turn that built nothing now
                      visibly lists nothing. */}
                  {builtCards(m.actions).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onFocusCard?.(c.id)}
                      disabled={!onFocusCard}
                      className="group flex w-full items-center gap-2 rounded-xl border border-ss-line bg-white px-3 py-2 text-left transition-colors hover:border-ss-accent disabled:cursor-default dark:bg-white/[0.03]"
                    >
                      <span
                        aria-hidden
                        className="h-6 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--ss-accent)' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-bold uppercase tracking-wide text-ss-slate">
                          Added to the board
                        </span>
                        <span className="block truncate text-[13px] font-semibold text-ss-ink">{c.title}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ss-slate transition-colors group-hover:text-ss-accent" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-ss-accent text-white px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap">
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt="Attached work"
                    className="mb-2 rounded-lg max-h-44 w-auto border border-white/30"
                  />
                )}
                {m.content}
              </div>
            </div>
          )
        )}

        {busy && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[color:var(--ss-accent)]/10 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-ss-accent" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-ss-chip dark:bg-white/5 px-4 py-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5" aria-hidden>
                <span className="w-1.5 h-1.5 rounded-full bg-ss-slate animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ss-slate animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ss-slate animate-bounce" />
              </span>
              {/* Three dots say only "something is happening". For a call that
                  can run ten seconds that is not enough to tell a slow turn
                  from a broken one — so it says which job is running. */}
              <span className="text-[13px] font-semibold text-ss-slate">{working}</span>
            </div>
          </div>
        )}
      </div>

      {/* Pending checkpoint banner — finish the check before advancing */}
      {pendingCheckpoint && !busy && (
        <button
          type="button"
          disabled={!pendingCheckpoint.nextId || !onGoToCheck}
          onClick={() => pendingCheckpoint.nextId && onGoToCheck?.(pendingCheckpoint.nextId)}
          className="mx-4 mb-2 w-[calc(100%-2rem)] text-left px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-[13px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:cursor-default"
        >
          {/* One check, several questions. Calling them "checks" made two
              questions read as two separate things to get past. */}
          {pendingCheckpoint.total === 1
            ? 'Answer the check on the canvas to continue.'
            : pendingCheckpoint.remaining === pendingCheckpoint.total
              ? `Answer the ${pendingCheckpoint.total} questions on the canvas to continue.`
              : `${pendingCheckpoint.remaining} of the ${pendingCheckpoint.total} questions still to answer.`}
          {pendingCheckpoint.nextId && onGoToCheck && (
            <span className="block mt-0.5 text-[12px] font-medium opacity-80">Tap to jump to it →</span>
          )}
        </button>
      )}

      {/* Suggestions (hidden while a check is pending so the student finishes it first) */}
      {!busy && !pendingCheckpoint && suggestions.length > 0 && !done && (
        <div data-tour="lesson-chips" className="px-4 pb-2 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => askSuggestion(s)}
              className="text-left text-[13px] px-3.5 py-2 rounded-xl border border-ss-line text-gray-700 dark:text-gray-300 hover:border-ss-accent hover:text-ss-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Persistent forward controls — reliable lesson navigation.
          Hidden while a plan is still awaiting a decision: the plan card
          carries its own "Looks good, start", and offering a second, differently
          worded way forward beside it is how a learner ends up unsure which
          button is the real one. */}
      {!busy && !pendingCheckpoint && !done && !awaitingPlan && (
        <div className="px-4 pb-2 flex gap-2">
          <button
            onClick={advance}
            data-tour="lesson-continue"
            className="flex-1 text-[13px] px-3.5 py-2 rounded-xl bg-ss-accent text-white font-semibold hover:brightness-95 transition-all"
          >
            Continue →
          </button>
          {onQuizMe && (
            <button
              onClick={onQuizMe}
              className="text-[13px] px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              Quiz me
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="mx-4 mb-2 rounded-xl bg-emerald-50 px-3.5 py-3 dark:bg-emerald-900/20">
          <p className="flex items-center gap-2 text-[13px] text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-4 h-4 shrink-0" />
            You&apos;ve completed this topic. Great work!
          </p>
          {onProveIt && (
            <>
              {/* The lesson is only half the loop — a saved result is what
                  moves the gap map, so offer the test right here. */}
              <button
                type="button"
                onClick={onProveIt}
                disabled={provingIt}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[12.5px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {provingIt ? 'Building your quiz…' : 'Prove it — take the quiz'}
              </button>
              <p className="mt-1.5 text-center text-[12px] text-emerald-700/80 dark:text-emerald-400/70">
                Fresh questions on this topic. Your score updates your gap map.
              </p>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        {attachment && (
          <div className="mb-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment} alt="Attachment preview" className="h-20 w-auto rounded-xl border border-ss-line" />
            <button
              onClick={() => setAttachment(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900/80 text-white flex items-center justify-center"
              aria-label="Remove attachment"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {attachError && <p className="text-[12px] text-red-500 mb-1.5">{attachError}</p>}
        <div
          data-tour="lesson-composer"
          className="flex items-end gap-2 rounded-2xl border border-ss-line bg-ss-chip dark:bg-black/30 px-3 py-2 focus-within:ring-2 focus-within:ring-[color:var(--ss-accent)]/40"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              ingestFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || locked}
            className="w-8 h-8 rounded-xl text-ss-slate hover:text-ss-accent hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center disabled:opacity-60 shrink-0 transition-colors"
            aria-label="Attach an image of your work"
            title="Attach an image of your work"
          >
            <ImagePlus className="w-4.5 h-4.5" />
          </button>
          <textarea
            value={value}
            readOnly={locked}
            onChange={(e) => !locked && setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) send(value)
              }
            }}
            rows={1}
            // The box is one line tall until something is typed into it, so the
            // placeholder has to fit on one line: the old one wrapped to two and
            // the first was clipped off the top.
            placeholder={
              locked
                ? lockedHint ?? 'Typing is off in the demo.'
                : 'Ask anything, or paste your work…'
            }
            className={`flex-1 bg-transparent resize-none outline-none text-[13.5px] max-h-28 py-1 ${
              locked && composed === null ? 'text-ss-slate' : ''
            }`}
          />
          <button
            onClick={() => send(value)}
            disabled={!canSend || busy}
            className="w-8 h-8 rounded-xl bg-ss-accent text-white flex items-center justify-center disabled:opacity-60 hover:brightness-95 transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12px] text-ss-slate text-center mt-2">AI can make mistakes. Check important info.</p>
      </div>
    </div>
  )
}
