// components/studylab/check/targets.ts

/**
 * Where focus goes back to after Try again: the first thing to answer with --
 * an option, a box to write in, a list, a blank, a tile, a slot or a part of a
 * diagram.
 */
export const ANSWER_TARGETS = [
  '[role="radio"]:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[data-part^="blank-"]:not([disabled])',
  '[data-part^="tile-"]:not([disabled])',
  '[data-part^="slot-"]:not([disabled])',
  '[data-part^="region-"]:not([disabled])',
].join(', ')
