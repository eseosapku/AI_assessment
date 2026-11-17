// lib/studylab/engines/tree-diagrams/tree-diagrams.test.ts
import { describe as suite, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  treeEngine as E, strict, chanceOf, sameFrac, eqText, readState, captionText, goalText, handlingText, measureOf, verdictText, check, EXAMPLES, COLOURS,
  type TreeConfig, type TreeState,
} from './config'
import { TreeView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'

vi.spyOn(console, 'error').mockImplementation(() => {})

const [FIND_CHANCE, FIND_MOST, FIND_LEAST, CHOOSE] = EXAMPLES.map((e) => e.config)
const RB: [string, string] = ['red', 'blue']

const find = (extra: Partial<TreeConfig> = {}): TreeConfig => ({ kind: 'find', colours: RB, bag: [3, 2], put: 'out', goal: 'chance', chance: [1, 10], ...extra })
const choose = (extra: Partial<TreeConfig> = {}): TreeConfig => ({ kind: 'choose', colours: RB, bag: [3, 2], chance: [9, 25], pair: [0, 0], ...extra })
const st = (first: 0 | 1 | null, second: 0 | 1 | null, back = false, tried: TreeState['tried'] = []): TreeState => ({ first, back, second, tried })

/** Every valid config over a spread of colours, bags, handlings and targets. */
function allConfigs(): TreeConfig[] {
  const out: TreeConfig[] = []
  const colourPairs: [string, string][] = [RB, ['green', 'yellow'], ['yellow', 'red']]
  for (const colours of colourPairs) {
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        if (a + b < 3 || a + b > 9) continue
        const bag = [a, b]
        for (const put of ['out', 'back']) {
          for (const goal of ['most', 'least']) out.push({ kind: 'find', colours, bag, put, goal })
          const s = strict({ kind: 'find', colours, bag, put, goal: 'chance' })
          for (const [f, sec] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
            const c = chanceOf(s, f, sec, put === 'back')
            if (c.n > 0 && c.d <= 100) out.push({ kind: 'find', colours, bag, put, goal: 'chance', chance: [c.n, c.d] })
          }
        }
        for (const pair of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
          const s = strict({ kind: 'find', colours, bag, put: 'out', goal: 'chance' })
          for (const back of [false, true]) {
            const c = chanceOf(s, pair[0] as 0 | 1, pair[1] as 0 | 1, back)
            if (c.n > 0 && c.d <= 100) out.push({ kind: 'choose', colours, bag, pair, chance: [c.n, c.d] })
          }
        }
      }
    }
  }
  return out.filter((c) => E.faults(c).length === 0)
}

