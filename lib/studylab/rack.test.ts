import { describe, it, expect } from 'vitest'
import fixture from './rack.fixture.json'
import {
  buildRack, totalGaps, nextFix, kanaHomeLine, cleanChapterName, visibleTrays, squareSize, findChapter,
  sectionToStart, chapterLabel, sectionLabel, aboutLine, sheetLine, resolveDeepLink, snapshotRack, changesSince,
  type RackChapter, type RackSection,
} from './rack'

const books = () => JSON.parse(JSON.stringify(fixture.data.textbooks)) as any[]
const trays = buildRack(fixture.data.textbooks)
const chapter = (name: string): RackChapter => {
  for (const t of trays) for (const c of t.chapters) if (c.name === name) return c
  throw new Error(`no chapter ${name}`)
}
const sec = (c: RackChapter, name: string): RackSection => c.sections.find((s) => s.name === name)!

describe('home', () => {
  it('counts gaps', () => expect(totalGaps(trays)).toBe(4))
  it('picks the lowest', () => expect(nextFix(trays)?.section?.name).toBe('Quadratic equations'))
  it('says it', () => expect(kanaHomeLine(trays, nextFix(trays))).toBe("Tiles sticking up have gaps, and you have 4. Let's start with Quadratic equations, it's your lowest."))
  it('invites a first quiz when there are no trays', () => expect(kanaHomeLine([], null)).toBe("Take your first quiz and I'll show you where your gaps are."))
  it('says results are unlinked when there are no trays but other results', () => expect(kanaHomeLine([], null, true)).toBe("Your quiz results are below, but they aren't linked to chapters yet. Take a quiz from a book and I'll show you where your gaps are."))
  it('does not celebrate when nothing was tried', () => {
    const untried = buildRack([{ id: 1, name: 'Maths', topics: [{ id: 2, name: 'Ch', subtopics: [{ id: 3, name: 'A', score: null }] }] }])
    expect(kanaHomeLine(untried, null)).toBe("Nothing tried here yet. Pick a chapter and I'll start you off.")
  })
  it('celebrates only when something was tried and no gaps', () => {
    const t = buildRack([{ id: 1, name: 'Maths', topics: [{ id: 2, name: 'Ch', subtopics: [{ id: 3, name: 'A', score: 90, lowest: 90, attempts: 4 }] }] }])
    expect(kanaHomeLine(t, null)).toBe('Every tile is back in its slot. Pick something new to try.')
  })
  it('names the chapter for a chapter-level pick', () => {
    const p = nextFix(trays)!
    expect(kanaHomeLine(trays, { ...p, section: null })).toContain(`Let's start with ${p.chapter.name}, it's your lowest.`)
  })
  it('makes three trays and leaves the name-only bucket out', () => expect(trays.map((t) => t.subject).sort()).toEqual(['Biology', 'Chemistry', 'Mathematics']))
})

describe('attempts decide whether sections win', () => {
  const one = (subs: any[], score: number | null) => buildRack([{ id: 1, name: 'Maths', topics: [{ id: 2, name: 'Ch', score, lowest: score, subtopics: subs }] }])[0].chapters[0]
  it('2/2 tagged plus a whole-chapter 20 is a gap', () => {
    const c = one([{ id: 3, name: 'A', score: 100, lowest: 100, attempts: 2 }, { id: 4, name: 'B', score: null }], 20)
    expect(c).toMatchObject({ state: 'gap', wholeChapter: { score: 20 } })
    expect(c.sections[0].attempts).toBe(2)
    expect(sectionToStart(c)).toBeNull()
    expect(nextFix(buildRack([{ id: 1, name: 'Maths', topics: [{ id: 2, name: 'Ch', score: 20, lowest: 20, subtopics: [{ id: 3, name: 'A', score: 100, lowest: 100, attempts: 2 }] }] }]))?.section).toBeNull()
  })
  it('a section with 3 attempts beats the whole-chapter score', () => {
    const c = one([{ id: 3, name: 'A', score: 90, lowest: 90, attempts: 3 }], 20)
    expect(c).toMatchObject({ state: 'solid', wholeChapter: null })
  })
})

