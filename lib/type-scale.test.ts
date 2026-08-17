import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Minimum readable text size.
 *
 * The UI had shipped 281 pieces of text below 12px — 144 at 10px and 6 at 9px —
 * mostly wide-tracked uppercase labels, which are the hardest kind to read
 * small. Testers reported simply not being able to see instructions, and WAVE
 * flagged the wizard for "very small text" 25 times on one screen.
 *
 * 12px is the floor for anything carrying meaning. This walks the real source
 * so a stray `text-[10px]` in a new component fails the build rather than
 * shipping and being found by a user squinting at a phone.
 */

const ROOTS = ['components', 'app']
/** Arbitrary-value text sizes below 12px. */
const TOO_SMALL = /text-\[(\d+(?:\.\d+)?)px\]/g
const FLOOR_PX = 12

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(p, out)
    } else if (entry.name.endsWith('.tsx')) {
      out.push(p)
    }
  }
  return out
}

describe('type scale', () => {
  it(`ships no text below ${FLOOR_PX}px`, () => {
    const offenders: string[] = []

    for (const root of ROOTS) {
      const dir = path.join(process.cwd(), root)
      if (!fs.existsSync(dir)) continue
      for (const file of walk(dir)) {
        const source = fs.readFileSync(file, 'utf8')
        const lines = source.split('\n')
        lines.forEach((line, i) => {
          for (const m of line.matchAll(TOO_SMALL)) {
            if (parseFloat(m[1]) < FLOOR_PX) {
              offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}  ${m[0]}`)
            }
          }
        })
      }
    }

    expect(
      offenders,
      `Text below ${FLOOR_PX}px is unreadable for many people. Raise these:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
