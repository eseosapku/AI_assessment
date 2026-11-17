// lib/studylab/engines/figurative-language/figurative-language.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  figurativeEngine as engine, SCENES, SCENE_DATA, TASKS, carriedOf, done, endingOf, fitsOf, looksOf, madeLines, madeText, picturedOf, sentenceOf, working,
  type FigConfig, type FigState, type SceneName,
} from './config'
import { FigurativeView, H, LAKE, LEAF_SCALE, LEAVES, W, foldFlap, leafPose, leafTarget } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const ALL: FigConfig[] = TASKS.flatMap((task) => SCENES.map((scene) => ({ task, scene })))
const nameOf = (c: FigConfig) => JSON.stringify(c)
const carry = (scene: SceneName): FigConfig => ({ task: 'carry', scene })
const write = (scene: SceneName): FigConfig => ({ task: 'write', scene })

/** Every state the learner can reach: each set of cards carried, or each ending (or none). */
function everyState(c: FigConfig): FigState[] {
  const s = SCENE_DATA[c.scene as SceneName]
  if (c.task === 'write') return [{ ending: null }, ...s.endings.map((e) => ({ ending: e.id }))]
  const ids = s.qualities.map((q) => q.id)
  return Array.from({ length: 1 << ids.length }, (_, bits) => ({ carried: ids.filter((_, i) => bits & (1 << i)) }))
}