describe('chapter state', () => {
  it('gap', () => { expect(chapter('Algebra')).toMatchObject({ state: 'gap', gapCount: 2, triedCount: 3 }) })
  it('closed', () => expect(chapter('Number').state).toBe('gold'))
  it('shaky', () => expect(chapter('Atoms').state).toBe('shaky'))
  it('solid', () => expect(chapter('Enzymes').state).toBe('solid'))
  it('not tried', () => expect(chapter('Geometry')).toMatchObject({ state: 'none', gapCount: 0, triedCount: 0 }))
  it('a gap beats a gold section', () => {
    const b = books(); b[0].topics[1].subtopics.push({ id: 1022, name: 'Surds', score: 20, lowest: 20 })
    expect(buildRack(b).flatMap((t) => t.chapters).find((c) => c.name === 'Number')!.state).toBe('gap')
  })
})

describe('whole-chapter score', () => {
  it('decides an untried chapter', () => {
    expect(chapter('The Periodic Table')).toMatchObject({ state: 'gap', gapCount: 1, wholeChapter: { score: 40 } })
    expect(sec(chapter('The Periodic Table'), 'Groups').band).toBe('none')
  })
  it('loses to a tried section', () => {
    const b = books(); const c = b[2].topics[0]; c.subtopics[0].score = 90; c.subtopics[0].lowest = 90; c.subtopics[0].attempts = 3
    const rebuilt = buildRack(b).flatMap((t) => t.chapters).find((x) => x.name === 'The Periodic Table')!
    expect(rebuilt.wholeChapter).toBeNull()
    expect(rebuilt.state).toBe('solid')
  })
  it('adds one square for the chapter to its tray', () => {
    const chem = trays.find((t) => t.subject === 'Chemistry')!
    expect(chem.squares).toEqual(['gap', 'shaky', 'none'])
    expect(chem).toMatchObject({ gapCount: 1, triedCount: 2, totalCount: 3 })
  })
})

describe('chapters with no sections', () => {
  it('get one plate standing for the chapter', () => {
    const atoms = chapter('Atoms')
    expect(atoms.hasSections).toBe(false)
    expect(atoms.sections).toHaveLength(1)
    expect(atoms.sections[0]).toMatchObject({ subtopicId: null, key: 't302', band: 'shaky', score: 74 })
  })
})

describe('tray order', () => {
  const mk = (name: string, secs: (number | null)[]) => ({ id: name.charCodeAt(0), name, topics: [{ id: name.charCodeAt(0) * 10, name: `${name} ch`, subtopics: secs.map((s, i) => ({ id: name.charCodeAt(0) * 100 + i, name: `${name}${i}`, score: s, lowest: s })) }] })
  it('lowest gap first, then most gaps', () => {
    const out = buildRack([mk('D', [null]), mk('C', [30, 30]), mk('B', [40, 40, 40]), mk('A', [20])])
    expect(out.map((t) => t.subject)).toEqual(['A', 'B', 'C', 'D'])
  })
  it('tried before untried, then by name', () => {
    const out = buildRack([mk('Z', [null]), mk('Y', [90]), mk('X', [null])])
    expect(out.map((t) => t.subject)).toEqual(['Y', 'X', 'Z'])
  })
  it('breaks a tie on the newer attempt, then book order', () => {
    const b = [mk('A', [30]), mk('B', [30])]
    ;(b[0].topics[0].subtopics[0] as any).last_assessed = '2026-10-01T00:00:00Z'
    ;(b[1].topics[0].subtopics[0] as any).last_assessed = '2026-11-01T00:00:00Z'
    expect(nextFix(buildRack(b))?.section?.name).toBe('B0')
    delete (b[1].topics[0].subtopics[0] as any).last_assessed
    delete (b[0].topics[0].subtopics[0] as any).last_assessed
    expect(nextFix(buildRack(b))?.section?.name).toBe('A0')
  })
})

