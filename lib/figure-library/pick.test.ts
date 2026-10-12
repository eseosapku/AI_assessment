import { describe, it, expect } from 'vitest'
import { withLibrary } from './pick'

const f = (id: string) => ({ id, textbookIds: [], textbookName: '', page: 0, localPath: `/${id}`, noun: '', shows: '', labels: [], topic: '', original: '' })

describe('library figures after the bank', () => {
  it('keeps the bank first and the total within the share', () => {
    expect(withLibrary([f('b1'), f('b2')], [f('l1'), f('l2'), f('l3')], 3, () => true).map((x) => x.id)).toEqual(['b1', 'b2', 'l1'])
    expect(withLibrary([f('b1'), f('b2'), f('b3')], [f('l1')], 3, () => true).map((x) => x.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('leaves out library figures without a question this quiz can use', () => {
    expect(withLibrary([], [f('l1'), f('l2')], 5, (x) => x.id === 'l2').map((x) => x.id)).toEqual(['l2'])
  })
})