const raw = (config: FigConfig, state: FigState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(FigurativeView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
const svgOf = (html: string) => html.match(/<svg viewBox="0 0 360[\s\S]*?<\/svg>/)![0]

describe('the scenes, from the subject', () => {
  it('each device is what its sentence is', () => {
    const lake = SCENE_DATA.lake
    expect(lake.device).toBe('simile')
    expect(lake.figure).toMatch(/^(?:like|as) /)
    const snow = SCENE_DATA.snow
    expect(snow.device).toBe('metaphor')
    expect(`${snow.before}${snow.figure}`).toMatch(/\bwas a\b/)
    expect(`${snow.before}${snow.figure}${snow.after}`).not.toMatch(/\blike\b|\bas\b/)
    const leaves = SCENE_DATA.leaves
    expect(leaves.device).toBe('personification')
    // A person's action, given to something that is not a person.
    expect(leaves.before).toBe('The leaves ')
    expect(leaves.figure).toBe('danced')
  })

  it('each scene has qualities that fit and qualities the writer did not mean, in a mixed order', () => {
    for (const id of SCENES) {
      const s = SCENE_DATA[id]
      const ids = s.qualities.map((q) => q.id)
      expect(new Set(ids).size, id).toBe(ids.length)
      expect(s.qualities.some((q) => q.fits), id).toBe(true)
      expect(s.qualities.some((q) => !q.fits), id).toBe(true)
      // The cards that fit are not simply the first ones.
      expect(s.qualities.slice(0, fitsOf(s).length).every((q) => q.fits), id).toBe(false)
      for (const q of s.qualities) expect(s.picture.parts[q.id], `${id} ${q.id}`).toBeTruthy()
    }
  })

  it('each write card has one right ending, and the right ending paints what the fitting qualities paint', () => {
    for (const id of SCENES) {
      const s = SCENE_DATA[id]
      const right = s.endings.filter((e) => e.kind === 'right')
      expect(right, id).toHaveLength(1)
      expect([...right[0].looks].sort(), id).toEqual([...fitsOf(s)].sort())
      expect(s.endings.some((e) => e.kind === 'other'), id).toBe(true)
      expect(s.endings.some((e) => e.kind === 'plain'), id).toBe(true)
      for (const e of s.endings) for (const l of e.looks) expect(s.picture.parts[l], `${id} ${e.id} ${l}`).toBeTruthy()
      for (const e of s.endings) if (e.kind !== 'right') expect(e.said, `${id} ${e.id}`).not.toBe('')
    }
    // The right ending is not in the same place on every card.
    expect(new Set(SCENES.map((id) => SCENE_DATA[id].endings.findIndex((e) => e.kind === 'right'))).size).toBe(SCENES.length)
  })

  it('the word like on its own changes nothing: the reader pictures what the plain sentence paints', () => {
    let seen = 0
    for (const id of SCENES) {
      const s = SCENE_DATA[id]
      for (const e of s.endings.filter((x) => x.kind === 'notComparison')) {
        seen++
        expect(e.text, id).toMatch(/\bI like\b/)
        expect(e.looks, id).toEqual(s.plainLooks)
      }
      // A plain ending never paints the whole picture the comparison paints.
      for (const e of s.endings.filter((x) => x.kind !== 'right')) expect(fitsOf(s).every((l) => e.looks.includes(l)), `${id} ${e.id}`).toBe(false)
    }
    expect(seen).toBeGreaterThanOrEqual(2)
  })

  it('says what the reader pictures in plain words', () => {
    expect(picturedOf(SCENE_DATA.lake, [])).toBe('a lake with small ripples')
    expect(picturedOf(SCENE_DATA.lake, ['frame'])).toBe('a lake with small ripples and a wooden frame round it')
    expect(picturedOf(SCENE_DATA.lake, ['still', 'reflect'])).toBe('a lake with flat water and the trees upside down in it')
    expect(picturedOf(SCENE_DATA.snow, ['cover', 'thick'])).toBe('a town with deep, soft snow and the car and the bench hidden under snow')
    expect(picturedOf(SCENE_DATA.leaves, ['shoes'])).toBe('leaves falling to the ground and wearing little dancing shoes')
    expect(picturedOf(SCENE_DATA.leaves, ['spin', 'leap'])).toBe('leaves spinning and twirling and leaping lightly up and down')
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
    expect(ALL).toHaveLength(6)
  })

  it('marks exactly by the rule, over every state the learner can reach', () => {
    for (const c of ALL) {
      const s = SCENE_DATA[c.scene as SceneName]
      let right = 0
      for (const st of everyState(c)) {
        const should = c.task === 'carry'
          ? [...(st.carried ?? [])].sort().join() === [...fitsOf(s)].sort().join()
          : st.ending === s.endings.find((e) => e.kind === 'right')!.id
        expect(engine.check(c, st).ok, `${nameOf(c)} ${JSON.stringify(st)}`).toBe(should)
        if (should) right++
      }
      expect(right, nameOf(c)).toBe(1)
    }
  })

  it('names the cards it marks wrong, and only those', () => {
    const c = carry('lake')
    expect(engine.check(c, { carried: ['frame', 'still'] }).wrongIds.sort()).toEqual(['frame', 'reflect'])
    expect(engine.check(write('lake'), { ending: 'enjoy' }).wrongIds).toEqual(['ending'])
  })

  it('refuses a state that could not have been made, and counts a repeat once', () => {
    const c = carry('snow')
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { carried: 'cover' as never }).ok).toBe(false)
    expect(engine.check(c, { carried: ['cover', 'thick', 'nonsense'] }).ok).toBe(true)
    expect(carriedOf(c, { carried: ['thick', 'cover', 'cover'] })).toEqual(['cover', 'thick'])
    expect(engine.check(write('snow'), { ending: 7 as never }).ok).toBe(false)
    expect(engine.check(write('snow'), { ending: 'nonsense' }).ok).toBe(false)
    expect(endingOf(write('snow'), { ending: 'nonsense' })).toBeNull()
  })

  it('the picture follows the language: carried cards, or the chosen ending, or the plain sentence', () => {
    expect(looksOf(carry('lake'), { carried: ['frame'] })).toEqual(['frame'])
    expect(looksOf(write('lake'), { ending: null })).toEqual(['still'])
    expect(looksOf(write('lake'), { ending: 'washer' })).toEqual(['churn'])
    expect(sentenceOf(write('lake'), { ending: 'mirror' })).toEqual({ before: 'The lake was ', middle: 'like a mirror', after: '.' })
    expect(sentenceOf(write('leaves'), { ending: null })).toEqual({ before: 'The leaves ', middle: 'fell', after: ' in the wind.' })
    expect(sentenceOf(carry('snow'), {})).toEqual({ before: 'The snow was ', middle: 'a blanket', after: ' over the town.' })
  })

  it('says why when right, and names the device', () => {
    for (const c of ALL) {
      const [lead, rest] = working(c)
      expect(lead.startsWith('Yes.'), nameOf(c)).toBe(true)
      const device = SCENE_DATA[c.scene as SceneName].device
      expect(`${lead} ${rest}`, nameOf(c)).toContain(device)
    }
    expect(working(carry('snow'))[1]).toMatch(/Greek for carrying across/)
  })

  it('when wrong, says what the reader pictures, and never names a fitting card the learner left out', () => {
    for (const c of ALL) {
      const s = SCENE_DATA[c.scene as SceneName]
      for (const st of everyState(c)) {
        if (done(c, st)) continue
        const said = madeText(c, st)
        expect(said.startsWith('Yes'), `${nameOf(c)} ${JSON.stringify(st)}`).toBe(false)
        if (c.task === 'carry') {
          expect(said).not.toMatch(/simile|metaphor|personification/)
          const missing = fitsOf(s).filter((id) => !(st.carried ?? []).includes(id))
          for (const id of missing) expect(said, `${nameOf(c)} ${JSON.stringify(st)} names ${id}`).not.toContain(s.picture.parts[id])
          for (const q of s.qualities) expect(said).not.toContain(q.text)
        } else {
          const right = s.endings.find((e) => e.kind === 'right')!
          expect(said, nameOf(c)).not.toContain(`"${right.text}"`)
        }
      }
    }
    expect(madeText(carry('lake'), { carried: ['frame'] })).toBe('Your reader pictures a lake with small ripples and a wooden frame round it. Could a real lake be like that?')
    expect(madeText(carry('leaves'), { carried: ['spin'] })).toBe('Your reader pictures leaves spinning and twirling. A dancer has more to give the leaves.')
    expect(madeText(carry('snow'), {})).toMatch(/^Nothing is carried across yet\. Your reader pictures just a town/)
    expect(madeLines(write('lake'), { ending: 'enjoy' })).toEqual(['You chose "still, and I like lakes".', 'Here "like" means enjoy: nothing is compared, so the reader’s picture stays the same.'])
    expect(madeText(write('snow'), { ending: null })).toMatch(/not chosen an ending/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({})).toEqual({ task: 'carry', scene: 'lake' })
    expect(engine.parse({ task: 'Carry across', scene: 'Lake' })).toEqual({ task: 'carry', scene: 'lake' })
    expect(engine.parse({ task: 'simile' })).toEqual({ task: 'carry', scene: 'lake' })
    expect(engine.parse({ task: 'metaphor' })).toEqual({ task: 'carry', scene: 'snow' })
    expect(engine.parse({ task: 'Personification' })).toEqual({ task: 'carry', scene: 'leaves' })
    expect(engine.parse({ task: 'write', device: 'metaphor' })).toEqual({ task: 'write', scene: 'snow' })
    expect(engine.parse({ task: 'finish the sentence', sentence: 'The leaves danced in the wind.' })).toEqual({ task: 'write', scene: 'leaves' })
    expect(engine.parse({ task: 'literal to figurative', comparison: 'like a mirror' })).toEqual({ task: 'write', scene: 'lake' })
    expect(engine.parse({ task: { kind: 'rewrite', scene: 'snow blanket' } })).toEqual({ task: 'write', scene: 'snow' })
    expect(engine.parse({ mode: 'meaning', scene: 'leaf' })).toEqual({ task: 'carry', scene: 'leaves' })
    expect(engine.parse({ task: 'carry', scene: '' })).toEqual({ task: 'carry', scene: 'lake' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('lake')).toBeNull()
    expect(engine.parse({ task: 5 })).toBeNull()
    expect(engine.parse({ task: 'carry', scene: 3 })).toBeNull()
    // Unknown words still parse: faults says what would work.
    expect(engine.parse({ task: 'dance off' })).toEqual({ task: 'carry', scene: 'leaves' })
    expect(engine.parse({ task: 'carry', scene: 'volcano' })).toEqual({ task: 'carry', scene: 'volcano' })
    expect(engine.parse({ task: 'juggle' })).toEqual({ task: 'juggle', scene: 'lake' })
  })

  it('refuses only what cannot be drawn, naming what works and a nearby example', () => {
    const cases: [FigConfig, RegExp][] = [
      [{ task: 'carry', scene: 'volcano' }, /lake .*snow .*leaves/],
      [{ task: 'carry', scene: '__proto__' }, /lake .*snow .*leaves/],
      [{ task: 'juggle', scene: 'lake' }, /carry .*write/],
      [{ task: 'dance-off', scene: 'leaves' }, /carry .*write/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const scene = f[0].match(/e\.g\. scene "(\w+)"/)
      const task = f[0].match(/e\.g\. task "(\w+)"/)
      const fixed = { ...c, ...(scene ? { scene: scene[1] } : {}), ...(task ? { task: task[1] } : {}) }
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok).toBe(true)
      // A refused config still draws and marks without crashing.
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(() => raw(c, engine.initial(c), 'idle', true)).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: FigConfig, p: string) => engine.promptFaults!(c, p)

  it('asking for the gesture and the aim is fine', () => {
    expect(pf(carry('lake'), "Tap what a mirror is like to carry it into the reader's picture, and tap again to take it out. Carry across only what the writer meant.")).toEqual([])
    expect(pf(carry('lake'), 'This sentence uses a simile. What would a reader really picture? Tap the cards to find out.')).toEqual([])
    expect(pf(write('leaves'), 'Tap an ending to finish the sentence, and tap another to change it. Make the reader see the leaves as light and playful, as if they were people.')).toEqual([])
    expect(pf(write('lake'), 'Turn the plain sentence into a simile that makes the reader see how still and clear the water was.')).toEqual([])
  })

  it('naming a card, the answer or a count is not', () => {
    for (const p of ['Carry across the reflection.', 'A mirror shows the trees upside down.', 'Leave out the frame.', 'The lake is not made of glass.', 'Carry two of them.', 'Think about how flat the water is.']) {
      expect(pf(carry('lake'), p), p).toHaveLength(1)
    }
    for (const p of ['Snow covers everything.', 'Is the snow really wool?', 'Deep snow hides the car.']) expect(pf(carry('snow'), p), p).toHaveLength(1)
    for (const p of ['Do leaves really wear shoes?', 'The leaves spin and twirl.', 'Do they hold hands?']) expect(pf(carry('leaves'), p), p).toHaveLength(1)
    for (const p of ['Choose "like a mirror".', 'I like lakes is not a simile.', 'A washing machine would be wrong.']) expect(pf(write('lake'), p), p).toHaveLength(1)
    expect(pf(write('snow'), 'Use the blanket.')).toHaveLength(1)
    expect(pf(write('leaves'), 'Make them dance.')).toHaveLength(1)
  })

  it('what the card does not do is refused too', () => {
    for (const p of ['Drag the words into the picture.', 'Type your own simile.', 'Write your own metaphor about the sea.', 'Draw what the reader pictures.', 'Listen to the alliteration.', 'Find the onomatopoeia.']) {
      expect(pf(carry('lake'), p).join(' '), p).toMatch(/does not do/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const said = pf(c, 'Carry two of them, then drag the frame.')
      expect(said.length, nameOf(c)).toBeGreaterThan(0)
      for (const msg of said) {
        const fix = msg.match(/\("([^"]+)"\)/)![1]
        expect(pf(c, fix), `${nameOf(c)}: ${fix}`).toEqual([])
        expect(fix).toMatch(c.task === 'carry' ? /carry it into the reader's picture/ : /Tap an ending/)
      }
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"figurative-language", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, f[2]).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, f[2]).toBe(true)
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['carry', 'write']))
    // The prompts quoted beside each config are the same ones.
    for (const m of engine.prompt.matchAll(/-- the prompt says "([^"]+)"/g)) expect(found.map((f) => f[1])).toContain(m[1])
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "figurative-language"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'figurative-language')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Figurative language', 'Similes and metaphors', 'Personification', 'Unit 4: Similes', 'Using metaphors in descriptive writing', 'Figures of speech',
      'Literal and figurative language', 'Chapter 3: Imagery and figurative language', 'Language devices', 'Imagery in poetry', 'Writing with similes',
      'Simile, metaphor and personification', 'Descriptive language: creating images for the reader',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for near misses or for words that share a stem', () => {
    for (const st of [
      'Similar triangles', 'Similarity and congruence', 'Metaphase in mitosis', 'Personal hygiene', 'Personal finance', 'Plane figures', 'Significant figures',
      'Images in plane mirrors', 'Satellite imagery and remote sensing', 'Word classes', 'Parts of speech', 'Punctuation', 'Persuasive writing techniques',
      'Sonnets and rhyme schemes', 'Onomatopoeia and alliteration', 'Figurative painting in the Renaissance', 'Direct speech',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config and isolates in its catalogue entry', () => {
    expect(getEngine('figurative-language')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "figurative-language"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:figurative-language"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const id of SCENES) expect(engine.prompt).toContain(`${id} (${SCENE_DATA[id].device}`)
    for (const id of SCENES) expect(engine.prompt).toContain(`${SCENE_DATA[id].plainBefore}${SCENE_DATA[id].plainSlot}${SCENE_DATA[id].plainAfter}`)
    // "two in each scene", as the entry says.
    for (const id of SCENES) expect(fitsOf(SCENE_DATA[id])).toHaveLength(2)
  })
})

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  const LEAF_LOOKS = [[], ['spin'], ['leap'], ['spin', 'leap'], ['shoes'], ['hands'], ['shoes', 'hands', 'spin', 'leap'], ['march'], ['rain'], ['slow']]
  const reach = 15 * LEAF_SCALE

  it('agrees with what the view writes out as literals', () => {
    expect(W).toBe(360)
    expect(H).toBe(190)
    const html = raw(carry('lake'), {}, 'idle', true)
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
    expect(LEAVES).toBe(6)
  })

  it('every leaf stays on the plate, whatever it has been given, all the way down', () => {
    for (const looks of LEAF_LOOKS) {
      const p = leafTarget(looks)
      for (let k = 0; k < 240; k++) {
        for (let i = 0; i < LEAVES; i++) {
          const q = leafPose(i, k / 240, p)
          if (q.alpha < 0.05) continue
          expect(q.x - reach, `${looks} ${i} ${k}`).toBeGreaterThanOrEqual(0)
          expect(q.x + reach, `${looks} ${i} ${k}`).toBeLessThanOrEqual(W)
          expect(q.y - reach, `${looks} ${i} ${k}`).toBeGreaterThanOrEqual(0)
          expect(q.y + reach, `${looks} ${i} ${k}`).toBeLessThanOrEqual(H)
        }
      }
    }
  })

  it('partners keep apart from each other and from the other pairs; a marching row is evenly spaced', () => {
    const p = leafTarget(['hands'])
    for (let k = 0; k < 120; k++) {
      const q = Array.from({ length: LEAVES }, (_, i) => leafPose(i, k / 120, p))
      for (const i of [0, 2, 4]) expect(Math.hypot(q[i].x - q[i + 1].x, q[i].y - q[i + 1].y)).toBeGreaterThanOrEqual(30)
      for (let i = 0; i < LEAVES; i++) for (let j = i + 1; j < LEAVES; j++) {
        if ((i >> 1) === (j >> 1) || q[i].alpha < 0.5 || q[j].alpha < 0.5) continue
        expect(Math.hypot(q[i].x - q[j].x, q[i].y - q[j].y), `pairs ${i} ${j} at ${k}`).toBeGreaterThanOrEqual(20)
      }
    }
    const m = Array.from({ length: LEAVES }, (_, i) => leafPose(i, 0.4, leafTarget(['march'])))
    for (let i = 1; i < LEAVES; i++) {
      expect(m[i].x - m[i - 1].x).toBeCloseTo(38, 5)
      expect(m[i].y).toBeCloseTo(m[0].y, 5)
    }
  })

  it('one move, one clear change: each kind of motion puts the leaves somewhere else', () => {
    const at = (looks: string[]) => Array.from({ length: LEAVES }, (_, i) => leafPose(i, 0.31, leafTarget(looks)))
    const plain = at([])
    for (const looks of [['spin'], ['leap'], ['hands'], ['march'], ['rain']]) {
      const moved = at(looks).reduce((n, q, i) => n + Math.hypot(q.x - plain[i].x, q.y - plain[i].y), 0) / LEAVES
      expect(moved, looks.join()).toBeGreaterThan(6)
    }
    // Slow and fast are told apart by how far a leaf goes in a second.
    expect(leafTarget(['slow']).period).toBeGreaterThan(leafTarget([]).period)
    expect(leafTarget(['rain']).period).toBeLessThan(leafTarget([]).period)
  })

  it('the folded corner and the crack sit in their own places on the plate', () => {
    for (const [x, y] of foldFlap()) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(W)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(H)
    }
    // The cracks start inside the water, where the glass would be.
    expect(((226 - LAKE.cx) / LAKE.rx) ** 2 + ((146 - LAKE.cy) / LAKE.ry) ** 2).toBeLessThan(1)
    // The frame's outer edge stays on the plate.
    expect(LAKE.cy + LAKE.ry + 12.5 + 0.8).toBeLessThanOrEqual(H)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: FigConfig, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'figurative-language', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says the answer, the device or a count', () => {
    for (const c of ALL) {
      const prompt = 'Tap the cards and watch the reader’s picture.'
      const html = card(c, prompt)
      expect(html, nameOf(c)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'carries across only', 'stay behind', 'simile', 'metaphor', 'personification', 'plainly', 'means enjoy', 'nothing is compared', 'more to give', 'Could a real', 'Greek']) {
        expect(shown, `${secret} in ${nameOf(c)}`).not.toContain(secret)
      }
    }
  })

  it('names the goal and the picture on the card, before anything is touched', () => {
    const lake = text(raw(carry('lake'), {}))
    for (const words of ['The lake was', 'like a mirror', 'Aim:', 'make the picture the writer meant', 'What a reader pictures', 'What is a mirror like? Tap to carry it into the picture.']) expect(lake).toContain(words)
    const snow = text(raw(write('snow'), { ending: null }))
    for (const words of ['The snow was', 'white', 'Aim:', 'covers everything', 'Tap an ending to finish the sentence.']) expect(snow).toContain(words)
  })

  it('every control is a real button with its own label, pressed as it stands, and locked when solved', () => {
    for (const c of ALL) {
      const html = raw(c, engine.initial(c))
      const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0])
      expect(buttons, nameOf(c)).toHaveLength(4)
      const labels = buttons.map((b) => b.match(/aria-label="([^"]+)"/)![1])
      expect(new Set(labels).size).toBe(4)
      for (const b of buttons) {
        expect(b).toContain('type="button"')
        expect(b).toContain('aria-pressed="false"')
        expect(b).not.toMatch(/\sdisabled=""/)
      }
      const solved = raw(c, engine.solve(c), 'right')
      for (const b of solved.matchAll(/<button[^>]*>/g)) expect(b[0], nameOf(c)).toMatch(/\sdisabled=""/)
    }
    expect(raw(carry('lake'), { carried: ['frame'] })).toContain('aria-label="Take &quot;has a frame round it&quot; out of the picture"')
    expect(raw(write('lake'), { ending: 'mirror' })).toContain('aria-label="Take out the ending &quot;like a mirror&quot;"')
  })

  it('showing the answer draws the answer, whatever the learner had', () => {
    const c = carry('snow')
    const html = raw(c, {}, 'shown')
    expect([...html.matchAll(/aria-pressed="true"/g)]).toHaveLength(2)
    expect(text(html)).toContain('Yes.')
    expect(attrs(html)).toContain('the car and the bench hidden under snow')
    const w = raw(write('leaves'), { ending: 'march' }, 'shown')
    expect(w).toContain('aria-label="Take out the ending &quot;danced&quot;"')
  })

  it('marking says why when right, and what the reader pictures when wrong', () => {
    expect(text(raw(carry('lake'), { carried: ['still', 'reflect'] }, 'right'))).toContain('This is a simile')
    expect(text(raw(carry('lake'), { carried: ['frame'] }, 'wrong'))).toContain('Your reader pictures a lake with small ripples and a wooden frame round it.')
    expect(text(raw(write('lake'), { ending: 'enjoy' }, 'wrong'))).toContain('means enjoy')
  })

  it('the still frame changes with every move, with nothing moving under reduced motion', () => {
    for (const c of ALL) {
      const first = raw(c, engine.initial(c), 'idle', true)
      expect(first, nameOf(c)).not.toMatch(/transition:|animation:/)
      expect(first).not.toContain('<style>')
      const s = SCENE_DATA[c.scene as SceneName]
      if (c.task === 'carry') {
        for (const q of s.qualities) expect(svgOf(raw(c, { carried: [q.id] }, 'idle', true)), `${nameOf(c)} ${q.id}`).not.toBe(svgOf(first))
      } else {
        for (const e of s.endings) {
          const after = raw(c, { ending: e.id }, 'idle', true)
          // The sentence always changes; the picture changes unless the words compare nothing new.
          expect(text(after), `${nameOf(c)} ${e.id}`).not.toBe(text(first))
          const same = JSON.stringify(e.looks) === JSON.stringify(s.plainLooks)
          expect(svgOf(after) === svgOf(first), `${nameOf(c)} ${e.id}`).toBe(same)
        }
      }
    }
    // A change eases when motion is allowed.
    expect(raw(carry('lake'), {}, 'idle', false)).toMatch(/transition:opacity 700ms/)
  })

  it('a still frame of the leaves shows each way of moving as a trail', () => {
    const plain = raw(carry('leaves'), {}, 'idle', true)
    expect([...plain.matchAll(/data-trail=/g)]).toHaveLength(LEAVES)
    expect(svgOf(raw(carry('leaves'), { carried: ['spin'] }, 'idle', true))).not.toBe(svgOf(plain))
    expect(raw(write('leaves'), { ending: 'march' }, 'idle', true)).not.toContain('data-trail=')
  })

  it('tells a screen reader what the reader pictures, never whether it is right', () => {
    const html = raw(carry('lake'), { carried: ['frame'] })
    expect(attrs(html)).toContain('What a reader pictures: a lake with small ripples and a wooden frame round it.')
    expect(text(html)).toContain('A reader pictures a lake with small ripples and a wooden frame round it.')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const c of ALL) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(c, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/font-size="(?:\d|1[01])(?:\.\d+)?"/)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
