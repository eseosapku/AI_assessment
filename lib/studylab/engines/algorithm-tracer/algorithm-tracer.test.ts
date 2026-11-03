import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  algorithmTracerEngine as engine, ALGORITHMS, BUGS, MAX_ITEMS, MAX_LINE_CHARS, MAX_ROWS, MAX_SORT_ITEMS, MAX_VALUE, MIN_ITEMS,
  answerCells, canon, cellKey, correctRun, expectedAnswer, explain, faultFound, faultLine, faultSaid, fixedLine, judgePredict, judgeTrace,
  layout, lineText, predictSaid, readState, symptom, traceSaid, traceSolution,
  type AlgoId, type AlgorithmTracerConfig, type AlgorithmTracerState, type BugId, type Kind,
} from './config'
import { AlgorithmTracerView, ArrayStrip, arrayBefore, CELL_MIN, stripGeometry, TABLE_LABEL_WIDTH } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { checkIntent } from '../../activities/intent'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Short algorithms in Cambridge pseudocode: the tutor names an algorithm and
 * its numbers, the engine writes the listing and runs it, and the learner
 * fills the trace table, predicts the output, or taps the faulty line.
 */

type Raw = { values: number[]; target?: number; limit?: number }
const cfg = (kind: Kind, algorithm: AlgoId, raw: Raw, bug?: BugId): AlgorithmTracerConfig =>
  ({ task: { kind, algorithm, values: raw.values, ...(raw.target !== undefined ? { target: raw.target } : {}), ...(raw.limit !== undefined ? { limit: raw.limit } : {}), ...(bug ? { bug } : {}) } })

// ---------------------------------------------------------------------------
// Independent oracles: plain loops that share nothing with the engine's interpreter.

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)
const oCount = (v: number[], limit: number) => v.filter((x) => x > limit).length
const oSearch = (v: number[], target: number) => (v.includes(target) ? `${v.indexOf(target) + 1}` : 'Not found')
const oBubble = (v: number[]): number[] => {
  const a = [...v]
  for (let i = 0; i + 1 < a.length; i++) if (a[i] > a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]]
  return a
}
/** What the correct algorithm leaves: OUTPUT, or Data after a pass. */
function oracle(algo: AlgoId, r: Raw): string[] {
  const v = r.values
  switch (algo) {
    case 'total': return [`${sum(v)}`]
    case 'count': return [`${oCount(v, r.limit!)}`]
    case 'maximum': return [`${Math.max(...v)}`]
    case 'minimum': return [`${Math.min(...v)}`]
    case 'linear-search': return [oSearch(v, r.target!)]
    case 'bubble-pass': return oBubble(v).map(String)
  }
}

/** What each planted bug leaves, written out by hand as a plain loop. */
const BUGGY: Record<BugId, (r: Raw) => string[]> = {
  'total-starts-at-one': (r) => [`${1 + sum(r.values)}`],
  'total-adds-index': (r) => [`${r.values.reduce((a, _, i) => a + i + 1, 0)}`],
  'total-skips-first': (r) => [`${sum(r.values.slice(1))}`],
  'total-skips-last': (r) => [`${sum(r.values.slice(0, -1))}`],
  'count-ge': (r) => [`${r.values.filter((x) => x >= r.limit!).length}`],
  'count-less': (r) => [`${r.values.filter((x) => x < r.limit!).length}`],
  'count-starts-at-one': (r) => [`${1 + oCount(r.values, r.limit!)}`],
  'count-not-incremented': (r) => [`${oCount(r.values, r.limit!) > 0 ? 1 : 0}`],
  'max-wrong-way': (r) => [`${Math.min(...r.values)}`],
  'max-skips-last': (r) => [`${Math.max(...r.values.slice(0, -1))}`],
  'max-stores-index': (r) => {
    let m = r.values[0]
    for (let i = 2; i <= r.values.length; i++) if (r.values[i - 1] > m) m = i
    return [`${m}`]
  },
  'min-wrong-way': (r) => [`${Math.max(...r.values)}`],
  'min-skips-last': (r) => [`${Math.min(...r.values.slice(0, -1))}`],
  'min-stores-index': (r) => {
    let m = r.values[0]
    for (let i = 2; i <= r.values.length; i++) if (r.values[i - 1] < m) m = i
    return [`${m}`]
  },
  'min-starts-at-zero': () => ['0'],
  'search-stops-early': (r) => {
    let i = 1
    let found = false
    while (i < r.values.length && !found) {
      if (r.values[i - 1] === r.target) found = true
      else i++
    }
    return [found ? `${i}` : 'Not found']
  },
  'search-not-equal': (r) => {
    let i = 1
    let found = false
    while (i <= r.values.length && !found) {
      if (r.values[i - 1] !== r.target) found = true
      else i++
    }
    return [found ? `${i}` : 'Not found']
  },
  'search-starts-at-two': (r) => {
    let i = 2
    let found = false
    while (i <= r.values.length && !found) {
      if (r.values[i - 1] === r.target) found = true
      else i++
    }
    return [found ? `${i}` : 'Not found']
  },
  'search-output-off-by-one': (r) => [r.values.includes(r.target!) ? `${r.values.indexOf(r.target!) + 2}` : 'Not found'],
  'bubble-wrong-way': (r) => {
    const a = [...r.values]
    for (let i = 0; i + 1 < a.length; i++) if (a[i] < a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]]
    return a.map(String)
  },
  'bubble-loses-value': (r) => {
    const a = [...r.values]
    for (let i = 0; i + 1 < a.length; i++) {
      if (a[i] > a[i + 1]) {
        a[i] = a[i + 1]
        a[i + 1] = a[i]
      }
    }
    return a.map(String)
  },
  'bubble-stops-early': (r) => {
    const a = [...r.values]
    for (let i = 0; i + 2 < a.length; i++) if (a[i] > a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]]
    return a.map(String)
  },
}

/** Whether a config teaches something, decided without the engine: the rules of the brief, written again. */
function worthwhile(kind: Kind, algo: AlgoId, r: Raw, bug?: BugId): boolean {
  const v = r.values
  if (kind === 'fault') return BUGGY[bug!](r).join('|') !== oracle(algo, r).join('|')
  if (kind === 'predict' && (algo === 'maximum' || algo === 'minimum')) return false
  switch (algo) {
    case 'total': return true
    case 'count': return oCount(v, r.limit!) > 0 && oCount(v, r.limit!) < v.length
    case 'maximum': return v[0] !== Math.max(...v)
    case 'minimum': return v[0] !== Math.min(...v)
    case 'linear-search': return v[0] !== r.target
    case 'bubble-pass': return oBubble(v).join() !== v.join()
  }
}

const MAIN: Record<AlgoId, Raw> = {
  'total': { values: [4, 9, 2, 7, 5] },
  'count': { values: [4, 9, 5, 7, 2], limit: 5 },
  'maximum': { values: [3, 8, 2, 11, 6] },
  'minimum': { values: [9, 6, 12, 8, 3] },
  'linear-search': { values: [4, 9, 2, 7, 5], target: 7 },
  'bubble-pass': { values: [4, 9, 2, 7, 5] },
}
const SEARCH = cfg('trace', 'linear-search', MAIN['linear-search'])
const TOTAL = cfg('trace', 'total', MAIN.total)
const BUBBLE = cfg('trace', 'bubble-pass', MAIN['bubble-pass'])

const listing = (c: AlgorithmTracerConfig) => layout(c).lines.map(lineText)
const bugsOf = (a: AlgoId) => BUGS.filter((b) => b.algorithm === a).map((b) => b.id)

