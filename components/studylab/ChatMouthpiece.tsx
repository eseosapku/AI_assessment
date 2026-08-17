'use client'

import { useEffect, useRef, useState } from 'react'
import Latex from 'react-latex-next'
import { Brain, Send, Sparkles, ImagePlus, X } from 'lucide-react'
import type { ChatMessage } from '@/lib/studylab/types'

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
  try {
    return <Latex>{children}</Latex>
  } catch {
    return <>{children}</>
  }
}

interface ChatMouthpieceProps {
  messages: ChatMessage[]
  suggestions: string[]
  busy: boolean
  done: boolean
  /** Optional: start a real assessment on the studied topic once done. */
  onProveIt?: () => void
  provingIt?: boolean
  onSend: (text: string, opts?: { image?: string; silent?: boolean }) => void
  pendingCheckpoint?: { total: number; remaining: number; nextId: string | null } | null
  onGoToCheck?: (nodeId: string) => void
  onQuizMe?: () => void
}

export default function ChatMouthpiece({ messages, suggestions, busy, done, onSend, pendingCheckpoint, onGoToCheck, onQuizMe, onProveIt, provingIt = false }: ChatMouthpieceProps) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
    const value = text.trim()
    if ((!value && !attachment) || busy) return
    onSend(value || "Here's my work — can you take a look?", { image: attachment ?? undefined })
    setInput('')
    setAttachment(null)
    setAttachError(null)
  }

  // Button actions (Continue, suggestions…) drive the tutor silently — they
  // don't drop a user bubble into the chat.
  const sendAction = (text: string) => {
    if (busy) return
    onSend(text, { silent: true })
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-ss-slate text-center mt-8">Starting your session…</p>
        )}
        {messages.map((m, i) =>
          m.role === 'assistant' ? (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[color:var(--ss-accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-4 h-4 text-ss-accent" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-ss-chip dark:bg-white/5 px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap">
                <SafeLatex>{m.content}</SafeLatex>
              </div>
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
            <div className="rounded-2xl rounded-tl-sm bg-ss-chip dark:bg-white/5 px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ss-slate animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-ss-slate animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-ss-slate animate-bounce" />
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
          {pendingCheckpoint.total > 1
            ? `Answer all ${pendingCheckpoint.total} checks on the canvas to continue — ${pendingCheckpoint.remaining} left.`
            : 'Answer the check on the canvas to continue.'}
          {pendingCheckpoint.nextId && onGoToCheck && (
            <span className="block mt-0.5 text-[12px] font-medium opacity-80">Tap to jump to it →</span>
          )}
        </button>
      )}

      {/* Suggestions (hidden while a check is pending so the student finishes it first) */}
      {!busy && !pendingCheckpoint && suggestions.length > 0 && !done && (
        <div className="px-4 pb-2 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendAction(s)}
              className="text-left text-[13px] px-3.5 py-2 rounded-xl border border-ss-line text-gray-700 dark:text-gray-300 hover:border-ss-accent hover:text-ss-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Persistent forward controls — reliable lesson navigation */}
      {!busy && !pendingCheckpoint && !done && (
        <div className="px-4 pb-2 flex gap-2">
          <button
            onClick={() => sendAction("I'm ready — let's continue.")}
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
        <div className="flex items-end gap-2 rounded-2xl border border-ss-line bg-ss-chip dark:bg-black/30 px-3 py-2 focus-within:ring-2 focus-within:ring-[color:var(--ss-accent)]/40">
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
            disabled={busy}
            className="w-8 h-8 rounded-xl text-ss-slate hover:text-ss-accent hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center disabled:opacity-60 shrink-0 transition-colors"
            aria-label="Attach an image of your work"
            title="Attach an image of your work"
          >
            <ImagePlus className="w-4.5 h-4.5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder="Ask me anything, or paste a photo of your work…"
            className="flex-1 bg-transparent resize-none outline-none text-[13.5px] max-h-28 py-1"
          />
          <button
            onClick={() => send(input)}
            disabled={(!input.trim() && !attachment) || busy}
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
