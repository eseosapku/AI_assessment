# Steerable LearnSpace Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move LearnSpace control flow out of the 353-line tutor prompt and into a tested state machine, so a learner can negotiate the plan before anything is built, test out of what they already know, and set their own pace.

**Architecture:** A pure state machine (`lessonRun.ts`) owns phase, per-step status and pace, and returns a refusal value rather than throwing. A policy resolved from `learnspaces.origin` decides how strict that machine is — gap lessons lock steps over measured gaps and freeze their plan, open lessons advise and stay editable. The tutor route becomes an action dispatcher that applies a transition, then calls the one narrow model job the new state requires.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, vitest, Postgres (`pg`), AWS Bedrock via `lib/bedrock.ts`.

**Spec:** `docs/superpowers/specs/2026-08-24-learnspace-steerable-lessons-design.md`

## Global Constraints

- Work on `aws_deploy` in the main repo. No worktrees — the user watches edits live.
- `npx tsc --noEmit` clean and `npx vitest run` green at the end of every task. Baseline: 826 tests passing.
- Existing StudyLab tests must keep passing untouched: `blocks`, `actions.*`, `layout`, `checkpointState`, `quiz`, `wall`, `freeform`, `webDoc`, `tutorClean`, `exportCanvas`, `recallFromCheckpoint`, `runner/*`.
- Gap threshold is `50`, matching `GAP_THRESHOLD` in `lib/admin/gap-metrics.ts`. Never hardcode a second copy.
- Montessori is out of scope. Do not add a `mode` branch anywhere.
- Do not touch `app/api/studylab/grade/route.ts`, `app/api/studylab/snap/route.ts`, or `lib/textbook-vision-images.ts`. They are on the incident default deliberately and are a separate task.
- `ss-*` colours are CSS variables: Tailwind's `/40` alpha shorthand emits nothing for them and renders elements invisible. Use `bg-[color:var(--ss-warn)]/40` form, or an inline `style` for solid fills.
- No text below `12px`. `lib/type-scale.test.ts` enforces it.
- New `.tsx` files must use `ss-*` tokens, not raw Tailwind palette classes. `lib/palette-escapes.test.ts` enforces it.

---

### Task 1: Lesson policy

The rules that differ between a lesson opened from a measured gap and one a learner started on a topic of their own choosing. Pure data plus one lookup; no I/O.

**Files:**
- Create: `lib/studylab/lessonPolicy.ts`
- Test: `lib/studylab/lessonPolicy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type LessonOrigin`, `type Pace`, `interface LessonPolicy`, `const POLICIES`, `function policyFor(origin: string | null | undefined): LessonPolicy`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/lessonPolicy.test.ts
import { describe, it, expect } from 'vitest'
import { policyFor, POLICIES } from './lessonPolicy'

describe('policyFor', () => {
  it('locks and freezes a lesson built from a measured gap', () => {
    // A gap lesson is remediation: the plan is the contract for fixing the
    // thing a measurement said was wrong.
    const p = policyFor('gap')
    expect(p.gaps).toBe('lock')
    expect(p.planEditable).toBe('planning-only')
    expect(p.completion).toBe('all-steps')
    expect(p.defaultPace).toBe('step')
  })

  it('advises rather than locks a lesson the learner opened themselves', () => {
    // 47 scratch LearnSpaces exist and not one carries a subtopic_id, so there
    // is nothing to lock against — locking there is undefined, not strict.
    const p = policyFor('scratch')
    expect(p.gaps).toBe('advise')
    expect(p.planEditable).toBe('always')
    expect(p.completion).toBe('learner-says')
    expect(p.defaultPace).toBe('run')
  })

  it('treats homework as a problem to solve, not a syllabus', () => {
    const p = policyFor('homework')
    expect(p.gaps).toBe('advise')
    expect(p.planSize.max).toBeLessThan(POLICIES.scratch.planSize.max)
  })

  it('falls back to the permissive policy for an origin it does not know', () => {
    // A lesson that wrongly refuses to let someone move on is a worse failure
    // than one that wrongly lets them skip.
    expect(policyFor('something-new')).toEqual(POLICIES.scratch)
    expect(policyFor(null)).toEqual(POLICIES.scratch)
    expect(policyFor(undefined)).toEqual(POLICIES.scratch)
    expect(policyFor('')).toEqual(POLICIES.scratch)
  })

  it('ignores case and surrounding space, since origin is free text in the column', () => {
    expect(policyFor('  GAP ')).toEqual(POLICIES.gap)
  })

  it('gives every policy a plan size with min no greater than max', () => {
    for (const [name, p] of Object.entries(POLICIES)) {
      expect(p.planSize.min, name).toBeLessThanOrEqual(p.planSize.max)
      expect(p.planSize.min, name).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studylab/lessonPolicy.test.ts`
Expected: FAIL — `Failed to resolve import "./lessonPolicy"`

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/lessonPolicy.ts

/**
 * How strict a lesson is, decided by where it came from.
 *
 * A lesson opened from the gap map and a lesson a learner started on a whim
 * are not the same object. The gap lesson is remediation: a measurement said
 * they were weak, the plan is the contract for fixing that, and deleting the
 * step that addresses it defeats the reason the lesson exists. An open lesson
 * is exploration, where the plan is a suggestion and freezing it would be the
 * tutor overruling the person who asked for it.
 *
 * The live data makes it concrete rather than a matter of taste: there are 47
 * `scratch` LearnSpaces and not one carries a `subtopic_id`. In an open lesson
 * there is nothing to lock against — locking there is undefined, not strict.
 */

export type LessonOrigin = 'gap' | 'scratch' | 'homework'
export type Pace = 'step' | 'run'

export interface LessonPolicy {
  /** What a measured gap does: block the step, or just point it out. */
  gaps: 'lock' | 'advise'
  /** When the plan may be restructured. */
  planEditable: 'always' | 'planning-only'
  defaultPace: Pace
  /** What `finish()` requires. */
  completion: 'all-steps' | 'learner-says'
  planSize: { min: number; max: number }
}

export const POLICIES: Record<LessonOrigin, LessonPolicy> = {
  gap: {
    gaps: 'lock',
    planEditable: 'planning-only',
    defaultPace: 'step',
    completion: 'all-steps',
    planSize: { min: 3, max: 4 },
  },
  scratch: {
    gaps: 'advise',
    planEditable: 'always',
    defaultPace: 'run',
    completion: 'learner-says',
    planSize: { min: 4, max: 6 },
  },
  homework: {
    gaps: 'advise',
    planEditable: 'always',
    defaultPace: 'run',
    completion: 'learner-says',
    planSize: { min: 2, max: 4 },
  },
}

/**
 * The policy for a stored `learnspaces.origin`.
 *
 * Unknown origins get the permissive policy on purpose. `origin` is a free-text
 * column, so a typo or a value added later must not silently produce a lesson
 * that refuses to let a learner move on.
 */
export function policyFor(origin: string | null | undefined): LessonPolicy {
  const key = String(origin ?? '').trim().toLowerCase()
  return POLICIES[key as LessonOrigin] ?? POLICIES.scratch
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studylab/lessonPolicy.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 832 tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/lessonPolicy.ts lib/studylab/lessonPolicy.test.ts
git commit -m "feat(studylab): a lesson's origin decides how strict it is"
```

---

### Task 2: Lesson run state machine

The core. Every transition is a pure function returning a new run or a refusal with a reason. This is where "skip a locked step" stops being a prompt instruction and becomes a branch that cannot be talked around.

**Files:**
- Create: `lib/studylab/lessonRun.ts`
- Test: `lib/studylab/lessonRun.test.ts`

**Interfaces:**
- Consumes: `LessonPolicy`, `Pace` from `./lessonPolicy`.
- Produces: `type LessonPhase`, `type StepStatus`, `interface LessonStep`, `interface OpenCheck`, `interface LessonRun`, `type Transition`, `interface PlanEdit`, and functions `emptyRun`, `proposePlan`, `acceptPlan`, `editPlan`, `nextBeat`, `beginCheck`, `passCheck`, `failCheck`, `requestTestOut`, `skipStep`, `jumpTo`, `setPace`, `stop`, `finish`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/lessonRun.test.ts
import { describe, it, expect } from 'vitest'
import { policyFor } from './lessonPolicy'
import {
  emptyRun, proposePlan, acceptPlan, editPlan, nextBeat, beginCheck,
  passCheck, failCheck, requestTestOut, skipStep, jumpTo, setPace, stop, finish,
  type LessonRun, type LessonStep,
} from './lessonRun'

const GAP = policyFor('gap')
const OPEN = policyFor('scratch')

const step = (id: string, over?: Partial<LessonStep>): LessonStep => ({
  id, title: `Step ${id}`, goal: `goal ${id}`, status: 'pending', cardIds: [], ...over,
})

/** A run mid-lesson: three steps, teaching the first. */
function teaching(policy = GAP, steps?: LessonStep[]): LessonRun {
  const planned = proposePlan(emptyRun(policy), steps ?? [step('a'), step('b'), step('c')])
  if (!planned.ok) throw new Error(planned.reason)
  const started = acceptPlan(planned.run)
  if (!started.ok) throw new Error(started.reason)
  return started.run
}

const unwrap = (t: ReturnType<typeof nextBeat>): LessonRun => {
  if (!t.ok) throw new Error(`expected ok, got refusal: ${t.reason}`)
  return t.run
}

describe('emptyRun', () => {
  it('opens in planning with nothing built and no step current', () => {
    const run = emptyRun(GAP)
    expect(run.phase).toBe('planning')
    expect(run.steps).toEqual([])
    expect(run.currentStep).toBe(-1)
  })

  it('takes its starting pace from the policy', () => {
    // Remediation opens step-by-step; browsing a topic opens running.
    expect(emptyRun(GAP).pace).toBe('step')
    expect(emptyRun(OPEN).pace).toBe('run')
  })
})

describe('acceptPlan', () => {
  it('starts teaching the first step', () => {
    const run = teaching()
    expect(run.phase).toBe('teaching')
    expect(run.currentStep).toBe(0)
    expect(run.steps[0].status).toBe('teaching')
  })

  it('skips over steps already marked known', () => {
    const planned = unwrap(proposePlan(emptyRun(OPEN), [step('a', { status: 'known' }), step('b')]))
    const run = unwrap(acceptPlan(planned))
    expect(run.currentStep).toBe(1)
  })

  it('refuses an empty plan', () => {
    const t = acceptPlan(emptyRun(GAP))
    expect(t.ok).toBe(false)
  })
})

describe('skipStep', () => {
  it('refuses to skip a step over a measured gap in a gap lesson', () => {
    // The guarantee this whole design exists for.
    const run = teaching(GAP, [
      step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } }),
    ])
    const t = skipStep(run, 'b', GAP)
    expect(t.ok).toBe(false)
    if (!t.ok) expect(t.reason).toContain('38')
  })

  it('allows the same skip in an open lesson', () => {
    // Same code, same locked step, different policy. Information, not permission.
    const run = teaching(OPEN, [
      step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } }),
    ])
    const t = skipStep(run, 'b', OPEN)
    expect(t.ok).toBe(true)
    if (t.ok) expect(t.run.steps[1].status).toBe('known')
  })

  it('refuses a step id that is not in the plan', () => {
    expect(skipStep(teaching(), 'nope', GAP).ok).toBe(false)
  })

  it('moves teaching along when the skipped step was the current one', () => {
    const run = unwrap(skipStep(teaching(OPEN), 'a', OPEN))
    expect(run.steps[0].status).toBe('known')
    expect(run.currentStep).toBe(1)
    expect(run.steps[1].status).toBe('teaching')
  })
})