describe('the pseudocode the engine writes', () => {
  it('writes totalling as the syllabus does: DECLARE, the arrow, FOR ... NEXT, OUTPUT', () => {
    expect(listing(TOTAL)).toEqual([
      'DECLARE Data : ARRAY[1:5] OF INTEGER',
      'DECLARE Total : INTEGER',
      'DECLARE Index : INTEGER',
      'Total ← 0',
      'FOR Index ← 1 TO 5',
      '   Total ← Total + Data[Index]',
      'NEXT Index',
      'OUTPUT Total',
    ])
  })

  it('writes a linear search with WHILE ... DO ... ENDWHILE, IF ... THEN ... ELSE ... ENDIF', () => {
    expect(listing(SEARCH)).toEqual([
      'DECLARE Data : ARRAY[1:5] OF INTEGER',
      'DECLARE Target : INTEGER',
      'DECLARE Index : INTEGER',
      'DECLARE Found : BOOLEAN',
      'Found ← FALSE',
      'Index ← 1',
      'WHILE Index <= 5 AND Found = FALSE DO',
      '   IF Data[Index] = Target THEN',
      '      Found ← TRUE',
      '   ELSE',
      '      Index ← Index + 1',
      '   ENDIF',
      'ENDWHILE',
      'IF Found = TRUE THEN',
      '   OUTPUT Index',
      'ELSE',
      '   OUTPUT "Not found"',
      'ENDIF',
    ])
  })

  it('writes counting, a maximum and one bubble sort pass', () => {
    expect(listing(cfg('trace', 'count', MAIN.count)).slice(3)).toEqual([
      'DECLARE Index : INTEGER', 'Count ← 0', 'FOR Index ← 1 TO 5', '   IF Data[Index] > Limit THEN', '      Count ← Count + 1', '   ENDIF', 'NEXT Index', 'OUTPUT Count',
    ])
    expect(listing(cfg('trace', 'maximum', MAIN.maximum)).slice(3)).toEqual([
      'Max ← Data[1]', 'FOR Index ← 2 TO 5', '   IF Data[Index] > Max THEN', '      Max ← Data[Index]', '   ENDIF', 'NEXT Index', 'OUTPUT Max',
    ])
    expect(listing(BUBBLE)).toEqual([
      'DECLARE Data : ARRAY[1:5] OF INTEGER',
      'DECLARE Temp : INTEGER',
      'DECLARE Index : INTEGER',
      'FOR Index ← 1 TO 4',
      '   IF Data[Index] > Data[Index + 1] THEN',
      '      Temp ← Data[Index]',
      '      Data[Index] ← Data[Index + 1]',
      '      Data[Index + 1] ← Temp',
      '   ENDIF',
      'NEXT Index',
    ])
  })

  it('plants a bug as the one changed line, and the same line is right in the correct listing', () => {
    const c = cfg('fault', 'maximum', MAIN.maximum, 'max-stores-index')
    expect(faultLine(c)).toBe(7)
    expect(listing(c)[6]).toBe('      Max ← Index')
    expect(fixedLine(c)).toBe('Max ← Data[Index]')
    const loop = cfg('fault', 'total', MAIN.total, 'total-skips-last')
    expect(listing(loop)[4]).toBe('FOR Index ← 1 TO 4')
    expect(faultLine(loop)).toBe(5)
    expect(fixedLine(loop)).toBe('FOR Index ← 1 TO 5')
    expect(fixedLine(cfg('fault', 'linear-search', MAIN['linear-search'], 'search-stops-early'))).toBe('WHILE Index <= 5 AND Found = FALSE DO')
  })

  it('never writes a line wider than the card can show at 12px, for any size of array or any bug', () => {
    for (const algo of ALGORITHMS) {
      for (let n = MIN_ITEMS; n <= (algo === 'bubble-pass' ? MAX_SORT_ITEMS : MAX_ITEMS); n++) {
        for (const bug of [undefined, ...bugsOf(algo)]) {
          const c = cfg(bug ? 'fault' : 'trace', algo, { values: Array.from({ length: n }, (_, i) => i + 1), target: 5, limit: 3 }, bug)
          for (const l of layout(c).lines) expect(lineText(l).length, `${algo} line ${l.n}`).toBeLessThanOrEqual(MAX_LINE_CHARS)
        }
      }
    }
  })
})

describe('running the pseudocode gives the true trace', () => {
  it('matches a plain loop for every algorithm over many arrays', () => {
    let seed = 11
    const rand = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
    }
    for (let k = 0; k < 600; k++) {
      const algo = ALGORITHMS[k % ALGORITHMS.length]
      const n = MIN_ITEMS + rand((algo === 'bubble-pass' ? MAX_SORT_ITEMS : MAX_ITEMS) - MIN_ITEMS + 1)
      const raw: Raw = { values: Array.from({ length: n }, () => rand(MAX_VALUE + 1)), target: rand(MAX_VALUE + 1), limit: rand(MAX_VALUE + 1) }
      if (algo === 'linear-search' && rand(2)) raw.target = raw.values[rand(n)]
      const c = cfg('trace', algo, raw)
      const run = correctRun(c)
      expect(run.error).toBeNull()
      expect(answerCells(run, algo), JSON.stringify([algo, raw])).toEqual(oracle(algo, raw))
      for (const bug of bugsOf(algo)) {
        const bugged = layout(cfg('fault', algo, raw, bug)).run
        if (bugged.error) throw new Error(`${bug} stops with ${bugged.error}`)
        expect(answerCells(bugged, algo), JSON.stringify([bug, raw])).toEqual(BUGGY[bug](raw))
      }
    }
  })

  it('follows the totals a learner would, pass by pass', () => {
    const L = layout(TOTAL)
    expect(L.rows.map((r) => [r.label, r.truth?.after.Total, r.truth?.after.OUTPUT])).toEqual([
      ['Start', '0', ''], ['Index = 1', '4', ''], ['Index = 2', '13', ''], ['Index = 3', '15', ''], ['Index = 4', '22', ''], ['Index = 5', '27', ''], ['Finish', '27', '27'],
    ])
    // The line that gave each value, so a wrong cell can be said back with its line.
    expect(L.rows[2].truth?.setBy).toEqual({ Total: 6 })
    expect(L.rows[6].truth?.setBy).toEqual({ OUTPUT: 8 })
  })

  it('stops a linear search when the target is found, and leaves the rows after it spare', () => {
    const L = layout(SEARCH)
    expect(L.rows.map((r) => [r.id, r.truth ? [r.truth.after.Index, r.truth.after.Found, r.truth.after.OUTPUT] : null])).toEqual([
      ['start', ['1', 'FALSE', '']],
      ['p1', ['2', 'FALSE', '']], ['p2', ['3', 'FALSE', '']], ['p3', ['4', 'FALSE', '']], ['p4', ['4', 'TRUE', '']],
      ['p5', null],
      ['finish', ['4', 'TRUE', '4']],
    ])
    // A target that is not there runs to the end: no spare row.
    const absent = layout(cfg('trace', 'linear-search', { values: [4, 9, 2, 7, 5], target: 8 }))
    expect(absent.rows.filter((r) => r.kind === 'pass' && r.truth).length).toBe(5)
    expect(absent.rows.at(-1)?.truth?.after.OUTPUT).toBe('Not found')
  })

  it('traces a bubble sort pass as the array after each comparison, with Temp', () => {
    const L = layout(BUBBLE)
    const arr = (r: (typeof L.rows)[number]) => [1, 2, 3, 4, 5].map((i) => r.truth?.after[`D${i}`]).join(' ')
    expect(L.rows.map((r) => [r.label, r.truth?.after.Temp, arr(r)])).toEqual([
      ['Start', '', '4 9 2 7 5'], ['Index = 1', '', '4 9 2 7 5'], ['Index = 2', '9', '4 2 9 7 5'], ['Index = 3', '9', '4 2 7 9 5'], ['Index = 4', '9', '4 2 7 5 9'],
    ])
    // The start row is the array as given, for the learner to carry down from.
    expect(L.rows[0].cells).toMatchObject({ Temp: 'none', D1: 'given', D5: 'given' })
    expect(L.rows[2].cells).toMatchObject({ Temp: 'fill', D1: 'fill', D5: 'fill' })
  })

  it('keeps every table to the rows a card can draw', () => {
    for (const algo of ALGORITHMS) {
      const n = algo === 'bubble-pass' ? MAX_SORT_ITEMS : MAX_ITEMS
      const c = cfg('trace', algo, { values: Array.from({ length: n }, (_, i) => 99 - i), target: 3, limit: 5 })
      expect(layout(c).rows.length, algo).toBeLessThanOrEqual(MAX_ROWS)
    }
  })
})

