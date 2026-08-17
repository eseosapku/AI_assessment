import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Contrast guard for the design tokens.
 *
 * A usability audit found the light palette failing WCAG AA everywhere —
 * secondary text at 3.52:1, links at 3.58:1, white-on-primary-button at
 * 3.58:1 — which is why an almost-empty dashboard reported seventeen contrast
 * errors. Those were one palette problem, not seventeen component mistakes.
 *
 * This reads the real stylesheet rather than a copy of the values, so a token
 * edited back to a prettier, failing colour breaks the build instead of
 * quietly reintroducing the whole class of bug.
 */

const CSS = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8')

/** Pull a token from the light (`:root`) or dark block. */
function token(name: string, theme: 'light' | 'dark'): string {
  // The dark overrides come second, so light is the first match and dark the last.
  const matches = [...CSS.matchAll(new RegExp(`--ss-${name}\\s*:\\s*([^;]+);`, 'g'))].map((m) =>
    m[1].trim(),
  )
  expect(matches.length, `--ss-${name} should be defined in both themes`).toBeGreaterThanOrEqual(2)
  return theme === 'light' ? matches[0] : matches[matches.length - 1]
}

function toRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '').trim()
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(color: string): number {
  const srgb = toRgb(color).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const AA_TEXT = 4.5

describe('light theme text tokens', () => {
  // Every surface body text can sit on. Canvas is the darkest and therefore
  // the binding constraint — testing against white alone would let a token
  // pass here and fail on a real page.
  const surfaces = ['panel', 'chip', 'canvas'] as const

  for (const name of ['slate', 'accent', 'good', 'warn', 'bad', 'ink'] as const) {
    for (const surface of surfaces) {
      it(`--ss-${name} meets AA on --ss-${surface}`, () => {
        const ratio = contrast(token(name, 'light'), token(surface, 'light'))
        expect(ratio, `${name} on ${surface} was ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT)
      })
    }
  }
})

describe('light theme fills carrying white text', () => {
  // Primary buttons put white on the accent; a failing pair here is a failing
  // label on the most-clicked control in the product.
  for (const name of ['accent', 'accent-deep'] as const) {
    it(`white text on --ss-${name} meets AA`, () => {
      const ratio = contrast('#FFFFFF', token(name, 'light'))
      expect(ratio, `white on ${name} was ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT)
    })
  }
})

describe('dark theme text tokens', () => {
  for (const name of ['slate', 'accent', 'good', 'warn', 'bad', 'ink'] as const) {
    it(`--ss-${name} meets AA on --ss-panel`, () => {
      const ratio = contrast(token(name, 'dark'), token('panel', 'dark'))
      expect(ratio, `${name} on panel was ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT)
    })
  }
})

describe('the audited failures specifically', () => {
  it('no longer ships the exact values the audit flagged', () => {
    // Named so the diff explains itself if someone reverts them.
    const failing: Record<string, string> = {
      slate: '#7E8A96', // was 3.52:1
      accent: '#0E8FD1', // was 3.58:1, and 3.58:1 for white-on-fill
      good: '#16B67A', // was 2.62:1 under white text
      warn: '#F0A93E', // was 2.01:1 under white text
      bad: '#E26773', // was 3.27:1 under white text
    }
    for (const [name, old] of Object.entries(failing)) {
      expect(token(name, 'light').toUpperCase()).not.toBe(old)
    }
  })
})
