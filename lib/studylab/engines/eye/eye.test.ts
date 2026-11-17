// lib/studylab/engines/eye/eye.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  eyeEngine as E, meets, pupilSize, readState, done, madeText, working, captionText, measureOf, goalText, goodPrompt,
  type EyeConfig, type EyeState, type Muscle,
} from './config'
import { EyeView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const near: EyeConfig = { kind: 'focus', object: 'near' }
const far: EyeConfig = { kind: 'focus', object: 'far' }
const bright: EyeConfig = { kind: 'pupil', light: 'bright' }
const dim: EyeConfig = { kind: 'pupil', light: 'dim' }
const ALL = [near, far, bright, dim]
const MUSCLES: Muscle[] = ['relaxed', 'contracted']

const render = (config: EyeConfig, state: EyeState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(EyeView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

/** Every state the three muscles can be in. */
const everyState = (): EyeState[] =>
  MUSCLES.flatMap((ciliary) => MUSCLES.flatMap((circular) => MUSCLES.map((radial) => ({ ciliary, circular, radial }))))

describe('the rules', () => {
  it('puts the light on the retina only when the lens suits the distance', () => {
    expect(meets('near', 'relaxed')).toBe('behind')
    expect(meets('near', 'contracted')).toBe('on')
    expect(meets('far', 'relaxed')).toBe('on')
    expect(meets('far', 'contracted')).toBe('front')
  })

  it('sizes the pupil from the two iris muscles', () => {
    expect(pupilSize('contracted', 'relaxed')).toBe('narrow')
    expect(pupilSize('relaxed', 'contracted')).toBe('wide')
    expect(pupilSize('relaxed', 'relaxed')).toBe('medium')
    expect(pupilSize('contracted', 'contracted')).toBe('medium')
  })
})

describe('every valid config starts unsolved and solves', () => {
  it('holds for each task, and marks exactly the rule for every state', () => {
    for (const config of ALL) {
      expect(E.faults(config)).toEqual([])
      expect(E.check(config, E.initial(config)).ok, `starts solved ${JSON.stringify(config)}`).toBe(false)
      expect(E.check(config, E.solve(config)).ok, `cannot solve ${JSON.stringify(config)}`).toBe(true)
      for (const s of everyState()) {
        const r = E.check(config, s)
        const expected = config.kind === 'focus'
          ? meets(config.object, s.ciliary) === 'on'
          : config.light === 'bright' ? pupilSize(s.circular, s.radial) === 'narrow' : pupilSize(s.circular, s.radial) === 'wide'
        expect(r.ok, `${JSON.stringify(config)} ${JSON.stringify(s)}`).toBe(expected)
        expect(done(config, s)).toBe(expected)
        if (!expected) {
          expect(r.wrongIds.length).toBeGreaterThan(0)
          expect(madeText(config, s)).not.toMatch(/^Sharp/)
        }
      }
    }
  })

  it('takes one press for a focus and two for a pupil, and every press changes the picture', () => {
    for (const config of [near, far]) {
      const a = E.initial(config)
      const b = E.solve(config)
      expect((['ciliary', 'circular', 'radial'] as const).filter((k) => a[k] !== b[k])).toEqual(['ciliary'])
    }
    for (const config of [bright, dim]) {
      const a = E.initial(config)
      const b = E.solve(config)
      expect((['circular', 'radial'] as const).filter((k) => a[k] !== b[k])).toHaveLength(2)
      const mid = { ...a, circular: b.circular }
      expect(pupilSize(mid.circular, mid.radial)).toBe('medium')
      expect(E.check(config, mid).ok).toBe(false)
    }
  })

  it('starts as the eye was just doing the opposite', () => {
    expect(E.initial(near)).toEqual({ ciliary: 'relaxed', circular: 'relaxed', radial: 'relaxed' })
    expect(E.initial(far)).toEqual({ ciliary: 'contracted', circular: 'relaxed', radial: 'relaxed' })
    expect(E.initial(bright)).toEqual({ ciliary: 'relaxed', circular: 'relaxed', radial: 'contracted' })
    expect(E.initial(dim)).toEqual({ ciliary: 'relaxed', circular: 'contracted', radial: 'relaxed' })
    expect(pupilSize(E.initial(bright).circular, E.initial(bright).radial)).toBe('wide')
    expect(pupilSize(E.initial(dim).circular, E.initial(dim).radial)).toBe('narrow')
  })

  it('reads corrupt stored work as relaxed and never accepts it', () => {
    expect(readState({ ciliary: 'banana' } as unknown as EyeState)).toEqual({ ciliary: 'relaxed', circular: 'relaxed', radial: 'relaxed' })
    expect(readState(null)).toEqual({ ciliary: 'relaxed', circular: 'relaxed', radial: 'relaxed' })
    expect(E.check(near, {} as EyeState).ok).toBe(false)
  })
})

describe('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    expect(E.parse({ kind: 'focus', object: 'near' })).toEqual(near)
    expect(E.parse({ kind: 'focus' })).toEqual(near)
    expect(E.parse({})).toEqual(near)
    expect(E.parse({ kind: 'accommodation', object: 'distant tree' })).toEqual(far)
    expect(E.parse({ kind: 'pupil', light: 'Bright' })).toEqual(bright)
    expect(E.parse({ kind: 'pupil', light: 'dark' })).toEqual(dim)
    expect(E.parse({ kind: 'pupil' })).toEqual(bright)
    expect(E.parse({ kind: 'pupil reflex', light: 'dim room' })).toEqual(dim)
    expect(E.parse({ kind: 'focus', object: 'near', light: 'dim' })).toEqual(near)
    expect(E.parse({ kind: 'pupil', light: 'dim', object: 'far' })).toEqual(dim)
    expect(E.parse(null)).toBeNull()
    expect(E.parse('eye')).toBeNull()
  })

  it('refuses what cannot be drawn, with an example that works', () => {
    const parts = E.parse({ kind: 'parts' })!
    expect(E.faults(parts)[0]).toMatch(/not "parts".*\{ "kind":"focus", "object":"near" \}/)
    expect(E.faults(E.parse({ kind: 'sight-correction' })!)[0]).toMatch(/glasses and contact lenses are not built/)
    expect(E.faults(E.parse({ kind: 'focus', object: 'middle' })!)[0]).toMatch(/"middle".*"object":"near"/)
    expect(E.faults(E.parse({ kind: 'focus', object: 'very near' })!)[0]).toMatch(/"very near"/)
    expect(E.faults(E.parse({ kind: 'pupil', light: 'medium' })!)[0]).toMatch(/"medium".*"light":"dim"/)
    expect(E.faults(E.parse({ kind: 'pupil', light: 'dark' })!)).toEqual([])
    expect(E.faults(E.parse({ kind: 'long sight' })!)[0]).toMatch(/not built/)
    expect(E.check({ kind: 'other', asked: 'x' }, E.initial(near)).ok).toBe(false)
  })
})

