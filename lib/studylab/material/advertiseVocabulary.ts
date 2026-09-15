import { apparatusNames } from './canon'
import { apparatusDimensions } from './apparatusDimension'
import { MATERIAL_BOX } from './fit'
import { MATERIAL_GOAL_KINDS, MATERIAL_RULE_OPS } from './parse'

/**
 * Prompt fragment listing the composable material vocabulary from live sources.
 * Read by the montessori tutor prompt — numbers come from `MATERIAL_BOX`, names
 * from the canon, dimensions from `apparatusDimensions`, schema nouns from parse.
 */
export function advertiseVocabulary(): string {
  const box = [
    `widthPx: ${MATERIAL_BOX.widthPx}`,
    `heightPx: ${MATERIAL_BOX.heightPx}`,
    `maxGroupsPerRow: ${MATERIAL_BOX.maxGroupsPerRow}`,
    `maxSlotsPerRow: ${MATERIAL_BOX.maxSlotsPerRow}`,
    `maxRows: ${MATERIAL_BOX.maxRows}`,
    `maxTotalSlots: ${MATERIAL_BOX.maxTotalSlots}`,
  ].join('\n')

  const apparatus = apparatusNames()
    .map((name) => {
      const dims = apparatusDimensions(name)
      return dims?.length
        ? `- ${name} — isolates: ${dims.join(' | ')}`
        : `- ${name}`
    })
    .join('\n')

  return [
    'BUILD MATERIAL VOCABULARY:',
    '',
    'MaterialSpec shape (NOT ActivitySpec — no "pattern" / "payload" / "success"):',
    '- prompt: string the student sees',
    '- pieces: [{ id, label, traits: {..numbers or strings}, art?: catalogueName }]',
    '- groups: [{ id, label, ordered: boolean }]',
    '- slots: [{ id, groupId, x, y, capacity, index? }] — groupId must name a group',
    '- controls?: [{ id, label, min, max, step, unit? }]',
    '- displays?: [{ id, kind: beam|bar|gauge|tank|plot, ... }]',
    `- rules: [{ op: ${MATERIAL_RULE_OPS.join('|')}, ... }]`,
    `- goal: { kind: ${MATERIAL_GOAL_KINDS.join('|')}, ... } — required`,
    '- satisfiesCheckpoint?: string — optional step gate id',
    '',
    'Box limits (material must fit inside these):',
    box,
    '',
    'Canon apparatus (intent.apparatus must be one of these exact names):',
    apparatus,
    '',
    'intent.isolates must match the apparatus you chose — copy an isolates value',
    'listed beside that apparatus, do not invent a dimension.',
  ].join('\n')
}
