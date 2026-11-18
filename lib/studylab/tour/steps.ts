// lib/studylab/tour/steps.ts
//
// The in-lesson tour: which stops it makes, in order. Each stop points at a real
// control through a `data-tour` anchor; a stop whose control is not on screen is
// left out, so the tour never points at nothing.

export interface TourStep {
  id: string
  /** The `data-tour` value of the control to cut out, or null for the closing card. */
  anchor: string | null
  title: string
  body: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'board', anchor: 'lesson-board', title: 'The trail', body: 'Each stop is a station, and the card in front is where you are now.' },
  { id: 'plan', anchor: 'lesson-plan', title: 'Your plan', body: 'Happy with it? Press Start. Want it different? Tell me here.' },
  { id: 'next', anchor: 'lesson-next', title: 'The main button', body: 'It never moves, and it says what comes next: Start, Next step, Check.' },
  { id: 'ask', anchor: 'lesson-ask', title: 'Ask Kana', body: 'Ask anything about this lesson, or tap me.' },
  { id: 'stations', anchor: 'lesson-stations', title: 'Stations', body: 'Jump to any station, or see the whole board.' },
  { id: 'boardmenu', anchor: 'lesson-board-menu', title: 'The Board menu', body: 'See the whole board or get back to your card, zoom in and out, add your own notes, and turn the sound effects on or off.' },
  { id: 'leave', anchor: 'lesson-leave', title: 'Leave any time', body: 'Your place is saved.' },
  { id: 'close', anchor: null, title: "That's it", body: "Press Start when you're ready." },
]

/** The steps to run, given the anchors that are on screen. The closing card always stays. */
export function stepsPresent(anchors: Iterable<string>): TourStep[] {
  const present = new Set(anchors)
  return TOUR_STEPS.filter((s) => s.anchor === null || present.has(s.anchor))
}
