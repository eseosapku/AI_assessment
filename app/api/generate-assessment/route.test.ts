import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { paperGroups } from '@/lib/exam-parts'

const state = vi.hoisted(() => ({ calls: 0, incomplete: false, bareArray: false, damageFirst: 0, rejectUntil: 0, rejectFigures: false, checkerModels: [] as string[], checkerPrompts: [] as string[], generationPrompts: [] as string[] }))
vi.mock('@/lib/aws-config', () => ({
  getBedrockCredentials: () => ({ accessKeyId: 'test', secretAccessKey: 'test' }),
  getBedrockRegion: () => 'eu-west-1', BEDROCK_CREDENTIALS_ERROR: 'missing credentials',
}))
vi.mock('@/lib/db', () => ({ db: { query: vi.fn(async (sql: string) => ({ rows: sql.startsWith('INSERT') ? [{ id: 'saved-assessment' }] : [] })) } }))
vi.mock('@/lib/ai-usage-recorder', () => ({ withUsageTracking: (_: unknown, fn: () => unknown) => fn() }))
vi.mock('@/lib/subscription-server', () => ({ assertSubscriptionAccess: async () => ({ allowed: true }), incrementFreeAssessmentUsage: async () => {}, subscriptionPaywallBody: () => ({}) }))
vi.mock('@/lib/subject-figure-catalog', () => ({ buildSubjectFigureCatalog: async () => [] }))
vi.mock('@/lib/textbook-figure-bank', async (original) => ({
  ...await original<typeof import('@/lib/textbook-figure-bank')>(),
  bookInBank: () => false,
  figuresForQuiz: () => Array.from({ length: 5 }, (_, i) => ({
    id: `figure-${i}`, textbookIds: [], textbookName: 'Mathematics', page: i + 1,
    localPath: `/textbook-images/graph-${i}.png`, noun: 'graph', shows: `A coordinate graph with point (${i + 1}, 2).`,
    labels: ['x', 'y'], topic: 'Coordinates', original: 'Calculate the coordinates of the translated point.',
  })),
}))
vi.mock('@/lib/figure-question-bank', async (original) => ({
  ...await original<typeof import('@/lib/figure-question-bank')>(), hasVetted: () => true, hasFreshVetted: () => true,
}))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  InvokeModelCommand: class { constructor(public input: unknown) {} },
  BedrockRuntimeClient: class {
    async send(command: { input: { body: string; modelId: string } }) {
      const body = JSON.parse(command.input.body)
      const message = body.messages[0].content
      const text = typeof message === 'string' ? message : message[0].text
      if (body.anthropic_version || text.includes('QUESTIONS TO CHECK:')) {
        state.checkerModels.push(command.input.modelId)
        const prompt = text as string
        state.checkerPrompts.push(prompt)
        const match = prompt.match(/SCENARIO:.*coordinates \((\d+),/)
        const candidate = Number(match?.[1]) / 7
        const bad = candidate <= state.rejectUntil || (state.rejectFigures && prompt.includes('FIGURE (picture;'))
        const verdicts = [...prompt.matchAll(/--- Q(\d+) longform/g)].map((m) => ({
          id: Number(m[1]), verdict: bad ? 'drop' : 'ok',
          why: bad ? 'The particle cannot reach the top of the ring with the given speed. Use a different physically possible setup.' : undefined,
        }))
        const response = body.anthropic_version ? { content: [{ type: 'text', text: JSON.stringify(verdicts) }] }
          : { output: { message: { content: [{ text: JSON.stringify(verdicts) }] } } }
        return { body: new TextEncoder().encode(JSON.stringify(response)) }
      }
      state.generationPrompts.push(body.messages[0].content[0].text)
      const n = ++state.calls
      const questions = (state.incomplete || n <= state.damageFirst ? ['a'] : ['a', 'b', 'c', 'd']).map((part) => ({
        type: 'longform', part, scenario: `A point P has coordinates (${n * 7}, ${n * 11}).`,
        question: part === 'a' ? 'Calculate the new x-coordinate after a translation of 2 units right.'
          : part === 'b' ? 'Calculate the new y-coordinate after a translation of 3 units upwards.'
          : 'State the coordinates of the reflection of P in the x-axis.',
        marks: 2, marking_criteria: ['Use the correct translation or reflection.', 'Give the correct coordinate.'],
        model_answer: `Use the original coordinates (${n * 7}, ${n * 11}) and apply the stated transformation.`,
        explanation: 'A translation adds the displacement to the original coordinate; reflection changes its sign.',
        hints: ['Apply the transformation to the appropriate coordinate.'],
      }))
      const payload = { output: { message: { content: [{ text: JSON.stringify(state.bareArray ? questions : { questions }) }] } } }
      return { body: new TextEncoder().encode(JSON.stringify(payload)) }
    }
  },
}))