const render = (config: TreeConfig, state: TreeState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(TreeView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

suite('the chances', () => {
  it('reads the bag as the design says', () => {
    const s = strict(FIND_CHANCE)
    expect(chanceOf(s, 0, 0, false)).toEqual({ n: 6, d: 20 })
    expect(chanceOf(s, 1, 1, false)).toEqual({ n: 2, d: 20 })
    expect(chanceOf(s, 0, 0, true)).toEqual({ n: 9, d: 25 })
    expect(chanceOf(s, 1, 1, true)).toEqual({ n: 4, d: 25 })
    expect(chanceOf(s, 0, 1, false)).toEqual({ n: 6, d: 20 })
    expect(sameFrac({ n: 2, d: 20 }, { n: 1, d: 10 })).toBe(true)
    expect(eqText({ n: 2, d: 20 })).toBe('2/20 = 1/10')
    expect(eqText({ n: 9, d: 25 })).toBe('9/25')
  })

  it('has the four ends add up to 1 for any bag and handling', () => {
    for (const bag of [[3, 2], [4, 1], [2, 2], [6, 3]]) {
      const s = strict({ kind: 'find', colours: RB, bag, put: 'out', goal: 'most' })
      for (const back of [false, true]) {
        const sum = ([0, 1] as const).flatMap((f) => ([0, 1] as const).map((x) => chanceOf(s, f, x, back))).reduce((a, c) => a + c.n / c.d, 0)
        expect(sum).toBeCloseTo(1, 10)
      }
    }
  })
})

suite('every valid config starts unsolved and solves', () => {
  it('holds for every config', () => {
    const configs = allConfigs()
    expect(configs.length).toBeGreaterThan(300)
    for (const c of configs) {
      const tag = JSON.stringify(c)
      expect(E.check(c, E.initial(c)).ok, `starts solved ${tag}`).toBe(false)
      const s = E.solve(c)
      expect(E.check(c, s).ok, `cannot solve ${tag}`).toBe(true)
      expect(s.second, tag).not.toBeNull()
      expect(verdictText(c, s), tag).toBeTruthy()
      expect(E.parse(JSON.parse(JSON.stringify(c))), tag).toEqual(c)
      // The solving pair can really be drawn: the second counter exists after the first.
      const sc = strict(c)
      expect(chanceOf(sc, s.first!, s.second!, s.back).n, tag).toBeGreaterThan(0)
    }
  })

  it('is not solved by a half-drawn pair, and reads corrupt work as the start', () => {
    expect(E.check(FIND_CHANCE, st(1, null)).ok).toBe(false)
    expect(E.check(CHOOSE, st(0, null)).ok).toBe(false)
    expect(readState(null)).toEqual(st(null, null))
    expect(readState({ first: 5, second: 0, back: true, tried: [{ first: 9 }] } as unknown as TreeState)).toEqual(st(null, null))
    expect(readState({ first: null, second: 1 } as unknown as TreeState).second).toBeNull()
    expect(E.check(FIND_CHANCE, {} as TreeState).ok).toBe(false)
  })
})

suite('marking', () => {
  it('find chance: only the pair with that chance, and every tied pair', () => {
    expect(E.check(FIND_CHANCE, st(1, 1)).ok).toBe(true)
    for (const [a, b] of [[0, 0], [0, 1], [1, 0]] as const) expect(E.check(FIND_CHANCE, st(a, b)).ok).toBe(false)
    // 3/10 is shared by RR, RB and BR.
    const c = find({ chance: [3, 10] })
    expect(E.faults(c)).toEqual([])
    for (const [a, b] of [[0, 0], [0, 1], [1, 0]] as const) expect(E.check(c, st(a, b)).ok).toBe(true)
    expect(E.check(c, st(1, 1)).ok).toBe(false)
  })

  it('find most and least: ties all pass, and 0 is never the least', () => {
    expect(E.check(FIND_MOST, st(0, 1)).ok).toBe(true)
    expect(E.check(FIND_MOST, st(1, 0)).ok).toBe(true)
    expect(E.check(FIND_MOST, st(0, 0)).ok).toBe(false)
    expect(E.check(FIND_MOST, st(1, 1)).ok).toBe(false)
    expect(E.check(FIND_LEAST, st(1, 1, true)).ok).toBe(true)
    expect(E.check(FIND_LEAST, st(0, 0, true)).ok).toBe(false)
    // 4 red and 1 blue, kept out: BB cannot be drawn, so the least likely pair that can happen is RB (or BR) at 4/20.
    const c = find({ bag: [4, 1], goal: 'least', chance: undefined })
    expect(E.faults(c)).toEqual([])
    expect(E.check(c, st(0, 1)).ok).toBe(true)
    expect(E.check(c, st(1, 0)).ok).toBe(true)
    expect(E.check(c, st(0, 0)).ok).toBe(false)
  })

  it('find needs the handling the task fixes', () => {
    expect(E.check(FIND_CHANCE, st(1, 1, true)).ok).toBe(false)
    expect(E.check(FIND_LEAST, st(1, 1, false)).ok).toBe(false)
  })

  it('choose: the right pair with the handling that gives the chance', () => {
    expect(E.check(CHOOSE, st(0, 0, true))).toEqual({ ok: true, wrongIds: [] })
    expect(E.check(CHOOSE, st(0, 0, false))).toEqual({ ok: false, wrongIds: ['handling'] })
    expect(E.check(CHOOSE, st(0, 1, true))).toEqual({ ok: false, wrongIds: ['pair'] })
    expect(E.check(CHOOSE, st(1, 0, true)).ok).toBe(false)
    const kept = choose({ chance: [3, 10] })
    expect(E.faults(kept)).toEqual([])
    expect(E.check(kept, st(0, 0, false)).ok).toBe(true)
    expect(E.check(kept, st(0, 0, true)).ok).toBe(false)
    expect(E.solve(kept)).toEqual(st(0, 0, false))
    expect(E.solve(CHOOSE)).toEqual(st(0, 0, true))
  })

  it('solves find tasks with the first pair that passes, in order', () => {
    expect(E.solve(FIND_CHANCE)).toEqual(st(1, 1))
    expect(E.solve(FIND_MOST)).toEqual(st(0, 1))
    expect(E.solve(FIND_LEAST)).toEqual(st(1, 1, true))
  })
})

suite('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    for (const c of [FIND_CHANCE, FIND_MOST, FIND_LEAST, CHOOSE]) expect(E.parse(JSON.parse(JSON.stringify(c)))).toEqual(c)
    expect(E.parse({ kind: 'find', put: 'without replacement', goal: 'chance', chance: '1/10' })).toEqual(FIND_CHANCE)
    expect(E.parse({ kind: 'find', replacement: true, goal: 'least likely' })).toEqual(FIND_LEAST)
    expect(E.parse({ kind: 'find', colours: ['Green', 'Yellow'], bag: { green: 2, yellow: 2 }, put: 'out', goal: 'most likely' })).toEqual(FIND_MOST)
    expect(E.parse({ kind: 'choose', pair: ['red', 'red'], chance: { n: 9, d: 25 } })).toEqual(CHOOSE)
    expect(E.parse({ pair: [0, 0], chance: [9, 25] })).toEqual(CHOOSE)
    expect(E.parse({ goal: 'most', colours: ['green', 'yellow'], bag: [2, 2] })).toEqual({ ...FIND_MOST, put: 'out' })
    expect(E.parse(null)).toBeNull()
    expect(E.parse('tree')).toBeNull()
    expect(E.parse([])).toBeNull()
  })

  it('refuses what cannot be drawn, with a nearby one that works', () => {
    const f = (raw: unknown) => E.faults(E.parse(raw)!)
    expect(f({ kind: 'find', colours: ['red', 'red'], chance: [1, 10] })[0]).toMatch(/two different colours.*"colours":\["red","blue"\]/)
    expect(f({ kind: 'find', colours: ['red', 'pink'] })[0]).toMatch(/two different colours/)
    expect(f({ kind: 'find', bag: [8, 2], chance: [1, 10] })[0]).toMatch(/"bag":\[6,2\]/)
    expect(f({ kind: 'find', bag: [5, 5], chance: [1, 10] })[0]).toMatch(/not \[5,5\].*"bag":\[4,5\]/)
    expect(f({ kind: 'find', bag: [1, 1], chance: [1, 10] })[0]).toMatch(/"bag":\[2,1\]/)
    expect(f({ kind: 'find', pair: [0, 0], chance: [1, 10] })[0]).toMatch(/the pair is the answer/)
    expect(f({ kind: 'choose', put: 'back', pair: [0, 0], chance: [9, 25] })[0]).toMatch(/takes no "put"/)
    expect(f({ kind: 'choose', goal: 'most', pair: [0, 0], chance: [9, 25] })[0]).toMatch(/not "most"/)
    expect(f({ kind: 'choose', pair: [0, 0] })[0]).toMatch(/needs both/)
    expect(f({ kind: 'choose', chance: [9, 25] })[0]).toMatch(/needs both/)
    expect(f({ kind: 'find', chance: [10, 10] })[0]).toMatch(/"chance":\[1,10\]/)
    expect(f({ kind: 'find', chance: [1, 200] })[0]).toMatch(/whole numbers/)
    expect(f({ kind: 'find', goal: 'chance' })[0]).toMatch(/needs "chance"/)
    expect(f({ kind: 'find', chance: [9, 25] })[0]).toMatch(/put":"back"/)
    expect(f({ kind: 'find', chance: [9, 25], put: 'back' })).toEqual([])
    expect(f({ kind: 'find', chance: [3, 10] })).toEqual([])
    expect(f({ kind: 'find', bag: [2, 2], put: 'back', chance: [1, 4] })[0]).toMatch(/Every pair .* chance of 1\/4/)
    expect(f({ kind: 'find', bag: [3, 1], put: 'out', goal: 'most' })).toEqual([])
    expect(f({ kind: 'choose', pair: [0, 0], chance: [1, 2] })[0]).toMatch(/9\/25.*3\/10/)
    expect(f({ kind: 'choose', pair: [0, 0], chance: [3, 10] })).toEqual([])
    expect(f({ kind: 'find', put: 'sideways', chance: [1, 10] })[0]).toMatch(/"put" is "out" or "back"/)
    expect(f({ kind: 'dice' })[0]).toMatch(/Only two tasks/)
    expect(E.check({ kind: 'other', colours: RB, bag: [3, 2] }, st(0, 0)).ok).toBe(false)
  })
})