describe('the algorithm-tracer engine reads what the tutor writes', () => {
  it('reads a config however it is reasonably written', () => {
    const want = cfg('trace', 'linear-search', MAIN['linear-search'])
    expect(engine.parse(want)).toEqual(want)
    expect(engine.parse({ task: { kind: 'Trace table', algorithm: 'Linear search', values: '4, 9, 2, 7, 5', target: '7' } })).toEqual(want)
    expect(engine.parse({ task: { algorithm: 'linear_search', data: ['4', 9, 2, 7, 5], search_for: 7 } })).toEqual(want)
    expect(engine.parse({ algorithm: 'linear-search', values: [4, 9, 2, 7, 5], target: 7 })).toEqual(want)
    expect(engine.parse({ task: { kind: 'predict the output', algorithm: 'Totalling', values: [4, 9, 2] } })).toEqual(cfg('predict', 'total', { values: [4, 9, 2] }))
    expect(engine.parse({ task: { kind: 'find-the-fault', algorithm: 'count', values: [4, 9, 5], limit: 5, bug: 'ge' } })).toEqual(cfg('fault', 'count', { values: [4, 9, 5], limit: 5 }, 'count-ge'))
    expect(engine.parse({ task: { kind: 'fault', algorithm: 'one pass of bubble sort', values: [4, 9, 2], bug: 'bubble-loses-value' } })).toEqual(cfg('fault', 'bubble-pass', { values: [4, 9, 2] }, 'bubble-loses-value'))
    // No kind is a trace table.
    expect(engine.parse({ task: { algorithm: 'maximum', values: [1, 5, 3] } })!.task.kind).toBe('trace')
  })

  it('reads what it cannot use, so that faults can say what to fix, and returns null only for what it cannot read at all', () => {
    for (const bad of [null, 'trace', 7, {}, { task: 'trace' }, { task: null }]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    const unread = (task: object) => engine.faults(engine.parse({ task })!)
    expect(unread({ kind: 'trace', algorithm: 'merge sort', values: [1, 2, 3] })[0]).toMatch(/algorithm "merge sort" is not one of: total, count, maximum, minimum, linear-search, bubble-pass/)
    expect(unread({ kind: 'trace', algorithm: 'bubble sort', values: [1, 2, 3] })[0]).toMatch(/whole sort.*use "bubble-pass"/)
    expect(unread({ kind: 'dry', algorithm: 'total', values: [1, 2, 3] })[0]).toMatch(/kind "dry" is not one of: trace, predict, fault/)
    expect(unread({ algorithm: 'total' })[0]).toMatch(/needs "values"/)
    expect(unread({ values: [1, 2, 3] })[0]).toMatch(/needs an "algorithm"/)
    expect(unread({ algorithm: 'total', values: [1, 'four', 3] })[0]).toMatch(/"four" in values is not a number/)
    expect(unread({ kind: 'fault', algorithm: 'total', values: [1, 2, 3], bug: 'sleepy' })[0]).toMatch(/bug "sleepy" is not one for total: use "total-starts-at-one"/)
    expect(unread({ algorithm: 'linear-search', values: [1, 2, 3], target: 'x' })[0]).toMatch(/target "x" is not a number/)
  })

  it('reads numbers outside the range, so that faults can name the limit', () => {
    const c = engine.parse({ task: { kind: 'trace', algorithm: 'total', values: [4, 150, 2.5, -3] } })!
    expect(c.task.values).toEqual([4, 150, 2.5, -3])
    expect(engine.faults(c)[0]).toMatch(/^150 is not a whole number from 0 to 99, which is the range of every value in Data\. Use e\.g\. "values": \[4, 9, 2, 7, 5\]\.$/)
  })
})

describe('what the engine refuses, and the working example it offers instead', () => {
  const said = (kind: Kind, algo: AlgoId, raw: Raw, bug?: BugId) => engine.faults(cfg(kind, algo, raw, bug))
  const egOf = (message: string) => {
    const m = /Use e\.g\. (.+)\.$/.exec(message)
    return m ? (JSON.parse(`{${m[1]}}`) as { values: number[]; target?: number; limit?: number; bug?: BugId }) : null
  }

  it('names the number of values a table takes', () => {
    expect(said('trace', 'total', { values: [4, 9] })[0]).toMatch(/^Totalling takes 3 to 8 values \(a longer table is slow to fill\); "values" has 2\. Use e\.g\. "values": \[4, 9, 2, 7, 5\]\.$/)
    expect(said('trace', 'total', { values: [1, 2, 3, 4, 5, 6, 7, 8, 9] })[0]).toMatch(/takes 3 to 8 values.*has 9/)
    expect(said('trace', 'bubble-pass', { values: [4, 9, 2, 7, 5, 8, 1] })[0]).toMatch(/^One pass of a bubble sort takes 3 to 6 values \(each one is a column of the table\); "values" has 7\./)
    expect(said('trace', 'bubble-pass', { values: [4, 9, 2, 7, 5, 8] })).toEqual([])
  })

  it('names the range of the values', () => {
    expect(said('trace', 'total', { values: [4, 100, 2] })[0]).toMatch(/^100 is not a whole number from 0 to 99/)
    expect(said('trace', 'total', { values: [4, -1, 2] })[0]).toMatch(/^-1 is not a whole number from 0 to 99/)
    expect(said('trace', 'total', { values: [4, 1.5, 2] })[0]).toMatch(/^1.5 is not a whole number from 0 to 99/)
    expect(said('trace', 'total', { values: [0, 99, 50] })).toEqual([])
  })

  it('needs a target for a search and a limit for counting', () => {
    expect(said('trace', 'linear-search', { values: [4, 9, 2] })[0]).toMatch(/^Linear search needs a "target".*Use e\.g\. "values": \[4, 9, 2, 7, 5\], "target": 7\.$/)
    expect(said('trace', 'linear-search', { values: [4, 9, 2], target: 120 })[0]).toMatch(/needs a "target"/)
    expect(said('trace', 'count', { values: [4, 9, 2] })[0]).toMatch(/^Counting needs a "limit".*Use e\.g\. "values": \[4, 9, 2, 7, 5\], "limit": 5\.$/)
  })

  it('refuses a count that never tests anything, a maximum that never changes, a search that stops at once', () => {
    expect(said('trace', 'count', { values: [4, 1, 2], limit: 5 })[0]).toMatch(/No value is greater than 5, so the IF is never true and Count stays 0/)
    expect(said('trace', 'count', { values: [9, 8, 7], limit: 5 })[0]).toMatch(/Every value is greater than 5, so the IF is true every time/)
    expect(said('trace', 'maximum', { values: [9, 8, 7] })[0]).toMatch(/The first value, 9, is already the largest, so Max never changes after it is set/)
    expect(said('trace', 'minimum', { values: [1, 8, 7] })[0]).toMatch(/The first value, 1, is already the smallest, so Min never changes/)
    expect(said('trace', 'linear-search', { values: [7, 8, 9], target: 7 })[0]).toMatch(/The target 7 is the first value, so the search stops after one pass/)
    expect(said('trace', 'bubble-pass', { values: [1, 2, 3] })[0]).toMatch(/Data is already in order, so the pass swaps nothing/)
    // Not found is a good search to trace: the loop runs to the end.
    expect(said('trace', 'linear-search', { values: [7, 8, 9], target: 1 })).toEqual([])
  })

  it('will not ask for the output of a maximum or a minimum, which is only the biggest number on the page', () => {
    expect(said('predict', 'maximum', MAIN.maximum)).toEqual(['Predicting the output of a maximum is just picking the largest number off the page. Use kind "trace" to follow the algorithm, or "fault" to correct it.'])
    expect(said('predict', 'minimum', MAIN.minimum)[0]).toMatch(/smallest number off the page/)
    // Whatever else is wrong with the values, this is what a writer is told first.
    expect(said('predict', 'maximum', { values: [1] })[0]).toMatch(/just picking the largest number/)
    expect(said('trace', 'maximum', MAIN.maximum)).toEqual([])
    expect(said('fault', 'maximum', MAIN.maximum, 'max-wrong-way')).toEqual([])
  })

  it('needs a bug for a fault, and one that belongs to the algorithm', () => {
    expect(said('fault', 'total', MAIN.total)[0]).toMatch(/^A fault task needs a "bug".*one of "total-starts-at-one", "total-adds-index", "total-skips-first", "total-skips-last"\. Use e\.g\. .*"bug": "total-starts-at-one"\.$/)
    expect(said('fault', 'total', MAIN.total, 'count-ge')[0]).toMatch(/The bug "count-ge" belongs to a different algorithm/)
  })

  it('refuses a bug the values do not show, saying what it leaves instead', () => {
    // 5 is not in the data, so >= and > count the same.
    expect(said('fault', 'count', { values: [4, 9, 2, 7, 6], limit: 5 }, 'count-ge')[0]).toMatch(/^With these values the bug changes nothing: the algorithm outputs 3 either way, so the learner has no wrong answer to look into\. Choose values that make the bug show\. Use e\.g\. "values": \[4, 9, 2, 7, 5\], "limit": 5, "bug": "count-ge"\.$/)
    // The largest is not last, so stopping one early still finds it.
    expect(said('fault', 'maximum', MAIN.maximum, 'max-skips-last')[0]).toMatch(/changes nothing/)
    expect(said('fault', 'maximum', { values: [3, 8, 2, 6, 11] }, 'max-skips-last')).toEqual([])
    expect(said('fault', 'linear-search', MAIN['linear-search'], 'search-stops-early')[0]).toMatch(/changes nothing.*"target": 5/)
    expect(said('fault', 'bubble-pass', { values: [1, 2, 3] }, 'bubble-loses-value')[0]).toMatch(/changes nothing: the algorithm leaves Data \[1, 2, 3\] either way/)
  })

  it('offers an example the engine accepts, for every refusal it can make', () => {
    let checked = 0
    for (const algo of ALGORITHMS) {
      for (const kind of ['trace', 'predict', 'fault'] as Kind[]) {
        const bugs = kind === 'fault' ? bugsOf(algo) : [undefined]
        for (const bug of bugs) {
          for (const raw of [{ values: [1, 2] }, { values: [100, 1, 2] }, { values: [1, 1, 1, 1], target: 1, limit: 1 }, { values: [9, 8, 7], target: 9, limit: 1 }]) {
            for (const withBug of bug ? [bug] : [undefined]) {
              const c = cfg(kind, algo, raw, withBug)
              const m = engine.faults(c)
              if (!m.length) continue
              // A maximum cannot be predicted at all: the message says which kind to use instead.
              if (kind === 'predict' && (algo === 'maximum' || algo === 'minimum')) {
                expect(m[0]).toMatch(/Use kind "trace"/)
                continue
              }
              const eg = egOf(m[0])
              expect(eg, m[0]).not.toBeNull()
              const back = cfg(kind, algo, eg!, eg!.bug)
              expect(engine.faults(back), `${algo} ${kind} ${bug}: ${m[0]}`).toEqual([])
              checked++
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(60)
  })
})

// 24,000 or so configs, each judged against the oracles, and each valid one solved and picked at: room for a loaded full-suite run.
describe('every config the tutor can write', { timeout: 60_000 }, () => {
  function* everyConfig(): Generator<{ kind: Kind; algo: AlgoId; raw: Raw; bug?: BugId }> {
    let seed = 99
    const rand = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
    }
    const kinds = (algo: AlgoId): { kind: Kind; bug?: BugId }[] => [
      { kind: 'trace' }, { kind: 'predict' }, ...bugsOf(algo).map((bug) => ({ kind: 'fault' as Kind, bug })),
    ]
    for (const algo of ALGORITHMS) {
      const params = (values: number[]): Raw[] => {
        if (algo === 'linear-search') return [0, 1, 2, 3].map((target) => ({ values, target }))
        if (algo === 'count') return [0, 1, 2, 3].map((limit) => ({ values, limit }))
        return [{ values }]
      }
      // Every array of 3 and of 4 values from 0 to 3.
      for (const n of [3, 4]) {
        for (let code = 0; code < 4 ** n; code++) {
          const values = Array.from({ length: n }, (_, i) => Math.floor(code / 4 ** i) % 4)
          for (const raw of params(values)) for (const k of kinds(algo)) yield { ...k, algo, raw }
        }
      }
      // And 300 random arrays of 3 to 8 values from 0 to 99, a third of them with a target or a limit that is in them.
      for (let i = 0; i < 300; i++) {
        const n = MIN_ITEMS + rand((algo === 'bubble-pass' ? MAX_SORT_ITEMS : MAX_ITEMS) - MIN_ITEMS + 1)
        const values = Array.from({ length: n }, () => rand(MAX_VALUE + 1))
        const pick = i % 3 === 0 ? values[rand(n)] : rand(MAX_VALUE + 1)
        for (const k of kinds(algo)) yield { ...k, algo, raw: { values, target: pick, limit: pick } }
      }
    }
  }

  it('starts unsolved and is solved by the engine, or is refused with a reason, exactly as the plain-loop rules say', () => {
    let total = 0
    let valid = 0
    let refused = 0
    for (const { kind, algo, raw, bug } of everyConfig()) {
      total++
      const c = cfg(kind, algo, raw, bug)
      const label = JSON.stringify([kind, algo, raw, bug])
      const back = engine.parse(c)
      if (!back || JSON.stringify(back) !== JSON.stringify(c)) throw new Error(`${label} does not parse back`)
      const faults = engine.faults(c)
      const ok = worthwhile(kind, algo, raw, bug)
      // Plain checks, not expect(), in the loop: tens of thousands of deep-equals would be most of the run.
      if ((faults.length === 0) !== ok) throw new Error(`${label}: faults ${JSON.stringify(faults)}`)
      if (!ok) {
        refused++
        if (faults.length !== 1 || faults[0].length < 40 || !/\.$/.test(faults[0])) throw new Error(`${label}: a fault that says too little: ${faults}`)
        continue
      }
      valid++
      if (engine.check(c, engine.initial(c)).ok) throw new Error(`${label} starts solved`)
      const solved = engine.solve(c)
      if (!engine.check(c, solved).ok) throw new Error(`${label} cannot be solved`)
      const L = layout(c)
      if (L.rows.length > MAX_ROWS) throw new Error(`${label}: ${L.rows.length} rows`)
      if (kind === 'fault') {
        // Every other line fails; the planted one passes, and is the line that differs from the correct listing.
        const line = faultLine(c)!
        const right = layout(cfg('trace', algo, raw)).lines.map(lineText)
        const wrong = L.lines.map(lineText).flatMap((t, i) => (t !== right[i] ? [i + 1] : []))
        if (wrong.length !== 1 || wrong[0] !== line) throw new Error(`${label}: the listing differs at ${wrong}, the fault is on ${line}`)
        for (const l of L.lines) if (engine.check(c, { cells: {}, pick: l.n }).ok !== (l.n === line)) throw new Error(`${label}: line ${l.n}`)
      } else if (kind === 'predict') {
        for (const key of Object.keys(solved.cells)) {
          if (engine.check(c, { cells: { ...solved.cells, [key]: 'x' }, pick: null }).ok) throw new Error(`${label}: ${key} can be wrong`)
          if (engine.check(c, { cells: { ...solved.cells, [key]: '' }, pick: null }).ok) throw new Error(`${label}: ${key} can be empty`)
        }
        // The prediction is the output of the plain loop.
        if (JSON.stringify(Object.values(solved.cells)) !== JSON.stringify(oracle(algo, raw))) throw new Error(`${label}: solves to ${JSON.stringify(solved.cells)}`)
      } else {
        for (const key of Object.keys(solved.cells)) {
          // Leaving a cell empty means "unchanged", so each cell the solution writes is a change, and empty is wrong.
          const without = { ...solved.cells }
          delete without[key]
          if (engine.check(c, { cells: without, pick: null }).ok) throw new Error(`${label}: ${key} can be left empty`)
          if (engine.check(c, { cells: { ...solved.cells, [key]: 'x' }, pick: null }).ok) throw new Error(`${label}: ${key} can be wrong`)
        }
      }
    }
    expect(total).toBeGreaterThan(20_000)
    expect(valid).toBeGreaterThan(8_000)
    expect(refused).toBeGreaterThan(5_000)
  })
})

describe('marking a trace table', () => {
  const state = (cells: Record<string, string>): AlgorithmTracerState => ({ cells, pick: null })
  const SOLVED = traceSolution(TOTAL)

  it('is right only when every cell is, and a blank cell means "unchanged", as in an exam', () => {
    expect(SOLVED).toEqual({ 'start:Total': '0', 'p1:Total': '4', 'p2:Total': '13', 'p3:Total': '15', 'p4:Total': '22', 'p5:Total': '27', 'finish:OUTPUT': '27' })
    expect(engine.check(TOTAL, state(SOLVED)).ok).toBe(true)
    // The maximum: Max only changes twice, and the other passes are left empty.
    const max = cfg('trace', 'maximum', MAIN.maximum)
    expect(traceSolution(max)).toEqual({ 'start:Max': '3', 'p1:Max': '8', 'p3:Max': '11', 'finish:OUTPUT': '11' })
    expect(engine.check(max, state(traceSolution(max))).ok).toBe(true)
    // Writing the unchanged value in as well is the same answer.
    expect(engine.check(max, state({ ...traceSolution(max), 'p2:Max': '8', 'p4:Max': '11' })).ok).toBe(true)
    // But a cell that has to change cannot be left empty, and the start row has nothing to carry down from.
    expect(engine.check(max, state({ ...traceSolution(max), 'p3:Max': '' })).ok).toBe(false)
    expect(engine.check(max, state({ ...traceSolution(max), 'start:Max': '' })).ok).toBe(false)
    expect(engine.check(TOTAL, state({})).ok).toBe(false)
  })

  it('reads a value however it is written', () => {
    const search = traceSolution(SEARCH)
    expect(engine.check(SEARCH, state({ ...search, 'p4:Found': ' true ' })).ok).toBe(true)
    expect(engine.check(SEARCH, state({ ...search, 'p4:Found': 'T', 'start:Found': 'false', 'start:Index': '+1' })).ok).toBe(true)
    expect(engine.check(SEARCH, state({ ...search, 'p4:Found': 'yes' })).ok).toBe(false)
    expect(engine.check(SEARCH, state({ ...search, 'p1:Index': '2.0' })).ok).toBe(false)
    const absent = cfg('trace', 'linear-search', { values: [4, 9, 2, 7, 5], target: 8 })
    const none = traceSolution(absent)
    expect(none['finish:OUTPUT']).toBe('Not found')
    expect(engine.check(absent, state({ ...none, 'finish:OUTPUT': '"not  found"' })).ok).toBe(true)
    expect(engine.check(absent, state({ ...none, 'finish:OUTPUT': '0' })).ok).toBe(false)
    expect(canon('int', '−3')).toBe('-3')
  })

  it('rejects a value written in a row after a WHILE loop has ended', () => {
    const search = traceSolution(SEARCH)
    expect(engine.check(SEARCH, state({ ...search, 'p5:Index': '4' })).ok).toBe(false)
    expect(engine.check(SEARCH, state({ ...search, 'p5:Found': 'TRUE' })).ok).toBe(false)
    const j = judgeTrace(SEARCH, state({ ...search, 'p5:Index': '4' }))
    expect(j.faults.map((f) => [f.key, f.spare])).toEqual([['p5:Index', true]])
    expect(j.right).toBe(j.total)
  })

  it('says each wrong cell back with what was written and what its line gives, only once marked', () => {
    const wrong = state({ ...SOLVED, 'p3:Total': '14', 'p4:Total': '21' })
    expect(traceSaid(TOTAL, wrong)).toEqual([
      '5 of 7 cells are right.',
      'Index = 3, Total: you wrote 14; after line 6 (Total ← Total + Data[Index]) it is 15.',
      'Index = 4, Total: you wrote 21; after line 6 (Total ← Total + Data[Index]) it is 22.',
    ])
    // Left empty, the cell keeps the learner's own last value, and that is what is said.
    const blank: Record<string, string> = { ...SOLVED, 'p3:Total': '14' }
    delete blank['p4:Total']
    expect(traceSaid(TOTAL, state(blank)).slice(1)).toEqual([
      'Index = 3, Total: you wrote 14; after line 6 (Total ← Total + Data[Index]) it is 15.',
      'Index = 4, Total: you left it empty, which means it stays 14; after line 6 (Total ← Total + Data[Index]) it is 22.',
    ])
  })

  it('says a blank, an output and a cell that should be empty in words', () => {
    const empty = { ...SOLVED }
    delete empty['finish:OUTPUT']
    expect(traceSaid(TOTAL, state(empty)).slice(1)).toEqual(['Finish, OUTPUT: you left it empty; line 8 (OUTPUT Total) outputs 27.'])
    const bubble = traceSolution(BUBBLE)
    // Temp has no value until the first swap.
    expect(traceSaid(BUBBLE, state({ ...bubble, 'p1:Temp': '4' })).slice(1)).toEqual(['Index = 1, Temp: you wrote 4; Temp has no value yet, so leave it empty.'])
    // The IF is false in pass 1, so nothing changes in that row.
    const max = cfg('trace', 'maximum', MAIN.maximum)
    expect(traceSaid(max, state({ ...traceSolution(max), 'p2:Max': '9' })).slice(1, 2)).toEqual(['Index = 3, Max: you wrote 9; nothing changes Max in this row, so it stays 8.'])
    expect(traceSaid(max, state({ ...traceSolution(max), 'p2:Max': '9' }))).toHaveLength(2)
    // Two cells filled in a row after the loop has ended are one mistake, said once.
    expect(traceSaid(SEARCH, state({ ...traceSolution(SEARCH), 'p5:Found': 'FALSE', 'p5:Index': '4' })).slice(1)).toEqual(['Pass 5: the loop has already finished, so this row should be empty.'])
    expect(traceSaid(SEARCH, state({ ...traceSolution(SEARCH), 'p5:Found': 'FALSE' })).slice(1)).toEqual(['Pass 5: the loop has already finished, so this row should be empty.'])
  })

  it('says a wrong cell once, and does not repeat it in every cell below that only carries it down', () => {
    const bubble = traceSolution(BUBBLE)
    // Data[3] is wrong in pass 3, and the cells under it are left empty, so they carry the wrong value.
    const wrong = state({ ...bubble, 'p3:D3': '99' })
    expect(traceSaid(BUBBLE, wrong)).toEqual([
      `${judgeTrace(BUBBLE, wrong).total - 2} of ${judgeTrace(BUBBLE, wrong).total} cells are right.`,
      'Index = 3, Data[3]: you wrote 99; after line 7 (Data[Index] ← Data[Index + 1]) it is 7.',
      '1 more cell carries a wrong value down from above, and will come right when it does.',
    ])
    // Empty cells that should have changed are not carried: each is its own mistake.
    expect(traceSaid(TOTAL, state({})).filter((l) => /carry/.test(l))).toEqual([])
    const j = judgeTrace(BUBBLE, state({ ...bubble, 'p3:D3': '99' }))
    expect(j.faults.map((f) => [f.key, f.carried])).toEqual([['p3:D3', false], ['p4:D3', true]])
  })

  it('shows the first three wrong cells and counts the rest', () => {
    const lines = traceSaid(TOTAL, state({}))
    expect(lines[0]).toBe('0 of 7 cells are right.')
    expect(lines).toHaveLength(5)
    expect(lines[4]).toBe('4 more cells are not right: fix the first, because later ones may follow from it.')
    expect(traceSaid(TOTAL, state(SOLVED))).toEqual(['All 7 cells are right.'])
  })

  it('reads a saved state safely', () => {
    expect(readState(null)).toEqual({ cells: {}, pick: null })
    expect(readState({ cells: 'x', pick: 'y' })).toEqual({ cells: {}, pick: null })
    expect(readState({ cells: { a: 'b', c: 4 }, pick: 7 })).toEqual({ cells: { a: 'b' }, pick: 7 })
    expect(readState({ cells: { a: 'x'.repeat(50) } }).cells.a).toHaveLength(14)
    expect(engine.check(TOTAL, { cells: [1, 2] } as never).ok).toBe(false)
  })
})

describe('marking a prediction', () => {
  const total = cfg('predict', 'total', MAIN.total)
  const pass = cfg('predict', 'bubble-pass', MAIN['bubble-pass'])
  const state = (cells: Record<string, string>): AlgorithmTracerState => ({ cells, pick: null })

  it('is the OUTPUT of the algorithm, or Data after the pass', () => {
    expect(expectedAnswer(total)).toEqual(['27'])
    expect(engine.check(total, state({ p0: '27' })).ok).toBe(true)
    expect(engine.check(total, state({ p0: ' 27 ' })).ok).toBe(true)
    expect(engine.check(total, state({ p0: '26' })).ok).toBe(false)
    expect(engine.check(total, state({})).ok).toBe(false)
    expect(expectedAnswer(pass)).toEqual(['4', '2', '7', '5', '9'])
    expect(engine.check(pass, state({ p0: '4', p1: '2', p2: '7', p3: '5', p4: '9' })).ok).toBe(true)
    expect(engine.check(pass, state({ p0: '4', p1: '9', p2: '2', p3: '7', p4: '5' })).ok).toBe(false)
    expect(engine.solve(pass).cells).toEqual({ p0: '4', p1: '2', p2: '7', p3: '5', p4: '9' })
  })

  it('says what was predicted, whether it is high or low, and never the output', () => {
    expect(predictSaid(total, state({ p0: '25' }))).toEqual([
      'You predicted 25, which is not what OUTPUT shows. That is too low.',
      'Work through the loop one pass at a time, keeping each variable\'s value as you go.',
    ])
    expect(predictSaid(total, state({ p0: '31' }))[0]).toMatch(/too high/)
    expect(predictSaid(total, state({}))).toEqual(['You have not written a prediction yet.'])
    expect(predictSaid(total, state({ p0: '27' }))).toEqual([])
    expect(predictSaid(total, state({ p0: '25' })).join(' ')).not.toMatch(/\b27\b/)
    const said = predictSaid(pass, state({ p0: '4', p1: '9', p2: '2', p3: '7', p4: '9' }))
    expect(said[0]).toBe('Data[2], Data[3] and Data[4] are not right yet. You wrote 9, 2, 7 there.')
    expect(judgePredict(pass, state({ p0: '4', p1: '2', p2: '7', p3: '5', p4: '8' })).wrong.map((w) => w.label)).toEqual(['Data[5]'])
    const search = cfg('predict', 'linear-search', { values: [4, 9, 2, 7, 5], target: 8 })
    expect(engine.check(search, state({ p0: 'not found' })).ok).toBe(true)
    expect(predictSaid(search, state({ p0: '3' }))[0]).toBe('You predicted 3, which is not what OUTPUT shows.')
  })
})

describe('marking a fault', () => {
  const c = cfg('fault', 'count', { values: [4, 9, 5, 7, 2], limit: 5 }, 'count-ge')
  const pick = (n: number | null): AlgorithmTracerState => ({ cells: {}, pick: n })

  it('is right on the planted line and no other', () => {
    expect(faultLine(c)).toBe(7)
    expect(engine.check(c, pick(7)).ok).toBe(true)
    expect(engine.check(c, pick(8)).ok).toBe(false)
    expect(engine.check(c, pick(null)).ok).toBe(false)
    expect(engine.solve(c)).toEqual({ cells: {}, pick: 7 })
    expect(engine.check(c, pick(8)).wrongIds).toEqual(['line-8'])
  })

  it('shows what the buggy listing outputs and what it should, before anything is marked', () => {
    expect(symptom(c)).toEqual({ got: '3', should: '2', array: false })
    expect(symptom(cfg('fault', 'bubble-pass', { values: [4, 9, 2, 7, 5] }, 'bubble-wrong-way'))).toEqual({ got: '[9, 4, 7, 5, 2]', should: '[4, 2, 7, 5, 9]', array: true })
  })

  it('says which line was picked and that it is correct, without naming the fault', () => {
    expect(faultSaid(c, pick(8))).toEqual([
      'You picked line 8, Count ← Count + 1. That line is correct as it is written.',
      'Read the other lines against what goes wrong: the output is 3 when it should be 2.',
    ])
    expect(faultSaid(c, pick(null))).toEqual(['No line is picked yet. Tap the line you think is wrong.'])
    expect(faultSaid(c, pick(8)).join(' ')).not.toMatch(/>=|fault is/)
  })

  it('explains the fault once it is found, with the line as it should read', () => {
    expect(faultFound(c)).toBe('Line 7 is the fault. It uses >= so a value equal to Limit is counted too; only the values greater than Limit should be. It should read: IF Data[Index] > Limit THEN')
    expect(faultFound(cfg('fault', 'count', { values: [4, 9, 5, 7, 2], limit: 5 }, 'count-not-incremented'))).toMatch(/^Line 8 is the fault\. Count is set to 1.*It should read: Count ← Count \+ 1$/)
  })
})

describe('what is said when it is right', () => {
  it('explains the algorithm in the values it was given', () => {
    expect(explain(TOTAL)).toBe('4 + 9 + 2 + 7 + 5 = 27, so Total is 27 and that is what OUTPUT shows.')
    expect(explain(cfg('trace', 'count', MAIN.count))).toBe('9, 7 are greater than 5, so Count goes up 2 times and OUTPUT shows 2.')
    expect(explain(cfg('trace', 'maximum', MAIN.maximum))).toBe('Max starts as 3, then becomes 8 (Index 2) and then 11 (Index 4). The largest value is 11.')
    expect(explain(cfg('trace', 'minimum', MAIN.minimum))).toBe('Min starts as 9, then becomes 6 (Index 2) and then 3 (Index 5). The smallest value is 3.')
    expect(explain(SEARCH)).toBe('Data[4] is 7, the first match: Found becomes TRUE, the loop stops and OUTPUT shows 4.')
    expect(explain(cfg('trace', 'linear-search', { values: [4, 9, 2, 7, 5], target: 8 }))).toBe('No value in Data is 8, so the loop checks every position and OUTPUT shows "Not found".')
    expect(explain(BUBBLE)).toBe('Each neighbouring pair is compared and swapped when the left one is bigger, so Data ends as 4, 2, 7, 5, 9: the largest value has moved to the end.')
  })
})

// ---------------------------------------------------------------------------
// The scene on the board.

const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
const card = (config: unknown, prompt: string) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'algorithm-tracer', config }, success: { kind: 'scene' } } },
  } as never)))
