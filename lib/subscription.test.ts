import { describe, expect, it } from 'vitest'
import {
  buildSubscriptionSnapshot,
  FREE_ASSESSMENT_LIMIT,
  isSubscriptionActive,
  isTeacherExempt,
} from './subscription'

describe('subscription access rules', () => {
  it('allows exactly two free assessment completions', () => {
    const first = buildSubscriptionSnapshot({ id: 'u', free_assessments_used: 0 })
    const second = buildSubscriptionSnapshot({ id: 'u', free_assessments_used: 1 })
    const blocked = buildSubscriptionSnapshot({ id: 'u', free_assessments_used: FREE_ASSESSMENT_LIMIT })
    expect(first).toMatchObject({ canGenerateAssessment: true, freeAssessmentsRemaining: 2, canStartStudyPlan: false })
    expect(second).toMatchObject({ canGenerateAssessment: true, freeAssessmentsRemaining: 1 })
    expect(blocked).toMatchObject({ canGenerateAssessment: false, freeAssessmentsRemaining: 0, canStartStudyPlan: false })
  })

  it('allows active paid users and rejects expired access', () => {
    const active = { id: 'u', subscription_status: 'active', subscription_expires_at: '2030-01-01T00:00:00.000Z' }
    const expired = { ...active, subscription_expires_at: '2020-01-01T00:00:00.000Z' }
    expect(isSubscriptionActive(active, Date.parse('2029-01-01'))).toBe(true)
    expect(isSubscriptionActive(expired, Date.parse('2029-01-01'))).toBe(false)
    expect(buildSubscriptionSnapshot(expired).canGenerateAssessment).toBe(true)
  })

  it('keeps the existing teacher exemption', () => {
    expect(isTeacherExempt({ role: 'Teacher' })).toBe(true)
    expect(buildSubscriptionSnapshot({ id: 't', role: 'teacher', free_assessments_used: 99 })).toMatchObject({
      isSubscribed: true,
      canGenerateAssessment: true,
      canStartStudyPlan: true,
    })
  })
})