suite('prompts', () => {
  it('catches working shown', () => {
    for (const t of ['Take two counters out. Work out 3/5 × 2/4.', 'Multiply: 3/5 times 2/4.', 'Find 3 x 2 over 20.', 'Use 3/5 x 2/4 to find it.'])
      expect(E.promptFaults!(FIND_CHANCE, t).join(' '), t).toMatch(/gives the answer away/)
  })

  it('catches find prompts that name the answer pair', () => {
    for (const t of ['Take red then blue.', 'Find two blues.', 'Take both red counters.', 'Draw a red and a blue.', 'Take out blue, then blue.', 'Find red and blue.'])
      expect(E.promptFaults!(FIND_CHANCE, t).join(' '), t).toMatch(/gives the answer away/)
    for (const t of ['Take one of each colour.', 'Take two different colours.', 'Find a mixed pair.']) expect(E.promptFaults!(FIND_MOST, t).join(' '), t).toMatch(/gives the answer away/)
    expect(E.promptFaults!(FIND_LEAST, 'Take two of the same colour.').join(' ')).toMatch(/gives the answer away/)
  })

  it('catches a find most or least prompt that states a pair\'s chance', () => {
    expect(E.promptFaults!(FIND_MOST, 'Find a pair with chance 1/3.').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(FIND_MOST, 'Find a pair with chance 1/5.').join(' ')).toBe('')
    expect(E.promptFaults!(FIND_LEAST, 'Find the least likely pair out of 4/25.').join(' ')).toMatch(/gives the answer away/)
    // A chance goal names its own chance: that is the task.
    expect(E.promptFaults!(FIND_CHANCE, 'Find the pair with a chance of 1/10.')).toEqual([])
  })

  it('catches choose prompts that settle the handling', () => {
    for (const t of ['Use replacement.', 'The first counter is replaced.', 'Put it back first.', 'Put back the first.', 'Keep it out.', 'The first is kept out.', 'The counter stays out.', 'The counter goes back.', 'Return it.'])
      expect(E.promptFaults!(CHOOSE, t).join(' '), t).toMatch(/gives the answer away/)
    // Naming the pair is the task for choose.
    expect(E.promptFaults!(CHOOSE, 'Take out red, then red. Decide what to do with the first counter so that two reds have a chance of 9/25.')).toEqual([])
    // A find prompt may say the handling.
    expect(E.promptFaults!(FIND_LEAST, 'Take a counter, put it back, then take another.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('tree-diagrams')!
    expect(e).toBe(E)
    expect(EXAMPLES).toHaveLength(4)
    for (const { prompt, config } of EXAMPLES) {
      expect(e.prompt).toContain(JSON.stringify(config))
      expect(e.prompt).toContain(prompt)
      const parsed = e.parse(JSON.parse(JSON.stringify(config)))!
      expect(parsed).toEqual(config)
      expect(e.faults(parsed), prompt).toEqual([])
      expect(e.promptFaults!(parsed, prompt), prompt).toEqual([])
      expect(e.check(parsed, e.initial(parsed)).ok).toBe(false)
      expect(e.check(parsed, e.solve(parsed)).ok).toBe(true)
    }
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].map((m) => m[1])).toEqual(['consequence'])
    expect(e.isolates).toBe('consequence')
  })
})

