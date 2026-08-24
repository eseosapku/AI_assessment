import { db as defaultDb, type Database } from '@/lib/db'

/**
 * Which model does what, what each one charges, and where the Bedrock line on
 * the bill actually goes.
 *
 * The AWS export gives Bedrock as a single figure. That is enough to know
 * inference is 5% of spend and not enough to answer the question anyone asks
 * next, which is what it is being spent on. Until `ai_usage_events` has run
 * long enough to answer that directly, the total is apportioned across features
 * by how much work each one does — call volume multiplied by tokens per call —
 * and the panel says which of the two it is showing.
 *
 * Apportioning a real total is a much narrower claim than estimating one. The
 * sum is right either way; only the split between rows is modelled, and it
 * stops being modelled the moment the ledger fills.
 *
 * Every model here is resolved from the same environment variables the routes
 * read, so this catalogue and the running system cannot disagree about which
 * model is in use — a dashboard describing last quarter's model choice would be
 * worse than one that said nothing.
 */

export interface ModelSpec {
  id: string
  label: string
  provider: string
  /** USD per million tokens. List prices — verify against an invoice. */
  inputPer1M: number
  outputPer1M: number
  /** Why this model, in the terms the choice was actually made on. */
  note: string
}

export const MODELS: Record<string, ModelSpec> = {
  'amazon.nova-lite-v1:0': {
    id: 'amazon.nova-lite-v1:0',
    label: 'Nova Lite',
    provider: 'Amazon',
    inputPer1M: 0.06,
    outputPer1M: 0.24,
    note: 'The workhorse. On-demand in every commercial region and fast, where Gemma returns ValidationException in several.',
  },
  'amazon.nova-micro-v1:0': {
    id: 'amazon.nova-micro-v1:0',
    label: 'Nova Micro',
    provider: 'Amazon',
    inputPer1M: 0.035,
    outputPer1M: 0.14,
    note: 'Cheapest available. Held in reserve for short structured calls.',
  },
  'google.gemma-3-27b-it': {
    id: 'google.gemma-3-27b-it',
    label: 'Gemma 3 27B',
    provider: 'Google',
    inputPer1M: 0.2,
    outputPer1M: 0.4,
    note: 'Richer prose than Nova, which is why feedback and the tutor stayed on it. Roughly three times the price per token.',
  },
  'google.gemma-3-12b-it': {
    id: 'google.gemma-3-12b-it',
    label: 'Gemma 3 12B',
    provider: 'Google',
    inputPer1M: 0.1,
    outputPer1M: 0.2,
    note: 'Fallback tier when 27B is unavailable in a region.',
  },
  'anthropic.claude-haiku-4-5': {
    id: 'anthropic.claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    note: 'Not in the product. A single month of benchmarking in May, billed separately as Bedrock Edition.',
  },
}

export interface FeatureUse {
  key: string
  /** What the student sees. */
  label: string
  what: string
  /** The environment variable that decides this, so the panel matches production. */
  envVar: string
  fallbackModelId: string
  /** Typical tokens for one call, used only to apportion a known total. */
  tokensPerCall: number
  /**
   * Whether this model was chosen for this job, or inherited.
   *
   * On 22 June a Bedrock ValidationException on this account made
   * google.gemma-3-27b-it unusable and every route was moved to Nova Lite to
   * stop the 504s. Feedback was moved back the same day and the tutor three
   * days later; the shared default in bedrock.ts never was. Anything still
   * riding it is running on an incident fix rather than a decision.
   */
  provenance: 'chosen' | 'inherited'
  /** One line on how it came to be this model. */
  why: string
  /** Which count in the database stands for "one call of this". */
  countKey: 'assessments' | 'results' | 'tutorReplies' | 'lessons' | 'recallCards'
}

/**
 * The features that spend money, and what decides their model.
 *
 * Defaults mirror the routes exactly: generation and grading run on Nova Lite,
 * feedback and the tutor stayed on Gemma 27B for the prose.
 */
