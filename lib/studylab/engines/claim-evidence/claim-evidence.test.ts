// lib/studylab/engines/claim-evidence/claim-evidence.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  claimEvidenceEngine as engine, DEG_PER_UNIT, GOOD_PROMPT, MAX_CARD_TEXT, MAX_CARDS, MAX_CLAIM, MAX_NEITHER, MAX_TILT, MIN_CARDS,
  displayOrder, madeText, putOf, tiltOf, weightOn, working, type ArgConfig, type ArgState, type Card, type Side,
} from './config'
import { ClaimEvidenceView, H, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const mk = (text: string, side: Side, strength = 2): Card => ({ text, side, strength })
const RATION: ArgConfig = {
  claim: 'Rationing was the best way to feed Britain in the war.',
  cards: [
    mk('Every family got the same weekly food amounts', 'for', 3), mk('Rationed families ate more vegetables', 'for', 2), mk('A black market sold extra food to the rich', 'against', 2),
    mk('Ration books were printed in 1939', 'neither', 1), mk('Bread was never rationed', 'against', 1), mk('Farmers grew more food on every field', 'for', 1),
  ],
}

/** Every valid config shape: each count of cards, each split of sides, each strength pattern. */
const SIDES: Side[] = ['for', 'against', 'neither']
function allConfigs(): ArgConfig[] {
  const out: ArgConfig[] = []
  for (let n = MIN_CARDS; n <= MAX_CARDS; n++) {
    for (let code = 0; code < 3 ** n; code++) {
      const cards: Card[] = []
      for (let i = 0, c = code; i < n; i++, c = Math.floor(c / 3)) cards.push(mk(`Evidence number ${i + 1} of the case`, SIDES[c % 3], 1 + ((code + i) % 3)))
      const cfg = { claim: 'A claim worth arguing about.', cards }
      if (engine.faults(cfg).length === 0) out.push(cfg)
    }
  }
  return out
}

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, starts unsolved, and can be solved', () => {
    const all = allConfigs()
    expect(all.length).toBeGreaterThan(200)
    for (const c of all) {
      expect(engine.parse(c)).toEqual(c)
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
      expect(engine.check(c, engine.solve(c)).wrongIds).toEqual([])
    }
  })

  it('a card that bears on nothing is right off the scale and wrong on either pan', () => {
    const s = engine.solve(RATION)
    expect(s.put[3]).toBeNull()
    for (const pan of ['for', 'against'] as const) {
      const bad = { put: s.put.map((p, i) => (i === 3 ? pan : p)) }
      expect(engine.check(RATION, bad)).toEqual({ ok: false, wrongIds: ['3'] })
    }
  })

  it('any single card on the wrong pan is wrong, and a state that could not be made is read safely', () => {
    const s = engine.solve(RATION)
    s.put.forEach((p, i) => {
      if (p === null) return
      const bad = { put: s.put.map((q, j) => (j === i ? (p === 'for' ? 'against' : 'for') : q)) } as ArgState
      expect(engine.check(RATION, bad).wrongIds).toEqual([String(i)])
    })
    expect(engine.check(RATION, null as never).ok).toBe(false)
    expect(engine.check(RATION, { put: 'x' } as never).ok).toBe(false)
    expect(putOf(RATION, { put: ['for', 'nonsense', 5] as never })).toEqual(['for', null, null, null, null, null])
  })
})

