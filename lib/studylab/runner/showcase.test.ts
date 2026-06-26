import { describe, it, expect } from 'vitest'
import { isShowcaseOnly } from '@/lib/studylab/runner/showcase'

describe('isShowcaseOnly', () => {
  it('flags JavaScript that touches the DOM/browser as non-runnable', () => {
    expect(isShowcaseOnly('javascript', "document.getElementById('x')")).toBe(true)
    expect(isShowcaseOnly('js', 'window.alert("hi")')).toBe(true)
    expect(isShowcaseOnly('javascript', 'alert("hi")')).toBe(true)
    expect(isShowcaseOnly('javascript', 'localStorage.setItem("a","b")')).toBe(true)
  })

  it('keeps self-contained JavaScript runnable', () => {
    expect(isShowcaseOnly('javascript', 'console.log(1 + 2)')).toBe(false)
    expect(isShowcaseOnly('js', 'const a = [1,2,3]; console.log(a.map(x => x*2))')).toBe(false)
  })

  it('never showcases python or HTML with real tags (they run in pyodide / iframe)', () => {
    expect(isShowcaseOnly('python', 'print(document)')).toBe(false)
    expect(isShowcaseOnly('html', '<script>document.write("hi")</script>')).toBe(false)
    expect(isShowcaseOnly('html', '<div>hello</div>')).toBe(false)
  })

  it('showcases bare CSS / text with no HTML tags (running just echoes it)', () => {
    expect(isShowcaseOnly('css', 'display: flex; flex-direction: row;')).toBe(true)
    expect(isShowcaseOnly('html', 'flex-direction: column;')).toBe(true)
  })
})
