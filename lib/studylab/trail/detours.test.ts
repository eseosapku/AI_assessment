// lib/studylab/trail/detours.test.ts
import { describe, it, expect } from 'vitest'
import { PARK_AFTER, absorbTurn, backFromDetour, dueNotes, emptyMemory, loadMemory, onAskAnswered, plainQuestion, pruneMemory, saveMemory, showsDetourFooter, stillNotSure } from './detours'

const ask = (created: string[], question = 'Why?', version = 1) => ({ version, question, created })
const q = { ids: ['c1', 'c2'], at: 0 }
const opened = () => onAskAnswered(emptyMemory(), ask(['d1']), { station: 1, queue: q })

describe('starting a detour', () => {
  it('an ask that built cards starts a detour, remembering the queue', () => {
    expect(opened()).toMatchObject({ open: expect.any(String), detours: [{ station: 1, question: 'Why?', cardIds: ['d1'], tries: 0, returnTo: q }] })
  })
  it('a reply with no cards starts nothing', () => {
    const m = emptyMemory()
    expect(onAskAnswered(m, ask([]), { station: 1, queue: q })).toEqual(m)
  })
  it("a card menu's prompt never leaks its plumbing into what Kana asks or notes", () => {
    expect(plainQuestion('Focusing on the card "Demand" (card id: s1-x): explain this deeper.')).toBe('Demand')
    expect(plainQuestion('Why do prices fall?')).toBe('Why do prices fall?')
    const m = onAskAnswered(emptyMemory(), ask(['d1'], 'Focusing on the card "Demand" (card id: s1-x): show an example of this.'), { station: 1, queue: q })
    expect(m.detours[0].question).toBe('Demand')
  })
  it('one deep: another ask from inside stays in the same detour', () => {
    const m = onAskAnswered(opened(), ask(['d2'], 'And?', 2), { station: 1, queue: { ids: ['d1'], at: 0 } })
    expect(m.detours).toHaveLength(1)
    expect(m.detours[0].cardIds).toEqual(['d1', 'd2'])
    expect(m.detours[0].returnTo).toEqual(q)
  })
  it('a second detour from the same station is its own, after the first is closed', () => {
    const closed = backFromDetour(opened()).memory
    const m = onAskAnswered(closed, ask(['d2'], 'And?', 2), { station: 1, queue: q })
    expect(m.detours).toHaveLength(2)
    expect(m.detours[0].id).not.toBe(m.detours[1].id)
    expect(m.open).toBe(m.detours[1].id)
  })
})

describe('coming back', () => {
  it('Back restores the queue and leaves the cards on the branch', () => {
    const { memory, restore } = backFromDetour(opened())
    expect(restore).toEqual(q)
    expect(memory.open).toBeNull()
    expect(memory.detours[0].cardIds).toEqual(['d1'])
  })
  it('with no detour open, Back has nothing to restore', () => {
    expect(backFromDetour(emptyMemory()).restore).toBeNull()
  })
})

describe('Still not sure', () => {
  it('tries a picture, then an example, then small steps', () => {
    let r = stillNotSure(opened())
    expect(r.ask).toBe('Explain Why? a different way: with a picture')
    r = stillNotSure(r.memory)
    expect(r.ask).toBe('Explain Why? a different way: an everyday example')
    r = stillNotSure(r.memory)
    expect(r.ask).toBe('Explain Why? a different way: in small steps')
  })
  it('after three tries it parks, keeps a note, and goes back', () => {
    let m = opened()
    for (let i = 0; i < PARK_AFTER; i++) m = stillNotSure(m).memory
    const r = stillNotSure(m)
    expect(r).toMatchObject({ ask: null, parked: true, restore: q })
    expect(r.memory.open).toBeNull()
    expect(r.memory.notes).toMatchObject([{ station: 1, question: 'Why?', raised: false }])
    expect(dueNotes(r.memory, 1)).toHaveLength(1)
    expect(dueNotes(r.memory, 0)).toHaveLength(0)
  })
  it('a note raised once is not due again', () => {
    let m = opened()
    for (let i = 0; i < PARK_AFTER; i++) m = stillNotSure(m).memory
    const parked = stillNotSure(m).memory
    expect(dueNotes({ ...parked, notes: parked.notes.map((n) => ({ ...n, raised: true })) }, 1)).toHaveLength(0)
  })
})