describe('the balance', () => {
  it('tips towards the heavier pan, level when equal, and never past the stops', () => {
    expect(Math.abs(tiltOf(RATION, engine.initial(RATION)))).toBe(0)
    expect(tiltOf(RATION, { put: ['for', null, null, null, null, null] })).toBeLessThan(0)
    expect(tiltOf(RATION, { put: [null, null, 'against', null, null, null] })).toBeGreaterThan(0)
    expect(Math.abs(tiltOf(RATION, { put: [null, 'for', 'against', null, null, null] }))).toBe(0)
    for (const c of allConfigs().slice(0, 300)) {
      for (const s of [engine.solve(c), { put: c.cards.map(() => 'for') } as ArgState, { put: c.cards.map(() => 'against') } as ArgState]) {
        expect(Math.abs(tiltOf(c, s))).toBeLessThanOrEqual(MAX_TILT)
      }
    }
  })

  it('sums strength on each pan', () => {
    const s = engine.solve(RATION)
    expect(weightOn(RATION, s, 'for')).toBe(6)
    expect(weightOn(RATION, s, 'against')).toBe(3)
  })

  it('a first card of any strength tips the beam by a clear angle', () => {
    for (const strength of [1, 2, 3]) {
      const c: ArgConfig = { claim: 'x', cards: [mk('a', 'for', strength), mk('b', 'against', 2), mk('c', 'for', 1), mk('d', 'against', 1)] }
      expect(Math.abs(tiltOf(c, { put: ['for', null, null, null] }))).toBeGreaterThanOrEqual(DEG_PER_UNIT)
    }
  })
})

