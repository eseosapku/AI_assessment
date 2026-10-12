// scripts/figure-library/claude.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { BudgetExceeded, totalSpend } from './spend'
import { HAIKU, NOVA_LITE, SONNET, askJson, extractJson, readReply, requestBody, runPool, type ImageInput, type SendFn } from './claude'

const noWait = async () => {}

describe('reading JSON out of a model reply', () => {
  it('takes it from inside a code fence or surrounding words', () => {
    const fence = '`'.repeat(3)
    expect(extractJson(`Here:\n${fence}json\n{"a":1}\n${fence}`)).toEqual({ a: 1 })
    expect(extractJson('{"concepts":[]} done')).toEqual({ concepts: [] })
  })
  it('refuses a reply with no JSON object', () => {
    expect(() => extractJson('sorry')).toThrow(/No JSON/)
  })
})

describe('asking the model for JSON', () => {
  it('records what every call cost, including retries', async () => {
    const db = openStore(':memory:')
    let n = 0
    const send: SendFn = async () => (++n === 1
      ? { text: 'not json', inputTokens: 1000, outputTokens: 100 }
      : { text: '{"ok":true}', inputTokens: 1000, outputTokens: 100 })
    expect(await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 200, send, wait: noWait })).toEqual({ ok: true })
    expect(totalSpend(db, 't')).toBeCloseTo(2 * (1000 * 1.1 + 100 * 5.5) / 1e6, 9)
  })

  it('waits and retries when Bedrock is throttling', async () => {
    const db = openStore(':memory:')
    let n = 0
    const send: SendFn = async () => {
      if (++n < 3) throw Object.assign(new Error('Too many requests'), { name: 'ThrottlingException' })
      return { text: '{"ok":1}', inputTokens: 10, outputTokens: 10 }
    }
    expect(await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, wait: noWait })).toEqual({ ok: 1 })
  })

  it('counts a call with no usage figures at the worst case, never as free', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{}', inputTokens: 0, outputTokens: 0 })
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'x'.repeat(3000), maxTokens: 1000, send, wait: noWait })
    expect(totalSpend(db, 't')).toBeCloseTo((1000 * 1.1 + 1000 * 5.5) / 1e6, 9)
  })

  it('does not pay again for a reply that was cut off at the token limit', async () => {
    // Biology's 900-name chunk ran past 16k output tokens; the same prompt was
    // sent three more times and cut off identically each time.
    const db = openStore(':memory:')
    let calls = 0
    const send: SendFn = async () => { calls++; return { text: '{"concepts":[{"id":"a"', inputTokens: 10, outputTokens: 50, truncated: true } }
    await expect(askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, wait: noWait })).rejects.toThrow(/cut off/)
    expect(calls).toBe(1)
  })

  it('stops the job once it crosses its cap', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{}', inputTokens: 1_000_000, outputTokens: 0 })
    await expect(askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 10, send, wait: noWait })).rejects.toThrow(BudgetExceeded)
  })
})

describe('stopping a run', () => {
  it('starts no new item after one fails, and settles every call in flight before reporting it', async () => {
    // A budget stop used to reject straight away; main closed the store and the
    // other workers carried on through the queue, paying for calls they could not record.
    const started: number[] = []
    const finished: number[] = []
    const run = runPool(Array.from({ length: 30 }, (_, i) => i), 6, async (i) => {
      started.push(i)
      await new Promise((r) => setTimeout(r, i === 2 ? 1 : 20))
      if (i === 2) throw new BudgetExceeded('stop')
      finished.push(i)
    })
    await expect(run).rejects.toThrow(BudgetExceeded)
    expect(started.length).toBeLessThanOrEqual(7)
    expect(finished.sort((a, b) => a - b)).toEqual(started.filter((i) => i !== 2).sort((a, b) => a - b))
  })

  it('refuses to send once the job is already over its cap', async () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO spend (job, model, input_tokens, output_tokens, usd, at) VALUES ('t', 'm', 0, 0, 2, 'now')").run()
    let calls = 0
    const send: SendFn = async () => { calls++; return { text: '{}', inputTokens: 1, outputTokens: 1 } }
    await expect(askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 10, send, wait: noWait })).rejects.toThrow(BudgetExceeded)
    expect(calls).toBe(0)
  })
})

