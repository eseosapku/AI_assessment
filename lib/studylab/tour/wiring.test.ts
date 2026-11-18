import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { TIPS } from './tips'

const src = (p: string) => readFileSync(p, 'utf8')

describe('tools mark themselves used where their real control fires', () => {
  const wired: Record<string, string[]> = {
    'lesson-back-to-card': ['components/studylab/trail/TrailCanvas.tsx'],
    'lesson-go-deeper': ['components/studylab/trail/TrailConceptCard.tsx'],
    'lesson-detour-back': ['components/studylab/trail/TrailRibbon.tsx'],
    'lesson-look-back': ['components/studylab/trail/TrailRibbon.tsx'],
    'lesson-prove-it': ['components/studylab/trail/TrailDock.tsx'],
    'lesson-finished': ['components/studylab/trail/TrailStage.tsx'],
    'lesson-unsure': ['components/studylab/trail/DetourFooter.tsx'],
    'lesson-attach': ['components/studylab/ChatMouthpiece.tsx'],
    'lesson-stations': ['components/studylab/trail/TrailTopBar.tsx'],
    'lesson-board-menu': ['components/studylab/trail/TrailTopBar.tsx'],
  }
  for (const tip of TIPS) {
    it(`${tip.id} is marked used by its control, and its anchor exists`, () => {
      expect(wired[tip.id], `no wiring listed for ${tip.id}`).toBeTruthy()
      for (const file of wired[tip.id]) expect(src(file)).toMatch(new RegExp(String.raw`markToolUsed\([^)]*'` + tip.id + `'`))
      const all = ['trail/TrailStage', 'trail/TrailTopBar', 'trail/TrailDock', 'trail/DetourFooter', 'trail/TrailFrame', 'trail/TrailCanvas', 'trail/TrailConceptCard', 'trail/TrailRibbon', 'ChatMouthpiece'].map((f) => src(`components/studylab/${f}.tsx`)).join('\n')
      expect(all).toMatch(new RegExp(`["']${tip.anchor}["']`))
    })
  }
})