const view = (c: AlgorithmTracerConfig, state: AlgorithmTracerState, marked: SceneMarked) =>
  renderToStaticMarkup(createElement(AlgorithmTracerView, { config: c, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))

describe('the algorithm-tracer scene on the board', () => {
  it('is a valid activity, drawn as the listing, the array and an empty trace table', () => {
    expect(validateSpec({ pattern: 'scene', prompt: 'Trace it.', payload: { engine: 'algorithm-tracer', config: SEARCH }, success: { kind: 'scene' } })).toBe(true)
    const html = card(SEARCH, 'Complete the trace table for this linear search.')
    const words = text(html)
    expect(words).toContain('Linear search')
    expect(words).toContain('WHILE Index <= 5 AND Found = FALSE DO')
    expect(words).toContain('Target = 7')
    expect(html).toContain('aria-label="Data: position 1 holds 4, position 2 holds 9, position 3 holds 2, position 4 holds 7, position 5 holds 5."')
    expect(html).toContain('<table')
    for (const label of ['Start, Index', 'Start, Found']) expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain('Next row')
    // Every cell the learner fills is empty.
    for (const m of html.matchAll(/<input[^>]*>/g)) expect(m[0]).toContain('value=""')
  })

  it('shows no value, output or answer before it is marked, even to a screen reader', () => {
    const prompt = 'Complete the trace table for this algorithm.'
    for (const c of [TOTAL, SEARCH, cfg('trace', 'maximum', MAIN.maximum), cfg('trace', 'count', MAIN.count), BUBBLE]) {
      const html = card(c, prompt)
      const shown = text(html).replace(prompt, '')
      expect(shown, c.task.algorithm).not.toMatch(/Right\.|cells are right|you wrote|Here is the answer|The run|Put it back/)
      for (const m of html.matchAll(/<input[^>]*>/g)) expect(m[0]).toContain('value=""')
      // The numbers that are not on the page to begin with: the output and the running values.
      const run = layout(c).run
      const hidden = new Set<string>()
      for (const r of run.rows) for (const v of Object.values(r.after)) if (v !== '') hidden.add(v)
      const given = new Set([...c.task.values.map(String), `${c.task.target}`, `${c.task.limit}`, ...Array.from({ length: 9 }, (_, i) => `${i}`)])
      for (const v of hidden) {
        if (given.has(v) || /^(TRUE|FALSE)$/.test(v)) continue
        expect(shown, `${c.task.algorithm}: ${v}`).not.toMatch(new RegExp(`(?<![\\d.])${v}(?![\\d])`))
      }
    }
  })

  it('shows no prediction and no output before it is marked', () => {
    const prompt = 'Predict what Data holds after this pass.'
    const html = card(cfg('predict', 'bubble-pass', MAIN['bubble-pass']), prompt)
    expect(text(html).replace(prompt, '')).not.toMatch(/Right\.|The run|not right yet/)
    for (const m of html.matchAll(/<input[^>]*>/g)) expect(m[0]).toContain('value=""')
    const total = card(cfg('predict', 'total', MAIN.total), 'Predict the output.')
    expect(text(total)).not.toMatch(/(?<![\d.])27(?![\d])/)
    expect(text(total)).toContain('type what OUTPUT shows when the algorithm has run')
  })

  it('shows a fault task with its symptom, every line tappable, and nothing picked or named', () => {
    const c = cfg('fault', 'count', { values: [4, 9, 5, 7, 2], limit: 5 }, 'count-ge')
    const html = card(c, 'This algorithm gives the wrong answer. Tap the faulty line.')
    const words = text(html)
    expect(words).toContain('It outputs 3. It should output 2.')
    expect(words).toContain('IF Data[Index] >= Limit THEN')
    expect(html.match(/<button[^>]*aria-pressed="false"/g)).toHaveLength(layout(c).lines.length)
    expect(html).not.toContain('aria-pressed="true"')
    expect(words).not.toMatch(/\bthe fault\b|your pick|picked|It uses >=|should read|Line 7 is/)
    // The listing is in order, so the faulty line is not set apart by where it sits.
    const labels = [...html.matchAll(/aria-label="Line (\d+): ([^"]*)"/g)].map((m) => Number(m[1]))
    expect(labels).toEqual(layout(c).lines.map((l) => l.n))
  })

  it('highlights the lines of the row the learner is on, the same lines whichever branch is taken', () => {
    const html = view(SEARCH, { cells: {}, pick: null }, 'idle')
    // The start row is active: lines 5 and 6.
    expect([...html.matchAll(/aria-current="step"[^>]*>/g)].length).toBeGreaterThanOrEqual(2)
    const lit = [...html.matchAll(/<div aria-current="step"[^>]*>.*?<\/span><span[^>]*>(.*?)<\/span><\/div>/g)].map((m) => text(m[1]))
    expect(lit).toEqual(['Found ← FALSE', 'Index ← 1'])
  })

  it('once marked wrong, says what was written and what the line gives; once right, explains', () => {
    const wrong = view(TOTAL, { cells: { ...traceSolution(TOTAL), 'p3:Total': '14' }, pick: null }, 'wrong')
    expect(text(wrong)).toContain('Index = 3, Total: you wrote 14; after line 6 (Total ← Total + Data[Index]) it is 15.')
    expect(wrong).toContain('aria-invalid="true"')
    const right = view(TOTAL, engine.solve(TOTAL), 'right')
    expect(text(right)).toContain('4 + 9 + 2 + 7 + 5 = 27, so Total is 27')
    expect(right).not.toMatch(/<input[^>]*value=""[^>]*>/)
    expect(right).toContain('disabled')
    const fault = cfg('fault', 'total', MAIN.total, 'total-starts-at-one')
    expect(text(view(fault, { cells: {}, pick: 6 }, 'wrong'))).toContain('You picked line 6, Total ← Total + Data[Index]. That line is correct as it is written.')
    expect(text(view(fault, { cells: {}, pick: 4 }, 'right'))).toContain('Line 4 is the fault. Total starts at 1')
    expect(text(view(fault, { cells: {}, pick: 4 }, 'right'))).toContain('the fault')
    const predicted = view(cfg('predict', 'total', MAIN.total), { cells: { p0: '25' }, pick: null }, 'wrong')
    expect(text(predicted)).toContain('You predicted 25, which is not what OUTPUT shows. That is too low.')
    expect(text(predicted)).not.toMatch(/(?<![\d.])27(?![\d])/)
  })

  it('shows the run beside a right prediction, and the true table when the answer is shown', () => {
    const right = text(view(cfg('predict', 'total', MAIN.total), { cells: { p0: '27' }, pick: null }, 'right'))
    expect(right).toContain('The run')
    const shown = view(TOTAL, { cells: {}, pick: null }, 'shown')
    expect(text(shown)).toContain('Here is the answer.')
    expect(shown).toContain('value="27"')
  })

  it('draws the array the learner has traced so far, and compares the pair the row is on', () => {
    const L = layout(BUBBLE)
    const mine = traceSolution(BUBBLE)
    expect(arrayBefore(L, {}, 0)).toEqual([4, 9, 2, 7, 5])
    expect(arrayBefore(L, mine, 3)).toEqual([4, 2, 9, 7, 5])
    expect(arrayBefore(L, mine, 4)).toEqual([4, 2, 7, 9, 5])
    // A cell that is not a number is drawn as a stub, never as a guess.
    expect(arrayBefore(L, { 'p2:D2': 'x' }, 3)).toEqual([4, null, 2, 7, 5])
  })

  it('takes the controls away once solved, and keeps the table', () => {
    const html = view(SEARCH, engine.solve(SEARCH), 'right')
    expect(html).not.toMatch(/<input(?![^>]*disabled)/)
    expect(html).toContain('<table')
  })

  it('does not draw a config it cannot read', () => {
    const bad = engine.parse({ task: { kind: 'trace', algorithm: 'merge sort', values: [1, 2, 3] } })!
    expect(view(bad, { cells: {}, pick: null }, 'idle')).toContain('This scene could not be loaded.')
  })
})

describe('the drawing', () => {
  it('lays out each place with its value over its own bar and its number under it', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      for (const style of ['boxes', 'bars'] as const) {
        const values = Array.from({ length: n }, (_, i) => (i * 37) % 100)
        const g = stripGeometry(n, style, values)
        for (const s of g.slots) {
          // Inside the picture.
          expect(s.x).toBeGreaterThanOrEqual(0)
          expect(s.x + s.w).toBeLessThanOrEqual(g.w)
          expect(s.y).toBeGreaterThanOrEqual(14)
          expect(s.indexY).toBeLessThanOrEqual(g.h)
          // The value is above or inside its part, the number below it, and both on its middle.
          expect(s.cx).toBeCloseTo(s.x + s.w / 2)
          expect(s.valueY).toBeLessThan(s.y + s.h)
          expect(s.indexY).toBeGreaterThan(s.y + s.h)
          // And each is nearer its own part than any other.
          const nearest = g.slots.reduce((a, b) => (Math.abs(b.cx - s.cx) < Math.abs(a.cx - s.cx) ? b : a))
          expect(nearest.i).toBe(s.i)
        }
        // No two parts touch.
        for (let i = 1; i < g.slots.length; i++) expect(g.slots[i].x).toBeGreaterThan(g.slots[i - 1].x + g.slots[i - 1].w)
        // A value sits clear of the pointer above the bars, even over the tallest bar.
        for (const s of g.slots) expect(s.valueY - 13).toBeGreaterThanOrEqual(12)
      }
    }
  })

  it('keeps a bar for 0 to a stub with room for its value, and a bar for 99 under the pointer', () => {
    const g = stripGeometry(3, 'bars', [0, 50, 99])
    expect(g.slots[0].h).toBeGreaterThanOrEqual(10)
    expect(g.slots[2].y).toBeGreaterThanOrEqual(30)
    expect(g.slots[0].h).toBeLessThan(g.slots[1].h)
    expect(g.slots[1].h).toBeLessThan(g.slots[2].h)
  })

  it('fits the trace table to the card: at most seven columns, each wide enough for two digits, labels that fit', () => {
    for (const algo of ALGORITHMS) {
      const n = algo === 'bubble-pass' ? MAX_SORT_ITEMS : MAX_ITEMS
      const L = layout(cfg('trace', algo, { values: Array.from({ length: n }, (_, i) => 90 + i), target: 95, limit: 5 }))
      expect(L.columns.length, algo).toBeLessThanOrEqual(7)
      expect((360 - TABLE_LABEL_WIDTH) / L.columns.length, algo).toBeGreaterThanOrEqual(CELL_MIN)
      for (const r of L.rows) expect(r.given ? `${r.given.name} = ${r.given.value}`.length : r.label.length).toBeLessThanOrEqual(10)
    }
  })
})

