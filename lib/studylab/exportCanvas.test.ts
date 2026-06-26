import { describe, it, expect } from 'vitest'
import { exportLayout, exportFileName } from '@/lib/studylab/exportCanvas'

describe('exportLayout', () => {
  it('sizes the image to the content aspect ratio with a uniform margin', () => {
    const { width, height, zoom, tx, ty } = exportLayout(
      { x: 100, y: 50, width: 1000, height: 600 },
      { margin: 50, targetZoom: 1 }
    )
    expect(zoom).toBe(1)
    expect(width).toBe(1100) // 1000*1 + 2*50
    expect(height).toBe(700) // 600*1 + 2*50
    // The top-left of the content lands exactly `margin` px in.
    expect(tx + zoom * 100).toBe(50)
    expect(ty + zoom * 50).toBe(50)
  })

  it('renders at the target zoom for small boards (crispness)', () => {
    expect(exportLayout({ x: 0, y: 0, width: 400, height: 300 }, { targetZoom: 1.5 }).zoom).toBe(1.5)
  })

  it('shrinks so neither side exceeds maxDim', () => {
    const { width, height } = exportLayout({ x: 0, y: 0, width: 10000, height: 4000 }, { maxDim: 4000, margin: 0 })
    expect(width).toBeLessThanOrEqual(4000)
    expect(height).toBeLessThanOrEqual(4000)
  })
})

describe('exportFileName', () => {
  it('slugifies the title and appends the extension', () => {
    expect(exportFileName('The Quadratic Formula', 'png')).toBe('the-quadratic-formula.png')
    expect(exportFileName('  CSS: Flexbox!! ', 'pdf')).toBe('css-flexbox.pdf')
  })

  it('falls back to "learnspace" when empty', () => {
    expect(exportFileName('', 'png')).toBe('learnspace.png')
    expect(exportFileName(undefined, 'pdf')).toBe('learnspace.pdf')
  })
})