describe('requestTestOut', () => {
  it('opens a check on a later step without moving teaching', () => {
    // The reason openCheck names its own step: testing out of step 3 must not
    // disturb the fact that step 1 is being taught.
    const run = unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN))
    expect(run.openCheck).toMatchObject({ stepId: 'c', kind: 'testout' })
    expect(run.currentStep).toBe(0)
    expect(run.steps[0].status).toBe('teaching')
  })

  it('refuses on a locked step under a gap policy', () => {
    const run = teaching(GAP, [step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } })])
    expect(requestTestOut(run, 'b', 'cp-1', GAP).ok).toBe(false)
  })

  it('refuses while another check is already open', () => {
    const run = unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN))
    expect(requestTestOut(run, 'b', 'cp-2', OPEN).ok).toBe(false)
  })
})

describe('passCheck', () => {
  it('marks a tested-out step known and leaves teaching where it was', () => {
    const run = unwrap(passCheck(unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN))))
    expect(run.steps[2].status).toBe('known')
    expect(run.currentStep).toBe(0)
    expect(run.openCheck).toBeUndefined()
  })

  it('marks a checkpoint step done and advances', () => {
    const run = unwrap(passCheck(unwrap(beginCheck(teaching(), 'a', 'cp-1', 'checkpoint', 'hard'))))
    expect(run.steps[0].status).toBe('done')
    expect(run.currentStep).toBe(1)
    expect(run.steps[1].status).toBe('teaching')
  })

  it('refuses when no check is open', () => {
    expect(passCheck(teaching()).ok).toBe(false)
  })
})

describe('failCheck', () => {
  it('turns a failed test-out into teaching that step', () => {
    // Better than not trying: the lesson narrows to what was actually missed.
    const run = unwrap(failCheck(unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN)), ['q2']))
    expect(run.steps[2].status).toBe('teaching')
    expect(run.currentStep).toBe(2)
    expect(run.openCheck).toBeUndefined()
  })
})

describe('nextBeat', () => {
  it('counts beats on the current step', () => {
    expect(unwrap(nextBeat(teaching())).beats).toBe(1)
    expect(unwrap(nextBeat(unwrap(nextBeat(teaching())))).beats).toBe(2)
  })

  it('refuses while a hard check is open', () => {
    const run = unwrap(beginCheck(teaching(), 'a', 'cp-1', 'checkpoint', 'hard'))
    expect(nextBeat(run).ok).toBe(false)
  })

  it('allows a beat while only a soft check is open', () => {
    const run = unwrap(beginCheck(teaching(), 'a', 'cp-1', 'checkpoint', 'soft'))
    expect(nextBeat(run).ok).toBe(true)
  })
})

describe('editPlan', () => {
  it('refuses to restructure a gap lesson once teaching has started', () => {
    expect(editPlan(teaching(GAP), { add: [step('d')] }, GAP).ok).toBe(false)
  })

  it('lets an open lesson change direction mid-lesson', () => {
    const run = unwrap(editPlan(teaching(OPEN), { add: [step('d')] }, OPEN))
    expect(run.steps).toHaveLength(4)
  })

  it('refuses to remove a locked step under a gap policy', () => {
    const planned = unwrap(proposePlan(emptyRun(GAP), [
      step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } }),
    ]))
    expect(editPlan(planned, { remove: ['b'] }, GAP).ok).toBe(false)
  })
})

describe('finish', () => {
  it('refuses a gap lesson with work outstanding', () => {
    expect(finish(teaching(GAP), GAP).ok).toBe(false)
  })

  it('lets an open lesson stop whenever the learner says', () => {
    // No obligation to complete something started out of curiosity.
    const t = finish(teaching(OPEN), OPEN)
    expect(t.ok).toBe(true)
    if (t.ok) expect(t.run.phase).toBe('done')
  })

  it('allows a gap lesson to finish once every step is settled', () => {
    let run = teaching(GAP)
    for (const s of run.steps) run = unwrap(skipStep(run, s.id, OPEN))
    expect(finish(run, GAP).ok).toBe(true)
  })
})

describe('invariants', () => {
  it('keeps exactly one step teaching while the phase is teaching', () => {
    const run = unwrap(nextBeat(teaching()))
    expect(run.steps.filter((s) => s.status === 'teaching')).toHaveLength(1)
    expect(run.steps[run.currentStep].status).toBe('teaching')
  })

  it('never lets a locked step reach known under a gap policy', () => {
    const run = teaching(GAP, [step('a', { lockedBy: { subtopicId: 7, accuracy: 12 } })])
    expect(skipStep(run, 'a', GAP).ok).toBe(false)
    expect(requestTestOut(run, 'a', 'cp-1', GAP).ok).toBe(false)
  })

  it('resets the beat count when the current step changes', () => {
    const busy = unwrap(nextBeat(unwrap(nextBeat(teaching(OPEN)))))
    expect(unwrap(skipStep(busy, 'a', OPEN)).beats).toBe(0)
  })
})

describe('setPace and stop', () => {
  it('changes pace without disturbing anything else', () => {
    const run = unwrap(setPace(teaching(GAP), 'run'))
    expect(run.pace).toBe('run')
    expect(run.currentStep).toBe(0)
  })

  it('marks the run as awaiting the learner', () => {
    expect(unwrap(stop(teaching())).awaiting).toBe(true)
  })
})

