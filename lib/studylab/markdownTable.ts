// lib/studylab/markdownTable.ts

/**
 * Pulls a markdown table out of transcribed text.
 *
 * A homework question is often mostly a table — the pump question is a sentence
 * and then four rows of costs and lifetimes, and that table IS the question.
 * The read transcribes it as markdown, which rendered on the board as a wall of
 * pipes with the numbers running together.
 *
 * Returns the prose either side and the rows between, or null when there is no
 * table, so a caller can render each part as what it is.
 */
export interface SplitTable {
  before: string
  rows: string[][]
  after: string
}

/** A row of a markdown table: at least one pipe, and a pipe at each end. */
function isRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.length > 2
}

/** The `|:---|---:|` line under a header. It carries alignment, not data. */
function isDivider(line: string): boolean {
  return isRow(line) && /^[\s|:-]+$/.test(line)
}

function cells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim())
}

export function splitMarkdownTable(text: string): SplitTable | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex(isRow)
  if (start === -1) return null

  let end = start
  while (end + 1 < lines.length && isRow(lines[end + 1])) end += 1
  // One row on its own is a sentence with pipes in it, not a table.
  if (end === start) return null

  const rows = lines
    .slice(start, end + 1)
    .filter((l) => !isDivider(l))
    .map(cells)
  if (rows.length === 0) return null

  return {
    before: lines.slice(0, start).join('\n').trim(),
    rows,
    after: lines.slice(end + 1).join('\n').trim(),
  }
}
