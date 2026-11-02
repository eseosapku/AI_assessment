// lib/studylab/trail/voice.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ChatMouthpiece from '@/components/studylab/ChatMouthpiece'
import type { ChatMessage, TutorAction } from '../types'
import { bubbleLine, firstSentence, kanaPoseFor, lineTone, withDisplayLines } from './voice'

const say = (content: string) => ({ role: 'assistant', content }) as ChatMessage
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
const idle = { busy: false, working: 'Thinking…' }
const conceptAction = { type: 'createCard', id: 'c1', title: 'Demand', cardType: 'concept' } as unknown as TutorAction
const renderChat = (over: { look?: 'trail'; messages: ChatMessage[] }) =>
  renderToStaticMarkup(createElement(ChatMouthpiece, { suggestions: [], busy: false, done: false, onSend: () => {}, ...over }))

describe('bubbleLine', () => {
  it('a short line shows whole; over 40 words, the first sentence and More', () => {
    expect(bubbleLine([say(words(40))], [], idle)).toMatchObject({ more: false })
    const long = 'Demand slopes down. ' + words(45)
    expect(bubbleLine([say(long)], [], idle)).toMatchObject({ text: 'Demand slopes down.', more: true })
  })
  it('a long line with no sentence end is cut, not shown whole', () => {
    const line = bubbleLine([say(words(80))], [], idle)!
    expect(line.more).toBe(true)
    expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(40)
  })
  it('while busy the bubble says what is happening, and only that', () => {
    expect(bubbleLine([say('Old')], [], { busy: true, working: 'Drafting your plan…' })).toMatchObject({ text: 'Drafting your plan…', tone: 'working' })
  })
  it('check feedback shows in the bubble when newer than the tutor', () => {
    expect(bubbleLine([say('Old')], [{ afterIndex: 1, text: "That's it.", tone: 'good' }], idle)).toMatchObject({ text: "That's it.", tone: 'good' })
    expect(bubbleLine([say('Old'), say('New')], [{ afterIndex: 1, text: "That's it.", tone: 'good' }], idle)).toMatchObject({ text: 'New' })
  })
  it('a refused turn is said once, with its tone', () => {
    expect(bubbleLine([{ role: 'assistant', kind: 'refusal', content: 'Press again.' }], [], idle)).toMatchObject({ tone: 'refusal' })
  })
  it('status lines never reach the bubble', () => {
    expect(bubbleLine([say('Hi'), { role: 'assistant', kind: 'status', content: 'Marked' }], [], idle)).toMatchObject({ text: 'Hi' })
  })
  it('nothing said yet is no bubble', () => {
    expect(bubbleLine([], [], idle)).toBeNull()
  })
  it('a new line has a new key, and the same line keeps its key', () => {
    const a = bubbleLine([say('Hi')], [], idle)!
    expect(bubbleLine([say('Hi')], [], idle)!.key).toBe(a.key)
    expect(bubbleLine([say('Hi'), say('Hi')], [], idle)!.key).not.toBe(a.key)
  })
})

describe('firstSentence', () => {
  it('first sentences survive decimals, abbreviations and maths', () => {
    expect(firstSentence('It costs 3.5 today. Next.')).toBe('It costs 3.5 today.')
    expect(firstSentence('Try e.g. apples first. Then.')).toBe('Try e.g. apples first.')
    expect(firstSentence('Solve $x = 1. 2$ now. Then.')).toBe('Solve $x = 1. 2$ now.')
  })
  it('stops at a question, or at a paragraph break', () => {
    expect(firstSentence('Why does it fall? Think.')).toBe('Why does it fall?')
    expect(firstSentence('No full stop here\n\nNext part.')).toBe('No full stop here')
  })
  it('a price is not maths', () => {
    expect(firstSentence('It costs $5. Next.')).toBe('It costs $5.')
  })
})

describe('withDisplayLines', () => {
  it('display lines show in the chat but are never written to the history the tutor sees', () => {
    const messages = [say('Old')]
    const shown = withDisplayLines(messages, [{ afterIndex: 1, text: 'Yes.', tone: 'good' }])
    expect(shown.map((m) => m.content)).toEqual(['Old', 'Yes.'])
    expect(messages).toHaveLength(1)
  })
  it('each sits where it was said', () => {
    const shown = withDisplayLines([say('A'), say('B')], [{ afterIndex: 1, text: 'x', tone: 'good' }, { afterIndex: 2, text: 'y', tone: 'nudge' }])
    expect(shown.map((m) => m.content)).toEqual(['A', 'x', 'B', 'y'])
  })
})

describe('Kana', () => {
  it('pose priority: flying, then reaction, then talking, then pointing', () => {
    expect(kanaPoseFor({ flying: true, reaction: 'good', talking: true, pointing: true })).toBe('fly')
    expect(kanaPoseFor({ flying: false, reaction: 'good', talking: true, pointing: false })).toBe('celebrate')
    expect(kanaPoseFor({ flying: false, reaction: 'nudge', talking: false, pointing: false })).toBe('concerned')
    expect(kanaPoseFor({ flying: false, reaction: null, talking: true, pointing: true })).toBe('talking')
    expect(kanaPoseFor({ flying: false, reaction: null, talking: false, pointing: true })).toBe('point')
    expect(kanaPoseFor({ flying: false, reaction: null, talking: false, pointing: false })).toBe('open')
  })
  it('a wrong answer is a nudge, never a scolding', () => {
    expect(lineTone('good')).toBe('good')
    expect(lineTone('bad')).toBe('nudge')
    expect(lineTone('warn')).toBe('nudge')
    expect(lineTone('neutral')).toBe('say')
  })
})

describe('the chat', () => {
  it('in the Trail look: Kana, no "Added to the board"', () => {
    const html = renderChat({ look: 'trail', messages: [{ role: 'assistant', content: 'Hi', actions: [conceptAction] }] })
    expect(html).toContain('Kana')
    expect(html).not.toContain('Added to the board')
    expect(renderChat({ messages: [{ role: 'assistant', content: 'Hi', actions: [conceptAction] }] })).toContain('Added to the board')
  })
  it('renders emphasis and glossary terms, rather than showing their marks', () => {
    const html = renderChat({ messages: [say('How you *control* each one, and [[gain|how much bigger]].')] })
    expect(html).not.toContain('*control*')
    expect(html).not.toContain('[[gain')
    expect(html).toContain('control')
  })
  it('in the Trail look an old plan is not repeated: the plan is on the board', () => {
    const old: ChatMessage = { role: 'assistant', kind: 'plan', content: '', plan: { steps: [{ id: 's', title: 'Doping', goal: 'g', measured: null, locked: false }], questions: [], live: false } }
    expect(renderChat({ look: 'trail', messages: [old] })).not.toContain('Doping')
    expect(renderChat({ messages: [old] })).toContain('Doping')
  })
  it('in the Trail look suggestions stay under the bubble, not in the chat', () => {
    const html = renderToStaticMarkup(createElement(ChatMouthpiece, { suggestions: ['Show me another'], busy: false, done: false, onSend: () => {}, messages: [say('Hi')], look: 'trail' }))
    expect(html).not.toContain('Show me another')
  })
  it('a turn whose only content was built cards says nothing in the Trail look', () => {
    const turn: ChatMessage = { role: 'assistant', content: '', actions: [conceptAction] }
    const avatars = (html: string) => html.split('<svg').length
    const without = renderChat({ look: 'trail', messages: [say('Hi')] })
    expect(avatars(renderChat({ look: 'trail', messages: [say('Hi'), turn] }))).toBe(avatars(without))
  })
})
