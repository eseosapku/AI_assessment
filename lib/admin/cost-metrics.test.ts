import { describe, it, expect, vi } from 'vitest'
import {
  loadCostMetrics,
  costOfProfile,
  costOfTokens,
  MODEL_RATES,
  OPERATION_PROFILES,
  REVENUE_PER_STUDENT_USD,
} from './cost-metrics'
import type { Database } from '@/lib/db'

const COUNTS = {
  generate_assessment: '1923',
  generate_feedback: '1681',
  build_lesson: '65',
  tutor_reply: '708',
  recall_card: '398',
  active_students: '431',
}

/** Counts query first, then the ledger query. */
const dbWith = (ledgerRows: Record<string, unknown>[] = []): Database =>
  ({
    query: vi
      .fn()
      .mockResolvedValueOnce({ rows: [COUNTS] })
      .mockResolvedValueOnce({ rows: ledgerRows }),
  }) as unknown as Database

describe('costOfTokens', () => {
  it('prices a call from its model rate', () => {
    // 1M input on Nova Lite is $0.06 by the table above.
    expect(costOfTokens('amazon.nova-lite-v1:0', 1_000_000, 0)).toBeCloseTo(0.06, 6)
    expect(costOfTokens('amazon.nova-lite-v1:0', 0, 1_000_000)).toBeCloseTo(0.24, 6)
  })

  it('falls back rather than charging nothing for an unknown model', () => {
    // A model missing from the rate table must not silently cost $0 and
    // flatter the margin.
    expect(costOfTokens('some.new-model', 1_000_000, 0)).toBeGreaterThan(0)
  })
})

describe('the rate table', () => {
  it('prices every model the operation profiles reference', () => {
    for (const p of OPERATION_PROFILES) {
      expect(MODEL_RATES[p.model], p.model).toBeDefined()
    }
  })

  it('charges more for output than input on every model', () => {
    for (const [model, rate] of Object.entries(MODEL_RATES)) {
      expect(rate.output, model).toBeGreaterThan(rate.input)
    }
  })
})

describe('costOfProfile', () => {
  it('gives a per-call cost well under a cent for a generated paper', () => {
    const paper = OPERATION_PROFILES.find((p) => p.key === 'generate_assessment')!
    expect(costOfProfile(paper)).toBeLessThan(0.01)
    expect(costOfProfile(paper)).toBeGreaterThan(0)
  })
})

describe('loadCostMetrics', () => {
  it('estimates from operation counts while the ledger is empty', async () => {
    const c = await loadCostMetrics(dbWith([]))
    expect(c.basis).toBe('estimated')
    expect(c.lines.find((l) => l.key === 'generate_assessment')?.calls).toBe(1923)
  })

  it('switches to the ledger the moment it has rows', async () => {
    const c = await loadCostMetrics(
      dbWith([
        {
          feature: 'generate_assessment',
          model_id: 'amazon.nova-lite-v1:0',
          environment: 'production',
          calls: '10',
          input_tokens: '30000',
          output_tokens: '25000',
        },
      ]),
    )
    expect(c.basis).toBe('measured')
    expect(c.lines).toHaveLength(1)
    expect(c.lines[0].calls).toBe(10)
  })

  it('files non-production spend as development, not as teaching', async () => {
    // Vision passes and benchmarks are not a cost of teaching anyone, and
    // folding them in would overstate what a student costs.
    const c = await loadCostMetrics(
      dbWith([
        { feature: 'benchmark', model_id: 'amazon.nova-lite-v1:0', environment: 'development', calls: '5', input_tokens: '1000000', output_tokens: '0' },
      ]),
    )
    expect(c.aiDevelopmentUsd).toBeGreaterThan(0)
    expect(c.aiTeachingUsd).toBe(0)
  })

  it('reports a margin against the real subscription price', async () => {
    const c = await loadCostMetrics(dbWith([]))
    expect(c.revenuePerStudentUsd).toBe(REVENUE_PER_STUDENT_USD)
    expect(c.grossMarginPct).toBeCloseTo(
      ((c.revenuePerStudentUsd - c.costPerStudentMonthUsd) / c.revenuePerStudentUsd) * 100,
      1,
    )
  })

  it('finds infrastructure to be the bill, not inference', async () => {
    // The claim the margin rests on: a usage-driven cost rises with every new
    // student, a fixed one is diluted by them.
    const c = await loadCostMetrics(dbWith([]))
    expect(c.aiMonthlyUsd).toBeLessThan(c.infrastructureMonthlyUsd / 100)
  })

  it('improves the margin at scale rather than degrading it', async () => {
    const today = await loadCostMetrics(dbWith([]))
    const scaled = await loadCostMetrics(dbWith([]), { atScale: true, activeStudents: 6040 })
    expect(scaled.costPerStudentMonthUsd).toBeLessThan(today.costPerStudentMonthUsd)
    expect(scaled.grossMarginPct).toBeGreaterThan(today.grossMarginPct)
  })

  it('scales the call counts with the cohort it is costing', async () => {
    // Otherwise 6,040 students would be served by 431 students' worth of
    // generation, which would make inference look free by construction.
    const scaled = await loadCostMetrics(dbWith([]), { atScale: true, activeStudents: 6040 })
    expect(scaled.lines.find((l) => l.key === 'generate_assessment')!.calls).toBeGreaterThan(1923)
  })

  it('reports break-even as whole students, rounded up', async () => {
    const c = await loadCostMetrics(dbWith([]))
    expect(Number.isInteger(c.breakEvenStudents)).toBe(true)
    expect(c.breakEvenStudents).toBe(Math.ceil(c.infrastructureMonthlyUsd / c.revenuePerStudentUsd))
  })

  it('does not divide by zero on a platform with no students yet', async () => {
    const empty = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [] }),
    } as unknown as Database
    const c = await loadCostMetrics(empty)
    expect(Number.isFinite(c.costPerStudentMonthUsd)).toBe(true)
    expect(c.aiPerStudentMonthUsd).toBe(0)
  })
})
