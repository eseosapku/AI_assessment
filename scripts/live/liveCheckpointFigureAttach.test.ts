/**
 * Do figures actually reach a generated Checkpoint paper?
 *
 * The library can hold twenty thousand figures and a paper still come back
 * bare, and it has: the figures were extracted but had no vision description,
 * so the library-wide search -- which filters on description -- could not see
 * one of them. Before that, they were not in the curated manifest the runtime
 * reads. Neither failure shows up in a unit test; both look like "the model
 * chose not to use a figure".
 *
 * So this checks the chain end to end, and says WHICH link is broken.
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveCheckpointFigureAttach
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { getDescribedImages } from '@/lib/textbook-source-images'
import { checkpointSubject } from '@/lib/cambridge-checkpoint'
import { buildPaper, paperTopics } from '@/lib/checkpoint-paper'
import { figuresForFoci } from '@/lib/checkpoint-figures'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

describe('the figure chain', () => {
  it('has described figures at all', () => {
    const described = getDescribedImages()
    console.log(`\ndescribed figures visible to search: ${described.length}`)
    const exam = described.filter((i) => (i as { kind?: string }).kind === 'vector')
    console.log(`  of which rendered from exam papers: ${exam.length}`)
    expect(described.length, 'nothing is described — run vision-curate then apply').toBeGreaterThan(0)
  })

  it('finds figures for a real paper’s foci', async () => {
    const paper = buildPaper(SCIENCE, SCIENCE.components[0], { mode: 'paper', seed: 21 })
    const catalog = await figuresForFoci(paperTopics(paper), 17)
    console.log(`\nfigures offered for a ${paper.slots.length}-question paper: ${catalog.length}`)
    catalog.slice(0, 6).forEach((c) =>
      console.log(`   ${c.key} [${c.category}] ${String(c.description).slice(0, 70)}`),
    )
    expect(catalog.length, 'no figure matched any focus in the paper').toBeGreaterThan(0)
  }, 300_000)
})
