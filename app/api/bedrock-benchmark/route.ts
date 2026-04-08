import { NextRequest, NextResponse } from 'next/server'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

const MODELS = [
  { id: 'eu.google.gemma-3-27b-it', label: 'Gemma 3 27B' },
]

// Strip the optional "us." / "eu." / "ap." cross-region prefix for family detection
function modelFamily(modelId: string): string {
  return modelId.replace(/^(us|eu|ap)\./, '')
}

// Build the request body for each model family
function buildBody(modelId: string, prompt: string): string {
  const m = modelFamily(modelId)
  if (m.startsWith('amazon.nova')) {
    return JSON.stringify({
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0.7 },
    })
  }
  if (m.startsWith('meta.llama')) {
    return JSON.stringify({
      prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
      max_gen_len: 300,
      temperature: 0.7,
    })
  }
  // mistral, google, nvidia, openai — all use messages format
  return JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
  })
}

// Extract response text from each model family's response format
function extractText(modelId: string, body: any): string {
  const m = modelFamily(modelId)
  if (m.startsWith('amazon.nova')) return body?.output?.message?.content?.[0]?.text ?? ''
  if (m.startsWith('meta.llama'))  return body?.generation ?? ''
  return (
    body?.choices?.[0]?.message?.content ??
    body?.choices?.[0]?.text ??
    body?.content?.[0]?.text ??
    body?.outputs?.[0]?.text ??
    body?.text ??
    ''
  )
}

// Accuracy test: ask a verifiable factual/math question
const TEST_PROMPT = `Answer these 3 questions briefly and accurately:
1. What is 847 × 23?
2. What is the capital of Rwanda?
3. What is the chemical formula for water?

Reply in this exact format:
1. [answer]
2. [answer]
3. [answer]`

const CORRECT_ANSWERS = {
  math: '19481',
  capital: 'kigali',
  formula: 'h2o',
}

function scoreResponse(text: string): { score: number; details: string[] } {
  const lower = text.toLowerCase().replace(/\s/g, '')
  const results = [
    { q: 'Math (847×23=19481)', correct: lower.includes('19481') },
    { q: 'Capital of Rwanda (Kigali)', correct: lower.includes('kigali') },
    { q: 'Water formula (H₂O)', correct: lower.includes('h2o') || lower.includes('h₂o') },
  ]
  return {
    score: results.filter((r) => r.correct).length,
    details: results.map((r) => `${r.correct ? '✓' : '✗'} ${r.q}`),
  }
}

async function benchmarkModel(
  client: BedrockRuntimeClient,
  model: { id: string; label: string }
): Promise<{
  id: string
  label: string
  latencyMs: number | null
  tokensPerSec: number | null
  accuracyScore: number | null
  accuracyDetails: string[]
  response: string
  error: string | null
}> {
  const start = Date.now()
  try {
    // Auto-retry with alternate ID form (with/without "us." prefix)
    const alt = model.id.startsWith('us.') ? model.id.slice(3) : `us.${model.id}`
    const candidates = [model.id, alt]
    let res: any, usedId = model.id
    let lastErr: any
    for (const modelId of candidates) {
      try {
        const cmd = new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: buildBody(modelId, TEST_PROMPT),
        })
        res = await client.send(cmd)
        usedId = modelId
        break
      } catch (err: any) {
        lastErr = err
        const msg = err?.message ?? ''
        if (msg.includes('invalid') || msg.includes('Invalid') ||
            msg.includes('on-demand throughput') || msg.includes('ValidationException')) continue
        throw err
      }
    }
    if (!res) throw lastErr

    const latencyMs = Date.now() - start
    const body = JSON.parse(new TextDecoder().decode(res.body))
    const text = extractText(usedId, body)
    const { score, details } = scoreResponse(text)

    // Rough tokens/sec: assume ~4 chars per token
    const approxTokens = text.length / 4
    const tokensPerSec = latencyMs > 0 ? Math.round((approxTokens / latencyMs) * 1000) : null

    return {
      id: model.id,
      label: model.label,
      latencyMs,
      tokensPerSec,
      accuracyScore: score,
      accuracyDetails: details,
      response: text.slice(0, 400),
      error: null,
    }
  } catch (err: any) {
    return {
      id: model.id,
      label: model.label,
      latencyMs: Date.now() - start,
      tokensPerSec: null,
      accuracyScore: null,
      accuracyDetails: [],
      response: '',
      error: err?.message ?? String(err),
    }
  }
}

export async function POST(request: NextRequest) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION ?? 'us-east-1'

  if (!accessKeyId || !secretAccessKey) {
    return NextResponse.json({ error: 'AWS credentials not configured' }, { status: 500 })
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  const { modelIds } = await request.json().catch(() => ({ modelIds: null }))
  const targets = modelIds
    ? MODELS.filter((m) => modelIds.includes(m.id))
    : MODELS

  // Run all benchmarks in parallel
  const results = await Promise.all(targets.map((m) => benchmarkModel(client, m)))

  // Sort: successful first by latency, then errored
  results.sort((a, b) => {
    if (a.error && !b.error) return 1
    if (!a.error && b.error) return -1
    return (a.latencyMs ?? 99999) - (b.latencyMs ?? 99999)
  })

  return NextResponse.json({ results, region })
}

export async function GET() {
  return NextResponse.json({ models: MODELS })
}