describe('what is said once marked', () => {
  it('says the totals and that weighing is a judgement, and never marks the verdict', () => {
    const said = working(RATION)
    expect(said.startsWith('Yes.')).toBe(true)
    expect(said).toContain('6 to 3')
    expect(said).toContain('judgement')
    expect(working({ ...RATION, cards: RATION.cards.map((c) => ({ ...c, side: c.side === 'for' ? 'against' : c.side })) })).toContain('against the claim')
  })

  it('says what was made when wrong, without saying which card', () => {
    const t = madeText(RATION, { put: ['against', 'for', null, null, null, null] })
    expect(t).toMatch(/not where the evidence puts/)
    expect(t).not.toMatch(/Card \d|Yes\./)
    expect(madeText(RATION, engine.initial(RATION))).toBe('Nothing is on the scale yet.')
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    const a = engine.parse({ statement: 'Cats are better than dogs', evidence: [{ card: 'Cats clean themselves', bearing: 'supports', weight: 'strong' }, { text: 'Dogs can be trained', side: 'against' }, { text: 'Cats sleep a lot', side: 'Pro' }, { text: 'Fish are cold', side: 'irrelevant', strength: '1' }] })
    expect(a).toEqual({ claim: 'Cats are better than dogs', cards: [mk('Cats clean themselves', 'for', 3), mk('Dogs can be trained', 'against', 2), mk('Cats sleep a lot', 'for', 2), mk('Fish are cold', 'neither', 1)] })
    const b = engine.parse({ claim: 'X', supports: ['a', 'b'], against: [{ text: 'c', strength: 3 }], neither: ['d'] })
    expect(b!.cards.map((c) => c.side)).toEqual(['for', 'for', 'against', 'neither'])
    expect(b!.cards[2].strength).toBe(3)
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, 'x', {}, { claim: '' }, { claim: 'x' }, { claim: 'x', cards: 'a' }, { claim: 'x', cards: ['plain string'] }, { claim: 'x', cards: [{ text: 'a' }] }, { claim: 'x', cards: [{ text: 'a', side: 'maybe' }] }, { claim: 5, cards: [] }]) {
      expect(engine.parse(bad as never)).toBeNull()
    }
    expect(engine.parse({ claim: 'x', cards: [{ text: 'a', side: 'for', strength: 9 }] })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, with a nearby example', () => {
    const f = (c: ArgConfig) => engine.faults(c)
    expect(f({ claim: 'x'.repeat(MAX_CLAIM + 1), cards: RATION.cards })[0]).toMatch(/shorten it/)
    expect(f({ claim: 'x', cards: RATION.cards.slice(0, 2) }).join(' ')).toMatch(/too few.*4 to 6.*e\.g\./)
    expect(f({ claim: 'x', cards: [...RATION.cards, mk('another', 'for')] }).join(' ')).toMatch(/more than the scale holds/)
    expect(f({ claim: 'x', cards: RATION.cards.map((c) => ({ ...c, side: 'for' as Side })) }).join(' ')).toMatch(/none opposes/)
    expect(f({ claim: 'x', cards: [mk('a', 'for'), mk('b', 'against'), mk('c', 'neither'), mk('d', 'neither'), mk('e', 'neither')] }).join(' ')).toMatch(/at most 2/)
    expect(f({ claim: 'x', cards: [mk('a'.repeat(MAX_CARD_TEXT + 1), 'for'), mk('b', 'against'), mk('c', 'for'), mk('d', 'against')] }).join(' ')).toMatch(/Card 1 is/)
    expect(f({ claim: 'x', cards: [mk('a', 'for', 7), mk('b', 'against'), mk('c', 'for'), mk('d', 'against')] }).join(' ')).toMatch(/strength 7/)
    expect(f({ claim: 'x', cards: [mk('same', 'for'), mk('Same', 'against'), mk('c', 'for'), mk('d', 'against')] }).join(' ')).toMatch(/same thing/)
    expect(f(RATION)).toEqual([])
    expect(MAX_NEITHER).toBe(2)
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (p: string) => engine.promptFaults!(RATION, p)
  it('asking for the task is fine', () => {
    expect(pf(GOOD_PROMPT)).toEqual([])
    expect(pf('Tap a card, then tap a pan. Does the evidence build the case for rationing, or against it?')).toEqual([])
  })
  it('how many, which way it tips, or that a card is irrelevant is not', () => {
    for (const p of ['Three cards support the claim. Tap each onto a pan.', 'The evidence mostly supports rationing: sort it.', 'One card is irrelevant. Find it.', 'Two of the cards are against it.', 'So the claim is true; tap the cards.']) {
      expect(pf(p), p).toHaveLength(1)
    }
  })
  it('what the card does not do is refused', () => {
    for (const p of ['Drag each card onto a pan.', 'Write a PEEL paragraph.', 'Pick the strongest card.', 'Order the cards.']) {
      expect(pf(p), p).toHaveLength(1)
      expect(pf(p)[0]).toMatch(/does not do/)
    }
  })
  it('passes the example in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"claim-evidence", "config": (\{[\s\S]*?\] \}) \}/g)]
    expect(found.length).toBe(1)
    const c = engine.parse(JSON.parse(found[0][2]))!
    expect(c).not.toBeNull()
    expect(engine.faults(c)).toEqual([])
    expect(engine.promptFaults!(c, found[0][1])).toEqual([])
    expect(found[0][1]).toBe(GOOD_PROMPT)
    expect(engine.check(c, engine.initial(c)).ok).toBe(false)
    const top = engine.prompt.match(/config: (\{ "claim"[\s\S]*?\] \})/)![1]
    expect(engine.faults(engine.parse(JSON.parse(top))!)).toEqual([])
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "claim-evidence"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'claim-evidence')
  it('is offered for the stations it is made for', () => {
    for (const st of ['Building an argument', 'Claim, evidence and reasoning', 'Evidence for and against', 'Writing a PEEL paragraph', 'Communication: writing the essay', 'Weighing the evidence', 'Arguments for and against the Treaty of Versailles', 'Rebuttals and counterarguments']) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })
  it('is not offered for other uses of the words', () => {
    for (const st of ['Function arguments in Python', 'Arguments and parameters', 'The argument of a complex number', 'Modulus and argument', 'Command-line arguments', 'Evidence for evolution', 'Evidence for plate tectonics', 'Fossil evidence', 'Forensic evidence', 'Insurance claims', 'Land claims', 'Peeling an orange', 'Peel Commission', 'Logical arguments and validity', 'Cause and consequence', 'Source provenance and reliability', 'Evidence of climate change']) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })
  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('claim-evidence')).toBe(engine)
    expect(engine.isolates).toBe('category')
    expect(engine.prompt).toMatch(/SCENE "claim-evidence"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:claim-evidence"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    expect(engine.prompt).toContain(`${MIN_CARDS} to ${MAX_CARDS} pieces`)
    expect(engine.prompt).toContain(`up to ${MAX_CARD_TEXT} characters`)
    expect(engine.prompt).toContain(`up to ${MAX_CLAIM} characters`)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'claim-evidence', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (state: ArgState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(ClaimEvidenceView, { config: RATION, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says which pan a card belongs on, or the verdict', () => {
    const html = card(RATION, GOOD_PROMPT)
    const shown = text(html.replace(GOOD_PROMPT, '')) + ' ' + attrs(html)
    for (const secret of ['Yes', 'Off topic', 'judgement', 'tips towards the claim', 'not where the evidence']) expect(shown, secret).not.toContain(secret)
  })

  it('the tab order follows a shuffle, not the tutor’s order or the sides', () => {
    const order = displayOrder(RATION)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5])
    expect(order).toEqual(displayOrder(RATION))
    expect(order).not.toEqual([0, 1, 2, 3, 4, 5])
    const sides = order.map((i) => RATION.cards[i].side)
    expect(sides).not.toEqual([...sides].sort())
    const labels = [...raw(engine.initial(RATION), 'idle').matchAll(/data-card="(\d)"/g)].map((m) => Number(m[1]))
    expect(labels).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('every control is a real button with a label, and locks when solved', () => {
    const idle = raw(engine.initial(RATION), 'idle')
    const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
    expect(buttons.length).toBe(7)
    for (const m of buttons) expect(m[0]).toContain('type="button"')
    expect(idle).toContain('nodrag')
    expect([...raw(engine.solve(RATION), 'right').matchAll(/<button[^>]*disabled/g)].length).toBe(6)
  })

  it('marking names each card’s side and says the totals; wrong says only what was made', () => {
    const right = text(raw(engine.solve(RATION), 'right'))
    expect(right).toContain('Yes. Every card is on its side.')
    expect(right).toContain('Off topic')
    expect(right).toContain('6 to 3')
    const wrong = text(raw({ put: ['against', null, null, null, null, null] }, 'wrong'))
    expect(wrong).toContain('not where the evidence puts')
    expect(wrong).not.toContain('Off topic')
  })

  it('showing the answer draws the answer', () => {
    const html = raw(engine.initial(RATION), 'shown')
    expect(html).toContain('data-beam="-')
    expect(html).toContain('data-tile="6"')
    expect(text(html)).toContain('6 to 3')
  })

  it('the beam turns with each card, with nothing animating under reduced motion', () => {
    const first = raw(engine.initial(RATION), 'idle', true)
    expect(first).not.toMatch(/transition:\s*[a-z]/)
    const a = raw({ put: ['for', null, null, null, null, null] }, 'idle', true)
    const b = raw({ put: [null, null, 'against', null, null, null] }, 'idle', true)
    expect(a).not.toBe(first)
    expect(b).not.toBe(first)
    expect(a).not.toBe(b)
    expect(a).toMatch(/data-beam="-/)
    expect(raw(engine.initial(RATION), 'idle', false)).toMatch(/transition:transform 900ms/)
  })

  it('tells a screen reader what is on the scale, never which side a card is meant for', () => {
    const live = raw({ put: ['for', null, 'against', null, null, null] }, 'idle')
    expect(attrs(live)).toContain('1 card is on the supporting pan and 1 on the opposing pan')
    expect(attrs(live)).toContain('On the supporting pan')
    expect(attrs(live)).toContain('Not on the scale')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(marked === 'right' ? engine.solve(RATION) : engine.initial(RATION), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('agrees with what the view writes out as literals, and six strong cards fit a pan', () => {
    expect(raw(engine.initial(RATION), 'idle')).toContain(`viewBox="0 0 ${W} ${H}"`)
    expect(W).toBe(360)
    // Three columns of 34 px with 3 px gaps fit a 108 px dish; two rows of the tallest block (24 px + 3) fit in a 58 px cord.
    expect(3 * 34 + 2 * 3).toBeLessThanOrEqual(108)
    expect(2 * 27).toBeLessThanOrEqual(58)
    expect(MAX_CARDS).toBe(6)
    expect(() => raw({ put: RATION.cards.map(() => 'for') } as ArgState, 'idle')).not.toThrow()
  })
})
