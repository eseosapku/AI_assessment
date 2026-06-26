import { describe, it, expect } from 'vitest'
import { assembleWebDoc } from '@/lib/studylab/webDoc'

describe('assembleWebDoc', () => {
  it('inlines css in a <style> tag and js in a <script> tag', () => {
    const doc = assembleWebDoc('<h1>Hi</h1>', 'h1 { color: red }', 'console.log(1)')
    expect(doc).toContain('<style>')
    expect(doc).toContain('h1 { color: red }')
    expect(doc).toContain('<h1>Hi</h1>')
    expect(doc).toContain('<script>')
    expect(doc).toContain('console.log(1)')
  })

  it('omits empty style/script tags', () => {
    const doc = assembleWebDoc('<p>only html</p>', '', '')
    expect(doc).not.toContain('<style>')
    expect(doc).not.toContain('<script>')
    expect(doc).toContain('<p>only html</p>')
  })

  it('neutralizes a </script> inside user JS so it cannot break out', () => {
    const doc = assembleWebDoc('', '', 'const s = "</script>"')
    expect(doc).not.toContain('"</script>"')
    expect(doc).toContain('<\\/script>')
  })

  it('handles all-undefined input without throwing', () => {
    expect(() => assembleWebDoc()).not.toThrow()
  })
})
