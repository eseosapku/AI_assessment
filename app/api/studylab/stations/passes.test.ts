// app/api/studylab/stations/passes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))

import { callGemma } from '@/lib/bedrock'
import { runPass, type PassContext } from './passes'
import { modelForJob } from '@/lib/studylab/lessonJobs'

beforeEach(() => vi.mocked(callGemma).mockReset())

const sortSpec = {
  pattern: 'sort', prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1', imageUrl: 'iron' }, { id: 'i2', label: 'Sulfur', binId: 'b2', imageUrl: 'sulfur' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}
const intent = { goal: 'Tell metals from non-metals.', isolates: 'category', apparatus: 'sorting-frame', why: 'Sorting is the decision.' }
const step = { id: 's1', title: 'Metals and non-metals', goal: 'Sort elements into metals and non-metals', status: 'pending' as const, cardIds: [] }
const ctx = (partial: PassContext['partial'] = {}): PassContext => ({ title: 'Elements', subject: 'Chemistry', step, stepNo: 1, plan: [step], version: 'v1', partial })
const explore = { opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 's1-explore', spec: sortSpec, step: 1 }, intent, hints: ['Shiny?'] }
const card = (id: string) => ({ type: 'createCard', id, card: 'concept', title: `Card ${id}`, body: 'A real sentence with an example.', step: 1 })
const name = {
  solved: { say: 'You split them by behaviour.', actions: [card('s1-solved-1')] },
  helped: { say: 'Iron told you.', actions: [card('s1-helped-1')] },
  untried: { say: 'Here is the idea.', actions: [card('s1-untried-1')] },
}
const practice = { say: 'Same idea.', action: { type: 'createCard', id: 's1-practice', card: 'practice', title: 'Copper or carbon?', body: 'Which is a metal?', answer: 'Copper', rubric: 'Names copper', steps: ['Copper conducts'], step: 1 } }
const check = { say: 'Quick check.', questions: [{ id: 'q1', format: 'mcq', prompt: 'Which is a metal?', options: ['Sulfur', 'Iron'], answer: 1, optionFeedback: ['Sulfur is brittle.', 'Yes.'] }] }
const reply = (o: unknown) => vi.mocked(callGemma).mockResolvedValueOnce(JSON.stringify(o))
const call = (n = 0) => vi.mocked(callGemma).mock.calls[n]

describe('runPass: explore', () => {
  it('writes the explore item ahead, for this station, on the authoring model and within budget', async () => {
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'whatever', spec: sortSpec }, intent, hints: ['Shiny?'] })
    const out = await runPass('explore', ctx())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    // Ids are the station's, whatever the model chose, so nothing collides on the board.
    expect((out.partial?.explore?.action as { id?: string }).id).toBe('s1-explore')
    const [prompt, opts] = call()
    expect(String(prompt)).toContain('WRITING AHEAD')
    expect(String(prompt)).toContain('STAGE: EXPLORE')
    expect(String(prompt)).toContain('Sort elements into metals and non-metals')
    expect(String(prompt)).toMatch(/cite where it comes from/i)
    // Compact replies: indentation is output the pass waits for and nobody reads.
    expect(String(prompt)).toMatch(/no indentation/i)
    // Nothing in a sort that a teacher could argue.
    expect(String(prompt)).toMatch(/could argue/i)
    expect(opts).toMatchObject({ model: modelForJob('author'), maxTokens: expect.any(Number) })
    expect((opts as { maxTokens: number }).maxTokens).toBeLessThanOrEqual(1500)
  })
  it('takes the intent from the material when the model puts it there, and keeps it off the action', async () => {
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec, intent }, hints: [] })
    const out = await runPass('explore', ctx())
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.partial?.explore?.intent).toMatchObject({ isolates: 'category' })
    expect(out.partial?.explore?.action).not.toHaveProperty('intent')
  })

  it('tells a pass written again what was wrong with it last time', async () => {
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec }, intent, hints: [] })
    await runPass('explore', { ...ctx(), fix: 'the material cannot be solved' })
    expect(String(call()[0])).toContain('the material cannot be solved')
    expect(String(call()[0])).toMatch(/refused/i)
  })

  it('refuses a reading card in place of something to handle', async () => {
    reply({ opening: 'Read this.', action: card('x'), hints: [] })
    expect((await runPass('explore', ctx())).ok).toBe(false)
  })
})