export const FEATURE_USES: FeatureUse[] = [
  {
    key: 'generate_assessment',
    label: 'Paper generation',
    what: 'Builds a quiz from the curriculum, with questions tagged to subtopics.',
    envVar: 'AWS_GENERATION_MODEL_ID',
    fallbackModelId: 'amazon.nova-lite-v1:0',
    tokensPerCall: 5500,
    countKey: 'assessments',
    provenance: 'chosen',
    why: 'Moved to Nova Lite on 22 June to stop generation timing out at the gateway, and kept there.',
  },
  {
    key: 'generate_feedback',
    label: 'Feedback on a marked paper',
    what: 'Writes the explanation a student reads after submitting.',
    envVar: 'AWS_FEEDBACK_MODEL_ID',
    fallbackModelId: 'google.gemma-3-27b-it',
    tokensPerCall: 2800,
    countKey: 'results',
    provenance: 'chosen',
    why: 'Deliberately moved back to Gemma on 22 June for richer prose in a single call.',
  },
  {
    key: 'grade_longform',
    label: 'Long-form grading',
    what: 'Marks written answers against a rubric.',
    envVar: 'AWS_GRADING_MODEL_ID',
    fallbackModelId: 'amazon.nova-lite-v1:0',
    tokensPerCall: 2100,
    countKey: 'results',
    provenance: 'chosen',
    why: 'Tried on Gemma on 22 June and moved back the same day: grading was the largest 27B line and Nova was close enough.',
  },
  {
    key: 'tutor_reply',
    label: 'StudyLab tutor — and the lessons it writes',
    what: 'Answers a student inside a lesson and produces the whiteboard content, so this is what actually writes lessons.',
    envVar: 'AWS_TUTOR_MODEL_ID',
    fallbackModelId: 'google.gemma-3-27b-it',
    tokensPerCall: 4700,
    countKey: 'tutorReplies',
    provenance: 'chosen',
    why: 'Put on Gemma on 25 June — the tutor turn orchestrates the whole whiteboard, so it runs on the stronger model.',
  },
  {
    key: 'recall_card',
    label: 'Recall cards',
    what: 'Turns a lesson into spaced-repetition cards.',
    envVar: 'AWS_GENERATION_MODEL_ID',
    fallbackModelId: 'amazon.nova-lite-v1:0',
    tokensPerCall: 2700,
    countKey: 'recallCards',
    provenance: 'inherited',
    why: 'Never chosen. Rides the shared default that the 22 June incident set to Nova Lite.',
  },
]

/**
 * Call sites still running on the incident default.
 *
 * These reach Bedrock through callGemma() with no model of their own, so they
 * take DEFAULT_GEMMA_MODEL — which the 22 June fix pointed at Nova Lite and
 * nobody pointed back. The function's name still says Gemma, which is how this
 * stayed invisible.
 *
 * They are listed rather than costed because nothing in the database counts
 * them, and a spend figure without a call count would be invention.
 */
export const INHERITED_CALL_SITES = [
  {
    path: 'app/api/studylab/grade/route.ts',
    label: 'StudyLab checkpoint grading',
    what: 'Marks a student\'s work on the whiteboard.',
  },
  {
    path: 'app/api/studylab/snap/route.ts',
    label: 'StudyLab snap',
    what: 'Reads a photographed page. A vision call, where model choice matters most.',
  },
  {
    path: 'lib/textbook-vision-images.ts',
    label: 'Textbook figure curation',
    what: 'Decides which textbook images are worth attaching to a question.',
  },
]

/** The model a feature is actually running on right now. */
export function resolveModelId(use: FeatureUse, env: NodeJS.ProcessEnv = process.env): string {
  const configured =
    env[use.envVar] || env.AWS_BEDROCK_MODEL_ID || env.AWS_MODEL_ID || use.fallbackModelId
  // Region prefixes are a routing detail, not a different model.
  return String(configured).replace(/^(us|eu|ap)\./, '')
}

export interface ModelUsageRow {
  key: string
  label: string
  what: string
  modelId: string
  modelLabel: string
  provider: string
  inputPer1M: number
  outputPer1M: number
  note: string
  calls: number
  /** Share of the Bedrock line this feature accounts for. */
  sharePct: number
  usd: number
  /** USD per call at that share. */
  perCallUsd: number
  configuredBy: string
  provenance: 'chosen' | 'inherited'
  why: string
}

export interface ModelUsage {
  basis: 'measured' | 'apportioned'
  rows: ModelUsageRow[]
  /** The Bedrock total being split, straight off the bill. */
  bedrockUsd: number
  /** Models in the catalogue that nothing currently routes to. */
  unusedModels: ModelSpec[]
  /** Call sites still on the model an incident chose for them. */
  inheritedCallSites: typeof INHERITED_CALL_SITES
}