describe('prompts', () => {
  it('catches prompts that give the answer away', () => {
    for (const t of [
      'Contract the ciliary muscle to see the flower.', 'Let the muscle relax so the lens goes thin.', 'Make the lens fatter.',
      'The ligaments go slack when you look at it.', 'The lens must bulge.', 'Tighten the ligaments.', 'Make the lens rounder to see it.',
    ]) expect(E.promptFaults!(near, t).join(' '), t).toMatch(/gives the answer away/)
    for (const t of [
      'Make the pupil narrower.', 'Shrink the pupil.', 'Dilate the pupil.', 'Let in more light.', 'The pupil should be smaller.', 'Contract the circular muscle.', 'Relax the radial muscle.',
    ]) expect(E.promptFaults!(bright, t).join(' '), t).toMatch(/gives the answer away/)
    for (const c of ALL) expect(E.promptFaults!(c, 'Use the buttons so you can see.')).toEqual([])
    expect(E.promptFaults!(near, 'It is a tinted thing.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('eye')!
    expect(e).toBe(E)
    const prompts = [goodPrompt.nearFocus, goodPrompt.farFocus, goodPrompt.bright, goodPrompt.dim]
    ALL.forEach((c, i) => expect(E.promptFaults!(c, prompts[i]), prompts[i]).toEqual([]))
    const configs = [...e.prompt.matchAll(/or? ?(\{ "kind":"(?:focus|pupil)"[^}]*\})|^ {2}config: (\{ "kind"[^}]*\})/gm)].map((m) => JSON.parse(m[1] ?? m[2]))
    expect(configs).toHaveLength(4)
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
    for (const c of configs) {
      const config = e.parse(c)!
      expect(config).toEqual(ALL.find((a) => JSON.stringify(a) === JSON.stringify(c)))
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].map((m) => m[1])).toEqual(['consequence', 'consequence'])
    expect(e.isolates).toBe('consequence')
  })
})