describe('merging and junk', () => {
  it('merges two books with one subject, in order', () => {
    const b = [
      { id: 1, name: 'Maths 1', topics: [{ id: 1, name: 'One', subtopics: [] }] },
      { id: 2, name: 'Maths 2', topics: [{ id: 2, name: 'Two', subtopics: [] }] },
    ]
    const out = buildRack(b, () => 'Mathematics')
    expect(out).toHaveLength(1)
    expect(out[0].chapters.map((c) => c.name)).toEqual(['One', 'Two'])
  })
  it('survives junk', () => {
    expect(() => buildRack([null, {}, { topics: 'x' }, { name: 'X', topics: [null] }])).not.toThrow()
    expect(buildRack([null, {}, { topics: 'x' }, { name: 'X', topics: [null] }])).toEqual([])
  })
})

describe('cleanChapterName', () => {
  it.each([
    ['Chapter 1: Cells', 'Cells'], ['Unit 3 - Waves', 'Waves'], ['Unit conversions', 'Unit conversions'],
    ['Topic 3.2 Waves', 'Waves'], ['Chapter 3.2: Waves', 'Waves'], ['Term limits', 'Term limits'], ['Chapter 1', 'Chapter 1'], ['Unit civil rights', 'Unit civil rights'],
  ])('%s', (raw, clean) => expect(cleanChapterName(raw)).toBe(clean))
})

describe('layout helpers', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ ...trays[0], key: `k${i}` }))
  it('shows six trays, then all', () => {
    expect(visibleTrays(eight, false)).toMatchObject({ hidden: 2 })
    expect(visibleTrays(eight, false).shown).toHaveLength(6)
    expect(visibleTrays(eight, true)).toMatchObject({ hidden: 0 })
    expect(visibleTrays(eight, true).shown).toHaveLength(8)
  })
  it.each([[49, 13], [50, 9], [100, 9], [120, 6]])('squareSize %i', (n, size) => expect(squareSize(n)).toBe(size))
})

describe('labels', () => {
  it('chapterLabel', () => {
    expect(chapterLabel(chapter('Algebra'))).toBe('Algebra, 2 gaps: Factorising, Quadratic equations')
    expect(chapterLabel(chapter('Number'))).toBe('Number, a gap you closed')
    expect(chapterLabel(chapter('Atoms'))).toBe('Atoms, shaky')
    expect(chapterLabel(chapter('Enzymes'))).toBe('Enzymes, solid')
    expect(chapterLabel(chapter('Geometry'))).toBe('Geometry, not tried yet')
  })
  it('sectionLabel', () => {
    expect(sectionLabel(sec(chapter('Movement into and out of cells'), 'Osmosis'))).toBe('Osmosis, 34%, a gap')
    expect(sectionLabel(sec(chapter('Movement into and out of cells'), 'Active transport'))).toBe('Active transport, not tried yet')
    expect(sectionLabel(sec(chapter('Number'), 'Types of number'))).toBe('Types of number, gap closed, 38% to 86%')
  })
  it('aboutLine', () => {
    expect(aboutLine(chapter('Movement into and out of cells'))).toBe('Covers Osmosis, Diffusion and Active transport')
    expect(aboutLine(chapter('Algebra'))).toBe('Covers Expanding brackets, Factorising, Quadratic equations and more')
    expect(aboutLine(chapter('Atoms'))).toBeNull()
  })
})

