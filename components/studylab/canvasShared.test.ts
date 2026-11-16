import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SafeLatex, stripHtmlTags } from './canvasShared'

describe('html in card text', () => {
  it('drops known tags and keeps their words, and leaves a bare "<" alone', () => {
    expect(stripHtmlTags('<p>Add <b>both</b> sides</p>')).toBe('Add both sides ')
    expect(stripHtmlTags('one<br/>two')).toBe('one two')
    expect(stripHtmlTags('if x < 3 and y > 2')).toBe('if x < 3 and y > 2')
  })
  it('does not print tags to the learner', () => {
    const html = renderToStaticMarkup(createElement(SafeLatex, null, 'Use <strong>x</strong> here'))
    expect(html).not.toContain('&lt;strong')
    expect(html).toContain('Use x here')
  })
})

describe('punctuation after a formula', () => {
  it('rides with the formula so it cannot wrap alone', () => {
    const html = renderToStaticMarkup(createElement(SafeLatex, null, 'So $x=2$. Then go on.'))
    expect(html).toMatch(/white-space:\s*nowrap/)
    expect(html).toMatch(/<\/span><\/span><\/span>\.<\/span>|\.<\/span>/)
    expect(html).not.toContain('>. Then')
  })
})