describe('a turn landing mid-detour', () => {
  it('the new work waits, and Back lands on it', () => {
    const m = absorbTurn(opened(), ['n1', 'n2'])
    expect(m.open).toBe(opened().open)
    expect(backFromDetour(m).restore).toEqual({ ids: ['n1', 'n2'], at: 0 })
  })
  it('cards of the detour, or no detour, change nothing', () => {
    const m = opened()
    expect(absorbTurn(m, ['d1'])).toBe(m)
    const none = emptyMemory()
    expect(absorbTurn(none, ['n1'])).toBe(none)
    expect(absorbTurn(m, [])).toBe(m)
  })
})

describe('the footer', () => {
  const base = { detourOpen: true, nextInQueue: null, claimed: false, settled: false, busy: false }
  it('ends a detour card when nothing else waits', () => {
    expect(showsDetourFooter(base)).toBe(true)
  })
  it('stands aside while a turn runs: its presses would be dropped, and still count', () => {
    expect(showsDetourFooter({ ...base, busy: true })).toBe(false)
  })
  it('not outside a detour, and not with more of the burst to come', () => {
    expect(showsDetourFooter({ ...base, detourOpen: false })).toBe(false)
    expect(showsDetourFooter({ ...base, nextInQueue: 'b' })).toBe(false)
  })
  it('a question in a detour is answered first: its Check stays until it is marked', () => {
    expect(showsDetourFooter({ ...base, claimed: true })).toBe(false)
    expect(showsDetourFooter({ ...base, claimed: true, settled: true })).toBe(true)
  })
})

describe('memory', () => {
  it('never throws on bad storage', () => {
    for (const raw of [null, '', 'garbage', '{"v":99}', '{"v":1}', '[]']) expect(loadMemory(raw)).toEqual(emptyMemory())
    expect(() => saveMemory({ setItem: () => { throw new Error('blocked') } }, 's', emptyMemory())).not.toThrow()
    expect(() => saveMemory(null, 's', emptyMemory())).not.toThrow()
  })
  it('never throws on storage that is the right shape outside and wrong inside', () => {
    const good = { id: 'd', station: 1, question: 'Why?', cardIds: ['c'], tries: 0, parked: false, returnTo: null }
    expect(loadMemory('{"v":1,"detours":[null],"notes":[]}').detours).toEqual([])
    expect(loadMemory(JSON.stringify({ v: 1, detours: [{ id: 'd' }, good], notes: [] })).detours).toEqual([good])
    expect(loadMemory(JSON.stringify({ v: 1, detours: [{ ...good, returnTo: { at: 0 } }], notes: [] })).detours[0].returnTo).toBeNull()
    expect(loadMemory(JSON.stringify({ v: 1, detours: [], notes: [7, { id: 'n' }], queue: { at: 1 } }))).toEqual(emptyMemory())
    expect(loadMemory(JSON.stringify({ v: 1, detours: [], notes: [], blocks: { a: 1, b: 'x' } })).blocks).toEqual({ a: 1 })
    const m = loadMemory(JSON.stringify({ v: 1, detours: [{ id: 'd' }], notes: [], open: 'd', queue: 5 }))
    expect(m.open).toBeNull()
    expect(m.queue).toBeNull()
  })
  it('round trips under its own key', () => {
    const stored: Record<string, string> = {}
    saveMemory({ setItem: (k, v) => void (stored[k] = v) }, 'abc', opened())
    expect(Object.keys(stored)).toEqual(['ss-trail-run:abc'])
    expect(loadMemory(stored['ss-trail-run:abc'])).toEqual(opened())
  })
  it('stale memory: cards gone are dropped, an empty detour disappears, a lost return point goes', () => {
    const m = opened()
    expect(pruneMemory(m, new Set(['c1', 'c2'])).detours).toHaveLength(0)
    expect(pruneMemory(m, new Set(['c1', 'c2'])).open).toBeNull()
    expect(pruneMemory(m, new Set(['d1'])).detours[0].returnTo).toBeNull()
  })
  it('a saved queue whose focus card is gone goes too', () => {
    expect(pruneMemory({ ...emptyMemory(), queue: q }, new Set(['c2'])).queue).toBeNull()
  })
  it('nothing gone is the same memory, so saving does not spin', () => {
    const m = opened()
    expect(pruneMemory(m, new Set(['c1', 'c2', 'd1']))).toBe(m)
  })
})
