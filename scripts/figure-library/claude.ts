// scripts/figure-library/claude.ts
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { Store } from './store'
import { checkBudget, recordSpend } from './spend'

export const HAIKU = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
export const SONNET = 'eu.anthropic.claude-sonnet-5-5'
export const NOVA_LITE = 'eu.amazon.nova-lite-v1:0'
const isNova = (model: string) => /nova/.test(model)

/** An image sent with a prompt, base64-encoded. */
export interface ImageInput {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp'
  data: string
}

/** What one image is counted as when a reply carries no usage figures: a 1,200 px figure is about 1,600 tokens. */
const IMAGE_TOKENS_WORST = 1600

export interface ModelReply {
  text: string
  inputTokens: number
  outputTokens: number
  /** The model stopped at maxTokens, so the reply is incomplete. */
  truncated?: boolean
}

export type SendFn = (model: string, prompt: string, maxTokens: number, images?: readonly ImageInput[]) => Promise<ModelReply>

/**
 * The InvokeModel body. Images go before the words. Sonnet refuses a
 * temperature, so it gets an effort setting instead, as the repo's other
 * Sonnet scripts do. A prompt with no images is sent exactly as before.
 */
export function requestBody(model: string, prompt: string, maxTokens: number, images: readonly ImageInput[] = []): Record<string, unknown> {
  if (isNova(model)) {
    return {
      schemaVersion: 'messages-v1',
      messages: [{
        role: 'user',
        content: [...images.map((i) => ({ image: { format: i.mediaType.split('/')[1], source: { bytes: i.data } } })), { text: prompt }],
      }],
      inferenceConfig: { maxTokens, temperature: 0 },
    }
  }
  const content = images.length
    ? [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
        { type: 'text', text: prompt },
      ]
    : prompt
  return {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    ...(/sonnet|opus/.test(model) ? { output_config: { effort: 'low' } } : {}),
    messages: [{ role: 'user', content }],
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The repo's .env and .env.local, with the process environment winning. */
export function loadEnv(root = process.cwd()): Record<string, string> {
  const env: Record<string, string> = {}
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...env, ...(process.env as Record<string, string>) }
}

export function bedrockSender(env: Record<string, string> = loadEnv()): SendFn {
  const client = new BedrockRuntimeClient({
    region: env.AWS_REGION || 'eu-west-1',
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
  return async (model, prompt, maxTokens, images) => {
    const res = await client.send(new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody(model, prompt, maxTokens, images ?? [])),
    }))
    return readReply(model, JSON.parse(new TextDecoder().decode(res.body)))
  }
}

/** A Bedrock reply as text, token counts and whether it was cut off, from Claude's shape or Nova's. */
export function readReply(model: string, body: any): ModelReply {
  if (isNova(model)) {
    const content = body?.output?.message?.content
    return {
      text: (Array.isArray(content) ? content : []).map((c: { text?: string }) => c.text ?? '').join(''),
      inputTokens: Number(body?.usage?.inputTokens ?? 0),
      outputTokens: Number(body?.usage?.outputTokens ?? 0),
      truncated: body?.stopReason === 'max_tokens',
    }
  }
  return {
    text: (Array.isArray(body?.content) ? body.content : []).map((c: { text?: string }) => c.text ?? '').join(''),
    inputTokens: Number(body?.usage?.input_tokens ?? 0),
    outputTokens: Number(body?.usage?.output_tokens ?? 0),
    truncated: body?.stop_reason === 'max_tokens',
  }
}

export function extractJson(text: string): unknown {
  const cleaned = String(text).replace(/`{3}(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in the reply')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const THROTTLED = /throttl|too many requests|rate exceeded|serviceunavailable|\b503\b|\b429\b/i

/**
 * One model call that must come back as JSON. Every reply is paid for and
 * recorded before it is parsed, and the budget is checked before and after
 * each, so a run spends past its cap by at most one call per worker.
 */
export async function askJson(o: {
  db: Store
  job: string
  jobCapUsd: number
  prompt: string
  maxTokens: number
  send: SendFn
  images?: readonly ImageInput[]
  model?: string
  attempts?: number
  wait?: (ms: number) => Promise<void>
}): Promise<unknown> {
  const model = o.model ?? HAIKU
  const wait = o.wait ?? sleep
  const attempts = o.attempts ?? 4
  let last: unknown = null
  for (let i = 0; i < attempts; i++) {
    // A job already over its cap sends nothing more.
    checkBudget(o.db, { job: o.job, jobCapUsd: o.jobCapUsd })
    let reply: ModelReply
    try {
      reply = await o.send(model, o.prompt, o.maxTokens, o.images)
    } catch (err) {
      last = err
      const e = err as { name?: string; message?: string }
      if (THROTTLED.test(`${e?.name ?? ''} ${e?.message ?? ''}`)) {
        await wait(1000 * 2 ** i)
        continue
      }
      throw err
    }
    // A reply without usage figures is counted at its worst case, never as free.
    recordSpend(o.db, {
      job: o.job,
      model,
      inputTokens: reply.inputTokens || Math.ceil(o.prompt.length / 3) + IMAGE_TOKENS_WORST * (o.images?.length ?? 0),
      outputTokens: reply.outputTokens || o.maxTokens,
    })
    checkBudget(o.db, { job: o.job, jobCapUsd: o.jobCapUsd })
    // The same prompt would be cut off the same way again: say so instead of paying for it.
    if (reply.truncated) throw new Error(`The reply was cut off at ${o.maxTokens} tokens; send less per call or allow more`)
    try {
      return extractJson(reply.text)
    } catch (err) {
      last = err
    }
  }
  throw last instanceof Error ? last : new Error('The model gave no usable reply')
}

/**
 * Runs `fn` over the items, a few at a time. The first failure stops new items
 * starting, and every call already in flight settles before it is reported: a
 * budget stop used to return at once, the store was closed, and the other
 * workers went on paying for calls they could no longer record.
 */
export async function runPool<T>(items: readonly T[], workers: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  let failed: { error: unknown } | null = null
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (!failed && next < items.length) {
      const item = items[next++]
      try {
        await fn(item)
      } catch (error) {
        if (!failed) failed = { error }
      }
    }
  }))
  if (failed) throw (failed as { error: unknown }).error
}
