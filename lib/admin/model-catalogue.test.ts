import { describe, it, expect, vi } from 'vitest'
import {
  loadModelUsage,
  resolveModelId,
  MODELS,
  FEATURE_USES,
} from './model-catalogue'
import type { Database } from '@/lib/db'

const COUNTS = {
  assessments: '1923', results: '1681', tutor_replies: '708',
  lessons: '65', recall_cards: '398',
}

/** Counts query first, then the ledger query. */
const dbWith = (ledgerRows: Record<string, unknown>[] = []): Database =>
  ({
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [COUNTS] })
      .mockResolvedValueOnce({ rows: ledgerRows }),
  }) as unknown as Database

describe('the catalogue matches the running system', () => {
  it('prices every model a feature can fall back to', () => {
    // An unpriced model would silently contribute nothing to the split.
    for (const use of FEATURE_USES) {
      expect(MODELS[use.fallbackModelId], use.key).toBeDefined()
    }
  })

  it('agrees with the defaults the routes actually use', () => {
    // These mirror the route files. If a route changes model and this does not,
    // the dashboard describes a choice the system is no longer making.
    const byKey = Object.fromEntries(FEATURE_USES.map((u) => [u.key, u.fallbackModelId]))
    expect(byKey.generate_assessment).toBe('amazon.nova-lite-v1:0')
    expect(byKey.generate_feedback).toBe('google.gemma-3-27b-it')
    expect(byKey.grade_longform).toBe('amazon.nova-lite-v1:0')
    expect(byKey.tutor_reply).toBe('google.gemma-3-27b-it')
    // callGemma's DEFAULT_GEMMA_MODEL falls back to Nova Lite despite the name.
    expect(byKey.build_lesson).toBe('amazon.nova-lite-v1:0')
  })

  it('charges more for output than input on every model', () => {
    for (const [id, m] of Object.entries(MODELS)) {
      expect(m.outputPer1M, id).toBeGreaterThan(m.inputPer1M)
    }
  })
})

describe('resolveModelId', () => {
  it('prefers the feature-specific variable', () => {
    const tutor = FEATURE_USES.find((u) => u.key === 'tutor_reply')!
    expect(resolveModelId(tutor, { AWS_TUTOR_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe('amazon.nova-micro-v1:0')
  })

  it('falls back through the shared variables before the default', () => {
    const tutor = FEATURE_USES.find((u) => u.key === 'tutor_reply')!
    expect(resolveModelId(tutor, { AWS_BEDROCK_MODEL_ID: 'amazon.nova-lite-v1:0' } as never))
      .toBe('amazon.nova-lite-v1:0')
    expect(resolveModelId(tutor, {} as never)).toBe('google.gemma-3-27b-it')
  })

  it('strips the region prefix, which is routing rather than a different model', () => {
    const tutor = FEATURE_USES.find((u) => u.key === 'tutor_reply')!
    expect(resolveModelId(tutor, { AWS_TUTOR_MODEL_ID: 'eu.google.gemma-3-27b-it' } as never))
      .toBe('google.gemma-3-27b-it')
  })
})

describe('loadModelUsage', () => {
  it('splits the bill without inventing a total', async () => {
    // The sum is the Bedrock line off the invoice; only the division is modelled.
    const u = await loadModelUsage(12.17, dbWith([]), {} as never)
    const summed = u.rows.reduce((a, r) => a + r.usd, 0)
    expect(summed).toBeCloseTo(12.17, 1)
  })

  it('weights by work done, not by call count alone', async () => {
    // Generation runs about as often as feedback but on far longer prompts, so
    // ranking by calls would put them level and mislead the reader.
    const u = await loadModelUsage(12.17, dbWith([]), {} as never)
    const gen = u.rows.find((r) => r.key === 'generate_assessment')!
    const feedback = u.rows.find((r) => r.key === 'generate_feedback')!
    expect(gen.usd).toBeGreaterThan(feedback.usd)
  })

  it('says it is apportioning while the ledger is empty', async () => {
    expect((await loadModelUsage(12.17, dbWith([]), {} as never)).basis).toBe('apportioned')
  })

  it('switches to measured the moment the ledger has rows', async () => {
    const u = await loadModelUsage(
      12.17,
      dbWith([
        {
          feature: 'generate_assessment', model_id: 'eu.amazon.nova-lite-v1:0',
          calls: '10', input_tokens: '30000', output_tokens: '25000',
        },
      ]),
      {} as never,
    )
    expect(u.basis).toBe('measured')
    expect(u.rows.find((r) => r.key === 'generate_assessment')!.calls).toBe(10)
  })

  it('names the variable that decides each feature', async () => {
    // Without it, someone reading the page cannot act on what it says.
    const u = await loadModelUsage(12.17, dbWith([]), {} as never)
    for (const r of u.rows) expect(r.configuredBy, r.key).toMatch(/^AWS_/)
  })

  it('lists catalogued models nothing routes to', async () => {
    const u = await loadModelUsage(12.17, dbWith([]), {} as never)
    expect(u.unusedModels.map((m) => m.id)).toContain('amazon.nova-micro-v1:0')
  })

  it('survives a bill of zero without dividing by it', async () => {
    const u = await loadModelUsage(0, dbWith([]), {} as never)
    expect(u.rows.every((r) => r.usd === 0)).toBe(true)
  })
})