describe('sectionToStart', () => {
  const algebra = () => chapter('Algebra')
  it('takes the wanted section', () => expect(sectionToStart(algebra(), 1011)?.name).toBe('Expanding brackets'))
  it('ignores a wanted id from another chapter', () => expect(sectionToStart(algebra(), 2011)?.name).toBe('Quadratic equations'))
  it('goes to the lowest gap', () => expect(sectionToStart(algebra())?.name).toBe('Quadratic equations'))
  it('then the first', () => expect(sectionToStart(chapter('Enzymes'))?.name).toBe('Enzyme action'))
  it('gives nothing for a whole-chapter gap with nothing tried', () => expect(sectionToStart(chapter('The Periodic Table'))).toBeNull())
  it('goes to the first untried when nothing is a gap', () => {
    expect(sectionToStart(chapter('Geometry'))?.name).toBe('Angles')
  })
})

describe('sheetLine', () => {
  const movement = () => chapter('Movement into and out of cells')
  it('gap', () => expect(sheetLine(movement(), sec(movement(), 'Osmosis'))).toEqual({ lead: 'Osmosis', rest: ' is on 34%. Want me to teach it, then you retake it?', actions: ['teach', 'retake'] }))
  it('solid', () => expect(sheetLine(chapter('Enzymes'), sec(chapter('Enzymes'), 'Enzyme action'))).toEqual({ lead: 'Enzyme action', rest: ' is solid at 88%. Retake it any time to keep it that way.', actions: ['retake', 'teach'] }))
  it('untried', () => expect(sheetLine(movement(), sec(movement(), 'Active transport'))).toEqual({ lead: 'Active transport', rest: ' is new to us. A short quiz shows where you stand.', actions: ['teach', 'quiz'] }))
  it('gold', () => expect(sheetLine(chapter('Number'), sec(chapter('Number'), 'Types of number'))).toEqual({ lead: 'You closed this gap.', rest: ' 38% to 86%, well done.', actions: ['retake'] }))
  it('whole chapter', () => expect(sheetLine(chapter('The Periodic Table'), null)).toEqual({ lead: 'This chapter', rest: ' is on 40%. Want me to teach it, then you retake it?', actions: ['teach', 'retake'] }))
  it('cheer with a scored next offers teach and retake', () => expect(sheetLine(movement(), sec(movement(), 'Osmosis'), { name: 'Osmosis', next: sec(movement(), 'Diffusion') }).actions).toEqual(['teach', 'retake']))
  it('cheer with an untried next offers teach and quiz', () => expect(sheetLine(movement(), sec(movement(), 'Osmosis'), { name: 'Osmosis', next: sec(movement(), 'Active transport') }).actions).toEqual(['teach', 'quiz']))
  it('a gold section can be retaken', () => expect(sheetLine(chapter('Number'), sec(chapter('Number'), 'Types of number')).actions).toEqual(['retake']))
  it('cheer with next', () => expect(sheetLine(movement(), sec(movement(), 'Osmosis'), { name: 'Osmosis', next: sec(movement(), 'Diffusion') })).toMatchObject({ lead: 'Nice, Osmosis is gold now.', rest: ' Next up, Diffusion.' }))
  it('cheer without next', () => expect(sheetLine(movement(), sec(movement(), 'Osmosis'), { name: 'Osmosis', next: null })).toMatchObject({ lead: 'Nice, that was the last gap here.', rest: ' Go back and watch this tile drop into its slot.' }))
})

