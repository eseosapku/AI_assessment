import { describe, it, expect } from 'vitest'
import { splitGlossary, MAX_TERMS } from './glossary'

describe('tap-to-define terms in card text', () => {
  it('pulls a marked term and its definition out of the text', () => {
    expect(splitGlossary('A [[corpus|the texts a model learns from]] is where it starts.')).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'term', term: 'corpus', definition: 'the texts a model learns from' },
      { kind: 'text', text: ' is where it starts.' },
    ])
  })

  it('leaves text with no marks alone', () => {
    expect(splitGlossary('Nothing to define here.')).toEqual([{ kind: 'text', text: 'Nothing to define here.' }])
    expect(splitGlossary('')).toEqual([])
  })

  it('shows a mark missing one half as its plain word, without brackets', () => {
    expect(splitGlossary('An [[|no term]] here.')).toEqual([{ kind: 'text', text: 'An  here.' }])
    expect(splitGlossary('A [[term|]] here.')).toEqual([{ kind: 'text', text: 'A term here.' }])
  })

  it('leaves double brackets with no bar exactly as written -- they are code, not marks', () => {
    // Stripping them turned a nested list [[1, 2]] into "1, 2", so a Python
    // question could show its right answer as a wrong-looking one.
    expect(splitGlossary('x = [[1, 2]]')).toEqual([{ kind: 'text', text: 'x = [[1, 2]]' }])
    expect(splitGlossary('See the [[corpus]] first.')).toEqual([{ kind: 'text', text: 'See the [[corpus]] first.' }])
  })

  it('never reads a mark inside code or maths', () => {
    expect(splitGlossary('Index with `grid[[i|j]]` here.')).toEqual([{ kind: 'text', text: 'Index with `grid[[i|j]]` here.' }])
    expect(splitGlossary('The matrix $[[a|b]]$ and a [[term|its meaning]].')).toEqual([
      { kind: 'text', text: 'The matrix $[[a|b]]$ and a ' },
      { kind: 'term', term: 'term', definition: 'its meaning' },
      { kind: 'text', text: '.' },
    ])
    expect(splitGlossary('$$[[x|y]]$$')).toEqual([{ kind: 'text', text: '$$[[x|y]]$$' }])
  })

  it('keeps an unclosed bracket as typed', () => {
    expect(splitGlossary('Arrays like a[[0] stay.')).toEqual([{ kind: 'text', text: 'Arrays like a[[0] stay.' }])
  })

  it('defines at most three terms; later ones read as plain words', () => {
    const text = '[[a|one]] [[b|two]] [[c|three]] [[d|four]]'
    const parts = splitGlossary(text)
    expect(parts.filter((p) => p.kind === 'term')).toHaveLength(MAX_TERMS)
    expect(MAX_TERMS).toBe(3)
    expect(parts.at(-1)).toEqual({ kind: 'text', text: ' d' })
  })

  it('keeps maths inside a definition as written', () => {
    expect(splitGlossary('The [[area|length times width, $A = lw$]] grows.')[1]).toEqual({
      kind: 'term', term: 'area', definition: 'length times width, $A = lw$',
    })
  })

  it('joins neighbouring plain text so nothing renders in pieces', () => {
    const parts = splitGlossary('x [[bad|]] y')
    expect(parts).toEqual([{ kind: 'text', text: 'x bad y' }])
  })
})
