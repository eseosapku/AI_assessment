// app/api/studylab/stations/passes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', async (orig) => ({
  buildModelCandidates: (await orig<typeof import('@/lib/bedrock')>()).buildModelCandidates,
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))

import { callGemma, buildModelCandidates } from '@/lib/bedrock'
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
    // Nothing in a sort, match or order that a teacher could argue, and no sorting by a judgement.
    expect(String(prompt)).toMatch(/sort, a match or an order/i)
    expect(String(prompt)).toMatch(/never sort by a judgement/i)
    expect(opts).toMatchObject({ model: modelForJob('author'), maxTokens: expect.any(Number), reasoningEffort: 'low', noGemmaFallback: true })
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

  it('reads an explore written in the live turn shape, or wrapped in a list, rather than spending a try', async () => {
    // Seen in the scene eval: { say, actions, awaitUser, suggestions, done }, and a bare [ { ... } ].
    reply({ say: 'Watch which ones bend.', actions: [{ type: 'createActivity', id: 'x', spec: sortSpec, intent }], suggestions: [] })
    const turn = await runPass('explore', ctx())
    expect(turn).toMatchObject({ ok: true, partial: { explore: { opening: 'Watch which ones bend.', action: { type: 'createActivity' } } } })
    vi.mocked(callGemma).mockReset()
    reply([{ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec }, intent, hints: [] }])
    expect(await runPass('explore', ctx())).toMatchObject({ ok: true })
  })

  it('puts an explore split into pieces back together, and says what a list held when it cannot', async () => {
    reply([{ opening: 'Watch which ones bend.' }, { action: { type: 'createActivity', id: 'x', spec: sortSpec } }, { intent }, { hints: [] }])
    expect(await runPass('explore', ctx())).toMatchObject({ ok: true, partial: { explore: { opening: 'Watch which ones bend.' } } })
    vi.mocked(callGemma).mockReset()
    reply(['Watch which ones bend.', 'Sort them.'])
    expect(((await runPass('explore', ctx())) as { reason: string }).reason).toMatch(/a list of 2 \(string, string\)/)
  })

  it('says what a reply with no action held instead, so the shape it came back in can be seen', async () => {
    // Break-even explores came back as JSON with no "opening" or "action" three times running.
    reply({ type: 'createActivity', spec: sortSpec })
    const out = await runPass('explore', ctx())
    expect(out).toMatchObject({ ok: false })
    expect((out as { reason: string }).reason).toMatch(/no "action" -- it held: type, spec/)
  })

  it('asks for a predict item outright after a material was refused for its schema', async () => {
    reply({ opening: 'Guess first.', action: { type: 'createCard', id: 'x', card: 'practice', title: 'Predict: what does AND output?', body: 'For each input pair.', answer: '1 only for 1,1', rubric: 'r', steps: ['s'] }, hints: [] })
    await runPass('explore', { ...ctx(), fix: 'the "compose" material does not match its apparatus\'s schema (its payload, prompt or success rule).' })
    expect(String(call()[0])).toMatch(/This time, open with a "Predict: \.\.\." practice card/)
    vi.mocked(callGemma).mockReset()
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec }, intent, hints: [] })
    await runPass('explore', { ...ctx(), fix: 'a vary material must cite the relationship it models, with a source' })
    expect(String(call()[0])).not.toMatch(/This time, open with a "Predict/)
  })

  it('keeps a scene its engine could not read on the scene: the config is written again, not the card changed', async () => {
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec }, intent, hints: [] })
    await runPass('explore', { ...ctx(), fix: 'the "algebra-tiles" scene could not read its config {"equation":"3x + 2 = 8"}: write it exactly in the shape its catalogue entry gives' })
    expect(String(call()[0])).not.toMatch(/This time, open with a "Predict/)
  })

  it('asks for a predict item outright once the catalogue has no picture of what was to be labelled', async () => {
    // "Reading climate graphs" tried a bar-chart label three times over this refusal.
    reply({ opening: 'Guess first.', action: { type: 'createCard', id: 'x', card: 'practice', title: 'Predict: which month is wettest?', body: 'Look at the bars.', answer: 'July', rubric: 'r', steps: ['s'] }, hints: [] })
    await runPass('explore', { ...ctx(), fix: 'the picture "bar-chart" does not show what is to be labelled: use one that does, or none -- the catalogue has no diagram of it, so use a different apparatus, or a predict item' })
    expect(String(call()[0])).toMatch(/This time, open with a "Predict: \.\.\." practice card/)
  })

  it('never lets a refused authoring model fall through to another model', async () => {
    // Found live: with the author model refused, the call quietly moved on to
    // Gemma 3 12B, and stations were being written by it.
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec }, intent, hints: [] })
    await runPass('explore', ctx())
    expect(call()[1]).toMatchObject({ maxCandidates: new Set(buildModelCandidates(modelForJob('author'))).size })
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

  it('keeps the words the passes are briefed in off the board', async () => {
    // Found live: a naming card read "The explore item shows this".
    replyName()
    await runPass('name', ctx({ explore: explore as never }))
    expect(String(call()[0])).toMatch(/never sees the words "explore item"/i)
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

describe('the scenes a pass is offered', () => {
  it('are the ones near the station, never the whole catalogue', async () => {
    await import('@/lib/studylab/engines')
    reply({ opening: 'Watch which ones bend.', action: { type: 'createActivity', id: 'x', spec: sortSpec }, intent, hints: [] })
    await runPass('explore', ctx())
    expect(String(call()[0])).not.toMatch(/SCENE "orbit"/)
  })
})

describe('runPass: practice_check', () => {
  it('asks for a check of two kinds: a multiple choice, then one answered by hand where the idea allows', async () => {
    // Twenty audited stations wrote nineteen multiple choices and one short answer: the fill, order
    // and tap formats were offered as an aside and never chosen.
    reply({ practice, check })
    await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    const asked = String(call()[0])
    expect(asked).toMatch(/CHECK -- two questions on this station/)
    expect(asked).toMatch(/The second is answered\s+by hand -- a fill, an order or a tap/)
  })

  it('asks for a practice card outright once the material tried last time cannot be drawn', async () => {
    // "Reading climate graphs" wrote its practice as a bar-chart label three times over this refusal.
    reply({ practice, check })
    await runPass('practice_check', { ...ctx({ explore: explore as never, name: name as never }), fix: 'the picture "bar-chart" does not show what is to be labelled: use one that does, or none -- the catalogue has no diagram of it, so use a different apparatus, or a predict item' })
    expect(String(call()[0])).toMatch(/This time, make the practice item a "practice" card/)
    vi.mocked(callGemma).mockReset()
    reply({ practice, check })
    await runPass('practice_check', { ...ctx({ explore: explore as never, name: name as never }), fix: 'option 2 feedback does not fit' })
    expect(String(call()[0])).not.toMatch(/This time, make the practice item/)
  })

  it('builds a question from its slips: each wrong option worked out from the mistake that gives it', async () => {
    reply({ practice, check: { say: 'Quick check.', questions: [{
      format: 'mcq', prompt: 'Which fraction equals 2/5?',
      right: { option: '4/10', feedback: 'Yes -- top and bottom both doubled.' },
      wrong: [
        { slip: 'multiplied only the top by 2', option: '4/5', feedback: 'Only the top was doubled; the bottom has to be too.' },
        { slip: 'added 2 to top and bottom', option: '4/7', feedback: 'Adding changes the amount; multiply both instead.' },
      ],
    }] } })
    const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const q = out.partial!.check!.questions[0] as { id: string; format: string; options: string[]; answer: number; optionFeedback: string[] }
    expect(q.format).toBe('mcq')
    expect(q.id).toBeTruthy()
    expect(q.options).toHaveLength(3)
    expect(q.options[q.answer]).toBe('4/10')
    expect(q.optionFeedback[q.answer]).toBe('Yes -- top and bottom both doubled.')
    expect(q.optionFeedback[q.options.indexOf('4/5')]).toBe('Only the top was doubled; the bottom has to be too.')
    expect(q.optionFeedback[q.options.indexOf('4/7')]).toBe('Adding changes the amount; multiply both instead.')
    // The working is how the options were made, not something the learner reads.
    expect(JSON.stringify(q)).not.toContain('multiplied only the top')
    expect(String(call()[0])).toMatch(/"slip"/)
  })

  it('does not always put the right option first', async () => {
    const answers = new Set<number>()
    for (const prompt of ['Which equals 1/2?', 'Which equals 3/4?', 'Which equals 2/3?', 'Which equals 1/5?', 'Which equals 5/6?', 'Which equals 3/8?']) {
      vi.mocked(callGemma).mockReset()
      reply({ practice, check: { say: 'Check.', questions: [{ format: 'mcq', prompt,
        right: { option: 'R', feedback: 'Yes.' },
        wrong: [{ slip: 'a', option: 'A', feedback: 'No, a.' }, { slip: 'b', option: 'B', feedback: 'No, b.' }] }] } })
      const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
      if (out.ok) answers.add((out.partial!.check!.questions[0] as { answer: number }).answer)
    }
    expect(answers.size).toBeGreaterThan(1)
  })

  it('offers a practice card that carries a question to answer by hand, and the formats to write it in', async () => {
    reply({ practice, check })
    await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    const p = String(call()[0])
    expect(p).toMatch(/"practice" card carrying a "question"/)
    expect(p).toContain('"format":"fill"')
    expect(p).toContain('asset:plant-cell')
  })

  it('gives a fill, order or tap question an id when the model leaves it out', async () => {
    reply({ practice, check: { say: 'Check.', questions: [{ format: 'order', prompt: 'Put them in order.', items: ['Solid', 'Liquid', 'Gas'] }] } })
    const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.partial!.check!.questions[0]).toMatchObject({ id: 'q1', format: 'order' })
  })

  it('says outright when a scene is made for the station’s idea, and not when none is', async () => {
    reply({ explore: {} })
    const melt = { ...step, title: 'Changes of state', goal: 'Explain melting and boiling with the particle model' }
    await runPass('explore', { ...ctx(), step: melt, plan: [melt] })
    expect(String(call()[0])).toMatch(/A SCENE IS MADE FOR THIS STATION: "particles"/)
    vi.mocked(callGemma).mockReset()
    reply({ explore: {} })
    await runPass('explore', ctx())
    expect(String(call()[0])).not.toMatch(/A SCENE IS MADE FOR THIS STATION/)
  })

  it('refuses a check whose wrong option says nothing to whoever picks it', async () => {
    reply({ practice, check: { ...check, questions: [{ ...check.questions[0], optionFeedback: ['', 'Yes.'] }] } })
    expect((await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))).ok).toBe(false)
  })
  it('keeps a practice material\'s intent beside it, off the action, as the explore does', async () => {
    reply({ practice: { say: 'Same idea.', action: { type: 'createActivity', id: 'x', spec: sortSpec, intent } }, check })
    const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.partial?.practice?.intent).toMatchObject({ isolates: 'category' })
    expect(out.partial?.practice?.action).not.toHaveProperty('intent')
  })

  it('writes a near-twin practice item and a hard check with feedback on every option', async () => {
    reply({ practice, check })
    const out = await runPass('practice_check', ctx({ explore: explore as never, name: name as never }))
    expect(out.ok).toBe(true)
    expect(String(call()[0])).toMatch(/near-twin/i)
    // A near-twin of the explore item as it is, items and all.
    expect(String(call()[0])).toContain('Sulfur')
    expect(String(call()[0])).toMatch(/no indentation/i)
    expect(String(call()[0])).toMatch(/could argue/i)
    // Each wrong option is worked out from its slip, and its feedback written for that slip.
    expect(String(call()[0])).toMatch(/decide the mistake first/i)
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
    reply({ ok: false, kind: 'false-statement', pass: 'name', quote: 'You split them by behaviour', reason: 'Not what the sort shows.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'name' })
  })

  it('passes a station the judge fails without quoting anything actually in it -- a judge that invents an error', async () => {
    reply({ ok: false, pass: 'practice_check', quote: '3/9 does not match', reason: 'Wrong pattern.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, pass: 'explore', reason: 'The vary relationship is wrong.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
  })

  describe('an item a teacher could argue', () => {
    // Written again, a part came back with another one (milk, a rubber ball, a butterfly): the one item goes instead.
    const match = { id: 'q2', format: 'match', prompt: 'Match each element to its kind.', pairs: [{ left: 'Iron', right: 'Metal' }, { left: 'Sulfur', right: 'Non-metal' }, { left: 'Copper', right: 'Conducts heat' }, { left: 'Silicon', right: 'Semi-metal' }] }
    const withMatch = { ...whole, check: { say: 'Quick check.', questions: [...check.questions, match] } as never }
    const arguable = { ok: false, kind: 'arguable-item', pass: 'practice_check', quote: 'Silicon', reason: 'Silicon is a metalloid; its kind is argued.' }

    it('is taken out, and the station judged once more', async () => {
      reply(arguable)
      reply({ ok: true })
      const out = await runPass('verify', ctx(withMatch))
      expect(out.ok).toBe(true)
      if (!out.ok) return
      const pairs = (out.bundle!.check.questions[1] as unknown as { pairs: { left: string }[] }).pairs
      expect(pairs.map((p) => p.left)).toEqual(['Iron', 'Sulfur', 'Copper'])
      expect(callGemma).toHaveBeenCalledTimes(2)
    })

    it('sends the part back when the station without it still fails', async () => {
      reply(arguable)
      reply({ ok: false, kind: 'wrong-key', pass: 'practice_check', quote: 'Copper', reason: 'Wrong.' })
      expect(await runPass('verify', ctx(withMatch))).toMatchObject({ ok: false, redo: 'practice_check' })
    })

    it('sends the part back when the item cannot come out', async () => {
      reply({ ...arguable, quote: 'Sulfur is brittle.' })
      expect(await runPass('verify', ctx(withMatch))).toMatchObject({ ok: false, redo: 'practice_check' })
      expect(callGemma).toHaveBeenCalledTimes(1)
    })
  })

  it('gives the judge room to finish, and asks for the shortest quote: a 350-token reply was cut off mid-quote', async () => {
    // Audit 7: "1095 characters, ending ... so 8 +" -- a whole feedback line quoted, and the budget spent.
    reply({ truth: 'Binary columns double.', ok: true })
    await runPass('verify', ctx(whole))
    expect((call()[1] as { maxTokens: number }).maxTokens).toBeGreaterThanOrEqual(800)
    expect(String(call()[0])).toMatch(/shortest exact text/i)
  })

  it('says how a judge reply that is not JSON ended, so a reply cut off at its budget shows as one', async () => {
    const cut = JSON.stringify({ truth: 'Milk is close to neutral. '.repeat(20), ok: false, kind: 'arguable-item', quote: 'Milk' }).slice(0, 300)
    vi.mocked(callGemma).mockResolvedValueOnce(cut)
    const out = await runPass('verify', ctx(whole))
    expect(out).toMatchObject({ ok: false })
    expect((out as { reason: string }).reason).toMatch(/the judge did not come back as JSON \(300 characters, ending ".*Milk is close to neutral\./)
  })

  it('finds the pass to write again from where the quote is, when the judge names none', async () => {
    reply({ ok: false, kind: 'false-statement', quote: 'Watch which ones bend', reason: 'Nothing bends in a sort.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'explore' })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, kind: 'false-statement', pass: 'nonsense', quote: 'Sulfur is brittle', reason: 'It is.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'practice_check' })
  })

  it('asks the judge for the earliest part an error starts in, not the last place it shows', async () => {
    reply({ ok: true })
    await runPass('verify', ctx(whole))
    expect(String(call()[0])).toMatch(/earliest part/i)
  })

  it('asks the judge about a fill or an order a teacher could argue, as it asks about a sort', async () => {
    reply({ ok: true })
    await runPass('verify', ctx(whole))
    expect(String(call()[0])).toMatch(/"arguable-item": a sort, match, order or fill/)
  })

  it('passes a station the judge fails for anything but a definite error of a kind it was given', async () => {
    // Found live: a practice failed twice for "not assessing the goal" -- a
    // judgement on teaching, which the brief rules out. It quoted the station,
    // so the quote check alone let it through.
    reply({ ok: false, kind: 'pedagogy', pass: 'practice_check', quote: 'Same idea.', reason: 'It does not assess the goal.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, pass: 'practice_check', quote: 'Same idea.', reason: 'Weak.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: true })
    vi.mocked(callGemma).mockReset()
    reply({ ok: false, kind: 'wrong-key', pass: 'practice_check', quote: 'Sulfur is brittle', reason: 'The key is wrong.' })
    expect(await runPass('verify', ctx(whole))).toMatchObject({ ok: false, redo: 'practice_check' })
    expect(String(call()[0])).toMatch(/"kind"/)
  })

  it('has the judge fail an item whose right place a teacher could argue', async () => {
    reply({ ok: true })
    await runPass('verify', ctx(whole))
    expect(String(call()[0])).toMatch(/place a teacher could argue/i)
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
    expect(call()[1]).toMatchObject({ model: modelForJob('judge'), reasoningEffort: 'low', noGemmaFallback: true })
    expect((call()[1] as { fallbackModel?: string }).fallbackModel).toBeUndefined()
    expect(modelForJob('judge')).toBe('global.moonshotai.kimi-k3.1')
    // Nor the judge: a station judged by a weaker model is worse than one served live.
    expect((call()[1] as { maxCandidates?: number }).maxCandidates).toBeGreaterThan(0)
    // A short reply ends at its JSON whatever the cap; at 350 a long one was cut off and the try lost.
    expect((call()[1] as { maxTokens: number }).maxTokens).toBeLessThanOrEqual(1000)
  })
})