describe('the prompt an algorithm-tracer card is written with', () => {
  const faults = (c: AlgorithmTracerConfig, prompt: string) => getEngine('algorithm-tracer')!.promptFaults!(c, prompt)

  it('may not say the output of a trace or a prediction', () => {
    for (const p of [
      'Trace this algorithm, which outputs 27.',
      'Complete the trace table: the total is 27.',
      'Predict the output (the answer is 27).',
      'Trace it; Total ends as 27.',
    ]) expect(faults(TOTAL, p).join(' '), p).toMatch(/^the prompt gives the answer away: it says the output/)
    expect(faults(TOTAL, 'Trace this algorithm for the five values shown.')).toEqual([])
    expect(faults(TOTAL, 'Data holds 4, 9, 2, 7 and 5. Trace the total.')).toEqual([])
    // A number that is not 27 is no give-away.
    expect(faults(TOTAL, 'Trace it. Is the total more than 20?')).toEqual([])
  })

  it('may not say a value that is one of the data when it says it is the answer', () => {
    const max = cfg('trace', 'maximum', MAIN.maximum)
    expect(faults(max, 'Trace this algorithm, which finds the largest value, 11.')[0]).toMatch(/gives the answer away/)
    expect(faults(max, 'Trace this algorithm; the maximum is 11.')[0]).toMatch(/gives the answer away/)
    expect(faults(max, 'Trace this algorithm for 3, 8, 2, 11 and 6.')).toEqual([])
    const search = cfg('predict', 'linear-search', MAIN['linear-search'])
    expect(faults(search, 'Predict the output: it is found at position 4.')[0]).toMatch(/gives the answer away/)
    expect(faults(search, 'Predict the output when it looks for 7.')).toEqual([])
  })

  it('may not say that the target is missing, or what Data holds after the pass', () => {
    const absent = cfg('predict', 'linear-search', { values: [4, 9, 2, 7, 5], target: 8 })
    expect(faults(absent, 'Predict the output. The target is not found.')[0]).toMatch(/gives the answer away/)
    expect(faults(absent, 'Predict what it outputs when it searches for 8.')).toEqual([])
    const pass = cfg('predict', 'bubble-pass', MAIN['bubble-pass'])
    expect(faults(pass, 'After one pass, Data is 4, 2, 7, 5, 9. Trace it.')[0]).toMatch(/gives the answer away: it says what Data holds after the pass/)
    expect(faults(pass, 'Predict Data after one pass over 4, 9, 2, 7 and 5.')).toEqual([])
  })

  it('may not name the faulty line or what is wrong with it', () => {
    const c = cfg('fault', 'count', { values: [4, 9, 5, 7, 2], limit: 5 }, 'count-ge')
    expect(faults(c, 'The bug is on line 7: tap it.')[0]).toMatch(/which line the fault is on/)
    expect(faults(c, 'Tap the faulty line (the 7th line).')[0]).toMatch(/which line the fault is on/)
    expect(faults(c, 'It counts a value equal to the limit. Find the >= bug.')[0]).toMatch(/what is wrong/)
    expect(faults(c, 'This algorithm gives the wrong answer. Tap the faulty line.')).toEqual([])
    // Another line is not this fault.
    expect(faults(c, 'Look at line 3 first, then tap the faulty line.')).toEqual([])
    const total = cfg('fault', 'total', MAIN.total, 'total-starts-at-one')
    expect(faults(total, 'Total starts at 1 instead of 0: tap it.')[0]).toMatch(/what is wrong/)
    const skip = cfg('fault', 'maximum', { values: [3, 8, 2, 6, 11] }, 'max-skips-last')
    expect(faults(skip, 'The loop stops one place early. Tap the line.')[0]).toMatch(/what is wrong/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('algorithm-tracer')!
    // Each example's prompt, then its config by matching braces.
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => {
      const from = e.prompt.indexOf('"config": ', m.index!) + '"config": '.length
      let depth = 0
      let end = from
      for (; end < e.prompt.length; end++) {
        if (e.prompt[end] === '{') depth++
        if (e.prompt[end] === '}' && --depth === 0) break
      }
      return { prompt: m[1], config: JSON.parse(e.prompt.slice(from, end + 1)) }
    })
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(new Set(found.map((f) => f.config.task.kind))).toEqual(new Set(['trace', 'predict', 'fault']))
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
    }
  })
})

