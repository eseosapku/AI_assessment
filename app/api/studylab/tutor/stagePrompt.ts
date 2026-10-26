// app/api/studylab/tutor/stagePrompt.ts
import type { Stage } from '@/lib/studylab/lessonRun'
import type { Pace } from '@/lib/studylab/lessonPolicy'
import { COMPREHENSION_CHIPS } from '@/lib/studylab/chips'

/**
 * What a station's teaching turn must do, by stage.
 *
 * A stage is a contract, not a mood: each block names exactly which actions
 * the turn may emit. The server holds the stage and enforces the parts that
 * matter (dispatch.ts) -- an explore turn that comes back as reading cards is
 * asked again, a check turn's chips are dropped -- so these words and that code
 * describe the same thing.
 */

const CHIPS = COMPREHENSION_CHIPS.map((c) => `"${c}"`).join(', ')

const EXPLORE = [
  'STAGE: EXPLORE — the student handles something before anything is explained.',
  'Emit exactly ONE of these, and nothing to read:',
  '  • a MATERIAL: one "createActivity" (the nine apparatus in the MATERIAL CONTRACT) or one "build_material";',
  '  • only where no material honestly fits (a source, a poem, a definition-led idea): ONE "practice" card',
  '    whose title starts "Predict:" — a quick prediction or a thing to notice, with "answer", "rubric" and "steps".',
  'This turn: no "concept", "table", "callout", "mermaid" or "worked" card, and no checkpoint.',
  'Your "say" is ONE line on what to watch for while they work it.',
].join('\n')

const NAME = [
  'STAGE: NAME IT — now name what the student just did.',
  'Emit 1 or 2 cards that build on what the student just did on the board above — the result they reached,',
  'the arrangement they made, the prediction they wrote — and give the idea its name. Connect them to it.',
  'No checkpoint this turn.',
  `End with "suggestions" set to exactly [${CHIPS}].`,
].join('\n')

const PRACTICE = [
  'STAGE: PRACTICE — a near-twin of what they just did.',
  'Emit ONE "practice" card (or ONE material, if the idea was taught with one) of the SAME kind, with one thing',
  'changed — new numbers, a new letter, the other handle. Not harder. No checkpoint this turn.',
].join('\n')

const CHECK = [
  'STAGE: CHECK — step back and check.',
  'Emit ONE "checkpoint" for this step (gate "hard", 1 or 2 questions) and nothing else.',
  'Your "say" is at most eight words, or empty. "suggestions": [] — no chips during a check.',
].join('\n')

function nearTwin(missed: string[]): string {
  if (missed.length === 0) return ''
  return [
    'NEAR-TWIN — they just missed:',
    ...missed.map((m) => `  • ${m}`),
    'Set a minimal variation of each: the same idea with one thing changed (4 + 7 after missing 4 + 8).',
    'Never harder, never a new idea, and never the answer to the one they missed.',
  ].join('\n')
}

export function stagePrompt(stage: Stage, ctx: { missed: string[]; pace: Pace }): string {
  const twin = nearTwin(ctx.missed)
  if (ctx.pace === 'run') {
    // The rest of the station in one turn, in order.
    const order: Stage[] = ['explore', 'name', 'practice', 'check']
    const parts = order.slice(order.indexOf(stage)).map((s) => ({ explore: EXPLORE, name: NAME, practice: PRACTICE, check: CHECK })[s])
    return [
      'WHOLE STATION — at this pace, build the rest of the station in ONE turn, in this order, ending with the',
      'checkpoint. Each part below still holds; ignore any line in it that says "this turn".',
      '',
      ...parts.flatMap((p) => [p, '']),
      twin,
    ].filter(Boolean).join('\n')
  }
  const block = { explore: EXPLORE, name: NAME, practice: PRACTICE, check: CHECK }[stage]
  // The item after a miss: the practice after a failed check, or the check
  // after a missed practice. A new station starts clean.
  return [block, stage === 'practice' || stage === 'check' ? twin : ''].filter(Boolean).join('\n\n')
}
