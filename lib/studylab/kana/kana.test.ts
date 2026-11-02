// lib/studylab/kana/kana.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Kana } from '@/components/studylab/kana/Kana'
import { flightPoint, poseProps, type KanaPose } from './poses'

const render = (p = {}) => renderToStaticMarkup(createElement(Kana, { size: 160, ...p }))
const POSES: KanaPose[] = ['happy', 'open', 'wink', 'think', 'talking', 'surprised', 'sleepy', 'wave', 'point', 'fly', 'celebrate', 'concerned']
// The brand blues, ink and white. The blush is the one warm note, and it is the spec's own (celebrate).
const BRAND = ['#2acbf2', '#14a9ea', '#0e92d6', '#0c86ce', '#0b7cc4', '#0a6aa8', '#0f3a5c', '#ffffff']
const BLUSH = '#ff9aa2'

describe('Kana', () => {
  it.each(POSES)('%s draws, in brand colours only, with no brain', (pose) => {
    const html = render({ pose }).toLowerCase()
    expect(html).toContain('<svg')
    expect(html).not.toMatch(/brain|badge/)
    for (const hex of html.match(/#[0-9a-f]{6}/g) ?? []) if (hex !== BLUSH) expect(BRAND).toContain(hex)
    expect(html.includes(BLUSH)).toBe(pose === 'celebrate')
  })

  it('two Kanas on a page do not share gradient ids', () => {
    const html = renderToStaticMarkup(createElement('div', null, createElement(Kana), createElement(Kana)))
    const all = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
    expect(all.length).toBeGreaterThan(0)
    expect(new Set(all).size).toBe(all.length)
  })

  it('wears the suit and the four-tile pin, and small sizes drop that detail', () => {
    expect(render()).toContain('data-part="pin"')
    expect(render({ simple: true })).not.toContain('data-part="pin"')
    expect(render({ simple: true }).length).toBeLessThan(render().length)
  })

  it('raises a wing only when asked, by name or by amount', () => {
    expect(render({ wing: 'down' })).not.toContain('data-part="wing-raised-right"')
    expect(render({ wing: 'up' })).toContain('data-part="wing-raised-right"')
    expect(render({ wingT: 0.5 })).toContain('data-part="wing-raised-right"')
    expect(render({ wingL: 1 })).toContain('data-part="wing-raised-left"')
  })

  it('moves only when given time, so reduced motion is simply no t', () => {
    expect(render({ pose: 'open' })).toBe(render({ pose: 'open' }))
    expect(render({ pose: 'open', t: 1 })).not.toBe(render({ pose: 'open', t: 2 }))
  })

  it('blinks open eyes on the rig\'s beat', () => {
    expect(render({ eyes: 'open', t: 3.4 - 1.3 + 0.05 })).toContain('data-part="blink"')
    expect(render({ eyes: 'open', t: 1 })).not.toContain('data-part="blink"')
  })
})

describe('poses', () => {
  it('match the spec', () => {
    expect(poseProps('celebrate')).toMatchObject({ eyes: 'happy', wingT: 1, wingL: 1, blush: true })
    expect(poseProps('point').look).toMatchObject({ x: 1 })
    expect(poseProps('concerned').tilt).toBeLessThan(0)
    expect(poseProps('fly')).toMatchObject({ flap: true })
    expect(poseProps('talking')).toMatchObject({ talking: true })
  })

  it('a flight arcs above both ends and lands exactly', () => {
    const a = { x: 0, y: 100 }, b = { x: 400, y: 200 }
    expect(flightPoint(a, b, 0)).toEqual(a)
    expect(flightPoint(a, b, 1)).toEqual(b)
    expect(flightPoint(a, b, 0.5).y).toBeLessThan(100)
  })
})
