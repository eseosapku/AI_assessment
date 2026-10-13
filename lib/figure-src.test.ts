import { describe, expect, it } from 'vitest'
import { figureSrc, isFigurePath } from './figure-src'

const CDN = 'https://d123.cloudfront.net'

describe('figureSrc', () => {
  it('leaves every path alone when no base is configured', () => {
    expect(figureSrc('/textbook-images/rwanda/5/page129-embedded-0.jpeg', '')).toBe('/textbook-images/rwanda/5/page129-embedded-0.jpeg')
  })

  it('serves both figure folders from the base', () => {
    expect(figureSrc('/textbook-images/checkpoint-bank/x/p5-fig-0.png', CDN)).toBe(`${CDN}/textbook-images/checkpoint-bank/x/p5-fig-0.png`)
    expect(figureSrc('/exam-images/waec/a.png', CDN)).toBe(`${CDN}/exam-images/waec/a.png`)
  })

  it('does not move anything outside the figure folders', () => {
    for (const src of [
      '/art/brain.png',
      '/logo1.png',
      'data:image/png;base64,AAAA',
      'https://example.com/textbook-images/a.png',
      'textbook-images/a.png',
      '',
    ]) {
      expect(figureSrc(src, CDN)).toBe(src)
    }
  })

  it('recognises only the figure folders', () => {
    expect(isFigurePath('/textbook-images/a.png')).toBe(true)
    expect(isFigurePath('/textbook-imagesX/a.png')).toBe(false)
    expect(isFigurePath(undefined)).toBe(false)
  })
})