describe('the meaning gates', () => {
  const action = (config: unknown, prompt = 'Complete the trace table for this algorithm.') =>
    ({ type: 'createActivity', id: 'm1', spec: { pattern: 'scene', prompt, payload: { engine: 'algorithm-tracer', config }, success: { kind: 'scene' } } })

  it('refuses a config that teaches nothing, and a prompt that gives the answer away', () => {
    expect(meaningFaults(action(cfg('trace', 'maximum', { values: [9, 2, 3] }))).join(' ')).toMatch(/already the largest/)
    expect(meaningFaults(action(TOTAL, 'Trace it: the total comes to 27.')).join(' ')).toMatch(/gives the answer away/)
    expect(meaningFaults(action({ task: { kind: 'trace', algorithm: 'quick sort', values: [3, 1, 2] } })).join(' ')).toMatch(/not one of: total, count/)
    expect(meaningFaults(action(TOTAL))).toEqual([])
    expect(meaningFaults(action(cfg('fault', 'count', { values: [4, 9, 5, 7, 2], limit: 5 }, 'count-ge'), 'This algorithm gives the wrong answer. Tap the faulty line.'))).toEqual([])
  })
})

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and an example in orbit’s format', () => {
    expect(getEngine('algorithm-tracer')?.id).toBe(engine.id)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/^SCENE "algorithm-tracer"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"algorithm-tracer"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:algorithm-tracer"/)
    expect(engine.prompt).toMatch(/"isolates":"consequence"/)
    // The intent the tutor writes with it passes the teaching-intent check.
    const spec = { pattern: 'scene', prompt: 'Trace it.', payload: { engine: 'algorithm-tracer', config: TOTAL }, success: { kind: 'scene' } }
    expect(dimensionsOf(spec as never)).toEqual(['consequence'])
    expect(checkIntent({ goal: 'g', isolates: 'consequence', apparatus: 'scene:algorithm-tracer', why: 'w' }, spec as never).ok).toBe(true)
    for (const algo of ALGORITHMS) expect(engine.prompt).toContain(`"${algo}"`)
    for (const bug of BUGS) expect(engine.prompt, bug.id).toContain(bug.id)
  })

  it('is offered to a station about tracing, searching and sorting, and to no station about something else', () => {
    expect(sceneCatalogue('Linear search: finding a value in a list')).toContain('SCENE "algorithm-tracer"')
    expect(sceneCatalogue('Trace tables: following an algorithm')).toContain('SCENE "algorithm-tracer"')
    expect(sceneCatalogue('Bubble sort')).toContain('SCENE "algorithm-tracer"')
    expect(sceneCatalogue('Writing pseudocode')).toContain('SCENE "algorithm-tracer"')
    expect(sceneCatalogue('Totalling and counting in a loop')).toContain('SCENE "algorithm-tracer"')
    expect(scenesFor('Linear search').map((e) => e.id)).toContain('algorithm-tracer')
    expect(scenesFor('Totalling and counting values in a loop').map((e) => e.id)).toContain('algorithm-tracer')
    // A station is told a scene is made for it only when every word of a topic is in it.
    for (const other of ['Counting in tens', 'Linear equations', 'Times tables', 'Sorting materials by their properties', 'Finding totals in a ledger']) {
      expect(scenesFor(other).map((e) => e.id), other).not.toContain('algorithm-tracer')
    }
    expect(sceneCatalogue('Equivalent fractions')).not.toContain('SCENE "algorithm-tracer"')
    expect(sceneCatalogue('Break-even analysis')).not.toContain('SCENE "algorithm-tracer"')
  })

  it('has a bug for every algorithm that the catalogue lists, and a description for each', () => {
    for (const algo of ALGORITHMS) expect(bugsOf(algo).length, algo).toBeGreaterThanOrEqual(3)
    for (const b of BUGS) {
      expect(b.what.length, b.id).toBeGreaterThan(30)
      expect(b.what, b.id).toMatch(/\.$/)
    }
  })
})

