// lib/studylab/point.ts

/**
 * The parts of a card Kana can point at, and how to find one on the board.
 *
 * Each renderer marks its parts with `data-part`: a concept card's list items
 * (`item-1`, from 1), a worked card's steps (`step-1`), a table's cells
 * (`r0c1` is the header row, body rows from `r1`), a question's options
 * (`option-1`), and a material's pieces and slots (`piece-<id>`,
 * `slot-<id>`). The tutor names one; the board glows it and the bubble's arrow
 * reaches it.
 */
const PART = /^(?:item-\d{1,3}|step-\d{1,3}|r\d{1,3}c\d{1,3}|option-\d{1,2}|blank-\d{1,2}|piece-[A-Za-z0-9_-]{1,60}|slot-[A-Za-z0-9_-]{1,60}|region-[a-z0-9-]{1,60})$/

/** Whether a part name is one the renderers draw. It goes into a selector, so nothing else is. */
export function isValidPart(part: string): boolean {
  return PART.test(part)
}

/**
 * Escapes a value for a double-quoted attribute selector. A control character
 * -- a newline in a model's card id -- is written as its CSS hex escape: left
 * raw, querySelector threw, and took the stage down with it.
 */
function quoted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f\u007f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)
}

/** The card on the board, and the part inside it when the part is one; else the whole card. */
export function pointSelector(nodeId: string, part?: string): string {
  const card = `.react-flow__node[data-id="${quoted(nodeId)}"]`
  return part && isValidPart(part) ? `${card} [data-part="${part}"]` : card
}

/**
 * Whether the camera goes to what Kana points at: only when the pointing is new
 * and the learner's card did not change with it. A turn that builds a new card
 * and points at an older one keeps the camera on the new card, the older one
 * glowing; and moving along the queue with a pointer still up does not fly back
 * to it. Flying there fought the camera on its way to the new card, left it
 * between the two, and marked the board as moved by the learner ("Back to my
 * card") when they had not touched it.
 */
export function pointerTakesCamera(input: { pointerMoved: boolean; focusMoved: boolean; pointNode: string | null; focusId: string | null; placed: boolean; away: boolean }): boolean {
  const { pointerMoved, focusMoved, pointNode, focusId, placed, away } = input
  return !!pointNode && pointerMoved && !focusMoved && pointNode !== focusId && placed && !away
}
