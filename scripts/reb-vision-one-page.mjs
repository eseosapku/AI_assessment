import fs from 'node:fs'
import path from 'node:path'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

function loadEnv() {
  const env = {}
  for (const name of ['.env', '.env.local']) {
    const file = path.join(process.cwd(), name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...env, ...process.env }
}

const env = loadEnv()
const png = fs.readFileSync('data/past-paper-corpus/reb-pilot-page.png').toString('base64')
const client = new BedrockRuntimeClient({
  region: env.AWS_REGION || 'eu-west-1',
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
})
const res = await client.send(new InvokeModelCommand({
  modelId: 'eu.anthropic.claude-sonnet-5-5',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } },
        { type: 'text', text: 'Extract every exam question visible on this page. Keep the wording verbatim. Do not guess a smudged number. If a region is unreadable, mark it needs_review and keep what is legible. Reply as JSON: {"confidence":"high"|"low","questions":[{"number":"","text":"","marks":null}]}' },
      ],
    }],
  }),
}))
const body = JSON.parse(new TextDecoder().decode(res.body))
const text = (body.content ?? []).map((part) => part.text || '').join('\n')
const input = Number(body.usage?.input_tokens ?? 0)
const output = Number(body.usage?.output_tokens ?? 0)
const usd = (input * 2.2 + output * 11) / 1_000_000
fs.writeFileSync('data/past-paper-corpus/reb-pilot-page.json', JSON.stringify({ input, output, usd, text }, null, 2))
console.log(JSON.stringify({ input, output, usd, preview: text.slice(0, 400) }, null, 2))
