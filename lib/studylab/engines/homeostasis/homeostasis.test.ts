// lib/studylab/engines/homeostasis/homeostasis.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { getEngine, sceneCatalogue } from '../registry'
import {
  bloodCount, goodPrompt, heatLoss, homeostasisEngine, inNormalBand, madeText, readingOf, storeCount, working,
  type HomeostasisConfig, type HomeostasisState,
} from './config'
import { HomeostasisView } from './View'

vi.spyOn(console, 'error').mockImplementation(() => {})

const high: HomeostasisConfig = { task: 'glucose', direction: 'high', diabetes: false }
const low: HomeostasisConfig = { task: 'glucose', direction: 'low', diabetes: false }
const type1: HomeostasisConfig = { task: 'glucose', direction: 'high', diabetes: true }
const hot: HomeostasisConfig = { task: 'temperature', direction: 'hot', diabetes: false }
const cold: HomeostasisConfig = { task: 'temperature', direction: 'cold', diabetes: false }
const all = [high, low, type1, hot, cold]
const view = (config: HomeostasisConfig, state: HomeostasisState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle') =>
  renderToStaticMarkup(createElement(HomeostasisView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

describe('the glucose model', () => {
  it('moves one particle per dose: insulin into the liver store, glucagon back out', () => {
    expect(readingOf(high, { insulin: 0, glucagon: 0 })).toBe(10)
    expect(readingOf(high, { insulin: 3, glucagon: 0 })).toBe(7)
    expect(storeCount(high, { insulin: 3, glucagon: 0 })).toBe(5)
    expect(readingOf(low, { insulin: 0, glucagon: 2 })).toBe(5)
    expect(bloodCount(high, { insulin: 3 }) + storeCount(high, { insulin: 3 })).toBe(12)
  })

  it('makes the wrong hormone push the reading further from normal', () => {
    expect(readingOf(high, { glucagon: 1 })).toBeGreaterThan(readingOf(high, {}))
    expect(readingOf(low, { insulin: 1 })).toBeLessThan(readingOf(low, {}))
  })
})

describe('the temperature model', () => {
  it('needs both right responses to reach the band, and a wrong one pushes the other way', () => {
    expect(inNormalBand(hot, { vessels: 'wide', sweat: 2, shiver: 0 })).toBe(true)
    expect(inNormalBand(hot, { vessels: 'wide', sweat: 0, shiver: 0 })).toBe(false)
    expect(inNormalBand(hot, { vessels: 'normal', sweat: 2, shiver: 0 })).toBe(false)
    expect(readingOf(hot, { shiver: 1 })).toBeGreaterThan(readingOf(hot, {}))
    expect(inNormalBand(cold, { vessels: 'narrow', sweat: 0, shiver: 2 })).toBe(true)
    expect(inNormalBand(cold, { vessels: 'narrow', sweat: 0, shiver: 0 })).toBe(false)
    expect(inNormalBand(cold, { vessels: 'normal', sweat: 0, shiver: 2 })).toBe(false)
    expect(readingOf(cold, { vessels: 'wide' })).toBeLessThan(readingOf(cold, {}))
  })

  it('shows more heat leaving the skin with wider vessels and more sweat', () => {
    expect(heatLoss({ vessels: 'wide', sweat: 2 })).toBeGreaterThan(heatLoss({}))
    expect(heatLoss({ vessels: 'narrow' })).toBeLessThan(heatLoss({}))
  })
})

describe('marking', () => {
  it('starts unsolved, solves, and never marks malformed work right', () => {
    for (const config of all) {
      expect(homeostasisEngine.check(config, homeostasisEngine.initial(config)).ok).toBe(false)
      expect(homeostasisEngine.check(config, homeostasisEngine.solve(config)).ok).toBe(true)
      expect(homeostasisEngine.check(config, null as unknown as HomeostasisState).ok).toBe(false)
      expect(homeostasisEngine.check(config, { insulin: -3, glucagon: 1.5, sweat: 9, shiver: NaN } as HomeostasisState).ok).toBe(false)
    }
  })

  it('reads the tutor’s configs and rejects impossible ones', () => {
    expect(homeostasisEngine.parse({ task: 'glucose', direction: 'high' })).toEqual(high)
    expect(homeostasisEngine.parse({ task: 'temperature', direction: 'cold' })).toEqual(cold)
    expect(homeostasisEngine.parse({ task: 'diabetes' })).toEqual(type1)
    expect(homeostasisEngine.parse('glucose')).toBeNull()
    expect(homeostasisEngine.faults({ task: 'glucose', direction: 'low', diabetes: true })).toHaveLength(1)
    for (const config of all) expect(homeostasisEngine.faults(config)).toEqual([])
  })
})

describe('words on the card', () => {
  it('names the controls before marking but keeps the explanation back', () => {
    const g = view(high, homeostasisEngine.initial(high))
    expect(g).toMatch(/Release insulin/)
    expect(g).toMatch(/Release glucagon/)
    expect(g).not.toMatch(/glycogen|negative feedback/i)
    expect(view(type1, homeostasisEngine.initial(type1))).toMatch(/Inject insulin/)
    expect(view(type1, homeostasisEngine.initial(type1))).toMatch(/no insulin/)
    const t = view(hot, homeostasisEngine.initial(hot))
    expect(t).toMatch(/Skin blood vessels/)
    expect(t).toMatch(/Sweating/)
    expect(t).toMatch(/Shivering/)
    expect(t).not.toMatch(/vasodilation|vasoconstriction|negative feedback/i)
  })

  it('explains the mechanism once marked right, and says what was made when wrong', () => {
    expect(working(high, { insulin: 5 })).toMatch(/glycogen/)
    expect(working(low, { glucagon: 2 })).toMatch(/break down glycogen/)
    expect(working(type1, { insulin: 5 })).toMatch(/makes no insulin, so it is injected/)
    expect(working(hot, { vessels: 'wide', sweat: 2 })).toMatch(/vasodilation/)
    expect(working(cold, { vessels: 'narrow', shiver: 2 })).toMatch(/vasoconstriction/)
    expect(madeText(high, { glucagon: 1 })).toMatch(/11\.0 mmol\/L, above.*0 insulin and 1 glucagon/)
    expect(view(high, { insulin: 5 }, 'right')).toMatch(/Yes: 5\.0 mmol\/L/)
  })
})

describe('the prompt a card is written with', () => {
  it('accepts the good prompts and refuses ones that name the answer', () => {
    for (const config of all) expect(homeostasisEngine.promptFaults!(config, goodPrompt(config))).toEqual([])
    expect(homeostasisEngine.promptFaults!(high, 'Release insulin until the glucose is normal.').join(' ')).toMatch(/gives the answer away/)
    expect(homeostasisEngine.promptFaults!(hot, 'Make the person sweat to cool down.').join(' ')).toMatch(/gives the answer away/)
    expect(homeostasisEngine.promptFaults!(type1, 'Inject insulin to bring it down.').join(' ')).toMatch(/gives the answer away/)
  })
})

describe('station routing', () => {
  it('catches the homeostasis stations and leaves the near misses to their own scenes', () => {
    for (const station of ['Homeostasis and negative feedback', 'Control of blood glucose', 'Insulin and glucagon', 'Type 1 diabetes', 'Control of body temperature', 'Temperature regulation']) {
      expect(sceneCatalogue(station), station).toContain('SCENE "homeostasis"')
    }
    for (const station of ['Nerve impulses and reflex arcs', 'The kidney and excretion', 'Enzymes and temperature: enzyme rate', 'Heat transfer in Physics: thermal transfer']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "homeostasis"')
    }
  })

  it('is registered, and its view reads no config constants at module top', () => {
    expect(getEngine('homeostasis')).toBe(homeostasisEngine)
    const source = readFileSync(`${process.cwd()}/lib/studylab/engines/homeostasis/View.tsx`, 'utf8')
    const top = source.slice(0, source.indexOf('function Scale'))
    expect(top).not.toMatch(/= .*\b(?:PARTICLES|GLUCOSE_BAND|TEMPERATURE_BAND|RESPONSE_MAX)\b/)
  })
})