suite('the words on the card', () => {
  it('says the goal, the handling and the live measure', () => {
    expect(goalText(FIND_CHANCE)).toBe('Find the pair with a chance of 1/10')
    expect(goalText(FIND_MOST)).toBe('Find a most likely pair')
    expect(goalText(FIND_LEAST)).toBe('Find a least likely pair')
    expect(goalText(CHOOSE)).toBe('Red then red, with a chance of 9/25')
    expect(handlingText(FIND_CHANCE)).toBe('The first counter stays out.')
    expect(handlingText(FIND_LEAST)).toBe('The first counter goes back.')
    expect(handlingText(CHOOSE)).toBe('You decide if the first goes back.')
    expect(measureOf(CHOOSE, st(null, null)).value).toBe('Nothing taken yet')
    expect(measureOf(CHOOSE, st(0, null)).value).toBe('3/5')
    expect(measureOf(CHOOSE, st(0, 0, false)).value).toBe('3/5 × 2/4 = 6/20')
    expect(measureOf(CHOOSE, st(0, 0, true)).value).toBe('3/5 × 3/5 = 9/25')
    expect(measureOf(CHOOSE, st(0, 0)).label).toBe('Chance of these draws')
  })

  it('has a caption for each state, with no verdict in it', () => {
    expect(captionText(FIND_CHANCE, st(null, null))).toBe('The bag holds 3 red and 2 blue counters. Take one out.')
    expect(captionText(FIND_CHANCE, st(0, null))).toBe('3 of the 5 were red, so the first branch is 3/5. 4 are left, and the next branches come from them.')
    expect(captionText(FIND_LEAST, st(0, null))).toMatch(/Put it back before the next draw/)
    expect(captionText(CHOOSE, st(0, null))).toMatch(/without it. You may put it back/)
    expect(captionText(CHOOSE, st(0, null, true))).toBe('The bag is whole again, so the next branches match the first ones.')
    expect(captionText(CHOOSE, st(0, 0, true))).toBe('The second draw kept 3/5 of the 3/5 piece. The chance of the pair is the product.')
    expect(captionText(FIND_CHANCE, st(0, 0))).toBe('The second draw kept 2/4 of the 3/5 piece. The chance of the pair is the product.')
    expect(captionText(find({ bag: [3, 1], goal: 'most', chance: undefined }), st(1, null))).toMatch(/No blue is left, so that branch is 0/)
    for (const c of allConfigs().filter((_, i) => i % 9 === 0)) {
      for (const s of [E.initial(c), st(0, null), st(1, null, true), E.solve(c)]) {
        expect(captionText(c, s), JSON.stringify(c)).not.toMatch(/\b(?:correct|incorrect|wrong|right|solved)\b/i)
      }
    }
  })

  it('says the verdicts from the design', () => {
    expect(verdictText(FIND_CHANCE, st(1, 1))).toBe('Blue then blue has a chance of 2/20 = 1/10, the chance asked for.')
    expect(verdictText(FIND_CHANCE, st(0, 0))).toBe('Red then red has a chance of 6/20 = 3/10, not 1/10. Try another pair.')
    expect(verdictText(FIND_MOST, st(0, 1))).toBe('Green then yellow has a chance of 4/12 = 1/3. No pair is more likely. Yellow then green ties it.')
    expect(verdictText(FIND_MOST, st(0, 0))).toBe('Green then green has a chance of 2/12 = 1/6, but green then yellow has 4/12 = 1/3, which is more likely.')
    expect(verdictText(FIND_LEAST, st(1, 1, true))).toBe('Blue then blue has a chance of 4/25. No pair is less likely.')
    expect(verdictText(FIND_LEAST, st(0, 0, true))).toBe('Red then red has a chance of 9/25, but red then blue has 6/25, which is less likely.')
    expect(verdictText(CHOOSE, st(0, 0, true))).toBe('Put back, the bag is whole again: 3 of 5 are red, so red then red has 3/5 × 3/5 = 9/25.')
    expect(verdictText(choose({ chance: [3, 10] }), st(0, 0, false))).toBe('Kept out, 2 of the 4 left are red, so red then red has 3/5 × 2/4 = 6/20 = 3/10.')
    expect(verdictText(CHOOSE, st(0, 0, false))).toBe('Kept out, this pair has 3/5 × 2/4 = 6/20 = 3/10, not 9/25. Putting it back leaves 3 of 5 red.')
    expect(verdictText(CHOOSE, st(0, 1, true))).toMatch(/not the pair the goal asks for/)
    expect(verdictText(CHOOSE, st(null, null))).toMatch(/No pair has been drawn/)
    expect(check(CHOOSE, st(0, 0, true)).ok).toBe(true)
  })
})

