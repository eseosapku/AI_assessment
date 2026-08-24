import { describe, it, expect, vi } from 'vitest'
import { loadCostMetrics, REVENUE_PER_STUDENT_USD } from './cost-metrics'
import { AWS_MONTHS, SERVICE_BUCKETS, serviceTotals, bucketsForMonth } from './aws-costs'
import type { Database } from '@/lib/db'

/** Monthly active students, the shape loadMonthlyActive returns. */
const dbWith = (rows: { month: string; students: string }[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const LIVE = [
  { month: '2026-02', students: '5' },
  { month: '2026-03', students: '8' },
  { month: '2026-04', students: '6' },
  { month: '2026-05', students: '340' },
  { month: '2026-06', students: '287' },
  { month: '2026-07', students: '13' },
]

describe('the imported bill', () => {
  it('sums to the total on the export', () => {
    // If these drift the whole panel is quietly wrong, and nothing else would
    // catch it — the figures are pasted in, not computed.
    const total = serviceTotals().reduce((a, s) => a + s.usd, 0)
    expect(total).toBeCloseTo(246.88, 1)
  })

  it('accounts for every month in the export', () => {
    expect(AWS_MONTHS.map((m) => m.month)).toEqual([
      '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ])
  })

  it('splits each month into exactly its own total', () => {
    for (const m of AWS_MONTHS) {
      const b = bucketsForMonth(m)
      expect(b.serving + b.inference + b.development, m.month).toBeCloseTo(m.total, 4)
    }
  })

  it('buckets an unrecognised service rather than dropping it', () => {
    // A new line on the bill must never vanish from the total it belongs to.
    const rogue = { month: '2026-99', total: 10, byService: { 'Brand New Service': 10 } }
    expect(bucketsForMonth(rogue).serving).toBe(10)
  })

  it('files build tooling and one-off experiments as development', () => {
    // They would not disappear if every student left, so charging them to a
    // student overstates what a student costs.
    expect(SERVICE_BUCKETS['CodeBuild']).toBe('development')
    expect(SERVICE_BUCKETS['EC2 Container Registry (ECR)']).toBe('development')
    expect(SERVICE_BUCKETS['Claude Haiku 4.5 ( Bedrock Edition)']).toBe('development')
    expect(SERVICE_BUCKETS['Rekognition']).toBe('development')
  })

  it('files the database and network as serving', () => {
    expect(SERVICE_BUCKETS['Relational Database Service']).toBe('serving')
    expect(SERVICE_BUCKETS['VPC']).toBe('serving')
  })
})

describe('loadCostMetrics', () => {
  it('finds the database, not inference, to be the bill', async () => {
    // The margin thesis holds, but for a different reason than the models
    // being cheap: this platform costs money to store and serve data.
    const c = await loadCostMetrics(dbWith(LIVE))
    expect(c.inferenceSharePct).toBeLessThan(10)
    expect(c.servingUsd).toBeGreaterThan(c.inferenceUsd * 10)
  })

  it('reports a healthy margin in the month students actually turned up', async () => {
    const c = await loadCostMetrics(dbWith(LIVE))
    expect(c.bestMonth?.month).toBe('2026-05')
    expect(c.bestMonth?.marginPct).toBeGreaterThan(90)
  })

  it('reports a loss as a loss when the bill outruns the students', async () => {
    // July cost more than any other month and had thirteen students on it.
    // Blending that away would hide the only thing here worth acting on.
    const c = await loadCostMetrics(dbWith(LIVE))
    const july = c.months.find((m) => m.month === '2026-07')!
    expect(july.marginPct).toBeLessThan(0)
    expect(july.costPerStudentUsd).toBeGreaterThan(REVENUE_PER_STUDENT_USD)
  })

  it('says nothing rather than zero for a month with nobody on it', async () => {
    // No margin is not a margin of zero, and no cost per student is not free.
    const c = await loadCostMetrics(dbWith([]))
    expect(c.months.every((m) => m.marginPct === null)).toBe(true)
    expect(c.months.every((m) => m.costPerStudentUsd === null)).toBe(true)
  })

  it('leaves development spend out of what a student costs', async () => {
    const c = await loadCostMetrics(dbWith(LIVE))
    for (const m of c.months) {
      expect(m.costToServeUsd, m.month).toBeCloseTo(m.servingUsd + m.inferenceUsd, 2)
      expect(m.costToServeUsd, m.month).toBeLessThanOrEqual(m.totalUsd + 0.01)
    }
  })

  it('grows only the consumed part of the bill when costing a bigger cohort', async () => {
    // The database runs whether anyone logs in or not, so serving fourteen
    // times the students does not cost fourteen times as much — which is the
    // entire reason the per-student figure improves with size.
    const today = await loadCostMetrics(dbWith(LIVE))
    const scaled = await loadCostMetrics(dbWith(LIVE), { activeStudents: 6040 })
    expect(scaled.bestMonth!.activeStudents).toBe(6040)
    expect(scaled.bestMonth!.costPerStudentUsd!).toBeLessThan(today.bestMonth!.costPerStudentUsd!)
    expect(scaled.bestMonth!.marginPct!).toBeGreaterThan(today.bestMonth!.marginPct!)
  })

  it('reports break-even against the most recent month, not a lifetime average', async () => {
    const c = await loadCostMetrics(dbWith(LIVE))
    expect(c.breakEvenStudents).toBe(
      Math.ceil(c.latestMonth!.costToServeUsd / REVENUE_PER_STUDENT_USD),
    )
  })

  it('carries the export date, since these figures go stale silently', async () => {
    const c = await loadCostMetrics(dbWith(LIVE))
    expect(c.source.exportedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shares add up to the whole bill', async () => {
    const c = await loadCostMetrics(dbWith(LIVE))
    expect(c.servingUsd + c.inferenceUsd + c.developmentUsd).toBeCloseTo(c.totalUsd, 1)
  })
})