// ---------------------------------------------------------------------------
// The drawing answers what the learner types, before anything is marked.

describe('the drawing answers the trace table', () => {
  const L = layout(TOTAL)
  const passIndex = L.rows.findIndex((r) => r.kind === 'pass')
  const filled = (r: number) => {
    const row = L.rows[r]
    return L.columns.filter((c) => row.cells[c.id] === 'fill')
  }
  it('says back only the typed value in a big box', () => {
    const col = filled(0)[0]
    const typed = view(TOTAL, { cells: { [cellKey(L.rows[0].id, col.id)]: '777' }, pick: null }, 'idle')
    expect(typed).toContain('data-typed-box')
    expect(text(typed)).toContain('777')
    expect(view(TOTAL, { cells: {}, pick: null }, 'idle')).not.toContain('data-typed-box')
  })
  it('lights the data box the row reads, and only that one', () => {
    const lit = renderToStaticMarkup(createElement(ArrayStrip, { values: [4, 9, 2], style: 'boxes', pointer: 2 }))
    expect((lit.match(/data-lit/g) ?? []).length).toBe(1)
    expect(renderToStaticMarkup(createElement(ArrayStrip, { values: [4, 9, 2], style: 'boxes' }))).not.toContain('data-lit')
  })
  it('never shows the true value before marking', () => {
    const col = filled(0)[0]
    const right = traceSolution(TOTAL)[cellKey(L.rows[0].id, col.id)]
    const html = view(TOTAL, { cells: { [cellKey(L.rows[0].id, col.id)]: '777' }, pick: null }, 'idle')
    expect(html).not.toContain(`value="${right}"`)
    expect(text(html.match(/<div data-typed-box[\s\S]*?<\/div>/)![0])).not.toContain(`${right}`)
  })
  it('draws only the current row and the one before it, however many rows there are', () => {
    const rowsDrawn = (h: string) => (h.match(/<tr/g) ?? []).length - 1
    expect(rowsDrawn(view(TOTAL, { cells: {}, pick: null }, 'idle'))).toBe(1)
    expect(rowsDrawn(view(TOTAL, { cells: {}, pick: null }, 'wrong'))).toBeLessThanOrEqual(2)
    expect(layout(TOTAL).rows.length).toBeGreaterThan(3)
  })
})
