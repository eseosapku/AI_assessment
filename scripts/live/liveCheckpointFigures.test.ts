/**
 * Can a Checkpoint paper get figures from the platform's own library?
 *
 * Checkpoint sends no textbook_id, so it qualifies as a "custom topic quiz" and
 * the route searches the whole vision-described library by content rather than
 * scoping to one book. Whether that search actually finds anything for Stage 6
 * and Stage 9 science topics is a question about the library's contents, which
 * no mocked test can answer.
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveCheckpointFigures
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { getDescribedImages } from '@/lib/textbook-source-images'
import { rankImagesForFreeTopics, buildVisualFigureCatalogForTopics } from '@/lib/textbook-vision-images'
import { checkpointSubject } from '@/lib/cambridge-checkpoint'
import { buildPaper, paperTopics } from '@/lib/checkpoint-paper'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!
const MATHS = checkpointSubject('lower-secondary', 'Mathematics')!

describe('the figure library, against Checkpoint foci', () => {
  it('says how many figures each subject can reach', async () => {
    const described = getDescribedImages()
    console.log(`\nlibrary: ${described.length} described figures`)

    for (const subject of [SCIENCE, MATHS]) {
      const paper = buildPaper(subject, subject.components[0], { mode: 'paper', seed: 7 })
      const topics = paperTopics(paper)
      const ranked = rankImagesForFreeTopics(described, topics)
      console.log(`\n${subject.name}: ${topics.length} foci → ${ranked.length} figures rank above the floor`)
      ranked.slice(0, 5).forEach((img) =>
        console.log(`   ${img.key} | ${String(img.description).slice(0, 78)}`),
      )

      // Per-focus, which is what actually matters: a paper needs figures spread
      // across its questions, not thirty matches on one topic.
      const covered = topics.filter((t) => rankImagesForFreeTopics(described, [t]).length > 0)
      console.log(`   foci with at least one figure: ${covered.length}/${topics.length}`)
      console.log(`   uncovered: ${topics.filter((t) => !covered.includes(t)).slice(0, 6).join(' | ')}`)
    }
  }, 300_000)

  it('reports what the route would actually attach', async () => {
    const paper = buildPaper(SCIENCE, SCIENCE.components[0], { mode: 'paper', seed: 7 })
    const catalog = await buildVisualFigureCatalogForTopics({
      topics: paperTopics(paper),
      questionCount: paper.slots.length,
    })
    console.log(`\nroute would offer ${catalog.length} figure(s) for a ${paper.slots.length}-question paper`)
    catalog.slice(0, 6).forEach((c) =>
      console.log(`   ${c.key} [${c.category}] ${String(c.description).slice(0, 74)}`),
    )
    expect(Array.isArray(catalog)).toBe(true)
  }, 600_000)
})
