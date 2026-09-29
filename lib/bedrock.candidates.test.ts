import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildModelCandidates, rememberWorkingModel, resetWorkingModels, isModelIdError } from './bedrock'

describe('buildModelCandidates', () => {
  const saved = process.env.AWS_REGION
  beforeEach(() => {
    resetWorkingModels()
    process.env.AWS_REGION = 'eu-west-1'
  })
  afterEach(() => {
    process.env.AWS_REGION = saved
    resetWorkingModels()
  })

  it("tries this region's inference profile before the bare id", () => {
    // Measured in eu-west-1: the bare id fails on every call, the profile works.
    const c = buildModelCandidates('amazon.nova-lite-v1:0')
    expect(c[0]).toBe('eu.amazon.nova-lite-v1:0')
    expect(c.indexOf('amazon.nova-lite-v1:0')).toBeGreaterThan(0)
  })

  it('takes an id configured with a prefix at its word', () => {
    expect(buildModelCandidates('us.amazon.nova-lite-v1:0')[0]).toBe('us.amazon.nova-lite-v1:0')
  })

  it('puts the id that worked last time first', () => {
    // A model served bare in some other region/account: once it has worked,
    // nothing is probed ahead of it again.
    rememberWorkingModel('amazon.nova-lite-v1:0')
    expect(buildModelCandidates('amazon.nova-lite-v1:0')[0]).toBe('amazon.nova-lite-v1:0')
    rememberWorkingModel('eu.amazon.nova-lite-v1:0')
    expect(buildModelCandidates('eu.amazon.nova-lite-v1:0')[0]).toBe('eu.amazon.nova-lite-v1:0')
  })

  it('never lists an id twice', () => {
    const c = buildModelCandidates('amazon.nova-lite-v1:0')
    expect(new Set(c).size).toBe(c.length)
  })
})

describe('isModelIdError', () => {
  it('is true for the errors a different id can fix', () => {
    expect(isModelIdError({ name: 'ValidationException', message: 'Invocation of model ID amazon.nova-lite-v1:0 with on-demand throughput isn’t supported.' })).toBe(true)
    expect(isModelIdError({ name: 'ValidationException', message: 'The provided model identifier is invalid.' })).toBe(true)
  })

  it('is false for a bad request, which every id would reject the same way', () => {
    // The fault this guards: a request invalid for its own reasons walked the
    // whole chain and was reported as a model-id problem.
    expect(isModelIdError({ name: 'ValidationException', message: 'temperature: must be less than or equal to 1' })).toBe(false)
  })
})
