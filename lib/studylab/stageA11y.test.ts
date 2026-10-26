// lib/studylab/stageA11y.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * What the stage owes a learner on a keyboard or a screen reader, pinned at the
 * source: these are effects and markup, and the suite has no browser.
 */
const src = (f: string) => readFileSync(f, 'utf8')

describe('the lesson-complete scene', () => {
  it('plays its fanfare and takes focus once, not on every re-render of the stage', () => {
    const scene = src('components/studylab/stage/LessonCompleteScene.tsx')
    const deps = scene.match(/playSound\('lessonComplete'\)[\s\S]*?\},\s*\[([^\]]*)\]\)/)
    expect(deps, 'the effect that plays the fanfare').not.toBeNull()
    expect(deps![1].trim()).toBe('')
  })
})

describe('the dock keeps the keyboard', () => {
  it('turns Continue into the working state in place, so the pressed button never vanishes', () => {
    const dock = src('components/studylab/stage/ActionDock.tsx')
    expect(dock).toMatch(/aria-disabled=\{working/)
    // The pill that replaced the button is gone, and with it a second
    // announcement of what Inky's bubble already says.
    expect(dock).not.toMatch(/role="status"/)
  })
})

describe('results and tutor lines are announced', () => {
  it('CheckBar keeps one live region mounted from the start, outside the line it shows', () => {
    const bar = src('components/studylab/check/CheckBar.tsx')
    expect(bar).toMatch(/className="sr-only"[^>]*aria-live="polite"/)
    expect(src('components/studylab/check/InkyLine.tsx')).not.toMatch(/aria-live/)
  })
  it('InkyDock says each line through a region that stays put, not the bubble it remounts', () => {
    const dock = src('components/studylab/stage/InkyDock.tsx')
    expect(dock).toMatch(/className="sr-only"[^>]*aria-live="polite"/)
    expect(dock.match(/aria-live=/g)?.length).toBe(1)
  })
})
