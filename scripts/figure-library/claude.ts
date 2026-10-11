// scripts/figure-library/claude.ts
import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { Store } from './store'
import { checkBudget, recordSpend } from './spend'

export const HAIKU = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

export interface ModelReply {
  text: string
  inputTokens: number
  outputTokens: number
  /** The model stopped at maxTokens, so the reply is incomplete. */
  truncated?: boolean
}

export type SendFn = (model: string, prompt: string, maxTokens: number) => Promise<ModelReply>

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
  return async (model, prompt, maxTokens) => {
    const res = await client.send(new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    }))
    const body = JSON.parse(new TextDecoder().decode(res.body))
    return {
      text: (Array.isArray(body.content) ? body.content : []).map((c: { text?: string }) => c.text ?? '').join(''),
      inputTokens: Number(body.usage?.input_tokens ?? 0),
      outputTokens: Number(body.usage?.output_tokens ?? 0),
      truncated: body.stop_reason === 'max_tokens',
    }
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
 * recorded before it is parsed, and the budget is checked after each, so a
 * run can never spend past its cap by more than one call.
 */
export async function askJson(o: {
  db: Store
  job: string
  jobCapUsd: number
  prompt: string
  maxTokens: number
  send: SendFn
  model?: string
  attempts?: number
  wait?: (ms: number) => Promise<void>
}): Promise<unknown> {
  const model = o.model ?? HAIKU
  const wait = o.wait ?? sleep
  const attempts = o.attempts ?? 4
  let last: unknown = null
  for (let i = 0; i < attempts; i++) {
    let reply: ModelReply
    try {
      reply = await o.send(model, o.prompt, o.maxTokens)
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
      inputTokens: reply.inputTokens || Math.ceil(o.prompt.length / 3),
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

export async function runPool<T>(items: readonly T[], workers: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }))
}
