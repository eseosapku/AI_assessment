// lib/studylab/busyLabel.test.ts
import { describe, it, expect } from 'vitest'
import { busyLabel } from './busyLabel'

describe('busyLabel', () => {
  it('names the job so a slow turn is distinguishable from a broken one', () => {
    expect(busyLabel({ type: 'draft_plan' })).toBe('Working out a plan…')
    expect(busyLabel({ type: 'next_beat' })).toBe('Building the next card…')
    expect(busyLabel({ type: 'test_out' })).toBe('Writing a few questions…')
  })

  it('gives every action a distinct label, so the label confirms the click', () => {
    const types = ['draft_plan', 'accept_plan', 'next_beat', 'jump', 'test_out', 'answer_check', 'ask', 'edit_plan']
    const labels = types.map((type) => busyLabel({ type }))
    expect(new Set(labels).size).toBe(types.length)
  })

  it('falls back rather than showing nothing', () => {
    expect(busyLabel(null)).toBe('Thinking…')
    expect(busyLabel({ type: 'something_new' })).toBe('Thinking…')
  })
})
