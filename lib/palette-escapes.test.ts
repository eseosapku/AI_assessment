import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { countPaletteEscapes, checkRatchet } from './palette-escapes'
import baseline from './palette-escapes.baseline.json'

function scan(): Record<string, number> {
  const out: Record<string, number> = {}
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', '.git'].includes(entry.name)) walk(file)
      } else if (entry.name.endsWith('.tsx')) {
        const n = countPaletteEscapes(fs.readFileSync(file, 'utf8'))
        if (n > 0) out[file.split(path.sep).join('/')] = n
      }
    }
  }
  walk('components')
  walk('app')
  return out
}

describe('countPaletteEscapes', () => {
  it('counts the numbered scales that bypass the ss-* tokens', () => {
    expect(countPaletteEscapes('className="text-gray-400 bg-blue-600"')).toBe(2)
    expect(countPaletteEscapes('className="text-amber-600 dark:text-amber-400"')).toBe(2)
  })

  it('leaves the tokens and non-colour utilities alone', () => {
    expect(countPaletteEscapes('className="text-ss-slate bg-ss-panel border-ss-line"')).toBe(0)
    expect(countPaletteEscapes('className="duration-300 z-50 gap-4 text-white bg-black"')).toBe(0)
  })
})

describe('checkRatchet', () => {
  it('fails a converted file that backslides', () => {
    const r = checkRatchet({ 'a.tsx': 3 }, { 'a.tsx': 1 })
    expect(r.regressions).toEqual([{ file: 'a.tsx', baseline: 1, actual: 3 }])
  })

  it('fails a brand-new file that arrives dirty', () => {
    // The report card was missed because nothing forced new work to be clean.
    const r = checkRatchet({ 'new.tsx': 1 }, {})
    expect(r.regressions).toHaveLength(1)
  })

  it('allows an already-dirty file to stay as it is', () => {
    // Otherwise the guard could not be adopted without rewriting 53 files first.
    expect(checkRatchet({ 'a.tsx': 40 }, { 'a.tsx': 40 }).regressions).toEqual([])
  })

  it('reports improvements so the baseline can be lowered', () => {
    expect(checkRatchet({ 'a.tsx': 2 }, { 'a.tsx': 9 }).improvements)
      .toEqual([{ file: 'a.tsx', baseline: 9, actual: 2 }])
    expect(checkRatchet({}, { 'gone.tsx': 5 }).improvements)
      .toEqual([{ file: 'gone.tsx', baseline: 5, actual: 0 }])
  })
})

describe('the codebase itself', () => {
  const { regressions, improvements } = checkRatchet(
    scan(),
    baseline as Record<string, number>,
  )

  it('has no screen that skipped the design tokens', () => {
    const detail = regressions
      .map((r) => `  ${r.file}: ${r.actual} hardcoded palette classes (was ${r.baseline})`)
      .join('\n')
    expect(
      regressions,
      regressions.length === 0
        ? ''
        : `Hardcoded Tailwind palette classes bypass the ss-* tokens, so a palette\n` +
          `retune never reaches them — that is how the report card kept failing\n` +
          `contrast long after the palette was fixed. Use the tokens, or if the\n` +
          `colour is genuinely one-off, raise the baseline deliberately.\n\n${detail}`,
    ).toEqual([])
  })

  it('has a baseline that still reflects reality', () => {
    // Not a failure — a nudge. Lowering the baseline locks a cleanup in so the
    // file cannot quietly regress back to where it was.
    if (improvements.length > 0) {
      console.info(
        `Palette baseline can be lowered for ${improvements.length} file(s):\n` +
          improvements.map((i) => `  ${i.file}: ${i.baseline} -> ${i.actual}`).join('\n'),
      )
    }
    expect(true).toBe(true)
  })
})