import { generateAssessment as POST } from '@/lib/assessment-generation'

const generate = (extra: Record<string, unknown> = {}) => POST(new NextRequest('http://localhost/api/generate-assessment', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ subject: 'Mathematics', topics: ['Coordinates'], count: 10, style: 'Exam Style (Past Papers)', curriculum: 'rwanda', grade: 9, difficultyLevel: 'average', ...extra }),
}))

describe('numbered exam generation', () => {
  beforeEach(() => {
    state.calls = 0
    state.incomplete = false
    state.bareArray = false
    state.damageFirst = 0
    state.rejectUntil = 0
    state.rejectFigures = false
    state.checkerModels = []
    state.checkerPrompts = []
    state.generationPrompts = []
    vi.stubEnv('AWS_GENERATION_MODEL_ID', 'amazon.nova-lite-v1:0')
  })

  it('delivers ten complete question pages, keeps shared images, and gives time for every part', async () => {
    const response = await generate()
    const data = await response.json()
    expect(response.status, JSON.stringify(data)).toBe(200)
    const groups = paperGroups(data.questions)
    expect(groups).toHaveLength(10)
    expect(data.questions).toHaveLength(30)
    expect(data.questions.every((q: { part: string }) => ['a', 'b', 'c'].includes(q.part))).toBe(true)
    expect(groups.filter((g) => data.questions.slice(g.start, g.end).some((q: { image_url?: string }) => q.image_url))).toHaveLength(5)
    expect(data.estimated_time).toBeGreaterThanOrEqual(60)
    expect(data.assessment_id).toBe('saved-assessment')
  })

  it('does not pass thirty lone parts off as ten complete questions', async () => {
    state.incomplete = true
    const response = await generate()
    expect(response.status).toBe(500)
    expect((await response.json()).error).toContain('complete questions')
  })
  it('accepts a bare question array rather than silently discarding every generated group', async () => {
    state.bareArray = true
    const response = await generate()
    const data = await response.json()
    expect(response.status, JSON.stringify(data)).toBe(200)
    expect(paperGroups(data.questions)).toHaveLength(10)
  })

  it('checks every group with Nova Lite without switching to a more expensive model', async () => {
    const response = await generate()
    const data = await response.json()
    expect(response.status, JSON.stringify(data)).toBe(200)
    expect(paperGroups(data.questions)).toHaveLength(10)
    expect(data.questions.every((q: any) => q.checked)).toBe(true)
    expect(state.checkerPrompts.length).toBeGreaterThanOrEqual(10)
    expect(state.checkerModels.every((id) => /amazon\.nova-lite-v1:0$/.test(id))).toBe(true)
  })

  it('refills complete groups and their lost figures without splitting any group', async () => {
    state.damageFirst = 3
    const response = await generate()
    const data = await response.json()
    expect(response.status, JSON.stringify(data)).toBe(200)
    const groups = paperGroups(data.questions)
    expect(groups).toHaveLength(10)
    expect(groups.every((g) => g.end - g.start === 3)).toBe(true)
    expect(groups.filter((g) => data.questions[g.start].image_url)).toHaveLength(5)
  })

  it('continues beyond three rejected refill passes and returns exactly ten checked questions', async () => {
    state.rejectUntil = 60
    const response = await generate({ curriculum: 'cambridge', className: 'Cambridge AS and A Level Further Mathematics', grade: 12 })
    const data = await response.json()
    expect(response.status, JSON.stringify(data)).toBe(200)
    expect(paperGroups(data.questions)).toHaveLength(10)
    expect(state.calls).toBeGreaterThan(60)
    expect(state.checkerPrompts.every((p) => p.includes('AS and A Level Further Mathematics'))).toBe(true)
    expect(state.checkerPrompts.every((p) => [...p.matchAll(/--- Q\d+ longform/g)].length === 3)).toBe(true)
    expect(state.generationPrompts.some((p) => p.includes('Previous attempts had these faults'))).toBe(true)
  })

  it('escapes a repeatedly rejected figure and completes the paper with fresh solvable setups', async () => {
    state.rejectFigures = true
    const response = await generate({ curriculum: 'cambridge' })
    const data = await response.json()
    expect(response.status, JSON.stringify(data)).toBe(200)
    expect(paperGroups(data.questions)).toHaveLength(10)
    expect(data.questions.every((q: { part: string }) => ['a', 'b', 'c'].includes(q.part))).toBe(true)
    const illustratedChecks = state.checkerPrompts.filter((p) => p.includes('FIGURE (picture;'))
    expect(illustratedChecks.length).toBeLessThanOrEqual(10)
  })
})