describe('jumpTo', () => {
  it('refuses to jump past an unfinished locked step in a gap lesson', () => {
    const run = teaching(GAP, [
      step('a', { lockedBy: { subtopicId: 7, accuracy: 20 } }), step('b'), step('c'),
    ])
    expect(jumpTo(run, 'c', GAP).ok).toBe(false)
  })

  it('allows the same jump in an open lesson', () => {
    const run = teaching(OPEN, [
      step('a', { lockedBy: { subtopicId: 7, accuracy: 20 } }), step('b'), step('c'),
    ])
    expect(jumpTo(run, 'c', OPEN).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studylab/lessonRun.test.ts`
Expected: FAIL — `Failed to resolve import "./lessonRun"`

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/lessonRun.ts
import type { LessonPolicy, Pace } from './lessonPolicy'

/**
 * The lesson's control flow, as data.
 *
 * Everything here is pure: no I/O, no model calls, no React. That is the point
 * of the module. The 353-line tutor prompt accumulated rules whose only job was
 * to police control flow — never skip a step, never repeat a checkpoint, only
 * finish after the last one — because a language model was being asked to run a
 * state machine. With the machine here, those rules have nothing left to
 * police, and a refusal becomes a branch rather than a request.
 *
 * `checking` is deliberately not a phase. Making it one forced a single
 * `currentStep` to mean both where teaching is and what is being answered,
 * which breaks the moment a learner tests out of a step ahead of the one they
 * are on. An open check names its own step instead.
 */

export type LessonPhase = 'planning' | 'teaching' | 'done'
export type StepStatus = 'pending' | 'teaching' | 'known' | 'done'

export interface LessonStep {
  id: string
  title: string
  goal: string
  status: StepStatus
  /** Curriculum subtopic this step covers, where one applies. */
  subtopicId?: number
  /**
   * Set whenever a measurement says the learner is weak here. Always computed;
   * what it *does* is the policy's decision, so an open lesson can still show
   * the number without turning it into a gate.
   */
  lockedBy?: { subtopicId: number; accuracy: number }
  cardIds: string[]
  checkpointId?: string
}

export interface OpenCheck {
  stepId: string
  checkpointId: string
  kind: 'checkpoint' | 'testout'
  gate: 'hard' | 'soft'
}

export interface LessonRun {
  phase: LessonPhase
  pace: Pace
  steps: LessonStep[]
  /** Index into `steps`. -1 while planning. */
  currentStep: number
  /** Beats spent on the current step. Resets when the current step changes. */
  beats: number
  awaiting: boolean
  openCheck?: OpenCheck
}

export type Transition =
  | { ok: true; run: LessonRun }
  | { ok: false; reason: string }

const ok = (run: LessonRun): Transition => ({ ok: true, run })
const no = (reason: string): Transition => ({ ok: false, reason })

/** Whether the policy turns this step's measurement into a gate. */
function isGated(step: LessonStep | undefined, policy: LessonPolicy): boolean {
  return Boolean(step?.lockedBy) && policy.gaps === 'lock'
}

function indexOf(run: LessonRun, stepId: string): number {
  return run.steps.findIndex((s) => s.id === stepId)
}

/** The next step that still needs attention, or -1 when none do. */
function nextUnsettled(steps: LessonStep[], from = 0): number {
  for (let i = from; i < steps.length; i += 1) {
    if (steps[i].status === 'pending' || steps[i].status === 'teaching') return i
  }
  return -1
}

/**
 * Moves teaching to `index`, clearing any other step that was mid-teach.
 * Beats reset, because a beat count belongs to the step it was spent on.
 */
function focus(run: LessonRun, index: number): LessonRun {
  const steps = run.steps.map((s, i) => {
    if (i === index) return { ...s, status: 'teaching' as StepStatus }
    return s.status === 'teaching' ? { ...s, status: 'pending' as StepStatus } : s
  })
  return { ...run, steps, currentStep: index, beats: 0 }
}

export function emptyRun(policy: LessonPolicy): LessonRun {
  return {
    phase: 'planning',
    pace: policy.defaultPace,
    steps: [],
    currentStep: -1,
    beats: 0,
    awaiting: true,
  }
}

export function proposePlan(run: LessonRun, steps: LessonStep[]): Transition {
  return ok({ ...run, phase: 'planning', steps, currentStep: -1, beats: 0, awaiting: true })
}

export function acceptPlan(run: LessonRun): Transition {
  if (run.steps.length === 0) return no('There is no plan to start yet.')
  const first = nextUnsettled(run.steps)
  if (first === -1) return ok({ ...run, phase: 'done', currentStep: -1, awaiting: true })
  return ok({ ...focus({ ...run, phase: 'teaching' }, first), awaiting: false })
}

export interface PlanEdit {
  add?: LessonStep[]
  remove?: string[]
  /** Step ids in their new order. Ids not listed keep their relative position. */
  reorder?: string[]
}

export function editPlan(run: LessonRun, edit: PlanEdit, policy: LessonPolicy): Transition {
  if (run.phase === 'teaching' && policy.planEditable === 'planning-only') {
    return no('This lesson is set from what you were measured on, so the plan stays put.')
  }
  for (const id of edit.remove ?? []) {
    const step = run.steps[indexOf(run, id)]
    if (!step) return no('That step is not in the plan.')
    if (isGated(step, policy)) {
      return no(`${step.title} — measured at ${step.lockedBy!.accuracy}%. This one stays.`)
    }
  }

  let steps = run.steps.filter((s) => !(edit.remove ?? []).includes(s.id))
  steps = [...steps, ...(edit.add ?? [])]
  if (edit.reorder?.length) {
    const rank = new Map(edit.reorder.map((id, i) => [id, i]))
    steps = [...steps].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }

  const current = run.currentStep >= 0 ? run.steps[run.currentStep] : undefined
  const moved = current ? steps.findIndex((s) => s.id === current.id) : -1
  return ok({ ...run, steps, currentStep: moved })
}

export function nextBeat(run: LessonRun): Transition {
  if (run.phase !== 'teaching') return no('The lesson is not running.')
  if (run.openCheck?.gate === 'hard') return no('Finish the check first.')
  return ok({ ...run, beats: run.beats + 1, awaiting: false })
}

export function beginCheck(
  run: LessonRun,
  stepId: string,
  checkpointId: string,
  kind: OpenCheck['kind'],
  gate: OpenCheck['gate'],
): Transition {
  if (run.openCheck) return no('There is already a check open.')
  if (indexOf(run, stepId) === -1) return no('That step is not in the plan.')
  return ok({ ...run, openCheck: { stepId, checkpointId, kind, gate }, awaiting: true })
}

export function requestTestOut(
  run: LessonRun,
  stepId: string,
  checkpointId: string,
  policy: LessonPolicy,
): Transition {
  const step = run.steps[indexOf(run, stepId)]
  if (!step) return no('That step is not in the plan.')
  if (isGated(step, policy)) {
    return no(`${step.title} — measured at ${step.lockedBy!.accuracy}%. This one gets taught.`)
  }
  return beginCheck(run, stepId, checkpointId, 'testout', 'soft')
}

/**
 * Resolves the open check.
 *
 * A checkpoint marks its step done and advances. A test-out marks its step
 * known and leaves teaching exactly where it was — which is the whole reason
 * the kind is recorded.
 */
export function passCheck(run: LessonRun): Transition {
  const check = run.openCheck
  if (!check) return no('There is no check open.')
  const index = indexOf(run, check.stepId)
  if (index === -1) return no('That step is not in the plan.')

  const settled: StepStatus = check.kind === 'testout' ? 'known' : 'done'
  const steps = run.steps.map((s, i) => (i === index ? { ...s, status: settled } : s))
  const cleared = { ...run, steps, openCheck: undefined }

  if (check.kind === 'testout') return ok({ ...cleared, awaiting: true })

  const next = nextUnsettled(steps, index + 1)
  if (next === -1) return ok({ ...cleared, currentStep: -1, awaiting: true })
  return ok({ ...focus(cleared, next), awaiting: false })
}

/**
 * A failed check teaches the step it was about.
 *
 * `missed` travels to the teaching job so the lesson narrows to what was
 * actually got wrong, which makes a failed test-out more useful than never
 * attempting one.
 */
export function failCheck(run: LessonRun, missed: string[]): Transition {
  const check = run.openCheck
  if (!check) return no('There is no check open.')
  const index = indexOf(run, check.stepId)
  if (index === -1) return no('That step is not in the plan.')
  void missed
  return ok({ ...focus({ ...run, openCheck: undefined, phase: 'teaching' }, index), awaiting: false })
}

export function skipStep(run: LessonRun, stepId: string, policy: LessonPolicy): Transition {
  const index = indexOf(run, stepId)
  const step = run.steps[index]
  if (!step) return no('That step is not in the plan.')
  if (isGated(step, policy)) {
    return no(`${step.title} — measured at ${step.lockedBy!.accuracy}%. This one gets taught.`)
  }

  const steps = run.steps.map((s, i) => (i === index ? { ...s, status: 'known' as StepStatus } : s))
  const cleared: LessonRun = { ...run, steps }
  if (run.currentStep !== index) return ok(cleared)

  const next = nextUnsettled(steps, index + 1)
  if (next === -1) return ok({ ...cleared, currentStep: -1, beats: 0, awaiting: true })
  return ok(focus(cleared, next))
}

export function jumpTo(run: LessonRun, stepId: string, policy: LessonPolicy): Transition {
  const index = indexOf(run, stepId)
  if (index === -1) return no('That step is not in the plan.')
  const blocking = run.steps
    .slice(0, index)
    .find((s) => isGated(s, policy) && s.status !== 'done')
  if (blocking) {
    return no(`${blocking.title} comes first — you were measured at ${blocking.lockedBy!.accuracy}%.`)
  }
  return ok(focus({ ...run, phase: 'teaching' }, index))
}

export function setPace(run: LessonRun, pace: Pace): Transition {
  return ok({ ...run, pace })
}

export function stop(run: LessonRun): Transition {
  return ok({ ...run, awaiting: true })
}

export function finish(run: LessonRun, policy: LessonPolicy): Transition {
  if (policy.completion === 'all-steps') {
    const outstanding = run.steps.find((s) => s.status === 'pending' || s.status === 'teaching')
    if (outstanding) return no(`${outstanding.title} is still open.`)
  }
  return ok({ ...run, phase: 'done', currentStep: -1, openCheck: undefined, awaiting: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studylab/lessonRun.test.ts`
Expected: PASS — 32 tests

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 864 tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/lessonRun.ts lib/studylab/lessonRun.test.ts
git commit -m "feat(studylab): a lesson run that refuses rather than requests"
```

---

### Task 3: Back-fill a run from an existing lesson

65 LearnSpaces already exist with a `plan` inside `canvas_state` and a
`current_step` column. They derive a run on read, so there is no batch script
and a lesson nobody opens again costs nothing.

**Files:**
- Create: `lib/studylab/lessonRunMigrate.ts`
- Test: `lib/studylab/lessonRunMigrate.test.ts`

**Interfaces:**
- Consumes: `LessonRun`, `LessonStep` from `./lessonRun`; `LessonPolicy` from `./lessonPolicy`.
- Produces: `function runFromLegacy(input: LegacyLesson, policy: LessonPolicy): LessonRun`, `interface LegacyLesson`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/lessonRunMigrate.test.ts
import { describe, it, expect } from 'vitest'
import { policyFor } from './lessonPolicy'
import { runFromLegacy } from './lessonRunMigrate'

const OPEN = policyFor('scratch')
const PLAN = [
  { title: 'Atoms', goal: 'what an atom is' },
  { title: 'Bonding', goal: 'why atoms bond' },
  { title: 'Shapes', goal: 'predicting shape' },
]

describe('runFromLegacy', () => {
  it('marks everything before the current step as done', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 3, status: 'active' }, OPEN)
    expect(run.steps.map((s) => s.status)).toEqual(['done', 'done', 'teaching'])
    expect(run.currentStep).toBe(2)
  })

  it('treats a lesson at step 1 as barely started', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 1, status: 'active' }, OPEN)
    expect(run.steps.map((s) => s.status)).toEqual(['teaching', 'pending', 'pending'])
  })

  it('carries a completed lesson straight to done', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 3, status: 'completed' }, OPEN)
    expect(run.phase).toBe('done')
  })

  it('gives a lesson with no plan an empty run in planning', () => {
    // Most of the 47 scratch lessons predate the plan entirely.
    const run = runFromLegacy({ plan: null, currentStep: 0, status: 'active' }, OPEN)
    expect(run.phase).toBe('planning')
    expect(run.steps).toEqual([])
  })

  it('locks nothing, because old plans carry no subtopic', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 2, status: 'active' }, policyFor('gap'))
    expect(run.steps.every((s) => !s.lockedBy)).toBe(true)
  })

  it('takes its pace from the policy, since none was ever stored', () => {
    expect(runFromLegacy({ plan: PLAN, currentStep: 1, status: 'active' }, OPEN).pace).toBe('run')
  })

  it('survives a plan whose entries are malformed', () => {
    // canvas_state is jsonb written by a model; it is not to be trusted.
    const run = runFromLegacy(
      { plan: [{ title: 'Ok', goal: 'g' }, null, { goal: 'no title' }] as never, currentStep: 1, status: 'active' },
      OPEN,
    )
    expect(run.steps).toHaveLength(1)
    expect(run.steps[0].title).toBe('Ok')
  })

  it('clamps a current step beyond the plan', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 99, status: 'active' }, OPEN)
    expect(run.currentStep).toBeLessThan(PLAN.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studylab/lessonRunMigrate.test.ts`
Expected: FAIL — `Failed to resolve import "./lessonRunMigrate"`

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/lessonRunMigrate.ts
import type { LessonPolicy } from './lessonPolicy'
import type { LessonRun, LessonStep, StepStatus } from './lessonRun'

/**
 * Derives a lesson run from a LearnSpace saved before runs existed.
 *
 * Done on read rather than as a batch migration: there is no downtime, no
 * script to babysit, and a lesson nobody opens again costs nothing. The derived
 * run is written back on the next save, so each space converts once, when it is
 * next used.
 *
 * Nothing locks. Old plans carry no `subtopicId`, so there is nothing to match
 * against `topic_mastery` — and inventing a lock for a lesson already in
 * progress would strand a learner mid-way through.
 */

export interface LegacyLesson {
  /** `canvas_state.plan`, which is model-written jsonb and may be anything. */
  plan: { title?: unknown; goal?: unknown }[] | null | undefined
  /** The `current_step` column. 1-based, 0 when never started. */
  currentStep: number | null | undefined
  /** The `status` column. */
  status: string | null | undefined
}

function toStep(raw: unknown, index: number): LessonStep | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { title?: unknown; goal?: unknown }
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return null
  return {
    id: `legacy-${index + 1}`,
    title,
    goal: typeof r.goal === 'string' ? r.goal : '',
    status: 'pending',
    cardIds: [],
  }
}

export function runFromLegacy(input: LegacyLesson, policy: LessonPolicy): LessonRun {
  const steps = (Array.isArray(input.plan) ? input.plan : [])
    .map(toStep)
    .filter((s): s is LessonStep => s !== null)

  const base: LessonRun = {
    phase: 'planning',
    pace: policy.defaultPace,
    steps: [],
    currentStep: -1,
    beats: 0,
    awaiting: true,
  }

  if (steps.length === 0) return base

  const done = String(input.status ?? '').toLowerCase() === 'completed'
  if (done) {
    return {
      ...base,
      phase: 'done',
      steps: steps.map((s) => ({ ...s, status: 'done' as StepStatus })),
    }
  }

  // current_step is 1-based; clamp because nothing ever validated it.
  const raw = Number(input.currentStep) || 1
  const index = Math.min(Math.max(raw - 1, 0), steps.length - 1)

  return {
    ...base,
    phase: 'teaching',
    currentStep: index,
    awaiting: true,
    steps: steps.map((s, i) => ({
      ...s,
      status: (i < index ? 'done' : i === index ? 'teaching' : 'pending') as StepStatus,
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studylab/lessonRunMigrate.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 872 tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/lessonRunMigrate.ts lib/studylab/lessonRunMigrate.test.ts
git commit -m "feat(studylab): derive a run from a lesson saved before runs existed"
```

---

### Task 4: Lock steps from measured gaps

Turns `topic_mastery` from something the gap map describes into something a
lesson obeys.

**Files:**
- Create: `lib/studylab/stepLocks.ts`
- Test: `lib/studylab/stepLocks.test.ts`

**Interfaces:**
- Consumes: `LessonStep` from `./lessonRun`; `Database` from `@/lib/db`; `GAP_THRESHOLD` from `@/lib/admin/gap-metrics`.
- Produces: `function applyLocks(steps: LessonStep[], userId: string, database?: Database): Promise<LessonStep[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/stepLocks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { applyLocks } from './stepLocks'
import { GAP_THRESHOLD } from '@/lib/admin/gap-metrics'
import type { Database } from '@/lib/db'
import type { LessonStep } from './lessonRun'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const step = (id: string, subtopicId?: number): LessonStep => ({
  id, title: `Step ${id}`, goal: 'g', status: 'pending', cardIds: [], subtopicId,
})

describe('applyLocks', () => {
  it('locks a step whose subtopic was measured below the line', () => {
    return expect(
      applyLocks([step('a', 7)], 'u1', dbWith([{ subtopic_id: 7, accuracy: 38 }])),
    ).resolves.toMatchObject([{ lockedBy: { subtopicId: 7, accuracy: 38 } }])
  })

  it('leaves a step measured at or above the line alone', async () => {
    const [s] = await applyLocks([step('a', 7)], 'u1', dbWith([{ subtopic_id: 7, accuracy: 82 }]))
    expect(s.lockedBy).toBeUndefined()
  })

  it('uses the same threshold as the learner-facing gap map', async () => {
    // A second copy of 50 would drift, and the dashboard and the student would
    // describe the same subtopic in contradictory terms.
    const [s] = await applyLocks(
      [step('a', 7)], 'u1', dbWith([{ subtopic_id: 7, accuracy: GAP_THRESHOLD }]),
    )
    expect(s.lockedBy).toBeUndefined()
  })

  it('leaves a step with no subtopic unlocked', async () => {
    // Every scratch lesson is in this case: 47 of them, none with a subtopic.
    const [s] = await applyLocks([step('a')], 'u1', dbWith([{ subtopic_id: 7, accuracy: 10 }]))
    expect(s.lockedBy).toBeUndefined()
  })

  it('leaves a subtopic with no measurement unlocked', async () => {
    // Absence of evidence is not evidence of a gap.
    const [s] = await applyLocks([step('a', 9)], 'u1', dbWith([]))
    expect(s.lockedBy).toBeUndefined()
  })

  it('does not query at all when no step names a subtopic', async () => {
    const db = dbWith([])
    await applyLocks([step('a'), step('b')], 'u1', db)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('returns the steps unlocked when the query fails', async () => {
    // A lesson that will not start because a lock query failed is worse than a
    // lesson that starts without locks.
    const broken = { query: vi.fn().mockRejectedValue(new Error('down')) } as unknown as Database
    const [s] = await applyLocks([step('a', 7)], 'u1', broken)
    expect(s.lockedBy).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studylab/stepLocks.test.ts`
Expected: FAIL — `Failed to resolve import "./stepLocks"`

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/stepLocks.ts
import { db as defaultDb, type Database } from '@/lib/db'
import { GAP_THRESHOLD } from '@/lib/admin/gap-metrics'
import type { LessonStep } from './lessonRun'

/**
 * Marks the steps a measurement says the learner is weak on.
 *
 * `lockedBy` is always computed and never conditionally set — what it *does* is
 * the policy's decision. Keeping the record either way costs nothing and lets
 * an open lesson tell the learner what the measurement said without turning it
 * into a gate.
 *
 * The threshold is imported rather than repeated. A second copy of 50 would
 * drift, and the dashboard and the learner's own gap map would end up
 * describing the same subtopic in contradictory terms.
 */
export async function applyLocks(
  steps: LessonStep[],
  userId: string,
  database: Database = defaultDb,
): Promise<LessonStep[]> {
  const subtopicIds = [...new Set(steps.map((s) => s.subtopicId).filter((id): id is number => !!id))]
  if (subtopicIds.length === 0 || !userId) return steps

  try {
    const { rows } = await database.query(
      `SELECT subtopic_id, accuracy
         FROM topic_mastery
        WHERE user_id = $1
          AND subtopic_id = ANY($2::int[])
          AND attempts > 0
          AND accuracy IS NOT NULL`,
      [userId, subtopicIds],
    )

    const measured = new Map<number, number>()
    for (const r of rows as Record<string, unknown>[]) {
      measured.set(Number(r.subtopic_id), Number(r.accuracy))
    }

    return steps.map((step) => {
      if (!step.subtopicId) return step
      const accuracy = measured.get(step.subtopicId)
      if (accuracy === undefined || accuracy >= GAP_THRESHOLD) return step
      return { ...step, lockedBy: { subtopicId: step.subtopicId, accuracy: Math.round(accuracy) } }
    })
  } catch (error) {
    // A lesson that will not start because a lock query failed is a worse
    // outcome than a lesson that starts without locks.
    console.error('Step locking failed:', (error as Error)?.message ?? error)
    return steps
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studylab/stepLocks.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 879 tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/stepLocks.ts lib/studylab/stepLocks.test.ts
git commit -m "feat(studylab): let measured gaps decide what a lesson may skip"
```

---

### Task 5: Job model routing, and usage tracking for callGemma

Four narrow jobs, each with its own model, each attributed in the usage ledger.
`callGemma` currently records nothing, so lesson spend would be invisible.

**Files:**
- Create: `lib/studylab/lessonJobs.ts`
- Test: `lib/studylab/lessonJobs.test.ts`
- Modify: `lib/bedrock.ts` — add a `usage` option to `CallGemmaOptions` and wrap the send

**Interfaces:**
- Consumes: `withUsageTracking` from `@/lib/ai-usage-recorder`.
- Produces: `type LessonJob`, `const JOB_MODELS`, `function modelForJob(job: LessonJob, env?: NodeJS.ProcessEnv): string`; and `CallGemmaOptions.usage?: { feature: string; requestId: string; userId: string | null }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/lessonJobs.test.ts
import { describe, it, expect } from 'vitest'
import { modelForJob, JOB_MODELS, type LessonJob } from './lessonJobs'

const JOBS: LessonJob[] = ['plan', 'teach_beat', 'check', 'grade']

describe('JOB_MODELS', () => {
  it('puts the jobs a student reads on the stronger model', () => {
    // Planning gets Gemma despite its short output: ordering a syllabus needs
    // the subject's dependency structure, and at one or two calls a lesson the
    // cost difference is about $0.0003.
    expect(JOB_MODELS.plan).toBe('google.gemma-3-27b-it')
    expect(JOB_MODELS.teach_beat).toBe('google.gemma-3-27b-it')
  })

  it('puts the bounded transforms on the fast model', () => {
    expect(JOB_MODELS.check).toBe('amazon.nova-lite-v1:0')
    expect(JOB_MODELS.grade).toBe('amazon.nova-lite-v1:0')
  })

  it('names a model for every job', () => {
    for (const job of JOBS) expect(JOB_MODELS[job], job).toBeTruthy()
  })
})

describe('modelForJob', () => {
  it('lets each job be overridden on its own', () => {
    expect(modelForJob('plan', { AWS_LESSON_PLAN_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe('amazon.nova-micro-v1:0')
    // Overriding one job must not move the others.
    expect(modelForJob('teach_beat', { AWS_LESSON_PLAN_MODEL_ID: 'amazon.nova-micro-v1:0' } as never))
      .toBe('google.gemma-3-27b-it')
  })

  it('strips a region prefix, which is routing rather than another model', () => {
    expect(modelForJob('grade', { AWS_LESSON_GRADE_MODEL_ID: 'eu.amazon.nova-lite-v1:0' } as never))
      .toBe('amazon.nova-lite-v1:0')
  })

  it('falls back to the table when nothing is set', () => {
    for (const job of JOBS) expect(modelForJob(job, {} as never)).toBe(JOB_MODELS[job])
  })

  it('ignores an override that is only whitespace', () => {
    expect(modelForJob('check', { AWS_LESSON_CHECK_MODEL_ID: '   ' } as never))
      .toBe(JOB_MODELS.check)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studylab/lessonJobs.test.ts`
Expected: FAIL — `Failed to resolve import "./lessonJobs"`

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/lessonJobs.ts

/**
 * Which model runs which part of a lesson.
 *
 * The line is whether the job needs judgement about the subject or is a bounded
 * transform. Planning and teaching are read by a student and shape what they
 * learn; writing a check and marking an answer are structured work against a
 * goal that is already decided.
 *
 * Model choice hangs off the job name rather than a route-level default, so no
 * job can silently inherit a model set during an incident — the failure three
 * call sites are still living with from 22 June, where callGemma has returned
 * Nova Lite ever since and its name says otherwise.
 */

export type LessonJob = 'plan' | 'teach_beat' | 'check' | 'grade'

export const JOB_MODELS: Record<LessonJob, string> = {
  plan: 'google.gemma-3-27b-it',
  teach_beat: 'google.gemma-3-27b-it',
  check: 'amazon.nova-lite-v1:0',
  grade: 'amazon.nova-lite-v1:0',
}

const ENV_KEYS: Record<LessonJob, string> = {
  plan: 'AWS_LESSON_PLAN_MODEL_ID',
  teach_beat: 'AWS_LESSON_TEACH_MODEL_ID',
  check: 'AWS_LESSON_CHECK_MODEL_ID',
  grade: 'AWS_LESSON_GRADE_MODEL_ID',
}

/** The model a job runs on right now, honouring its own override only. */
export function modelForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env[ENV_KEYS[job]] ?? '').trim()
  const model = configured || JOB_MODELS[job]
  return model.replace(/^(us|eu|ap)\./, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studylab/lessonJobs.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Add usage tracking to callGemma**

In `lib/bedrock.ts`, add to `CallGemmaOptions` (after `maxCandidates`):

```ts
  /**
   * Records this call in the usage ledger. Absent means untracked, which is
   * how every existing caller behaves — this is additive on purpose.
   */
  usage?: { feature: string; requestId: string; userId: string | null }
```

Add the import at the top of the file, beside the existing imports:

```ts
import { withUsageTracking } from '@/lib/ai-usage-recorder'
```

Then wrap the send inside `callGemma`'s candidate loop. Find the line that
awaits `client.send(...)` and replace it with:

```ts
      const response = opts.usage
        ? await withUsageTracking(
            {
              modelId,
              feature: opts.usage.feature,
              requestId: opts.usage.requestId,
              userId: opts.usage.userId,
              parseBody: (r: InvokeModelCommandOutput) =>
                JSON.parse(new TextDecoder().decode(r.body)),
            },
            () => client.send(command),
          )
        : await client.send(command)
```

Add `InvokeModelCommandOutput` to the existing `@aws-sdk/client-bedrock-runtime`
import if it is not already there.

- [ ] **Step 6: Verify nothing regressed**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 887 tests passing. Existing callers pass no `usage`,
so their behaviour is unchanged.

- [ ] **Step 7: Commit**

```bash
git add lib/studylab/lessonJobs.ts lib/studylab/lessonJobs.test.ts lib/bedrock.ts
git commit -m "feat(studylab): route each lesson job to its own model, and meter it"
```

---

### Task 6: Persist the run

A column, and the read path that back-fills into it.

**Files:**
- Create: `migrations/add-learnspace-lesson-run.sql`
- Modify: `app/api/studylab/[id]/route.ts` — return `lesson_run` on GET, accept it on PUT

**Interfaces:**
- Consumes: `runFromLegacy` from `@/lib/studylab/lessonRunMigrate`; `policyFor` from `@/lib/studylab/lessonPolicy`.
- Produces: GET response gains `lesson_run: LessonRun`; PUT accepts `body.lesson_run`.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/add-learnspace-lesson-run.sql
-- The lesson's control flow: phase, per-step status, pace, and any open check.
-- Separate from canvas_state because it is lesson structure, not canvas
-- content, and it carries status the whiteboard has no business owning.
ALTER TABLE learnspaces
  ADD COLUMN IF NOT EXISTS lesson_run jsonb;

COMMENT ON COLUMN learnspaces.lesson_run IS
  'LessonRun: phase, steps with status and locks, pace, open check. Null on rows saved before runs existed; derived from canvas_state.plan and current_step on read.';
```

- [ ] **Step 2: Apply it**

Run:
```bash
node -e "
const fs=require('fs');const {Client}=require('pg');
for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^[\"']|[\"']$/g,'')}
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();
await c.query(fs.readFileSync('migrations/add-learnspace-lesson-run.sql','utf8'));
const r=await c.query(\"SELECT column_name,data_type FROM information_schema.columns WHERE table_name='learnspaces' AND column_name='lesson_run'\");
console.table(r.rows);await c.end()})()"
```
Expected: one row — `lesson_run | jsonb`

- [ ] **Step 3: Return the run on GET**

In `app/api/studylab/[id]/route.ts`, after the space row is loaded and before
the response is built, add:

```ts
    // Rows saved before runs existed derive one here rather than in a batch
    // job: no downtime, and a lesson nobody opens again costs nothing. The
    // derived run is written back on the next save, so each space converts once.
    const policy = policyFor(space.origin)
    const lessonRun =
      space.lesson_run ??
      runFromLegacy(
        {
          plan: space.canvas_state?.plan ?? null,
          currentStep: space.current_step,
          status: space.status,
        },
        policy,
      )
```

Include `lesson_run: lessonRun` in the JSON the GET returns, and add the imports:

```ts
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { runFromLegacy } from '@/lib/studylab/lessonRunMigrate'
```

- [ ] **Step 4: Accept it on PUT**

In the same file's PUT handler, beside the existing `canvas_state` branch:

```ts
    if (body.lesson_run !== undefined) {
      sets.push(`lesson_run = $${idx++}::jsonb`)
      values.push(jsonbParam(body.lesson_run))
    }
```

- [ ] **Step 5: Verify against a real lesson**

Run:
```bash
node -e "
const fs=require('fs');const {Client}=require('pg');
for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^[\"']|[\"']$/g,'')}
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();
const r=await c.query(\"SELECT id,origin,current_step,status,jsonb_array_length(COALESCE(canvas_state->'plan','[]'::jsonb)) AS plan_steps FROM learnspaces WHERE canvas_state ? 'plan' LIMIT 5\");
console.table(r.rows);await c.end()})()"
```
Expected: a handful of rows with `plan_steps > 0`. Note one `id`, then
`curl -s "http://localhost:3000/api/studylab/<id>?user_id=<uid>" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s).lesson_run,null,2)))"`
Expected: a run whose steps before `current_step` are `done`.

- [ ] **Step 6: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 887 tests passing

- [ ] **Step 7: Commit**

```bash
git add migrations/add-learnspace-lesson-run.sql "app/api/studylab/[id]/route.ts"
git commit -m "feat(studylab): store the lesson run, deriving one on read where none exists"
```

---

### Task 7: Turn the tutor route into an action dispatcher

The route stops being one endpoint that does everything. It applies a
transition, then calls the one job the new state needs. A refusal returns with
no model call and no spend.

**Files:**
- Modify: `app/api/studylab/tutor/route.ts`
- Test: `app/api/studylab/tutor/route.test.ts` (create)

**Interfaces:**
- Consumes: every export of `lessonRun.ts`, `lessonPolicy.ts`, `lessonJobs.ts`, `stepLocks.ts`.
- Produces: `type LessonAction` (including `{ type: 'draft_plan' }`), `interface DispatchInput`,
  `interface DispatchResult`, `function applyAction(input: DispatchInput): Promise<DispatchResult>`,
  `function draftPlan(input: DraftPlanInput): Promise<LessonStep[]>`; and `POST` accepting
  `{ learnspaceId, action }` and returning `{ run, say, actions, suggestions, refusal? }`.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/studylab/tutor/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { callGemma } from '@/lib/bedrock'
import { applyAction, draftPlan } from './dispatch'
import type { Database } from '@/lib/db'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { emptyRun, proposePlan, acceptPlan, type LessonRun } from '@/lib/studylab/lessonRun'

const GAP = policyFor('gap')

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

function lockedRun(): LessonRun {
  const planned = proposePlan(emptyRun(GAP), [
    { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
    { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [],
      lockedBy: { subtopicId: 7, accuracy: 38 } },
  ])
  if (!planned.ok) throw new Error(planned.reason)
  const started = acceptPlan(planned.run)
  if (!started.ok) throw new Error(started.reason)
  return started.run
}

beforeEach(() => vi.mocked(callGemma).mockReset())

describe('applyAction', () => {
  it('returns a refusal without spending a model call', async () => {
    // Someone hammering skip on a locked step should cost nothing.
    const result = await applyAction({
      run: lockedRun(), policy: GAP, userId: 'u1',
      action: { type: 'skip', stepId: 'b' },
    })
    expect(result.refusal).toContain('38')
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('leaves the run untouched when it refuses', async () => {
    const run = lockedRun()
    const result = await applyAction({
      run, policy: GAP, userId: 'u1', action: { type: 'skip', stepId: 'b' },
    })
    expect(result.run).toEqual(run)
  })

  it('advances a beat and asks the teaching job for cards', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ say: 'Here', actions: [], suggestions: [], awaitUser: true }),
    )
    const result = await applyAction({
      run: lockedRun(), policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(result.run.beats).toBe(1)
    expect(callGemma).toHaveBeenCalledOnce()
  })

  it('changes pace without calling a model', async () => {
    const result = await applyAction({
      run: lockedRun(), policy: GAP, userId: 'u1',
      action: { type: 'set_pace', pace: 'run' },
    })
    expect(result.run.pace).toBe('run')
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('leaves the run untouched when the model output cannot be parsed', async () => {
    // A retry has to be safe, so state must not advance on a failed parse.
    vi.mocked(callGemma).mockResolvedValue('not json at all')
    const run = lockedRun()
    const result = await applyAction({
      run, policy: GAP, userId: 'u1', action: { type: 'next_beat' },
    })
    expect(result.run).toEqual(run)
    expect(result.refusal).toBeTruthy()
  })
})

describe('draftPlan', () => {
  it('turns the model outline into steps with ids', async () => {
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [
        { title: 'Atoms', goal: 'what an atom is' },
        { title: 'Bonding', goal: 'why atoms bond' },
      ] }),
    )
    const steps = await draftPlan({
      title: 'Chemistry', subject: 'Chemistry', policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(steps.map((s) => s.title)).toEqual(['Atoms', 'Bonding'])
    expect(new Set(steps.map((s) => s.id)).size).toBe(2)
  })

  it('drafts on the planning model, not the teaching one', async () => {
    vi.mocked(callGemma).mockResolvedValue(JSON.stringify({ steps: [{ title: 'A', goal: 'g' }] }))
    await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(vi.mocked(callGemma).mock.calls[0][1]).toMatchObject({
      model: 'google.gemma-3-27b-it',
    })
  })

  it('locks a drafted step the learner was measured weak on', async () => {
    // The whole point of attributing subtopics: the gap map decides what may
    // be skipped.
    vi.mocked(callGemma).mockResolvedValue(
      JSON.stringify({ steps: [{ title: 'Bonding', goal: 'g', subtopicId: 7 }] }),
    )
    const steps = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP, userId: 'u1',
      subtopics: [{ id: 7, name: 'Ionic bonding' }],
      database: dbWith([{ subtopic_id: 7, accuracy: 38 }]),
    })
    expect(steps[0].lockedBy).toEqual({ subtopicId: 7, accuracy: 38 })
  })

  it('returns nothing rather than a broken plan when the outline will not parse', async () => {
    vi.mocked(callGemma).mockResolvedValue('sorry, what?')
    const steps = await draftPlan({
      title: 'Chemistry', subject: null, policy: GAP,
      userId: 'u1', subtopics: [], database: dbWith([]),
    })
    expect(steps).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/studylab/tutor/route.test.ts`
Expected: FAIL — `Failed to resolve import "./dispatch"`

- [ ] **Step 3: Write the dispatcher**

Create `app/api/studylab/tutor/dispatch.ts`. It holds the action-to-transition
mapping and the job call, so the route file stays thin and this stays testable
without a request object.

```ts
// app/api/studylab/tutor/dispatch.ts
import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob } from '@/lib/studylab/lessonJobs'
import type { LessonPolicy } from '@/lib/studylab/lessonPolicy'
import {
  nextBeat, passCheck, failCheck, requestTestOut, skipStep, jumpTo,
  setPace, stop, finish, acceptPlan, editPlan,
  type LessonRun, type Transition,
} from '@/lib/studylab/lessonRun'
import type { PlanEdit } from '@/lib/studylab/lessonRun'
import type { Pace } from '@/lib/studylab/lessonPolicy'

export type LessonAction =
  | { type: 'accept_plan' }
  | { type: 'edit_plan'; edit: PlanEdit }
  | { type: 'next_beat' }
  | { type: 'test_out'; stepId: string; checkpointId: string }
  | { type: 'answer_check'; passed: boolean; missed?: string[] }
  | { type: 'skip'; stepId: string }
  | { type: 'jump'; stepId: string }
  | { type: 'set_pace'; pace: Pace }
  | { type: 'stop' }
  | { type: 'finish' }

export interface DispatchInput {
  run: LessonRun
  policy: LessonPolicy
  userId: string | null
  action: LessonAction
  /** Everything the teaching job needs to write its cards. Absent in tests. */
  context?: Record<string, unknown>
  requestId?: string
}

export interface DispatchResult {
  run: LessonRun
  say: string
  actions: unknown[]
  suggestions: string[]
  refusal?: string
}

/** Actions that only move state. None of these is worth a model call. */
function transitionFor(input: DispatchInput): Transition {
  const { run, policy, action } = input
  switch (action.type) {
    case 'accept_plan': return acceptPlan(run)
    case 'edit_plan': return editPlan(run, action.edit, policy)
    case 'next_beat': return nextBeat(run)
    case 'test_out': return requestTestOut(run, action.stepId, action.checkpointId, policy)
    case 'answer_check':
      return action.passed ? passCheck(run) : failCheck(run, action.missed ?? [])
    case 'skip': return skipStep(run, action.stepId, policy)
    case 'jump': return jumpTo(run, action.stepId, policy)
    case 'set_pace': return setPace(run, action.pace)
    case 'stop': return stop(run)
    case 'finish': return finish(run, policy)
  }
}

/** Which actions want the model to produce something afterwards. */
const NEEDS_TEACHING = new Set(['accept_plan', 'next_beat', 'answer_check', 'jump'])

/**
 * Applies one action, then calls the one job the new state requires.
 *
 * A refusal returns immediately with the run untouched and no model call: a
 * learner hammering a locked step should cost nothing. A failed parse likewise
 * leaves state alone, so a retry is always safe.
 */
export async function applyAction(input: DispatchInput): Promise<DispatchResult> {
  const transition = transitionFor(input)
  if (!transition.ok) {
    return { run: input.run, say: '', actions: [], suggestions: [], refusal: transition.reason }
  }

  const advanced = transition.run
  if (!NEEDS_TEACHING.has(input.action.type) || advanced.phase === 'done') {
    return { run: advanced, say: '', actions: [], suggestions: [] }
  }

  const step = advanced.steps[advanced.currentStep]
  if (!step) return { run: advanced, say: '', actions: [], suggestions: [] }

  const raw = await callGemma(buildTeachPrompt(advanced, step, input.context ?? {}), {
    maxTokens: 2600,
    temperature: 0.6,
    model: modelForJob('teach_beat'),
    usage: input.requestId
      ? { feature: 'lesson_teach_beat', requestId: input.requestId, userId: input.userId }
      : undefined,
  })

  let parsed: { say?: unknown; actions?: unknown; suggestions?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
    // State must not advance on a failed parse — the learner retries the same
    // action and gets the same starting point.
    return {
      run: input.run,
      say: '',
      actions: [],
      suggestions: [],
      refusal: 'That did not come through. Try that again.',
    }
  }

  return {
    run: advanced,
    say: typeof parsed?.say === 'string' ? parsed.say : '',
    actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
    suggestions: Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [],
  }
}

/** The teaching prompt, narrowed to one step's goal. */
function buildTeachPrompt(
  run: LessonRun,
  step: { title: string; goal: string },
  context: Record<string, unknown>,
): string {
  return [
    `LESSON: ${String(context.title ?? 'this topic')}`,
    context.subject ? `SUBJECT: ${String(context.subject)}` : '',
    `CURRENT STEP: ${step.title} — ${step.goal}`,
    `BEATS SPENT ON THIS STEP: ${run.beats}`,
    run.pace === 'run'
      ? 'PACE: build the whole step now, then stop.'
      : 'PACE: teach ONE beat — one or two cards — then stop.',
    '',
    'Reply with JSON: { "say": "...", "actions": [...], "suggestions": ["...","..."] }',
  ]
    .filter(Boolean)
    .join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/studylab/tutor/route.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Add the plan job to `dispatch.ts`**

```ts
export interface DraftPlanInput {
  title: string
  subject: string | null
  policy: LessonPolicy
  userId: string | null
  /** Curriculum subtopics available to attribute steps to. May be empty. */
  subtopics: { id: number; name: string }[]
  database?: Database
  requestId?: string
}

/**
 * Drafts the outline, then lets the gap map decide what may be skipped.
 *
 * Attribution is the reason subtopics are handed to the model at all: a step
 * that names its subtopic can be matched against `topic_mastery`, and that
 * match is what turns a measurement into a lock. A step the model cannot
 * attribute simply stays unlocked.
 */
export async function draftPlan(input: DraftPlanInput): Promise<LessonStep[]> {
  const { min, max } = input.policy.planSize
  const catalogue = input.subtopics.length
    ? `\nCURRICULUM SUBTOPICS (attribute each step to one by id where it fits):\n${
        input.subtopics.map((s) => `  ${s.id}: ${s.name}`).join('\n')
      }`
    : ''

  const prompt = [
    `Draft a lesson outline for: ${input.title}`,
    input.subject ? `Subject: ${input.subject}` : '',
    `Between ${min} and ${max} steps, ordered so each builds on the last.`,
    catalogue,
    '',
    'Reply with JSON only:',
    '{ "steps": [ { "title": "...", "goal": "one line on what this step teaches", "subtopicId": <id or omit> } ] }',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await callGemma(prompt, {
    maxTokens: 700,
    temperature: 0.4,
    model: modelForJob('plan'),
    usage: input.requestId
      ? { feature: 'lesson_plan', requestId: input.requestId, userId: input.userId }
      : undefined,
  })

  let parsed: { steps?: unknown }
  try {
    parsed = parseJsonRobust(raw)
  } catch {
    // No plan is better than a broken one: the learner is asked again rather
    // than shown an outline built from noise.
    return []
  }

  const steps: LessonStep[] = (Array.isArray(parsed?.steps) ? parsed.steps : [])
    .map((raw: unknown, i: number): LessonStep | null => {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as { title?: unknown; goal?: unknown; subtopicId?: unknown }
      const title = typeof r.title === 'string' ? r.title.trim() : ''
      if (!title) return null
      const subtopicId = Number(r.subtopicId)
      return {
        id: `s${i + 1}`,
        title,
        goal: typeof r.goal === 'string' ? r.goal : '',
        status: 'pending',
        cardIds: [],
        ...(Number.isInteger(subtopicId) && subtopicId > 0 ? { subtopicId } : {}),
      }
    })
    .filter((s): s is LessonStep => s !== null)

  if (steps.length === 0 || !input.userId) return steps
  return applyLocks(steps, input.userId, input.database)
}
```

Add to `LessonAction`: `| { type: 'draft_plan' }`. Add these imports to
`dispatch.ts`:

```ts
import { applyLocks } from '@/lib/studylab/stepLocks'
import { proposePlan, type LessonStep } from '@/lib/studylab/lessonRun'
import type { Database } from '@/lib/db'
```

In `transitionFor`, `draft_plan` returns `proposePlan(run, [])` — the steps are
filled by the route once `draftPlan` resolves, because a transition stays pure.

- [ ] **Step 6: Wire the route to the dispatcher**

Replace the body of `POST` in `app/api/studylab/tutor/route.ts` with:

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const learnspaceId = String(body?.learnspaceId ?? '').trim()
    const action = body?.action
    if (!learnspaceId || !action?.type) {
      return NextResponse.json({ error: 'A learnspace and an action are required' }, { status: 400 })
    }

    const { rows } = await db.query('SELECT * FROM learnspaces WHERE id = $1 LIMIT 1', [learnspaceId])
    const space = rows[0]
    if (!space) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const userId = space.user_id ? String(space.user_id) : null
    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'studylab')
      if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    }

    const policy = policyFor(space.origin)
    const run: LessonRun =
      space.lesson_run ??
      runFromLegacy(
        { plan: space.canvas_state?.plan ?? null, currentStep: space.current_step, status: space.status },
        policy,
      )

    const requestId = randomUUID()

    // Drafting is the one action that produces its steps before the
    // transition, since a transition has to stay pure.
    if (action.type === 'draft_plan') {
      const subtopics = await loadSubtopics(space)
      const steps = await draftPlan({
        title: String(space.title ?? ''),
        subject: space.subject ? String(space.subject) : null,
        policy, userId, subtopics, requestId,
      })
      const planned = proposePlan(run, steps)
      const next = planned.ok ? planned.run : run
      await saveRun(learnspaceId, next)
      return NextResponse.json({
        run: next,
        say: steps.length ? '' : 'I could not draft that outline — try again.',
        actions: [],
        suggestions: [],
        refusal: steps.length ? undefined : 'Could not draft a plan.',
      })
    }

    const result = await applyAction({ run, policy, userId, action, requestId,
      context: { title: space.title, subject: space.subject } })
    if (!result.refusal) await saveRun(learnspaceId, result.run)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Tutor dispatch failed:', error)
    return NextResponse.json({ error: 'Tutor request failed' }, { status: 500 })
  }
}

/** Persists just the run. Last write wins, matching how canvas_state behaves. */
async function saveRun(learnspaceId: string, run: LessonRun): Promise<void> {
  await db.query('UPDATE learnspaces SET lesson_run = $1::jsonb, updated_at = NOW() WHERE id = $2', [
    jsonbParam(run),
    learnspaceId,
  ])
}

/** The subtopics a step can be attributed to. Empty for a scratch lesson. */
async function loadSubtopics(space: Record<string, unknown>): Promise<{ id: number; name: string }[]> {
  const topicId = Number(space.topic_id)
  if (!Number.isInteger(topicId) || topicId <= 0) return []
  const { rows } = await db.query(
    'SELECT subtopic_id, subtopic FROM subtopics WHERE topic_id = $1 ORDER BY subtopic',
    [topicId],
  )
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.subtopic_id),
    name: String(r.subtopic),
  }))
}
```

Add the imports this needs at the top of the route:

```ts
import { randomUUID } from 'crypto'
import { jsonbParam } from '@/lib/pg-json'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { runFromLegacy } from '@/lib/studylab/lessonRunMigrate'
import { proposePlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { applyAction, draftPlan } from './dispatch'
```

- [ ] **Step 7: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 896 tests passing

- [ ] **Step 8: Commit**

```bash
git add app/api/studylab/tutor/route.ts app/api/studylab/tutor/dispatch.ts app/api/studylab/tutor/route.test.ts
git commit -m "feat(studylab): the tutor route dispatches actions instead of guessing"
```

---

### Task 8: The plan rail

The sidebar becomes the plan surface: status per step, a test-out control where
the policy allows one, and the reason a step is locked where it does not.

The decision of *what each row offers* is a pure function, tested on its own.
This repo has no component-test infrastructure — vitest runs in `node`, there
is no jsdom and no testing-library, and not one `.test.tsx` exists. Adding that
stack is real work unrelated to this feature, and the logic worth testing here
is the policy branching, not React.

**Files:**
- Create: `lib/studylab/planRail.ts`
- Test: `lib/studylab/planRail.test.ts`
- Modify: `components/studylab/StudyLabSidebar.tsx`

**Interfaces:**
- Consumes: `LessonRun`, `LessonStep`, `StepStatus` from `./lessonRun`; `LessonPolicy` from `./lessonPolicy`.
- Produces: `interface RailStep`, `function railSteps(run: LessonRun | null, policy: LessonPolicy): RailStep[]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/planRail.test.ts
import { describe, it, expect } from 'vitest'
import { railSteps } from './planRail'
import { policyFor } from './lessonPolicy'
import type { LessonRun } from './lessonRun'

const run: LessonRun = {
  phase: 'teaching', pace: 'step', currentStep: 0, beats: 0, awaiting: false,
  steps: [
    { id: 'a', title: 'Atoms', goal: 'g', status: 'teaching', cardIds: [] },
    { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [],
      lockedBy: { subtopicId: 7, accuracy: 38 } },
    { id: 'c', title: 'Shapes', goal: 'g', status: 'pending', cardIds: [] },
    { id: 'd', title: 'Naming', goal: 'g', status: 'known', cardIds: [] },
  ],
}

const GAP = policyFor('gap')
const OPEN = policyFor('scratch')

describe('railSteps', () => {
  it('shows the measurement on a locked step whichever policy applies', () => {
    // Information either way; only what it does differs.
    expect(railSteps(run, GAP)[1].measured).toBe(38)
    expect(railSteps(run, OPEN)[1].measured).toBe(38)
  })

  it('offers no test-out on a locked step in a gap lesson', () => {
    expect(railSteps(run, GAP)[1].canTestOut).toBe(false)
  })

  it('offers test-out on the same step in an open lesson', () => {
    // Same step, same measurement, different policy.
    expect(railSteps(run, OPEN)[1].canTestOut).toBe(true)
  })

  it('offers test-out on an unlocked pending step under either policy', () => {
    expect(railSteps(run, GAP)[2].canTestOut).toBe(true)
    expect(railSteps(run, OPEN)[2].canTestOut).toBe(true)
  })

  it('never offers test-out on the step being taught', () => {
    expect(railSteps(run, GAP)[0].canTestOut).toBe(false)
  })

  it('never offers test-out on a step already settled', () => {
    expect(railSteps(run, OPEN)[3].canTestOut).toBe(false)
  })

  it('marks which step is current', () => {
    expect(railSteps(run, GAP).map((r) => r.current)).toEqual([true, false, false, false])
  })

  it('returns nothing for a lesson with no run yet', () => {
    expect(railSteps(null, OPEN)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/studylab/planRail.test.ts`
Expected: FAIL — `Failed to resolve import "./planRail"`

- [ ] **Step 3: Write the implementation**

```ts
// lib/studylab/planRail.ts
import type { LessonPolicy } from './lessonPolicy'
import type { LessonRun, StepStatus } from './lessonRun'

/**
 * What each row of the plan rail offers.
 *
 * Kept out of the component so the policy branching can be tested without a
 * DOM. `measured` is populated whichever policy applies — an open lesson still
 * tells the learner what the measurement said, it just does not stop them.
 */
export interface RailStep {
  id: string
  title: string
  status: StepStatus
  /** Measured accuracy to display, or null when nothing was measured. */
  measured: number | null
  /** Whether to offer "I know this". */
  canTestOut: boolean
  /** Whether this is the step being taught. */
  current: boolean
}

export function railSteps(run: LessonRun | null, policy: LessonPolicy): RailStep[] {
  if (!run) return []
  return run.steps.map((step, i) => {
    const gated = Boolean(step.lockedBy) && policy.gaps === 'lock'
    return {
      id: step.id,
      title: step.title,
      status: step.status,
      measured: step.lockedBy?.accuracy ?? null,
      // Only a step still waiting can be tested out of: the current step is
      // already being taught, and a settled one has nothing left to prove.
      canTestOut: step.status === 'pending' && !gated,
      current: i === run.currentStep,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/studylab/planRail.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Render it in the sidebar**

Add to `StudyLabSidebarProps` in `components/studylab/StudyLabSidebar.tsx`:

```tsx
  run?: LessonRun | null
  policy: LessonPolicy
  onTestOut: (stepId: string) => void
  onJump: (stepId: string) => void
  onSetPace: (pace: Pace) => void
```

Import them:

```tsx
import { railSteps } from '@/lib/studylab/planRail'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import type { LessonPolicy, Pace } from '@/lib/studylab/lessonPolicy'
```

Then, where the component currently does `plan!.map((p, i) => ...)`, branch: use
`railSteps(run, policy)` when it returns rows, and fall back to the existing
`plan` rendering when it returns none, so a lesson that has not converted yet
still shows its roadmap. Each rail row renders:

```tsx
{railSteps(run ?? null, policy).map((step) => (
  <li key={step.id} className="px-3 py-2">
    <button
      type="button"
      onClick={() => onJump(step.id)}
      className={`block w-full text-left text-[13px] font-semibold ${
        step.current ? 'text-white' : 'text-gray-300 hover:text-white'
      }`}
    >
      {step.title}
    </button>

    {step.measured !== null && (
      <span className="mt-0.5 block text-[12px] font-medium text-ss-warn">
        measured {step.measured}%
      </span>
    )}

    {step.canTestOut && (
      <button
        type="button"
        aria-label={`Test out of ${step.title}`}
        onClick={() => onTestOut(step.id)}
        className="mt-1 rounded-lg px-2 py-1 text-[12px] font-bold text-ss-accent hover:bg-[color:var(--ss-accent)]/15"
      >
        I know this
      </button>
    )}
  </li>
))}
```

Add the pace toggle to the rail header:

```tsx
{run && (
  <div className="flex gap-1 px-3 pb-2">
    {(['step', 'run'] as const).map((p) => (
      <button
        key={p}
        type="button"
        onClick={() => onSetPace(p)}
        aria-pressed={run.pace === p}
        className={`rounded-lg px-2 py-1 text-[12px] font-bold ${
          run.pace === p ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        {p === 'step' ? 'Step by step' : 'Run ahead'}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 6: Check the guardrails this file must satisfy**

Run: `npx vitest run lib/type-scale.test.ts lib/palette-escapes.test.ts`
Expected: PASS. No text below 12px; no raw Tailwind palette classes — note the
`bg-[color:var(--ss-accent)]/15` form, because `bg-ss-accent/15` emits nothing
for a CSS-variable colour and renders the hover invisible.

- [ ] **Step 7: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 904 tests passing

- [ ] **Step 8: Commit**

```bash
git add lib/studylab/planRail.ts lib/studylab/planRail.test.ts components/studylab/StudyLabSidebar.tsx
git commit -m "feat(studylab): make the rail the plan surface"
```

---

### Task 9: Wire the workspace

The lesson stops starting itself. It loads its run, shows the proposed plan, and
sends actions.

**Files:**
- Modify: `components/studylab/Workspace.tsx`

**Interfaces:**
- Consumes: the GET `lesson_run` from Task 6; `applyAction`'s response shape from Task 7; the sidebar props from Task 8.
- Produces: nothing other modules consume.

- [ ] **Step 1: Stop the auto-start**

Replace the auto-start effect (around `Workspace.tsx:517`) so it only fires a
`plan` job when the loaded run is in `planning` with no steps:

```tsx
  // The lesson no longer starts itself. A space with a run already in progress
  // resumes it; one that has never been planned asks for a plan and nothing
  // else, so no cards exist until the learner has agreed to the outline.
  useEffect(() => {
    if (!loaded || !space || startedRef.current || loadError) return
    startedRef.current = true
    if (run && run.phase === 'planning' && run.steps.length === 0) {
      void sendAction({ type: 'draft_plan' })
    }
  }, [loaded, space, loadError, run, sendAction])
```

- [ ] **Step 2: Add the action sender**

```tsx
  const sendAction = useCallback(
    async (action: Record<string, unknown>) => {
      const res = await fetch('/api/studylab/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnspaceId: id, action }),
      })
      const body = await res.json()
      if (body.refusal) {
        // A refusal is a sentence in the tutor's voice, not an error toast.
        setMessages((m) => [...m, { role: 'assistant', content: body.refusal }])
        return
      }
      if (body.run) setRun(body.run)
      if (body.say || body.actions?.length) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: body.say ?? '', actions: body.actions, suggestions: body.suggestions },
        ])
        applyTutorActions(body.actions ?? [])
      }
    },
    [id, applyTutorActions],
  )
```

- [ ] **Step 3: Pass the run to the sidebar**

```tsx
  <StudyLabSidebar
    title={space.title}
    subject={space.subject}
    currentStep={currentStep}
    groups={groups}
    plan={plan}
    cardCount={nodes.length}
    run={run}
    policy={policy}
    onBack={() => router.push('/studylab')}
    onFocusGroup={focusGroup}
    onTestOut={(stepId) => void sendAction({ type: 'test_out', stepId, checkpointId: `to-${stepId}` })}
    onSkip={(stepId) => void sendAction({ type: 'skip', stepId })}
    onJump={(stepId) => void sendAction({ type: 'jump', stepId })}
    onSetPace={(pace) => void sendAction({ type: 'set_pace', pace })}
  />
```

- [ ] **Step 4: Verify in the running app**

Run `npm run dev`, open an existing LearnSpace, and check: the rail shows step
statuses; a locked step in a gap lesson shows its percentage and offers no
"I know this"; the same lesson opened from scratch offers it. Confirm no cards
are built on a brand-new space until the plan is accepted.

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 904 tests passing

- [ ] **Step 6: Commit**

```bash
git add components/studylab/Workspace.tsx
git commit -m "feat(studylab): the lesson waits to be told what to build"
```

---

### Task 10: Shed the rules the code now enforces

The prompt loses every rule whose only job was to police control flow.

**Files:**
- Modify: `app/api/studylab/tutor/route.ts` — the `SYSTEM` string

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Record the starting size**

Run: `awk '/^const SYSTEM = /,/^`$/' app/api/studylab/tutor/route.ts | wc -l`
Expected: 353

- [ ] **Step 2: Delete the control-flow rules**

Remove from the `SYSTEM` string:

- **Rule 1** (first turn drafts the plan) — the `plan` job does this now.
- **Rule 3a** (never repeat a checkpoint) — `beginCheck` refuses a second open check.
- **Rule 7** (STEP DISCIPLINE, never skip or jump) — `jumpTo` and `skipStep` decide this, and in an open lesson skipping is now correct.
- **Rule 13** (only finish after the last checkpoint) — `finish` enforces it per policy.
- The `"plan"` and `"step"` keys from the response schema, and the `LESSON PLAN` paragraph.

Keep everything about card types, LaTeX, connecting cards, and checkpoint
question shapes. Those describe *what good teaching output looks like*, which is
still the model's job.

- [ ] **Step 3: Confirm the reduction**

Run: `awk '/^const SYSTEM = /,/^`$/' app/api/studylab/tutor/route.ts | wc -l`
Expected: under 250 lines

- [ ] **Step 4: Confirm the removed rules are gone**

Run: `grep -cE "STEP DISCIPLINE|never skip|NEVER repeat a checkpoint" app/api/studylab/tutor/route.ts`
Expected: `0`

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/" ; npx vitest run`
Expected: no tsc output; 904 tests passing

- [ ] **Step 6: Commit**

```bash
git add app/api/studylab/tutor/route.ts
git commit -m "refactor(studylab): drop the prompt rules the state machine now enforces"
```

---

## Verification

After Task 10, confirm the whole feature end to end:

- [ ] A brand-new scratch LearnSpace proposes a plan and builds **no cards** until accepted.
- [ ] Editing that plan mid-lesson works.
- [ ] A gap LearnSpace shows its locked step with a percentage and refuses to skip it.
- [ ] "I know this" on an unlocked step opens a check; passing collapses the step, failing teaches it.
- [ ] Switching pace to `run` builds a whole step before pausing.
- [ ] An existing LearnSpace opened for the first time since Task 6 shows a sensible run derived from its old plan.
- [ ] `SELECT feature, COUNT(*) FROM ai_usage_events GROUP BY 1` shows `lesson_teach_beat` rows.
- [ ] `npx vitest run` green (904 tests), `npx tsc --noEmit` clean.
