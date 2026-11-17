/**
 * A question's scenario, split into what it is made of: paragraphs and tables.
 *
 * Scenarios carry results tables, and the model often writes one on a single
 * line -- "...her results. | Distance (cm) | Volume (cm³) ||---|---||10|8.0||"
 * -- which rendered as a wall of pipes. Rows are recovered from the "||"
 * between them so the table can be drawn as a table.
 */
import { splitMarkdownTable } from './studylab/markdownTable'

export type ScenarioBlock =
  | { kind: 'text'; text: string }
  | { kind: 'table'; rows: string[][] }

/** A line holding a markdown divider row: `|---|:---:|`. */
const HAS_DIVIDER = /\|\s*:?-{3,}:?\s*\|/

/** Put a table written on one line back onto one line per row. */
function unflattenTables(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!HAS_DIVIDER.test(line)) return line
      const start = line.indexOf('|')
      const end = line.lastIndexOf('|')
      const before = line.slice(0, start).trim()
      const after = line.slice(end + 1).trim()
      const table = line.slice(start, end + 1).replace(/\|\s*\|/g, '|\n|')
      return [before, table, after].filter(Boolean).join('\n')
    })
    .join('\n')
}

function paragraphs(text: string): ScenarioBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ kind: 'text' as const, text: p }))
}

export function scenarioBlocks(raw: unknown): ScenarioBlock[] {
  const blocks: ScenarioBlock[] = []
  let rest = unflattenTables(String(raw ?? '').replace(/\r\n/g, '\n')).trim()
  while (rest) {
    const split = splitMarkdownTable(rest)
    if (!split) {
      blocks.push(...paragraphs(rest))
      break
    }
    blocks.push(...paragraphs(split.before), { kind: 'table', rows: split.rows })
    rest = split.after
  }
  return blocks
}
