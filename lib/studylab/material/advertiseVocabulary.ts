import { apparatusNames } from './canon'
import { apparatusDimension } from './apparatusDimension'
import { MATERIAL_BOX } from './fit'

/**
 * Prompt fragment listing the composable material vocabulary from live sources.
 * Read by the montessori tutor prompt — numbers come from `MATERIAL_BOX`, names
 * from the canon, dimensions from `apparatusDimension`.
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
      const dim = apparatusDimension(name)
      return dim ? `- ${name} — isolates: ${dim}` : `- ${name}`
    })
    .join('\n')

  return [
    'BUILD MATERIAL VOCABULARY:',
    '',
    'Box limits (material must fit inside these):',
    box,
    '',
    'Canon apparatus (intent.apparatus must be one of these exact names):',
    apparatus,
    '',
    'intent.isolates must match the apparatus you chose — copy the isolates value',
    'listed beside that apparatus, do not invent a dimension.',
  ].join('\n')
}