describe('runPass: name', () => {
  const naming = { type: 'createCard', id: 'whatever', card: 'concept', title: 'Metals bend, non-metals snap', body: 'A metal bends because its atoms slide past each other.' }
  const extra = (title: string) => ({ type: 'createCard', id: 'x', card: 'concept', title, body: 'A real sentence with an example.' })
  const replyName = (over: Record<string, unknown> = {}) => reply({
    card: naming,
    solved: { say: 'You split them by behaviour.' },
    helped: { say: 'Iron gave it away.', card: extra('The shine was the clue') },
    untried: { say: 'Here is what the sort shows.', card: extra('What the sort shows') },
    point: 'piece-i1',
    ...over,
  })
  type Act = { type: string; id?: string; from?: string; to?: string; nodeId?: string; part?: string; step?: number; title?: string }

  it('writes the naming card once, and builds each outcome around it', async () => {
    replyName()
    const out = await runPass('name', ctx({ explore: explore as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const cut = (o: 'solved' | 'helped' | 'untried') => out.partial!.name![o].actions as Act[]
    const cards = (o: 'solved' | 'helped' | 'untried') => cut(o).filter((a) => a.type === 'createCard').map((a) => a.id)
    // Solved: the name, joined to what they handled, pointing at the part that shows it.
    expect(cards('solved')).toEqual(['s1-name'])
    expect(cut('solved')).toContainEqual(expect.objectContaining({ type: 'connect', from: 's1-explore', to: 's1-name' }))
    expect(cut('solved')).toContainEqual(expect.objectContaining({ type: 'point', nodeId: 's1-explore', part: 'piece-i1' }))
    // Helped: the name, and the step that was hard.
    expect(cards('helped')).toEqual(['s1-name', 's1-helped-1'])
    // Untried: what the item shows when done comes first, then the name.
    expect(cards('untried')).toEqual(['s1-untried-1', 's1-name'])
    expect(cut('untried')).toContainEqual(expect.objectContaining({ type: 'connect', from: 's1-untried-1', to: 's1-name' }))
    expect(out.partial!.name!.untried.say).toBe('Here is what the sort shows.')
    for (const o of ['solved', 'helped', 'untried'] as const) for (const a of cut(o)) if (a.type === 'createCard') expect(a.step).toBe(1)
  })

  it('briefs the name pass with the explore item whole, so it never describes what is not there', async () => {
    replyName()
    await runPass('name', ctx({ explore: explore as never }))
    const p = String(call()[0])
    expect(p).toContain('Watch which ones bend.')
    // The items and bins of the sort itself, not just its prompt.
    expect(p).toContain('Sulfur')
    expect(p).toContain('Non-metal')
    expect(p).toMatch(/never describe a result they did not reach/i)
    expect(p).toMatch(/true whatever the student did/i)
  })

  it('takes a helped cut with no card of its own as the name alone', async () => {
    replyName({ helped: { say: 'Iron gave it away.' } })
    const out = await runPass('name', ctx({ explore: explore as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect((out.partial!.name!.helped.actions as Act[]).filter((a) => a.type === 'createCard').map((a) => a.id)).toEqual(['s1-name'])
  })

  it('points at the whole explore item when the part named is not one the board draws', async () => {
    replyName({ point: 'the slider for resistance' })
    const out = await runPass('name', ctx({ explore: explore as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const point = (out.partial!.name!.solved.actions as Act[]).find((a) => a.type === 'point')
    expect(point).toMatchObject({ nodeId: 's1-explore' })
    expect(point).not.toHaveProperty('part')
  })

  it('refuses a reply with no naming card, or missing an outcome', async () => {
    replyName({ card: undefined })
    expect((await runPass('name', ctx({ explore: explore as never }))).ok).toBe(false)
    vi.mocked(callGemma).mockReset()
    replyName({ untried: undefined })
    expect((await runPass('name', ctx({ explore: explore as never }))).ok).toBe(false)
  })

  it('keeps the name pass small enough to finish well inside its time', async () => {
    replyName()
    await runPass('name', ctx({ explore: explore as never }))
    expect((call()[1] as { maxTokens: number }).maxTokens).toBeLessThanOrEqual(1000)
  })
})

describe('runPass: practice_check', () => {
  it('refuses a check whose wrong option says nothing to whoever picks it', async () => {
    reply({ practice, check: { ...check, questions: [{ ...check.questions[0], optionFeedback: ['', 'Yes.'] }] } })
    expect((await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))).ok).toBe(false)
  })
  it('writes a near-twin practice item and a hard check with feedback on every option', async () => {
    reply({ practice, check })
    const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    expect(out.ok).toBe(true)
    expect(String(call()[0])).toMatch(/optionFeedback/)
    expect(String(call()[0])).toMatch(/near-twin/i)
    // A near-twin of the explore item as it is, items and all.
    expect(String(call()[0])).toContain('Sulfur')
    expect(String(call()[0])).toMatch(/no indentation/i)
    expect(String(call()[0])).toMatch(/could argue/i)
    // Each distractor's slip is worked out before its feedback is written.
    expect(String(call()[0])).toMatch(/work out the exact slip/i)
  })
})

describe('runPass: verify', () => {
  const whole = { explore: explore as never, name: name as never, practice: practice as never, check: check as never }
  it('runs the code checks first, and asks no judge about a station they refuse', async () => {
    const out = await runPass('verify', ctx({ ...whole, check: { say: '', questions: [] } as never }))
    expect(out).toMatchObject({ ok: false, redo: 'practice_check' })
    expect(callGemma).not.toHaveBeenCalled()
  })
  it('hands a judge failure back as the pass to write again, when it quotes the wrong text', async () => {
    reply({ ok: false, pass: 'name', quote: 'You split them by behaviour', reason: 'Not what the sort shows.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'name' })
  })

  it('passes a station the judge fails without quoting anything actually in it -- a judge that invents an error', async () => {
    reply({ ok: false, pass: 'practice_check', quote: '3/9 does not match', reason: 'Wrong pattern.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, pass: 'explore', reason: 'The vary relationship is wrong.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
  })

  it('finds the pass to write again from where the quote is, when the judge names none', async () => {
    reply({ ok: false, quote: 'Watch which ones bend', reason: 'Nothing bends in a sort.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'explore' })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, pass: 'nonsense', quote: 'Sulfur is brittle', reason: 'It is.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'practice_check' })
  })

  it('asks the judge for the earliest part an error starts in, not the last place it shows', async () => {
    reply({ ok: true })
    await runPass('verify', ctx(whole))
    expect(String(call()[0])).toMatch(/earliest part/i)
  })

  it('asks about a relationship only when the station has one', async () => {
    reply({ ok: true })
    await runPass('verify', ctx(whole))
    expect(String(call()[0])).not.toMatch(/relationship/i)
  })
  it('returns the whole bundle when the judge passes it, on the judging model', async () => {
    reply({ ok: true })
    const out = await runPass('verify', ctx(whole))
    expect(out).toMatchObject({ ok: true, bundle: { version: 'v1', stepId: 's1' } })
    expect(call()[1]).toMatchObject({ model: modelForJob('judge'), fallbackModel: modelForJob('plan') })
    expect((call()[1] as { maxTokens: number }).maxTokens).toBeLessThanOrEqual(400)
  })
})
