// Shared AWS Bedrock (Gemma) helper.
// Centralises the model-candidate fallback + robust JSON parsing logic that the
// assessment/feedback routes use, so new features (StudyLab tutor) can reuse it.
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'
import { jsonrepair } from 'jsonrepair'
import {
  BEDROCK_CREDENTIALS_ERROR,
  getBedrockCredentials,
  getBedrockRegion,
  hasBedrockCredentials as hasCredentials,
} from '@/lib/aws-config'
import { withUsageTracking } from '@/lib/ai-usage-recorder'

const PREFIXES = ['eu', 'us', 'ap'] as const

export const DEFAULT_GEMMA_MODEL =
  process.env.AWS_GENERATION_MODEL_ID ||
  process.env.AWS_BEDROCK_MODEL_ID ||
  process.env.AWS_MODEL_ID ||
  // Amazon Nova Lite: reliably on-demand-available across commercial regions and
  // fast. The previous default (google.gemma-3-27b-it) returns ValidationException
  // on this account/region, forcing every call onto a slow fallback → 504 timeouts.
  'amazon.nova-lite-v1:0'

function awsRegion(): string {
  return getBedrockRegion()
}

export function hasBedrockCredentials(): boolean {
  return hasCredentials()
}

function stripPrefix(modelId: string): string {
  return modelId.replace(/^(us|eu|ap)\./, '')
}

function regionPrefix(): (typeof PREFIXES)[number] {
  const region = awsRegion()
  if (region.startsWith('eu-')) return 'eu'
  if (region.startsWith('ap-')) return 'ap'
  return 'us'
}

/**
 * The model id that actually worked, by bare model name, for this process.
 *
 * Measured in eu-west-1: `amazon.nova-lite-v1:0` fails EVERY time -- "on-demand
 * throughput isn't supported ... use an inference profile" -- in 640-850 ms,
 * and `eu.amazon.nova-lite-v1:0` then succeeds in about 930 ms. The candidate
 * list tried the bare id first and remembered nothing, so every single call
 * to Bedrock was made twice and took nearly twice as long, across all five
 * copies of this logic. Nova Micro, the fallback, the same.
 *
 * Once an id has worked it is tried first, so the probing happens at most once
 * per model per process rather than once per call.
 */
const WORKING_MODEL = new Map<string, string>()

/** Record the id that worked, so the next call goes straight to it. */
export function rememberWorkingModel(modelId: string): void {
  if (modelId) WORKING_MODEL.set(stripPrefix(modelId), modelId)
}

/** Test seam: forget what worked. */
export function resetWorkingModels(): void {
  WORKING_MODEL.clear()
}

export function buildModelCandidates(seedId: string): string[] {
  const expanded: string[] = []
  const clean = (seedId || '').trim()
  if (!clean) return expanded

  const bare = stripPrefix(clean)
  // What worked last time, first.
  const known = WORKING_MODEL.get(bare)
  if (known) expanded.push(known)
  // An id configured WITH a prefix is taken at its word.
  if (clean !== bare) expanded.push(clean)
  // Otherwise this region's inference profile before the bare id: newer
  // models are profile-only in most regions, and the bare id is the one that
  // fails on every call here. The bare id stays in the list for models and
  // regions that do serve it on demand.
  expanded.push(`${regionPrefix()}.${bare}`)
  expanded.push(bare)
  PREFIXES.forEach((p) => expanded.push(`${p}.${bare}`))

  // Known Gemma naming variants on Bedrock.
  if (bare === 'google.gemma-3-27b-it') {
    expanded.push('google.gemma-3-27b-it-v1:0')
    PREFIXES.forEach((p) => expanded.push(`${p}.google.gemma-3-27b-it-v1:0`))
  }
  if (bare === 'google.gemma-3-12b-it') {
    expanded.push('google.gemma-3-12b-it-v1:0')
    PREFIXES.forEach((p) => expanded.push(`${p}.google.gemma-3-12b-it-v1:0`))
  }

  return [...new Set(expanded.filter(Boolean))]
}

/**
 * Is this error about the MODEL ID, so another candidate is worth trying?
 *
 * `validationexception` on its own used to qualify, and that is the whole
 * class of request errors, not the model-id one. A run of 600 calls sent
 * temperature 3.15 — invalid, and identically invalid for every candidate —
 * and each call walked the entire fallback chain and then reported the LAST
 * candidate's complaint: "the provided model identifier is invalid". The
 * model ids were all fine. Every call failed, nothing in the log named the
 * real cause, and the fallback chain turned one clear error into a wrong one.
 *
 * So a ValidationException now has to actually be about the model to qualify.
 * Anything else is raised where it happened.
 */
export function isModelIdError(err: any): boolean {
  const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
  if (
    text.includes('provided model identifier is invalid') ||
    text.includes('invalid model') ||
    text.includes('on-demand throughput')
  ) {
    return true
  }
  return text.includes('validationexception') && /\bmodel\b/.test(text)
}

