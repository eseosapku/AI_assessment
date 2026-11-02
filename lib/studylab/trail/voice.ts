// lib/studylab/trail/voice.ts
import { latestLine } from '../bubble'
import type { BarModel } from '../checkBarModel'
import type { KanaPose } from '../kana/poses'
import type { ChatMessage } from '../types'

/**
 * Kana and the chat are one voice. The bubble on the board is the newest thing
 * said; the chat holds the same lines. Check feedback is shown in both but
 * written to neither history: the tutor never reads it back.
 */

export interface DisplayLine {
  /** How many messages had been said when this was: it sits right after them. */
  afterIndex: number
  text: string
  tone: 'good' | 'nudge' | 'say'
}

export interface BubbleLine {
  key: string
  text: string
  /** There is more of this line in the chat. */
  more: boolean
  tone: 'say' | 'good' | 'nudge' | 'refusal' | 'error' | 'working'
}

const MAX_WORDS = 40
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'cf', 'dr', 'mr', 'mrs', 'ms', 'prof', 'st', 'no', 'fig', 'approx'])

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** Up to the first full stop that ends a sentence: not one in a number, an abbreviation or a formula. */
export function firstSentence(text: string): string {
  const s = text.trim()
  let inMath = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '$') {
      // A lone dollar is a price: a formula has a closing one.
      if (inMath || s.indexOf('$', i + 1) !== -1) inMath = !inMath
      continue
    }
    if (inMath) continue
    if (c === '\n' && s[i + 1] === '\n') return s.slice(0, i).trim()
    if (c !== '.' && c !== '!' && c !== '?') continue
    const after = s[i + 1]
    if (after !== undefined && !/\s/.test(after)) continue
    if (c === '.') {
      const word = s.slice(0, i).split(/\s+/).pop()?.replace(/^[("'[]+/, '').toLowerCase() ?? ''
      if (ABBREVIATIONS.has(word)) continue
    }
    return s.slice(0, i + 1)
  }
  return s
}

function shortened(text: string): { text: string; more: boolean } {
  if (wordCount(text) <= MAX_WORDS) return { text, more: false }
  const first = firstSentence(text)
  if (wordCount(first) <= MAX_WORDS) return { text: first, more: true }
  return { text: `${first.split(/\s+/).slice(0, MAX_WORDS - 10).join(' ')}…`, more: true }
}

export function bubbleLine(messages: ChatMessage[], lines: DisplayLine[], state: { busy: boolean; working: string }): BubbleLine | null {
  if (state.busy) return { key: 'working', text: state.working, more: false, tone: 'working' }
  const said = latestLine(messages)
  const feedback = lines[lines.length - 1]
  if (feedback && (!said || feedback.afterIndex > said.index)) {
    return { key: `d${lines.length}`, ...shortened(feedback.text), tone: feedback.tone }
  }
  if (!said) return null
  return { key: `m${said.index}`, ...shortened(said.text), tone: said.tone }
}

/** The chat panel's copy of the conversation, with the feedback in its place. The history itself is untouched. */
export function withDisplayLines(messages: ChatMessage[], lines: DisplayLine[]): ChatMessage[] {
  if (lines.length === 0) return messages
  const shown: ChatMessage[] = []
  const line = (l: DisplayLine): ChatMessage => ({ role: 'assistant', content: l.text })
  messages.forEach((m, i) => {
    for (const l of lines) if (l.afterIndex === i) shown.push(line(l))
    shown.push(m)
  })
  for (const l of lines) if (l.afterIndex >= messages.length) shown.push(line(l))
  return shown
}

export function kanaPoseFor(s: { flying: boolean; reaction: 'good' | 'nudge' | null; talking: boolean; pointing: boolean }): KanaPose {
  if (s.flying) return 'fly'
  if (s.reaction === 'good') return 'celebrate'
  if (s.reaction === 'nudge') return 'concerned'
  if (s.talking) return 'talking'
  if (s.pointing) return 'point'
  return 'open'
}

export function lineTone(tone: BarModel['tone']): DisplayLine['tone'] {
  if (tone === 'good') return 'good'
  return tone === 'bad' || tone === 'warn' ? 'nudge' : 'say'
}
