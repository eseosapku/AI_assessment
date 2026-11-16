// lib/studylab/chatFade.test.ts
import { describe, it, expect } from 'vitest'
import { chatEmphasis } from './chatFade'
import type { ChatMessage } from './types'

/**
 * Brilliant-style: what came before the latest exchange fades, and the
 * tutor's newest reply is lit.
 */
const u = (content: string): ChatMessage => ({ role: 'user', content })
const a = (content: string, kind?: ChatMessage['kind']): ChatMessage => ({ role: 'assistant', content, ...(kind ? { kind } : {}) })

describe('chatEmphasis', () => {
  it('fades everything before the learner’s last message, and lights the reply after it', () => {
    const msgs = [a('Hi'), u('What is a cell?'), a('The smallest unit of life.'), u('And a tissue?'), a('Cells working together.')]
    expect(chatEmphasis(msgs)).toEqual({ before: 3, lit: 4 })
  })

  it('lights only a teaching line, not a status line or an error', () => {
    const msgs = [u('Go on'), a('Moved to step 2', 'status'), a('Here is the next idea.'), a('Something broke', 'error')]
    expect(chatEmphasis(msgs)).toEqual({ before: 0, lit: 2 })
  })

  it('with nothing from the learner yet, fades all but the tutor’s latest line', () => {
    const msgs = [a('Welcome.'), a('Your plan is ready.')]
    expect(chatEmphasis(msgs)).toEqual({ before: 1, lit: 1 })
  })

  it('fades nothing in an empty conversation', () => {
    expect(chatEmphasis([])).toEqual({ before: 0, lit: -1 })
  })
})