describe('running work a few at a time', () => {
  it('does every item, never more than the workers at once', async () => {
    let live = 0, peak = 0
    const done: number[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (i) => {
      live++; peak = Math.max(peak, live)
      await new Promise((r) => setTimeout(r, 5))
      done.push(i); live--
    })
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(peak).toBeLessThanOrEqual(3)
  })
})

describe('the request sent to Bedrock', () => {
  it('sends words alone to Haiku, as before', () => {
    expect(requestBody(HAIKU, 'hello', 100)).toEqual({
      anthropic_version: 'bedrock-2023-05-31', max_tokens: 100, messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('puts images before the words, and gives Sonnet an effort setting instead of a temperature', () => {
    const body = requestBody(SONNET, 'check this', 500, [{ mediaType: 'image/png', data: 'iVBOR' }]) as {
      messages: { content: unknown }[]; output_config?: unknown
    }
    expect(body.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBOR' } },
      { type: 'text', text: 'check this' },
    ])
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body).not.toHaveProperty('temperature')
  })
})

describe('asking about an image', () => {
  it('passes the images through to the model', async () => {
    const db = openStore(':memory:')
    let seen: readonly ImageInput[] | undefined
    const send: SendFn = async (_m, _p, _t, images) => {
      seen = images
      return { text: '{"ok":1}', inputTokens: 10, outputTokens: 10 }
    }
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, images: [{ mediaType: 'image/png', data: 'x' }], wait: noWait })
    expect(seen).toEqual([{ mediaType: 'image/png', data: 'x' }])
  })

  it('counts a reply with no usage figures at its worst case, images included', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{"ok":1}', inputTokens: 0, outputTokens: 0 })
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'abc', maxTokens: 100, send, model: SONNET, images: [{ mediaType: 'image/png', data: 'x' }], wait: noWait })
    expect(db.prepare('SELECT input_tokens AS i, output_tokens AS o FROM spend').get()).toEqual({ i: 1 + 1600, o: 100 })
  })
})

describe('Nova Lite', () => {
  it('gets the Nova request shape, images first', () => {
    expect(requestBody(NOVA_LITE, 'judge this', 300, [{ mediaType: 'image/jpeg', data: 'abc' }])).toEqual({
      schemaVersion: 'messages-v1',
      messages: [{ role: 'user', content: [{ image: { format: 'jpeg', source: { bytes: 'abc' } } }, { text: 'judge this' }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0 },
    })
  })

  it('reads a Nova reply, and a Claude reply, into one shape', () => {
    expect(readReply(NOVA_LITE, { output: { message: { content: [{ text: '{"ok":' }, { text: 'true}' }] } }, stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 6 } }))
      .toEqual({ text: '{"ok":true}', inputTokens: 10, outputTokens: 6, truncated: false })
    expect(readReply(NOVA_LITE, { output: { message: { content: [] } }, stopReason: 'max_tokens', usage: {} }).truncated).toBe(true)
    expect(readReply(HAIKU, { content: [{ text: 'hi' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 1 } }))
      .toEqual({ text: 'hi', inputTokens: 3, outputTokens: 1, truncated: false })
  })

  it('has a price, so its spend is recorded', async () => {
    const db = openStore(':memory:')
    const send: SendFn = async () => ({ text: '{"ok":1}', inputTokens: 1000, outputTokens: 100 })
    await askJson({ db, job: 't', jobCapUsd: 1, prompt: 'p', maxTokens: 50, send, model: NOVA_LITE, wait: noWait })
    expect(totalSpend(db, 't')).toBeCloseTo((1000 * 0.078 + 100 * 0.312) / 1e6, 12)
  })
})