describe('the words on the card', () => {
  it('says what is happening, as an observation, and the verdicts from the design', () => {
    expect(captionText(near, { ciliary: 'relaxed', circular: 'relaxed', radial: 'relaxed' })).toBe('The ciliary muscle is relaxed: the ligaments are pulled tight and the lens is thin.')
    expect(captionText(near, { ciliary: 'contracted', circular: 'relaxed', radial: 'relaxed' })).toBe('The ciliary muscle is contracted: the ligaments are slack and the lens is fat.')
    expect(captionText(bright, { ciliary: 'relaxed', circular: 'contracted', radial: 'relaxed' })).toMatch(/squeezing the pupil narrow/)
    expect(captionText(bright, { ciliary: 'relaxed', circular: 'relaxed', radial: 'contracted' })).toMatch(/pulling the pupil wide/)
    expect(captionText(bright, { ciliary: 'relaxed', circular: 'relaxed', radial: 'relaxed' })).toMatch(/Both iris muscles are relaxed/)
    expect(captionText(bright, { ciliary: 'relaxed', circular: 'contracted', radial: 'contracted' })).toMatch(/pulling against each other: the pupil stays medium/)
    expect(measureOf(near, E.initial(near))).toEqual({ label: 'Light meets', value: 'Behind the retina' })
    expect(measureOf(far, E.initial(far))).toEqual({ label: 'Light meets', value: 'In front of the retina' })
    expect(measureOf(far, E.solve(far)).value).toBe('On the retina')
    expect(measureOf(dim, E.initial(dim))).toEqual({ label: 'Pupil', value: 'Narrow' })
    expect(goalText(dim)).toBe('Dim room: let in enough light to see')
    expect(madeText(bright, E.initial(bright))).toBe('The pupil is wide: bright sunlight floods in and could damage the retina.')
    expect(madeText(bright, { ciliary: 'relaxed', circular: 'relaxed', radial: 'relaxed' })).toBe('Neither muscle is pulling: the pupil stays medium and too much bright light gets in.')
    expect(madeText(dim, { ciliary: 'relaxed', circular: 'contracted', radial: 'contracted' })).toBe('Both muscles pull against each other: the pupil stays medium and too little light gets in.')
    expect(madeText(dim, E.initial(dim))).toBe('The pupil is narrow: too little light gets in to see in the dim room.')
    expect(madeText(near, E.initial(near))).toMatch(/^Blurred\..*behind the retina\.$/)
    expect(madeText(far, E.initial(far))).toMatch(/^Blurred\..*in front of the retina\.$/)
    for (const c of ALL) expect(working(c)).toBeTruthy()
  })
})

describe('catalogue matching', () => {
  it('is offered for the eye, and not for its neighbours', () => {
    for (const station of ['The eye', 'Structure of the eye', 'Accommodation', 'The pupil reflex', 'How the eye focuses', 'Parts of the eye']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('eye')
      expect(sceneCatalogue(station), station).toContain('SCENE "eye"')
    }
    for (const station of ['Refraction and converging lenses', 'The electromagnetic spectrum', 'Nerve impulses', 'Correcting long sight and short sight', 'The ear']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('eye')
    }
  })
})

describe('the card', () => {
  it('renders every task, with no answer before marking, on the server', () => {
    for (const config of ALL) {
      const html = render(config, E.initial(config))
      expect(html).toContain('role="img"')
      expect(html).toContain('Goal')
      expect(html).toContain(goalText(config))
      expect(html).not.toMatch(/Sharp\.|Blurred\.|reflex\b.*It happens/)
      expect(html).not.toMatch(/data-done/)
      expect(html.match(/aria-pressed/g)).toHaveLength(config.kind === 'focus' ? 2 : 4)
      expect(html).not.toMatch(/disabled=""/)
    }
    const f = render(near, E.initial(near))
    expect(f).toContain('aria-label="Ciliary muscle relaxed"')
    expect(f).toContain('aria-label="Ciliary muscle contracted"')
    expect(f).toContain('Light meets')
    const p = render(bright, E.initial(bright))
    for (const l of ['Circular muscle relaxed', 'Circular muscle contracted', 'Radial muscle relaxed', 'Radial muscle contracted']) expect(p).toContain(`aria-label="${l}"`)
    expect(p).toContain('Pupil')
  })

  it('does not tell the answer in the screen-reader text before marking', () => {
    for (const config of ALL) {
      const words = render(config, E.initial(config)).replace(/ class="[^"]*"/g, '')
      expect(words).not.toMatch(/\b(?:correct|incorrect|wrong|right|solved|well done)\b/i)
    }
  })

  it('shows the verdict once marked, and locks the buttons', () => {
    const right = render(near, E.solve(near), 'right')
    expect(right).toContain('Sharp. The ciliary muscle contracted')
    expect(right).toContain('data-done="1"')
    expect(right).toContain('disabled=""')
    const wrong = render(near, E.initial(near), 'wrong')
    expect(wrong).toContain('Blurred. With the ciliary muscle relaxed')
    expect(wrong).toContain('data-done="0"')
    const shown = render(dim, E.initial(dim), 'shown')
    expect(shown).toContain('wide pupil lets in more light')
    expect(shown).toContain('Wide')
  })

  it('still renders with reduced motion and with an unreadable config', () => {
    expect(render(far, E.initial(far), 'idle', true)).toContain('Light meets')
    expect(renderToStaticMarkup(createElement(EyeView, { config: { kind: 'other', asked: 'x' }, state: E.initial(near), setState: () => {}, marked: 'idle', reduced: false, locked: false }))).toBe('')
  })

  it('renders inside the activity node', () => {
    const html = renderToStaticMarkup(
      createElement(ReactFlowProvider, null, createElement(ActivityNode, {
        id: 'n', type: 'activity', selected: false, dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0,
        data: { spec: { pattern: 'scene', prompt: goodPrompt.nearFocus, payload: { engine: 'eye', config: near }, success: { kind: 'scene' } }, work: E.initial(near), status: 'open' },
      } as never)),
    )
    expect(html).toContain('Ciliary muscle')
  })
})
