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
  onSend: (text: string, imageDataUrl?: string) => void
  pendingCheckpoint?: boolean
  onQuizMe?: () => void
}

export default function ChatMouthpiece({ messages, suggestions, busy, done, onSend, pendingCheckpoint, onQuizMe }: ChatMouthpieceProps) {
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

  const send = (text: string) => {
    const value = text.trim()
    if ((!value && !attachment) || busy) return
    onSend(value || "Here's my work — can you take a look?", attachment ?? undefined)
    setInput('')
    setAttachment(null)
    setAttachError(null)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#161617]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 rounded-xl bg-apple-blue/10 flex items-center justify-center">
          <Brain className="w-4.5 h-4.5 text-apple-blue" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-[14px]">AI Study Assistant</p>
          <p className="text-[11px] text-apple-dark-gray">Brain Ink AI</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-apple-dark-gray text-center mt-8">Starting your session…</p>
        )}
        {messages.map((m, i) =>
          m.role === 'assistant' ? (
            <div key={i} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-apple-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-4 h-4 text-apple-blue" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-apple-gray dark:bg-white/5 px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap">
                <SafeLatex>{m.content}</SafeLatex>
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-apple-blue text-white px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap">
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
            <div className="w-7 h-7 rounded-lg bg-apple-blue/10 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-apple-blue" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-apple-gray dark:bg-white/5 px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-apple-dark-gray animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-apple-dark-gray animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-apple-dark-gray animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Pending checkpoint banner — finish the check before advancing */}
      {pendingCheckpoint && !busy && (
        <div className="mx-4 mb-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-[13px] font-semibold">
          Answer the check on the canvas to continue.
        </div>
      )}

      {/* Suggestions (hidden while a check is pending so the student finishes it first) */}
      {!busy && !pendingCheckpoint && suggestions.length > 0 && !done && (
        <div className="px-4 pb-2 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              className="text-left text-[13px] px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-apple-blue hover:text-apple-blue transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Persistent "Quiz me" control */}
      {!busy && !pendingCheckpoint && !done && onQuizMe && (
        <div className="px-4 pb-2">
          <button
            onClick={onQuizMe}
            className="w-full text-[13px] px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            Quiz me on this
          </button>
        </div>
      )}

      {done && (
        <div className="mx-4 mb-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[13px] flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          You&apos;ve completed this topic. Great work!
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        {attachment && (
          <div className="mb-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment} alt="Attachment preview" className="h-20 w-auto rounded-xl border border-gray-200 dark:border-gray-700" />
            <button
              onClick={() => setAttachment(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900/80 text-white flex items-center justify-center"
              aria-label="Remove attachment"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {attachError && <p className="text-[11px] text-red-500 mb-1.5">{attachError}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-apple-gray dark:bg-black/30 px-3 py-2 focus-within:ring-2 focus-within:ring-apple-blue/40">
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
            className="w-8 h-8 rounded-xl text-apple-dark-gray hover:text-apple-blue hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
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
            className="w-8 h-8 rounded-xl bg-apple-blue text-white flex items-center justify-center disabled:opacity-40 hover:bg-blue-600 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-apple-dark-gray text-center mt-2">AI can make mistakes. Check important info.</p>
      </div>
    </div>
  )
}
