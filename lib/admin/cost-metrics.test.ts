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

  it('reports inference as a share of the subscription, not as a margin', async () => {
    // A margin needs a full cost base. Hosting, storage and payment fees are
    // not recorded anywhere in this system, so the only honest claim is how
    // much of the subscription the models take.
    const c = await loadCostMetrics(dbWith([]))
    expect(c).not.toHaveProperty('grossMarginPct')
    expect(c.revenuePerStudentUsd).toBe(REVENUE_PER_STUDENT_USD)
    expect(c.inferenceShareOfRevenuePct).toBeCloseTo(
      (c.aiPerStudentMonthUsd / c.revenuePerStudentUsd) * 100,
      2,
    )
  })

  it('carries no hand-entered infrastructure figure', async () => {
    // The number the old margin turned on was invented rather than measured,
    // which made the most consequential figure on the page the least checkable.
    const c = await loadCostMetrics(dbWith([]))
    expect(c).not.toHaveProperty('infrastructureMonthlyUsd')
    expect(c).not.toHaveProperty('totalMonthlyUsd')
    expect(c).not.toHaveProperty('breakEvenStudents')
  })

  it('finds model spend to be a fraction of a percent of revenue', async () => {
    // The narrower claim that survives: whatever running this costs, it is not
    // inference.
    const c = await loadCostMetrics(dbWith([]))
    expect(c.inferenceShareOfRevenuePct).toBeLessThan(1)
    expect(c.inferenceShareOfRevenuePct).toBeGreaterThan(0)
  })

  it('holds the per-student figure roughly flat as the cohort grows', async () => {
    // Call volumes move with the student body, so inference is very nearly a
    // pure variable cost — there is no fixed part left to dilute.
    const today = await loadCostMetrics(dbWith([]))
    const scaled = await loadCostMetrics(dbWith([]), { activeStudents: 6040 })
    expect(scaled.aiPerStudentMonthUsd).toBeCloseTo(today.aiPerStudentMonthUsd, 3)
  })

  it('scales the call counts with the cohort it is costing', async () => {
    // Otherwise 6,040 students would be served by 431 students' worth of
    // generation, which would make inference look free by construction.
    const scaled = await loadCostMetrics(dbWith([]), { activeStudents: 6040 })
    expect(scaled.lines.find((l) => l.key === 'generate_assessment')!.calls).toBeGreaterThan(1923)
  })

  it('reports a per-paper cost, the unit that actually scales with usage', async () => {
    const c = await loadCostMetrics(dbWith([]))
    expect(c.aiPerPaperUsd).toBeGreaterThan(0)
    expect(c.aiPerPaperUsd).toBeLessThan(0.05)
  })

  it('does not divide by zero on a platform with no students yet', async () => {
    const empty = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [] }),
    } as unknown as Database
    const c = await loadCostMetrics(empty)
    expect(Number.isFinite(c.aiPerStudentMonthUsd)).toBe(true)
    expect(c.aiPerStudentMonthUsd).toBe(0)
    expect(c.aiPerPaperUsd).toBe(0)
  })
})
