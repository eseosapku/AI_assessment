'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { chatEmphasis } from '@/lib/studylab/chatFade'
import { PlanCard } from './PlanCard'
import { QuestionPicker } from './QuestionPicker'
import { Send, Sparkles, ImagePlus, X, ArrowRight, Volume2, VolumeX, PanelLeftClose } from 'lucide-react'
import { KanaLive } from './trail/KanaLive'
import { SafeLatex } from './canvasShared'
import { useMuted } from '@/lib/studylab/sound'
import type { ChatMessage, TutorAction } from '@/lib/studylab/types'
import { plainTitle } from '@/lib/studylab/actions'
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

export interface ChatMouthpieceProps {
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
  /** The quiz could not be built: the lesson-end screen says so. */
  proveFailed?: boolean
  /** Whether the end-of-lesson quiz files its score where the Gap Map can read it. */
  proveUpdatesGapMap?: boolean
  onSend: (text: string, opts?: { image?: string; silent?: boolean }) => void
  /**
   * A suggestion chip was clicked. "Makes sense" moves on and "Not really" asks
   * what is unclear, where typing the same words is just a question; without
   * this, a chip is sent as if typed.
   */
  onChip?: (label: string) => void
  /**
   * Get help on a card, after a miss: its question and the learner's attempt.
   * The stage opens the drawer; this sends "Why was my answer wrong?".
   */
  onHelp?: (request: { nodeId: string; prompt: string; attempt: string }) => void
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
  /** Send a failed action again (the error bubble's Try again). */
  onRetry?: (action: Record<string, unknown>) => void
  /** The measured score this lesson was opened for, shown beside "Prove it". */
  before?: { title: string; accuracy: number } | null
  /** In the drawer: closes it. */
  onClose?: () => void
  /** Put the cursor in the box (the drawer was just opened). */
  focusInput?: boolean
}

export default function ChatMouthpiece({ messages, suggestions, busy, done, onSend, onChip, onProveIt, provingIt = false, proveUpdatesGapMap = false, onAcceptPlan, onAnswerPlan, working = 'Thinking…', onFocusCard, defaultPace, composed = null, locked = false, lockedHint, onStartHomework, onRetry, before = null, onClose, focusInput = false }: ChatMouthpieceProps) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fade = chatEmphasis(messages)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (focusInput) inputRef.current?.focus({ preventScroll: true })
  }, [focusInput])

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

  return (
    <div className="flex flex-col h-full ss-trail-chat">
      {/* Header */}
      <div className="ss-chat-rail">
        <MuteToggle />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the chat"
            title="Close (Esc)"
            className="grid h-11 w-11 place-items-center rounded-xl text-ss-slate transition hover:bg-ss-chip hover:text-ss-ink motion-reduce:transition-none"
          >
            <PanelLeftClose className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      {/* Messages */}
      {/* Brilliant-style: the scroll fades out at its top edge, what came
          before the latest exchange fades, and the newest reply is lit. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 ss-chat-scroll"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 40px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 40px)' }}
      >
        {messages.length === 0 && !busy && (
          <p className="text-sm text-ss-slate text-center mt-8">Starting your session…</p>
        )}
        {messages.map((m, i) => (<Fade key={i}>{
          // The plan is on the board; an old draft is not worth repeating.
          m.kind === 'plan' && !m.plan?.live ? null :
          // A turn that said nothing and built nothing is not a turn. One left
          // a bare avatar floating in the transcript with no bubble beside it,
          // which reads as the tutor having failed rather than as nothing
          // having happened. The plan card carries no text of its own, so it
          // is exempt.
          m.role === 'assistant' &&
          m.kind !== 'plan' &&
          !m.content?.trim() ? null :
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
              {/* Rendered by kind. A proposed plan, a refusal, an error and an
                  ordinary teaching line used to be the same grey bubble, so
                  nothing in the conversation read as more important than
                  anything else. */}
              {(m.kind === 'plan' && m.plan?.live) || (m.kind === 'homework' && m.sheet?.live) ? (
                // The live card is on the board, where the lesson begins; the
                // conversation keeps a pointer to it, not a second copy.
                <div className="ss-chat-say">
                  {m.kind === 'plan' ? 'Your plan is on the board.' : 'Pick your questions on the board.'}
                </div>
              ) : m.kind === 'homework' && m.sheet ? (
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
                <div className="max-w-[92%] w-full">
                  <PlanCard
                    plan={m.plan}
                    busy={busy}
                    onAccept={(pace) => onAcceptPlan?.(pace)}
                    defaultPace={defaultPace}
                    onAnswer={(answer) => onAnswerPlan?.(answer)}
                  />
                </div>
              ) : m.kind === 'refusal' ? (
                <div className="ss-chat-say ss-chat-warn whitespace-pre-wrap">
                  <SafeLatex>{m.content}</SafeLatex>
                  {m.retryAction && onRetry && i === messages.length - 1 && (
                    <RetryButton onClick={() => onRetry(m.retryAction!)} disabled={busy} />
                  )}
                </div>
              ) : m.kind === 'error' ? (
                <div role="alert" className="ss-chat-say ss-chat-warn whitespace-pre-wrap">
                  <SafeLatex>{m.content}</SafeLatex>
                  {/* Only on the latest message: an old error retrying an old action would surprise. */}
                  {m.retryAction && onRetry && i === messages.length - 1 && (
                    <RetryButton onClick={() => onRetry(m.retryAction!)} disabled={busy} />
                  )}
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  {m.content && (
                    <div
                      className={`ss-chat-say whitespace-pre-wrap${i === fade.lit ? ' ss-chat-lit' : ''}`}
                                          >
                      <SafeLatex>{m.content}</SafeLatex>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="ss-chat-you whitespace-pre-wrap">
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
        }</Fade>))}

        {busy && (
          <div className="flex gap-2.5">
            <div className="ss-chat-say ss-chat-lit flex flex-1 items-center gap-2">
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

      {/* Input */}
      <div className="ss-chat-foot">
        <KanaLive pose={busy ? 'think' : 'happy'} size={132} still={!focusInput} crop />
        <div className="ss-chat-compose">
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
          className="ss-chat-box"
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
            ref={inputRef}
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
                : 'How can I help?'
            }
            className={`flex-1 bg-transparent resize-none outline-none focus-visible:outline-none text-[13.5px] max-h-28 py-1 ${
              locked && composed === null ? 'text-ss-slate' : ''
            }`}
          />
          <button
            onClick={() => send(value)}
            disabled={!canSend || busy}
            aria-label="Send"
            className="ss-chat-send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12px] text-ss-slate text-center mt-2">AI can make mistakes. Check important info.</p>
        </div>
      </div>
    </div>
  )
}

/** Sends the failed turn again. Only ever on the newest message. */
function RetryButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 block rounded-lg bg-ss-accent px-3 py-1.5 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-60"
    >
      Try again
    </button>
  )
}

/** One switch for the lesson's sounds and, later, Kana's voice. */
function MuteToggle() {
  const [muted, setMuted] = useMuted()
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
      className="ml-auto grid h-11 w-11 place-items-center rounded-xl text-ss-slate transition hover:bg-ss-chip hover:text-ss-ink motion-reduce:transition-none"
    >
      {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
    </button>
  )
}

/**
 * A message from before the latest exchange: still readable (70% keeps the
 * text above 4.5:1), without its fill, so the latest exchange stands out.
 */
function Fade({ children }: { children: ReactNode }) {
  if (children === null || children === undefined || children === false) return null
  return (
    <div className="transition-opacity duration-300 motion-reduce:transition-none">
      {children}
    </div>
  )
}
