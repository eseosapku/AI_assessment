// Shared AWS Bedrock (Gemma) helper.
// Centralises the model-candidate fallback + robust JSON parsing logic that the
// assessment/feedback routes use, so new features (StudyLab tutor) can reuse it.
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { jsonrepair } from 'jsonrepair'
import {
  BEDROCK_CREDENTIALS_ERROR,
  getBedrockCredentials,
  getBedrockRegion,
  hasBedrockCredentials as hasCredentials,
} from '@/lib/aws-config'

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

export function buildModelCandidates(seedId: string): string[] {
  const expanded: string[] = []
  const clean = (seedId || '').trim()
  if (!clean) return expanded

  const bare = stripPrefix(clean)
  expanded.push(clean)
  expanded.push(bare)
  expanded.push(`${regionPrefix()}.${bare}`)
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

function isModelIdError(err: any): boolean {
  const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
  return (
    text.includes('provided model identifier is invalid') ||
    text.includes('invalid model') ||
    text.includes('validationexception') ||
    text.includes('on-demand throughput')
  )
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
    try {
      const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: buildInvokeBody(modelId, prompt, maxTokens, temperature, opts.image),
      })
      const res = await client.send(cmd)
      const parsed = JSON.parse(new TextDecoder().decode(res.body))
      const text = extractText(modelId, parsed)
      if (text.trim()) return text.trim()
      throw new Error(`Empty model response from ${modelId}`)
    } catch (err: any) {
      lastErr = err
      if (isModelIdError(err)) continue
      throw err
    }
  }

  throw lastErr || new Error('No Bedrock model candidate succeeded.')
}

// ── Robust JSON parsing (ported from generate-assessment) ─────────────────────

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
          out += ch + next; i += 2
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
  try { return JSON.parse(t) } catch { /* fall through */ }
  try { return JSON.parse(jsonrepair(t)) } catch { /* fall through */ }
  try {
    const reFixed = t.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
    return JSON.parse(jsonrepair(reFixed))
  } catch { /* fall through */ }
  throw new SyntaxError(`Could not repair JSON. Preview: ${t.slice(0, 120)}`)
}