export interface ImageInput {
  base64: string
  mimeType: string
}

function buildInvokeBody(
  modelId: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
  image?: ImageInput
): string {
  const m = stripPrefix(modelId)
  if (m.startsWith('amazon.nova')) {
    const content: any[] = [{ text: prompt }]
    if (image) {
      const format = image.mimeType.split('/')[1] || 'png'
      content.unshift({ image: { format, source: { bytes: image.base64 } } })
    }
    return JSON.stringify({
      messages: [{ role: 'user', content }],
      inferenceConfig: { maxTokens, temperature },
    })
  }
  if (m.startsWith('meta.llama')) {
    // Llama text-only path (vision not handled here).
    return JSON.stringify({
      prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
      max_gen_len: maxTokens,
      temperature,
    })
  }
  // mistral, google (gemma), nvidia, openai on Bedrock — OpenAI-style messages.
  if (image) {
    return JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
          ],
        },
      ],
      max_tokens: maxTokens,
      temperature,
    })
  }
  return JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature })
}

function extractText(modelId: string, payload: any): string {
  const m = stripPrefix(modelId)
  if (m.startsWith('amazon.nova')) return payload?.output?.message?.content?.[0]?.text ?? ''
  if (m.startsWith('meta.llama')) return payload?.generation ?? ''
  const raw =
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    payload?.output?.message?.content?.[0]?.text ??
    payload?.output_text ??
    payload?.content?.[0]?.text ??
    payload?.outputs?.[0]?.text ??
    ''
  if (Array.isArray(raw)) {
    return raw.map((item: any) => (typeof item === 'string' ? item : item?.text || '')).join('\n').trim()
  }
  return String(raw || '').trim()
}

let cachedClient: BedrockRuntimeClient | null = null
function getClient(): BedrockRuntimeClient {
  if (cachedClient) return cachedClient
  const credentials = getBedrockCredentials()
  if (!credentials) {
    throw new Error(BEDROCK_CREDENTIALS_ERROR)
  }
  cachedClient = new BedrockRuntimeClient({
    region: awsRegion(),
    maxAttempts: 1,
    credentials,
  })
  return cachedClient
}

export interface CallGemmaOptions {
  maxTokens?: number
  temperature?: number
  /** Override model seed. Defaults to DEFAULT_GEMMA_MODEL. */
  model?: string
  /** Optional image for multimodal models (best-effort). */
  image?: ImageInput
  /** Cap how many model-id candidates to try (used to fail fast on image turns). */
  maxCandidates?: number
  /**
   * Records this call in the usage ledger. Absent means untracked, which is
   * how every existing caller behaves — this is additive on purpose.
   */
  usage?: { feature: string; requestId: string; userId: string | null }
  /**
   * Gives up on the call when aborted. A request has 30 s on Amplify before
   * the student gets a gateway error page; a caller with a deadline passes
   * one so the call stops in time to answer properly instead.
   */
  signal?: AbortSignal
}

/**
 * Call Gemma (or whichever Bedrock model is configured) with a single prompt.
 * Tries the configured model id across region prefixes/variants, then falls back
 * to google.gemma-3-12b-it. Returns the raw text response.
 */
export async function callGemma(prompt: string, opts: CallGemmaOptions = {}): Promise<string> {
  if (!hasBedrockCredentials()) {
    throw new Error(BEDROCK_CREDENTIALS_ERROR)
  }

  const maxTokens = opts.maxTokens ?? 2000
  const temperature = opts.temperature ?? 0.6
  const client = getClient()

  const candidates = [
    ...buildModelCandidates(opts.model || DEFAULT_GEMMA_MODEL),
    ...buildModelCandidates('google.gemma-3-12b-it'),
  ]
  let uniqueCandidates = [...new Set(candidates)]
  if (opts.maxCandidates && opts.maxCandidates > 0) {
    uniqueCandidates = uniqueCandidates.slice(0, opts.maxCandidates)
  }

  let lastErr: any = null
  for (const modelId of uniqueCandidates) {
    if (opts.signal?.aborted) throw abortError()
    try {
      const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: buildInvokeBody(modelId, prompt, maxTokens, temperature, opts.image),
      })
      const res = opts.usage
        ? await withUsageTracking(
            {
              modelId,
              feature: opts.usage.feature,
              requestId: opts.usage.requestId,
              userId: opts.usage.userId,
              parseBody: (r: InvokeModelCommandOutput) =>
                JSON.parse(new TextDecoder().decode(r.body)),
            },
            () => client.send(cmd, { abortSignal: opts.signal }),
          )
        : await client.send(cmd, { abortSignal: opts.signal })
      const parsed = JSON.parse(new TextDecoder().decode(res.body))
      const text = extractText(modelId, parsed)
      if (text.trim()) {
        rememberWorkingModel(modelId)
        return text.trim()
      }
      throw new Error(`Empty model response from ${modelId}`)
    } catch (err: any) {
      lastErr = err
      if (isModelIdError(err)) continue
      throw err
    }
  }

  throw lastErr || new Error('No Bedrock model candidate succeeded.')
}

