// lib/studylab/dockWiring.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every card that draws its bar into the dock also has to act on the bar's
 * Continue (and Skip, which is Continue by another name). The practice card
 * took the dock without it: its Continue and Skip were dead buttons, and a
 * real lesson could not get past an unanswered practice problem.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx$/.test(name) ? [path] : []
  })
}

describe('cards in the dock', () => {
  it('act on Continue wherever they take the dock', () => {
    // Callers, not the file that defines the hook.
    const takers = sources('components/studylab').filter((f) => /=\s*useDock\(\)/.test(readFileSync(f, 'utf8')))
    expect(takers.length).toBeGreaterThanOrEqual(3)
    for (const file of takers) {
      expect(readFileSync(file, 'utf8'), `${file} takes the dock but never runs its Continue`).toMatch(/dock\.onContinue\(\)/)
    }
  })
})
