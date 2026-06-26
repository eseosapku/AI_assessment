import { describe, it, expect } from 'vitest'
import { exportDimensions, exportFileName } from '@/lib/studylab/exportCanvas'

describe('exportDimensions', () => {
  it('adds padding on both sides', () => {
    expect(exportDimensions({ width: 1000, height: 600 }, 100)).toMatchObject({ width: 1200, height: 800 })
  })

  it('clamps tiny boards up to a minimum and huge boards down to a max', () => {
    expect(exportDimensions({ width: 10, height: 10 }, 0).width).toBe(640)
    expect(exportDimensions({ width: 10, height: 10 }, 0).height).toBe(480)
    expect(exportDimensions({ width: 99999, height: 99999 }, 0)).toMatchObject({ width: 4096, height: 4096 })
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