function abortError(): Error {
  return Object.assign(new Error('The model call ran out of time.'), { name: 'AbortError' })
}

// ── Robust JSON parsing (ported from generate-assessment) ─────────────────────

// LaTeX commands beginning with n/t — the two escape letters that ALSO appear
// constantly as real whitespace in code/text (\n newline, \t tab). For these we
// only treat the backslash as LaTeX when the following word actually spells one
// of these commands; otherwise "\ndef" / "\t  x" would be mangled into literal
// "\n"/"\t". (b/f/r are rare as real escapes, so a trailing letter is enough.)
const LATEX_NT_COMMANDS = new Set([
  'nabla', 'neq', 'ne', 'neg', 'nu', 'ni', 'not', 'nleq', 'ngeq', 'nmid', 'nparallel',
  'ncong', 'nsubseteq', 'nsupseteq', 'natural', 'nexists', 'nwarrow', 'nrightarrow',
  'nleftarrow', 'ngtr', 'nless',
  'theta', 'times', 'to', 'tan', 'tanh', 'tau', 'top', 'tilde', 'triangle', 'tfrac',
  'therefore', 'text', 'textbf', 'textit', 'textrm', 'texttt', 'textsf', 'textsc',
  'triangleleft', 'triangleright', 'twoheadrightarrow', 'tbinom',
])

/** Fix invalid backslash escapes inside JSON string values (e.g. LaTeX \frac). */
export function fixLatexInRawJson(raw: string): string {
  const VALID_AFTER_SLASH = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])
  let out = ''
  let inString = false
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      i++
    } else {
      if (ch === '\\') {
        const next = raw[i + 1]
        if (next === undefined) { out += '\\\\'; i++; continue }
        if (next === 'u') {
          const hex = raw.slice(i + 2, i + 6)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) { out += ch + next + hex; i += 6 }
          else { out += '\\\\' + next; i += 2 }
        } else if (VALID_AFTER_SLASH.has(next)) {
          // \b \f \r followed by another letter is almost always a LaTeX command
          // (\beta \frac \rho \rightarrow), NOT a JSON escape — double the
          // backslash so it survives JSON.parse for KaTeX. \n and \t are common
          // real whitespace in code, so only treat them as LaTeX when the word
          // actually spells a known command (\nabla, \theta), never "\ndef".
          const after = raw[i + 2]
          const afterIsLetter = after !== undefined && /[a-zA-Z]/.test(after)
          let isLatex = false
          if ('bfr'.includes(next) && afterIsLetter) {
            isLatex = true
          } else if ('nt'.includes(next) && afterIsLetter) {
            let word = next
            let j = i + 2
            while (j < raw.length && /[a-zA-Z]/.test(raw[j])) { word += raw[j]; j++ }
            isLatex = LATEX_NT_COMMANDS.has(word)
          }
          if (isLatex) { out += '\\\\' + next; i += 2 }
          else { out += ch + next; i += 2 }
        } else {
          out += '\\\\' + next; i += 2
        }
      } else if (ch === '"') {
        inString = false; out += ch; i++
      } else if (ch === '\n' || ch === '\r') {
        out += '\\n'; i++
      } else {
        out += ch; i++
      }
    }
  }
  return out
}

/** Parse JSON from an LLM response: native -> jsonrepair -> \u fix -> throw. */
export function parseJsonRobust(text: string): any {
  let t = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  if (!t.startsWith('{') && !t.startsWith('[')) {
    const m = t.match(/[\{\[][\s\S]*[\}\]]/)
    if (m) t = m[0]
  }
  // The escapes are repaired BEFORE the first parse, not after it, because the
  // damage a LaTeX command does depends on its first letter and the worse case
  // is the one that parses. `\cdot` is an invalid escape, so parsing fails and
  // jsonrepair drops the backslash — a worked solution reading "2 cdot x cdot
  // 4 = 8x". But `\frac` IS valid JSON: it parses straight through as a
  // formfeed, and the card says "rac{b}{2}" with nothing to signal anything
  // went wrong. `fixLatexInRawJson` knows which backslashes are commands and
  // which are real escapes; the unrepaired text is still tried underneath, so
  // anything it gets wrong falls back to what would have happened anyway.
  const fixed = fixLatexInRawJson(t)
  try { return JSON.parse(fixed) } catch { /* fall through */ }
  try { return JSON.parse(t) } catch { /* fall through */ }
  try { return JSON.parse(jsonrepair(fixed)) } catch { /* fall through */ }
  try { return JSON.parse(jsonrepair(t)) } catch { /* fall through */ }
  try {
    const reFixed = t.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
    return JSON.parse(jsonrepair(reFixed))
  } catch { /* fall through */ }
  throw new SyntaxError(`Could not repair JSON. Preview: ${t.slice(0, 120)}`)
}
