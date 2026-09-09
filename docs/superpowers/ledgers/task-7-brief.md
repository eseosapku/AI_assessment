### Task 7: The composite gate

One function the rest of the system will call, so no caller has to remember the order or the three separate refusals.

**Files:**
- Create: `lib/studylab/material/validate.ts`
- Test: `lib/studylab/material/validate.test.ts`

**Interfaces:**
- Consumes: `parseMaterialSpec` (Task 1), `hasCycle` (Task 3), `checkIsolation` (Task 4), `fitsInBox` (Task 5), `isSolvable` (Task 6).
- Produces: `validateMaterial(raw: unknown, maxVarying?: number): { ok: true; spec: MaterialSpec } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/studylab/material/validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateMaterial } from './validate'

const sortSpec = {
  prompt: 'Sort them.',
  pieces: [
    { id: 'hcl', label: 'HCl', traits: { home: 'acid' } },
    { id: 'koh', label: 'KOH', traits: { home: 'base' } },
  ],
  groups: [{ id: 'acid', label: 'Acid', ordered: false }, { id: 'base', label: 'Base', ordered: false }],
  slots: [
    { id: 's-acid', groupId: 'acid', x: 0, y: 0, capacity: 4 },
    { id: 's-base', groupId: 'base', x: 1, y: 0, capacity: 4 },
  ],
  rules: [],
  goal: { kind: 'binAssignment', assign: { hcl: 'acid', koh: 'base' } },
}

describe('validateMaterial', () => {
  it('passes a material that is well formed, isolating, drawable and solvable', () => {
    const r = validateMaterial(sortSpec, 1)
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.spec.pieces).toHaveLength(2)
  })

  it('refuses malformed output first, before the expensive checks', () => {
    const r = validateMaterial({ pieces: 'two' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toMatch(/could not be read/i)
  })

  it('refuses a cyclic rule set', () => {
    const cyclic = { ...sortSpec, rules: [{ op: 'derive', name: 'x', expr: 'x + 1' }] }
    const r = validateMaterial(cyclic, 1)
    expect(r.ok === false && r.reason).toMatch(/cycle/i)
  })

  it('refuses one that varies more than it claims to isolate, naming the traits', () => {
    const twoWay = { ...sortSpec, pieces: [
      { id: 'hcl', label: 'HCl', traits: { home: 'acid', colour: 'red' } },
      { id: 'koh', label: 'KOH', traits: { home: 'base', colour: 'blue' } },
    ] }
    const r = validateMaterial(twoWay, 1)
    expect(r.ok === false && r.reason).toContain('colour')
  })

  it('refuses one that cannot be finished, and says so in those words', () => {
    const stuck = { ...sortSpec, goal: { kind: 'binAssignment', assign: { hcl: 'nowhere' } } }
    const r = validateMaterial(stuck, 1)
    expect(r.ok === false && r.reason).toMatch(/cannot be completed/i)
  })

  it('gives a reason specific enough for the next attempt to act on', () => {
    // A refusal that only says "invalid" produces the same material again.
    const r = validateMaterial({ ...sortSpec, goal: { kind: 'binAssignment', assign: { hcl: 'nowhere' } } }, 1)
    expect(r.ok === false && r.reason.length).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/studylab/material/validate`
Expected: FAIL with `Failed to resolve import "./validate"`.

- [ ] **Step 3: Write `lib/studylab/material/validate.ts`**

Run the checks cheapest-first: parse, then cycle, then isolation, then fit, then solvability. Each refusal returns a sentence naming what is wrong and what would fix it, in the voice of `checkIntent` in `lib/studylab/activities/intent.ts`. Default `maxVarying` to 1.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/studylab/material/validate`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/material/validate.ts lib/studylab/material/validate.test.ts
git commit -m "feat(studylab): one gate a material passes before anyone sees it

Cheapest check first, and every refusal names what would fix it — a
refusal that only says invalid produces the same material again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