describe('resolveDeepLink', () => {
  const raw = fixture.data.textbooks
  const none = { topicId: null, subtopicId: null, trayKey: null }
  it('finds a chapter and section', () => expect(resolveDeepLink(trays, raw, { chapter: '101', section: '1012' })).toMatchObject({ topicId: 101, subtopicId: 1012 }))
  it('ignores a section from another chapter', () => expect(resolveDeepLink(trays, raw, { chapter: '101', section: '2011' })).toMatchObject({ topicId: 101, subtopicId: null }))
  it('gives nothing for a stale chapter', () => expect(resolveDeepLink(trays, raw, { chapter: '999999' })).toEqual(none))
  it('gives nothing for a junk chapter', () => expect(resolveDeepLink(trays, raw, { chapter: 'abc' })).toEqual(none))
  it('subject with focus lands on the section', () => {
    const r = resolveDeepLink(trays, raw, { subject: 'Mathematics', focus: 'Factorising' })
    expect(r).toMatchObject({ topicId: 101, subtopicId: 1012 })
    expect(r.trayKey).toBe(trays.find((t) => t.subject === 'Mathematics')!.key)
  })
  it('assessment beats subject', () => {
    const r = resolveDeepLink(trays, raw, { assessment: 'a2', subject: 'Mathematics' })
    expect(r.trayKey).toBe(trays.find((t) => t.subject === 'Biology')!.key)
  })
  it('a focus that matches nothing gives the tray only', () => {
    const r = resolveDeepLink(trays, raw, { subject: 'Biology', focus: 'Kingdom of Buganda' })
    expect(r).toMatchObject({ topicId: null, subtopicId: null })
    expect(r.trayKey).toBe(trays.find((t) => t.subject === 'Biology')!.key)
  })
  it('a focus in several chapters picks the one with a gap, else the first', () => {
    const b = books()
    b[0].topics.push({ id: 104, name: 'Statistics', subtopics: [{ id: 1041, name: 'Introduction', score: 90, lowest: 90 }] })
    b[0].topics.push({ id: 105, name: 'Probability', subtopics: [{ id: 1051, name: 'Introduction', score: 20, lowest: 20 }] })
    const t = buildRack(b)
    expect(resolveDeepLink(t, b, { subject: 'Mathematics', focus: 'Introduction' })).toMatchObject({ topicId: 105, subtopicId: 1051 })
    b[0].topics[4].subtopics[0].score = 90; b[0].topics[4].subtopics[0].lowest = 90
    const t2 = buildRack(b)
    expect(resolveDeepLink(t2, b, { subject: 'Mathematics', focus: 'Introduction' })).toMatchObject({ topicId: 104 })
  })
  it('an exact name beats a partial match', () => {
    const b = books()
    b[0].topics.push({ id: 104, name: 'Factorising and more', subtopics: [{ id: 1041, name: 'Factorising quadratics', score: 20, lowest: 20 }] })
    expect(resolveDeepLink(buildRack(b), b, { subject: 'Mathematics', focus: 'Factorising' })).toMatchObject({ topicId: 101, subtopicId: 1012 })
  })
  it('a focus naming a chapter gives the chapter and no section', () => {
    expect(resolveDeepLink(trays, raw, { subject: 'Mathematics', focus: 'Algebra' })).toMatchObject({ topicId: 101, subtopicId: null })
  })
})

describe('findChapter', () => {
  it('finds, or gives null', () => {
    expect(findChapter(trays, 302)?.chapter.name).toBe('Atoms')
    expect(findChapter(trays, 999999)).toBeNull()
  })
})

describe('changesSince', () => {
  it('has nothing to say with no before', () => expect(changesSince(null, trays)).toEqual({ dropped: [], gold: [] }))
  it('reports a chapter that left gap, and a section that went gold', () => {
    const before = snapshotRack(trays)
    const b = books()
    b[1].topics[0].subtopics[0].score = 90; b[1].topics[0].subtopics[0].lowest = 34
    const after = buildRack(b)
    expect(changesSince(before, after)).toEqual({ dropped: [201], gold: ['s2011'] })
  })
  it('does not report a chapter that stays a gap', () => {
    const before = snapshotRack(trays)
    const b = books(); b[0].topics[0].subtopics[2].score = 30
    expect(changesSince(before, buildRack(b)).dropped).toEqual([])
  })
  it('reports a chapter that went from gap to shaky', () => {
    const before = snapshotRack(trays)
    const b = books(); b[1].topics[0].subtopics[0].score = 60; b[1].topics[0].subtopics[0].lowest = 34
    expect(changesSince(before, buildRack(b)).dropped).toEqual([201])
  })
})