suite('catalogue matching', () => {
  it('is offered for trees, and not for its neighbours', () => {
    for (const station of ['Tree diagrams', 'Probability trees', 'Probability tree diagrams', 'Combined events', 'With and without replacement', 'Conditional probability', 'Independent events']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('tree-diagrams')
      expect(sceneCatalogue(station), station).toContain('SCENE "tree-diagrams"')
    }
    for (const station of ['Factor trees', 'Family trees', 'Decision trees', 'Binary trees', 'Evolutionary trees', 'Sample space diagrams', 'Venn diagrams', 'Two-way tables', 'Relative frequency']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('tree-diagrams')
    }
    expect(COLOURS).toHaveLength(4)
  })
})

suite('the card', () => {
  it('renders every task with no answer before marking, on the server', () => {
    for (const config of allConfigs().filter((_, i) => i % 11 === 0)) {
      for (const state of [E.initial(config), st(0, null), E.solve(config)]) {
        const html = render(config, state)
        expect(html).toContain('Goal')
        expect(html).toContain('Chance of these draws')
        expect(html).not.toMatch(/data-done/)
        const words = html.replace(/ class="[^"]*"/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')
        expect(words).not.toMatch(/\b(?:correct|incorrect|wrong|right|solved|well done)\b/i)
        expect(words).not.toMatch(/the chance asked for|ties it|is not the pair|more likely\.|less likely\./)
        expect(html).toContain('aria-label="Put every counter back and start again"')
        expect(html.includes('aria-label="Put the first counter back in the bag"')).toBe(config.kind === 'choose' || config.put === 'back')
      }
    }
    const first = render(FIND_CHANCE, E.initial(FIND_CHANCE))
    expect(first).toContain('aria-label="Take a red counter out of the bag"')
    expect(first).toContain('aria-label="Take a blue counter out of the bag"')
    expect(first).toContain('Nothing taken yet')
  })

  it('disables what cannot be done', () => {
    const disabled = (html: string, label: string) => new RegExp(`<button[^>]*aria-label="${label}"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="${label}"`).test(html)
    const start = render(FIND_LEAST, E.initial(FIND_LEAST))
    expect(disabled(start, 'Put every counter back and start again')).toBe(true)
    expect(disabled(start, 'Put the first counter back in the bag')).toBe(true)
    expect(disabled(start, 'Take a red counter out of the bag')).toBe(false)
    // find + back: the first counter is out and not back yet, so no second draw.
    const out = render(FIND_LEAST, st(0, null))
    expect(disabled(out, 'Take a red counter out of the bag')).toBe(true)
    expect(disabled(out, 'Take a blue counter out of the bag')).toBe(true)
    expect(disabled(out, 'Put the first counter back in the bag')).toBe(false)
    expect(disabled(render(FIND_LEAST, st(0, null, true)), 'Take a blue counter out of the bag')).toBe(false)
    // Two counters out: no more draws, and no put back.
    const two = render(CHOOSE, st(0, 0, true))
    expect(disabled(two, 'Take a red counter out of the bag')).toBe(true)
    expect(disabled(two, 'Put the first counter back in the bag')).toBe(true)
    expect(disabled(two, 'Put every counter back and start again')).toBe(false)
    // None of a colour left.
    const none = render(find({ bag: [3, 1], goal: 'most', chance: undefined }), st(1, null))
    expect(disabled(none, 'Take a blue counter out of the bag')).toBe(true)
    expect(disabled(none, 'Take a red counter out of the bag')).toBe(false)
    // Kept out in a choose task: the second draw is open.
    expect(disabled(render(CHOOSE, st(0, null)), 'Take a red counter out of the bag')).toBe(false)
  })

  it('shows the verdict once marked, and locks the buttons', () => {
    const right = render(FIND_CHANCE, E.solve(FIND_CHANCE), 'right')
    expect(right).toContain('the chance asked for')
    expect(right).toContain('data-done="1"')
    expect(right).toContain('disabled=""')
    const wrong = render(FIND_CHANCE, st(0, 0), 'wrong')
    expect(wrong).toContain('not 1/10')
    expect(wrong).toContain('data-done="0"')
    const shown = render(CHOOSE, E.initial(CHOOSE), 'shown')
    expect(shown).toContain('9/25')
    expect(shown).toContain('data-done="1"')
  })

  it('still renders with reduced motion and with an unreadable config', () => {
    expect(render(CHOOSE, st(0, 0, true), 'idle', true)).toContain('3/5 × 3/5 = 9/25')
    expect(render({ kind: 'other', colours: RB, bag: [3, 2] }, st(null, null))).toBe('')
    expect(render({ kind: 'find', colours: RB, bag: [9, 9] }, st(null, null))).toBe('')
  })
})
