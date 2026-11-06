import { waitForAiJob } from './client-ai-jobs'

/** Existing callers receive their Response after short job-status polls. */
export async function fetchAssessment(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (response.status !== 202) return response
  const queued = await response.json()
  if (!queued?.job?.id) throw new Error('The server did not return an assessment job.')
  try {
    const result = await waitForAiJob(queued.job.id, { signal: init?.signal || undefined, pollIntervalMs: 2500 })
    return Response.json(result)
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error
    if (error?.status) return Response.json(error.payload, { status: error.status })
    throw error
  }
}