interface Counts {
  assessments: number
  results: number
  tutorReplies: number
  lessons: number
  recallCards: number
}

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, dp = 2): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

async function loadCounts(database: Database): Promise<Counts> {
  const { rows } = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM assessments)                                   AS assessments,
      (SELECT COUNT(*) FROM results)                                       AS results,
      (SELECT COUNT(*) FROM learnspace_messages WHERE role = 'assistant')  AS tutor_replies,
      (SELECT COUNT(*) FROM learnspaces)                                   AS lessons,
      (SELECT COUNT(*) FROM recall_cards)                                  AS recall_cards
  `)
  const r = rows[0] ?? {}
  return {
    assessments: n(r.assessments),
    results: n(r.results),
    tutorReplies: n(r.tutor_replies),
    lessons: n(r.lessons),
    recallCards: n(r.recall_cards),
  }
}

/** Measured spend per feature, once the ledger has anything to say. */
async function loadMeasured(
  database: Database,
): Promise<{ feature: string; modelId: string; calls: number; inputTokens: number; outputTokens: number }[]> {
  const { rows } = await database.query(`
    SELECT feature, model_id,
           COUNT(*)                        AS calls,
           COALESCE(SUM(input_tokens), 0)  AS input_tokens,
           COALESCE(SUM(output_tokens), 0) AS output_tokens
      FROM ai_usage_events
     WHERE status = 'succeeded'
     GROUP BY 1, 2
  `)
  return rows.map((r: Record<string, unknown>) => ({
    feature: String(r.feature),
    modelId: String(r.model_id).replace(/^(us|eu|ap)\./, ''),
    calls: n(r.calls),
    inputTokens: n(r.input_tokens),
    outputTokens: n(r.output_tokens),
  }))
}

/**
 * Splits the Bedrock line across the features that caused it.
 *
 * Weighted by call volume times tokens per call, so a feature that runs often
 * on short prompts and one that runs rarely on long ones land in the right
 * order. The total is never invented — it comes from the bill and the weights
 * only decide how it is divided.
 */
export async function loadModelUsage(
  bedrockUsd: number,
  database: Database = defaultDb,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ModelUsage> {
  const [counts, measured] = await Promise.all([
    loadCounts(database),
    loadMeasured(database).catch(() => []),
  ])

  const byFeature = new Map(measured.map((m) => [m.feature, m]))
  const basis: ModelUsage['basis'] = measured.length > 0 ? 'measured' : 'apportioned'

  const weighted = FEATURE_USES.map((use) => {
    const calls = counts[use.countKey]
    return { use, calls, weight: calls * use.tokensPerCall }
  })
  const totalWeight = weighted.reduce((a, w) => a + w.weight, 0)

  const rows: ModelUsageRow[] = weighted.map(({ use, calls, weight }) => {
    const modelId = resolveModelId(use, env)
    const spec = MODELS[modelId] ?? {
      id: modelId,
      label: modelId,
      provider: 'Unknown',
      inputPer1M: 0,
      outputPer1M: 0,
      note: 'Not in the catalogue — add it so its rate can be priced.',
    }

    const seen = byFeature.get(use.key)
    const share = totalWeight > 0 ? weight / totalWeight : 0
    const usd = seen
      ? (seen.inputTokens * spec.inputPer1M + seen.outputTokens * spec.outputPer1M) / 1_000_000
      : bedrockUsd * share
    const actualCalls = seen?.calls ?? calls

    return {
      key: use.key,
      label: use.label,
      what: use.what,
      modelId,
      modelLabel: spec.label,
      provider: spec.provider,
      inputPer1M: spec.inputPer1M,
      outputPer1M: spec.outputPer1M,
      note: spec.note,
      calls: actualCalls,
      sharePct: round(share * 100, 1),
      usd: round(usd, 2),
      perCallUsd: actualCalls > 0 ? round(usd / actualCalls, 6) : 0,
      configuredBy: use.envVar,
      provenance: use.provenance,
      why: use.why,
    }
  }).sort((a, b) => b.usd - a.usd)

  const inUse = new Set(rows.map((r) => r.modelId))
  return {
    basis,
    rows,
    bedrockUsd: round(bedrockUsd, 2),
    // Worth showing: a model in the catalogue that nothing routes to is either
    // a fallback that never fires or a decision nobody finished making.
    unusedModels: Object.values(MODELS).filter((m) => !inUse.has(m.id)),
    inheritedCallSites: INHERITED_CALL_SITES,
  }
}
