import { NextRequest } from 'next/server'
import { POST as signup } from '../../../app/api/auth/signup/route'
import { POST as login } from '../../../app/api/auth/login/route'
import { POST as updateProfile } from '../../../app/api/auth/update-profile/route'
import { POST as forgotPassword } from '../../../app/api/auth/forgot-password/route'
import { POST as googleAuth } from '../../../app/api/auth/google/route'
import { POST as completeProfile } from '../../../app/api/auth/complete-profile/route'
import { POST as resetPassword } from '../../../app/api/auth/reset-password/route'
import { POST as createJob } from '../../../app/api/jobs/route'
import { GET as getJob } from '../../../app/api/jobs/[id]/route'
import { POST as executeJob } from '../../../app/api/jobs/[id]/execute/route'
import { handler as sqsWorker } from './execute-ai-job'

function response(statusCode: number, body: unknown, headers?: Record<string, string>) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-job-runner-token',
      ...(headers ?? {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}

async function toApiGatewayResponse(nextResponse: Response) {
  const headers: Record<string, string> = {}
  nextResponse.headers.forEach((value, key) => {
    headers[key] = value
  })
  return response(nextResponse.status, await nextResponse.text(), headers)
}

function requestUrl(event: any) {
  const rawPath = normalizePath(event.rawPath || event.path || '/', event)
  const rawQuery = event.rawQueryString ? `?${event.rawQueryString}` : ''
  const host = event.headers?.host || 'lambda.local'
  return `https://${host}${rawPath}${rawQuery}`
}

function toNextRequest(event: any) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  const headers = new Headers()
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (typeof value === 'string') headers.set(key, value)
  }
  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    : undefined

  return new NextRequest(requestUrl(event), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })
}

function normalizePath(path: string, event: any) {
  const stage = event.requestContext?.stage
  if (stage && stage !== '$default' && path.startsWith(`/${stage}/`)) {
    return path.slice(stage.length + 1)
  }
  if (stage && stage !== '$default' && path === `/${stage}`) {
    return '/'
  }
  return path
}

function pathAndMethod(event: any) {
  const path = normalizePath(event.rawPath || event.path || '/', event)
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  return { path, method: String(method).toUpperCase() }
}

function jobIdFromPath(path: string) {
  const match = path.match(/^\/api\/jobs\/([^/]+)(?:\/execute)?$/)
  return match?.[1] ?? ''
}

export async function handler(event: any) {
  if (Array.isArray(event?.Records)) {
    await sqsWorker(event)
    return { batchItemFailures: [] }
  }

  const { path, method } = pathAndMethod(event)
  if (method === 'OPTIONS') return response(204, '')

  const request = toNextRequest(event)

  if (method === 'POST' && path === '/api/auth/signup') return toApiGatewayResponse(await signup(request))
  if (method === 'POST' && path === '/api/auth/login') return toApiGatewayResponse(await login(request))
  if (method === 'POST' && path === '/api/auth/google') return toApiGatewayResponse(await googleAuth(request))
  if (method === 'POST' && path === '/api/auth/complete-profile') return toApiGatewayResponse(await completeProfile(request))
  if (method === 'POST' && path === '/api/auth/update-profile') return toApiGatewayResponse(await updateProfile(request))
  if (method === 'POST' && path === '/api/auth/forgot-password') return toApiGatewayResponse(await forgotPassword(request))
  if (method === 'POST' && path === '/api/auth/reset-password') return toApiGatewayResponse(await resetPassword(request))

  if (method === 'POST' && path === '/api/jobs') return toApiGatewayResponse(await createJob(request))
  if (method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(path)) {
    return toApiGatewayResponse(await getJob(request, { params: Promise.resolve({ id: jobIdFromPath(path) }) }))
  }
  if (method === 'POST' && /^\/api\/jobs\/[^/]+\/execute$/.test(path)) {
    return toApiGatewayResponse(await executeJob(request, { params: Promise.resolve({ id: jobIdFromPath(path) }) }))
  }

  return response(404, { error: `No route for ${method} ${path}` })
}
