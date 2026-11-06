import { createHash, createHmac } from 'node:crypto'
import { getBedrockRegion } from './aws-config'
import { GENERATION_TIMEOUT_MS } from './generation-timeout'

/** Signed asynchronous invocation of the SAME deployed Lambda; no new queue. */
export async function invokeExistingLambda(jobId: string, functionName: string): Promise<void> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secret = process.env.AWS_SECRET_ACCESS_KEY
  if (!accessKeyId || !secret) throw new Error('Lambda runtime credentials are unavailable')
  const region = process.env.AWS_REGION || getBedrockRegion()
  const host = `lambda.${region}.amazonaws.com`
  const uri = `/2015-03-31/functions/${encodeURIComponent(functionName)}/invocations`
  const body = JSON.stringify({ ai_job_id: jobId })
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const day = date.slice(0, 8)
  const headers: Record<string, string> = { host, 'content-type': 'application/json', 'x-amz-date': date, 'x-amz-invocation-type': 'Event' }
  if (process.env.AWS_SESSION_TOKEN) headers['x-amz-security-token'] = process.env.AWS_SESSION_TOKEN
  const names = Object.keys(headers).sort()
  const signed = names.join(';')
  const hash = (text: string) => createHash('sha256').update(text).digest('hex')
  const canonical = `POST\n${uri}\n\n${names.map((name) => `${name}:${headers[name]}\n`).join('')}\n${signed}\n${hash(body)}`
  const scope = `${day}/${region}/lambda/aws4_request`
  const hmac = (key: string | Buffer, text: string) => createHmac('sha256', key).update(text).digest()
  const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 'lambda'), 'aws4_request')
  const signature = createHmac('sha256', key).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest('hex')
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`
  const response = await fetch(`https://${host}${uri}`, { method: 'POST', headers, body, signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS) })
  if (response.status !== 202) throw new Error(`Could not start background generation (${response.status})`)
  await response.body?.cancel()
}
