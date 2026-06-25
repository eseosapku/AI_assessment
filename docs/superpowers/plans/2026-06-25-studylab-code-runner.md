# StudyLab Code Runner Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make StudyLab `code` cards actually execute — real, client-side, no backend — with output/terminals: HTML/CSS/JS live preview, JavaScript in a Web Worker, and Python via Pyodide, plus a reusable canvas primitive for cards to edit and persist their own data.

**Architecture:** A small `lib/studylab/runner/` module exposes one `RunEngine` interface with lazily-loaded engines (js worker, python worker, web iframe). The static `CodeNode` is replaced by an interactive `RunnableCodeCard` with an editable code area, Run/Stop, and an output pane. Cards mutate their own `data` through a new `onNodeDataChange` callback threaded via `CanvasContext` → `StudyCanvas` → `Workspace`, which persists through the existing autosave. Execution engines run in terminable Web Workers (JS, Python) so infinite loops can be killed; web preview runs in a sandboxed iframe.

**Tech Stack:** Next.js 16, React 18, TypeScript (strict), `@xyflow/react` v12, Vitest, Web Workers (inline Blob), Pyodide (CDN, no npm dep), sandboxed iframe. **No new npm dependencies.**

## Global Constraints

- Path alias `@/*` maps to repo root (`./*`). Use `@/lib/...`, `@/components/...`.
- TypeScript `strict` is on. No `any` in new code unless mirroring an existing cast (`isValidAction(a: any)` is baseline).
- Pure-logic modules (`lib/studylab/runner/languages.ts`, `lib/studylab/runner/serialize.ts`, `lib/studylab/actions.ts`, `lib/studylab/blocks.ts`) must NOT import React or browser/canvas/`@xyflow/react` code, so they stay unit-testable in Node.
- **No new npm dependencies.** JS engine = inline Blob Worker; Python engine = Pyodide loaded from `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` inside a worker; web preview = `<iframe srcdoc sandbox="allow-scripts">`; editor = `<textarea>`.
- Every run must be cancellable: workers are terminated on Stop and on a timeout (default 10s). Output is text-escaped before render (React handles this for text nodes; never use `dangerouslySetInnerHTML` for program output).
- The verification gate is `npx tsc --noEmit` (clean) + `npm test` (all green). `npm run lint` is UNAVAILABLE in this project (Next 16 removed `next lint`); do not use it.
- Commit after each task. Commit messages: imperative mood, ending with the trailer below.

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

- This plan is **Phase 3** of `docs/superpowers/specs/2026-06-25-studylab-tutor-expansion-design.md`. Phases 4–6 (palette, checkpoints, tutor upgrades) are separate plans.
- Documented deviation from spec: the spec named CodeMirror for the editor; this phase uses a `<textarea>` (zero new deps, lighter alongside Pyodide). Syntax highlighting is a deferred follow-up. SQL engine remains stubbed/out of scope.

---

### Task 1: Runner core — languages + serialization (pure, TDD)

The testable heart of the runner: language normalization (so `js`/`py`/`html` aliases map correctly and the card knows when to show Run) and a console-argument serializer (so the JS worker can turn `console.log(obj)` args into readable text).

**Files:**
- Create: `lib/studylab/runner/types.ts`
- Create: `lib/studylab/runner/languages.ts`
- Create: `lib/studylab/runner/serialize.ts`
- Test: `lib/studylab/runner/languages.test.ts`
- Test: `lib/studylab/runner/serialize.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type RunLanguage = 'web' | 'javascript' | 'python'`
  - `interface RunResult { ok: boolean; stdout: string; stderr: string; previewHtml?: string }`
  - `interface RunEngine { language: RunLanguage; run(code: string, signal: AbortSignal): Promise<RunResult> }`
  - `function normalizeLanguage(lang: string | undefined): RunLanguage | null` — maps `html`/`css`/`web`→`web`, `js`/`javascript`/`typescript`/`ts`→`javascript`, `py`/`python`→`python`; everything else → `null`.
  - `function isRunnable(lang: string | undefined): boolean` — `normalizeLanguage(lang) !== null`.
  - `function serializeArg(value: unknown): string` — turns one console argument into a display string (strings as-is, objects/arrays JSON-stringified with 2-space indent, `undefined`→`'undefined'`, functions→`'[Function]'`, circular refs→`'[Circular]'`).

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/runner/languages.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeLanguage, isRunnable } from '@/lib/studylab/runner/languages'

describe('normalizeLanguage', () => {
  it('maps web aliases', () => {
    expect(normalizeLanguage('html')).toBe('web')
    expect(normalizeLanguage('css')).toBe('web')
    expect(normalizeLanguage('web')).toBe('web')
  })
  it('maps javascript aliases (incl. ts)', () => {
    expect(normalizeLanguage('js')).toBe('javascript')
    expect(normalizeLanguage('javascript')).toBe('javascript')
    expect(normalizeLanguage('ts')).toBe('javascript')
    expect(normalizeLanguage('typescript')).toBe('javascript')
  })
  it('maps python aliases', () => {
    expect(normalizeLanguage('py')).toBe('python')
    expect(normalizeLanguage('python')).toBe('python')
  })
  it('is case- and whitespace-insensitive', () => {
    expect(normalizeLanguage('  Python ')).toBe('python')
  })
  it('returns null for unknown or missing', () => {
    expect(normalizeLanguage('rust')).toBeNull()
    expect(normalizeLanguage(undefined)).toBeNull()
    expect(normalizeLanguage('')).toBeNull()
  })
  it('isRunnable reflects normalizeLanguage', () => {
    expect(isRunnable('python')).toBe(true)
    expect(isRunnable('rust')).toBe(false)
    expect(isRunnable(undefined)).toBe(false)
  })
})
```

Create `lib/studylab/runner/serialize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { serializeArg } from '@/lib/studylab/runner/serialize'

describe('serializeArg', () => {
  it('passes strings through', () => {
    expect(serializeArg('hi')).toBe('hi')
  })
  it('stringifies numbers and booleans', () => {
    expect(serializeArg(42)).toBe('42')
    expect(serializeArg(true)).toBe('true')
  })
  it('handles undefined and null', () => {
    expect(serializeArg(undefined)).toBe('undefined')
    expect(serializeArg(null)).toBe('null')
  })
  it('pretty-prints objects and arrays', () => {
    expect(serializeArg({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(serializeArg([1, 2])).toBe('[\n  1,\n  2\n]')
  })
  it('labels functions', () => {
    expect(serializeArg(() => {})).toBe('[Function]')
  })
  it('survives circular references', () => {
    const o: any = {}
    o.self = o
    expect(serializeArg(o)).toBe('[Circular]')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- runner`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three modules**

Create `lib/studylab/runner/types.ts`:
```ts
export type RunLanguage = 'web' | 'javascript' | 'python'

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  /** For the web engine: the HTML document to render in a sandboxed iframe. */
  previewHtml?: string
}

export interface RunEngine {
  language: RunLanguage
  run(code: string, signal: AbortSignal): Promise<RunResult>
}
```

Create `lib/studylab/runner/languages.ts`:
```ts
import type { RunLanguage } from './types'

const ALIASES: Record<string, RunLanguage> = {
  html: 'web', css: 'web', web: 'web',
  js: 'javascript', javascript: 'javascript', ts: 'javascript', typescript: 'javascript',
  py: 'python', python: 'python',
}

export function normalizeLanguage(lang: string | undefined): RunLanguage | null {
  if (!lang) return null
  return ALIASES[lang.trim().toLowerCase()] ?? null
}

export function isRunnable(lang: string | undefined): boolean {
  return normalizeLanguage(lang) !== null
}
```

Create `lib/studylab/runner/serialize.ts`:
```ts
// Turn one console argument into a human-readable string for the terminal pane.
export function serializeArg(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return '[Function]'
  if (typeof value !== 'object' || value === null) return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[Circular]'
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- runner`
Expected: PASS — all language + serialize tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/studylab/runner/types.ts lib/studylab/runner/languages.ts lib/studylab/runner/serialize.ts lib/studylab/runner/languages.test.ts lib/studylab/runner/serialize.test.ts
git commit -m "feat(studylab): runner core — language normalization + console serialization"
```

---

### Task 2: Make `autoPosition` block-size aware (pure, TDD)

Closes the foundation review carry: `autoPosition` assumes a uniform 300×200 footprint, but the runnable code card and later blocks are larger. Make occupied-rect computation read each node's real size from the registry, and let the caller pass the new card's type so the candidate footprint is correct.

**Files:**
- Modify: `lib/studylab/actions.ts` (`autoPosition` signature + body; its two call sites)
- Test: `lib/studylab/actions.placement.test.ts` (extend existing file)

**Interfaces:**
- Consumes: `blockSize` from `@/lib/studylab/blocks`.
- Produces: `export function autoPosition(nodes: StudyNode[], step: number, type?: string): { x: number; y: number }` — `type` defaults to `'concept'` (300×200) for back-compat; occupied rects use `blockSize(n.type)`, candidate footprint uses `blockSize(type)`.

- [ ] **Step 1: Write the failing tests (append to the existing placement test file)**

Add to `lib/studylab/actions.placement.test.ts`:
```ts
describe('autoPosition block-size awareness', () => {
  it('uses the real size of existing nodes when testing overlap', () => {
    // A 480-wide frame at slot 0 should push a new card past column 1 too,
    // because the frame overlaps both slot 0 (x=0) and slot 1 (x=356).
    const frame: StudyNode = { id: 'f', type: 'frame' as any, position: { x: 0, y: 460 }, data: { kind: 'concept', step: 1 } }
    const pos = autoPosition([frame], 1, 'concept')
    expect(pos.x).toBe(712) // column 2, since the 480px frame overlaps columns 0 and 1
    expect(pos.y).toBe(460)
  })

  it('still places a lone concept card at slot 0', () => {
    expect(autoPosition([], 1, 'concept')).toEqual({ x: 0, y: 460 })
  })

  it('defaults type to concept when omitted (back-compat)', () => {
    expect(autoPosition([], 2)).toEqual({ x: 0, y: 920 })
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- actions.placement`
Expected: FAIL — the 480-wide frame case returns `x: 356` (current code treats every node as 300 wide, so the frame only blocks slot 0).

- [ ] **Step 3: Update `autoPosition`**

In `lib/studylab/actions.ts`:
- Add import at the top: `import { blockSize } from './blocks'`
- Replace the `autoPosition` function with:
```ts
// Return the first 3-column grid slot in this step's band whose rectangle (sized
// for `type`) does not overlap any visible, non-group node's real footprint.
export function autoPosition(
  nodes: StudyNode[],
  step: number,
  type: string = 'concept'
): { x: number; y: number } {
  const occupied = nodes
    .filter((n) => n.type !== 'stepGroup' && !n.hidden)
    .map((n) => {
      const s = blockSize(n.type)
      return { x: n.position.x, y: n.position.y, w: s.w, h: s.h }
    })
  const size = blockSize(type)
  const bandY = step * STEP_BAND
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col < 3; col++) {
      const cand = { x: col * SLOT_W, y: bandY + row * SLOT_H, w: size.w, h: size.h }
      if (!occupied.some((o) => rectsOverlap(cand, o))) {
        return { x: cand.x, y: cand.y }
      }
    }
  }
  return { x: 0, y: bandY }
}
```
(Keep the existing `CARD_W`, `CARD_H`, `SLOT_W`, `SLOT_H`, `STEP_BAND`, `rectsOverlap` definitions. `SLOT_W`/`SLOT_H` still define the grid pitch.)

- [ ] **Step 4: Pass the card type at the call sites**

In `lib/studylab/actions.ts`:
- In the `createCard` case, change `autoPosition(nodes, step)` to `autoPosition(nodes, step, action.card)`.
- In `createImageCard`, change `autoPosition(state.nodes, opts.step)` to `autoPosition(state.nodes, opts.step, 'image')`.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS (including the original placement tests, which use concept-sized cards and are unaffected); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/actions.ts lib/studylab/actions.placement.test.ts
git commit -m "fix(studylab): make autoPosition block-size aware so larger cards don't overlap"
```

---

### Task 3: Execution engines + lazy dispatch (browser)

The three engines behind the `RunEngine` interface, plus a lazy `getEngine` that constructs an engine only when first needed (so Pyodide never loads until a student runs Python). Browser code; verified by tsc + the Task 5 manual run.

**Files:**
- Create: `lib/studylab/runner/jsEngine.ts`
- Create: `lib/studylab/runner/pythonEngine.ts`
- Create: `lib/studylab/runner/webEngine.ts`
- Create: `lib/studylab/runner/index.ts`

**Interfaces:**
- Consumes: `RunEngine`, `RunResult`, `RunLanguage` from `./types`; `serializeArg` from `./serialize`; `normalizeLanguage` from `./languages`.
- Produces: `function getEngine(language: RunLanguage): RunEngine` (returns a cached engine per language). The web engine's `run` returns `{ ok: true, stdout: '', stderr: '', previewHtml: <code> }` (the card renders the iframe). JS and Python engines run code in a terminable Web Worker and resolve `{ ok, stdout, stderr }`.

**Implementation spec (this is a standard-model task — follow the contracts; full skeletons below):**

- [ ] **Step 1: Web engine**

Create `lib/studylab/runner/webEngine.ts`:
```ts
import type { RunEngine } from './types'

// Web preview is rendered by the card as a sandboxed iframe; the engine just
// packages the student's HTML (which may contain <style>/<script>) as previewHtml.
export const webEngine: RunEngine = {
  language: 'web',
  async run(code: string): Promise<{ ok: boolean; stdout: string; stderr: string; previewHtml: string }> {
    return { ok: true, stdout: '', stderr: '', previewHtml: code }
  },
}
```

- [ ] **Step 2: JS engine (inline Blob Web Worker, terminable)**

Create `lib/studylab/runner/jsEngine.ts`. The engine builds a worker from a Blob whose script: overrides `console.log/info/warn/error` to post serialized output back, evaluates the user code (wrapped in an async IIFE), posts a `done`/`error` message. The host side collects stdout/stderr, enforces a 10s timeout, terminates the worker on timeout/abort, and resolves a `RunResult`.

```ts
import type { RunEngine, RunResult } from './types'
import { serializeArg } from './serialize'

const WORKER_SRC = `
const out = [];
const err = [];
const fmt = (args) => args.map(serializeArg).join(' ');
${serializeArg.toString()}
const realLog = (kind, args) => (kind === 'error' ? err : out).push(fmt(args));
self.console = {
  log: (...a) => realLog('log', a),
  info: (...a) => realLog('log', a),
  warn: (...a) => realLog('log', a),
  error: (...a) => realLog('error', a),
  debug: (...a) => realLog('log', a),
};
self.onmessage = async (e) => {
  try {
    const fn = new Function('return (async () => {' + e.data + '\\n})()');
    await fn();
    self.postMessage({ type: 'done', stdout: out.join('\\n'), stderr: err.join('\\n') });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: out.join('\\n'), stderr: String(ex && ex.stack || ex) });
  }
};
`

const TIMEOUT_MS = 10_000

export const jsEngine: RunEngine = {
  language: 'javascript',
  run(code: string, signal: AbortSignal): Promise<RunResult> {
    return new Promise((resolve) => {
      const blob = new Blob([WORKER_SRC], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      const worker = new Worker(url)
      let settled = false
      const finish = (r: RunResult) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.terminate()
        URL.revokeObjectURL(url)
        signal.removeEventListener('abort', onAbort)
        resolve(r)
      }
      const onAbort = () => finish({ ok: false, stdout: '', stderr: 'Stopped.' })
      const timer = setTimeout(
        () => finish({ ok: false, stdout: '', stderr: `Timed out after ${TIMEOUT_MS / 1000}s (possible infinite loop).` }),
        TIMEOUT_MS
      )
      signal.addEventListener('abort', onAbort)
      worker.onmessage = (e: MessageEvent) => {
        const d = e.data
        finish({ ok: d.type === 'done', stdout: d.stdout ?? '', stderr: d.stderr ?? '' })
      }
      worker.onerror = (e) => finish({ ok: false, stdout: '', stderr: e.message })
      worker.postMessage(code)
    })
  },
}
```

- [ ] **Step 3: Python engine (Pyodide in a worker, lazy, terminable)**

Create `lib/studylab/runner/pythonEngine.ts`. A worker that `importScripts` Pyodide from the CDN on first run, calls `loadPyodide`, redirects stdout/stderr, runs the code, and posts results. The host reuses one worker across runs (so Pyodide loads once) but terminates+recreates it on Stop/timeout.

```ts
import type { RunEngine, RunResult } from './types'

const PYODIDE_VERSION = 'v0.26.4'
const WORKER_SRC = `
let pyReady = null;
async function ensurePy() {
  if (!pyReady) {
    importScripts('https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js');
    pyReady = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/' });
  }
  return pyReady;
}
self.onmessage = async (e) => {
  try {
    const py = await ensurePy();
    let out = '', err = '';
    py.setStdout({ batched: (s) => { out += s + '\\n'; } });
    py.setStderr({ batched: (s) => { err += s + '\\n'; } });
    await py.runPythonAsync(e.data);
    self.postMessage({ type: 'done', stdout: out, stderr: err });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: '', stderr: String(ex && ex.message || ex) });
  }
};
`

const TIMEOUT_MS = 20_000 // Python's first run includes Pyodide download.

export const pythonEngine: RunEngine = {
  language: 'python',
  run(code: string, signal: AbortSignal): Promise<RunResult> {
    return new Promise((resolve) => {
      const blob = new Blob([WORKER_SRC], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      const worker = new Worker(url)
      let settled = false
      const finish = (r: RunResult) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.terminate()
        URL.revokeObjectURL(url)
        signal.removeEventListener('abort', onAbort)
        resolve(r)
      }
      const onAbort = () => finish({ ok: false, stdout: '', stderr: 'Stopped.' })
      const timer = setTimeout(
        () => finish({ ok: false, stdout: '', stderr: `Timed out after ${TIMEOUT_MS / 1000}s.` }),
        TIMEOUT_MS
      )
      signal.addEventListener('abort', onAbort)
      worker.onmessage = (e: MessageEvent) => {
        const d = e.data
        finish({ ok: d.type === 'done', stdout: d.stdout ?? '', stderr: d.stderr ?? '' })
      }
      worker.onerror = (e) => finish({ ok: false, stdout: '', stderr: e.message })
      worker.postMessage(code)
    })
  },
}
```
(Note: this recreates the worker per run for simplicity and guaranteed cancellability, so Pyodide reloads each run from the browser HTTP cache — acceptable for v1. A persistent-worker optimization is a later follow-up.)

- [ ] **Step 4: Lazy dispatch**

Create `lib/studylab/runner/index.ts`:
```ts
import type { RunEngine, RunLanguage } from './types'
import { webEngine } from './webEngine'
import { jsEngine } from './jsEngine'
import { pythonEngine } from './pythonEngine'

const ENGINES: Record<RunLanguage, RunEngine> = {
  web: webEngine,
  javascript: jsEngine,
  python: pythonEngine,
}

export function getEngine(language: RunLanguage): RunEngine {
  return ENGINES[language]
}

export type { RunEngine, RunResult, RunLanguage } from './types'
export { normalizeLanguage, isRunnable } from './languages'
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Workers/Pyodide globals live inside template strings, so they don't need TS lib types. If `Worker`/`Blob`/`URL` types error, confirm `tsconfig` `lib` includes `dom` — it does.)

- [ ] **Step 6: Commit**

```bash
git add lib/studylab/runner/webEngine.ts lib/studylab/runner/jsEngine.ts lib/studylab/runner/pythonEngine.ts lib/studylab/runner/index.ts
git commit -m "feat(studylab): client-side run engines (web iframe, js worker, pyodide worker)"
```

---

### Task 4: `onNodeDataChange` canvas primitive (browser)

A reusable way for any interactive node to update its own `data` and persist, threaded through the existing context + autosave. Needed by the runnable card (to save edited code) and reused by later phases.

**Files:**
- Modify: `components/studylab/canvasNodes.tsx` (`CanvasContext` type + default)
- Modify: `components/studylab/StudyCanvas.tsx` (`StudyCanvasProps`, provider value, `FlowInner` prop pass-through)
- Modify: `components/studylab/Workspace.tsx` (handler + pass prop)

**Interfaces:**
- Consumes: `StudyNodeData` from `@/lib/studylab/types`.
- Produces: `CanvasContext` gains `onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void`. `StudyCanvasProps` gains the same prop. `Workspace` implements it: merge `patch` into the node's `data`, set canvas state, and schedule a save.

- [ ] **Step 1: Extend the context type and default**

In `components/studylab/canvasNodes.tsx`:
- Add to the import from types if needed: `import type { StudyNodeData } from '@/lib/studylab/types'` (already imported — confirm).
- Change `CanvasCallbacks`:
```ts
interface CanvasCallbacks {
  onToggleGroup: (groupId: string) => void
  onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void
}
```
- Change the context default:
```ts
export const CanvasContext = createContext<CanvasCallbacks>({
  onToggleGroup: () => {},
  onNodeDataChange: () => {},
})
```

- [ ] **Step 2: Thread it through StudyCanvas**

In `components/studylab/StudyCanvas.tsx`:
- Add `onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void` to `StudyCanvasProps` (import `StudyNodeData` from `@/lib/studylab/types`).
- In the default export, change the provider value to:
```ts
<CanvasContext.Provider value={{ onToggleGroup: props.onToggleGroup, onNodeDataChange: props.onNodeDataChange }}>
```
(`FlowInner` does not need the callback; only the context provider does.)

- [ ] **Step 3: Implement the handler in Workspace**

In `components/studylab/Workspace.tsx`:
- Add this callback near `handleToggleGroup`:
```ts
const handleNodeDataChange = useCallback(
  (id: string, patch: Partial<StudyNodeData>) => {
    setCanvas((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }))
    scheduleCanvasSave()
  },
  [scheduleCanvasSave]
)
```
- Ensure `StudyNodeData` is imported in Workspace (`import type { ..., StudyNodeData } from '@/lib/studylab/types'`).
- Pass it to the canvas: add `onNodeDataChange={handleNodeDataChange}` to the `<StudyCanvas ... />` usage.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/studylab/canvasNodes.tsx components/studylab/StudyCanvas.tsx components/studylab/Workspace.tsx
git commit -m "feat(studylab): add onNodeDataChange primitive for interactive cards to persist edits"
```

---

### Task 5: `RunnableCodeCard` replacing the static `CodeNode` (browser)

The interactive card: editable `<textarea>`, language badge, Run/Stop, and an output pane (terminal text for JS/Python, sandboxed iframe for web). Persists code edits via `onNodeDataChange`. Output is ephemeral (re-run on demand).

**Files:**
- Create: `components/studylab/RunnableCodeCard.tsx`
- Modify: `components/studylab/canvasNodes.tsx` (remove the old `CodeNode` body; map `code` → the new card)

**Interfaces:**
- Consumes: `getEngine`, `normalizeLanguage`, `isRunnable`, `RunResult` from `@/lib/studylab/runner`; `CanvasContext` (`onNodeDataChange`) from `./canvasNodes`; `StudyNodeData` from `@/lib/studylab/types`.
- Produces: `export function RunnableCodeNode(props: NodeProps)` used as the `code` renderer in `studyNodeTypes`.

**Implementation spec (standard-model task — follow the contract and the skeleton):**

Behavior:
- Header: code icon, `data.title`, language badge (`data.language`).
- Body: a controlled `<textarea>` initialized from `data.code`, monospace, dark theme to match the old `pre`. On change, update local state; debounce (~700ms) a call to `onNodeDataChange(id, { code })` so edits persist without a round-trip per keystroke. Also persist on blur.
- Controls: a **Run** button shown only when `isRunnable(data.language)`; while running, it becomes **Stop**. Non-runnable languages show no Run button (just the editor, preserving today's behavior for unknown languages).
- Run: resolve `normalizeLanguage(data.language)`; create an `AbortController`; call `getEngine(lang).run(code, controller.signal)`; set `running=true`; store the result.
- Output pane (below the editor), shown after a run:
  - web → `<iframe sandbox="allow-scripts" srcDoc={result.previewHtml} className="w-full h-48 rounded-lg border ..." />` (NOTE: `allow-scripts` only — never add `allow-same-origin`).
  - js/python → a terminal `<pre>`: show `result.stdout`; if `result.stderr`, show it in red below. If both empty and `ok`, show a muted "(no output)".
- Stop: call `controller.abort()`.
- The card must stop running / clean up if unmounted (abort on unmount via `useEffect` cleanup).
- Reuse `CardFrame` (with the `sl-node-enter` animation already on it) so placement/animation and the violet accent are consistent. Keep `Handle`s (they come from `CardFrame`).
- **React Flow gotcha:** the textarea and buttons must not let React Flow pan/drag the canvas when interacted with. Add `className="nodrag"` to the textarea and to the Run/Stop button (React Flow's `nodrag` class stops drag propagation), and `onMouseDown={(e) => e.stopPropagation()}` on the textarea.

Skeleton (`components/studylab/RunnableCodeCard.tsx`):
```tsx
'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { Code2, Play, Square, Loader2 } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { getEngine, normalizeLanguage, isRunnable, type RunResult } from '@/lib/studylab/runner'
import { CanvasContext } from './canvasNodes'
import { CardFrame } from './canvasNodes' // export CardFrame from canvasNodes (see Task 5 Step 1)

export function RunnableCodeNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const [code, setCode] = useState(d.code ?? '')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runnable = isRunnable(d.language)

  useEffect(() => () => abortRef.current?.abort(), [])

  const persist = (next: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onNodeDataChange(id, { code: next }), 700)
  }

  const run = async () => {
    const lang = normalizeLanguage(d.language)
    if (!lang) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setResult(null)
    try {
      const r = await getEngine(lang).run(code, controller.signal)
      setResult(r)
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  // ...render: CardFrame > header (icon, title, language badge) >
  //   textarea (nodrag, value=code, onChange persist+setCode) >
  //   Run/Stop button (only if runnable) >
  //   output pane (iframe for web, <pre> for js/python) when result present
}
```

- [ ] **Step 1: Export `CardFrame` from `canvasNodes.tsx`**

In `components/studylab/canvasNodes.tsx`, change `function CardFrame(` to `export function CardFrame(` so the new card can reuse it.

- [ ] **Step 2: Create `RunnableCodeCard.tsx`**

Implement the full component per the skeleton + behavior spec above. Render exactly:
- the `CardFrame accent="violet"` wrapper,
- the header row (Code2 icon, title, uppercase language badge on the right),
- the `<textarea className="nodrag w-full h-28 ... font-mono text-[12px] bg-gray-950 text-gray-100 rounded-xl p-3" value={code} onChange={...} onMouseDown={stopPropagation} />`,
- a Run/Stop button row (only when `runnable`): Run shows `<Play>` + "Run"; while `running`, shows `<Square>`/`<Loader2 animate-spin>` + "Stop" wired to `stop`,
- the output pane when `result` is set (iframe for web; `<pre>` terminal for js/python with red stderr; muted "(no output)" when empty and ok).

- [ ] **Step 3: Wire the new renderer into `studyNodeTypes`**

In `components/studylab/canvasNodes.tsx`:
- Remove the old `CodeNode` function body (delete the function) OR leave it unused — prefer deleting it to avoid dead code.
- Add `import { RunnableCodeNode } from './RunnableCodeCard'` — **but** this creates a circular import (RunnableCodeCard imports `CanvasContext` and `CardFrame` from canvasNodes, and canvasNodes imports RunnableCodeNode). Resolve by moving the `studyNodeTypes` map registration so the cycle is value-level not type-level: ES modules tolerate this cycle because `studyNodeTypes` is read at render time, not module-eval time. If tsc/runtime complains, extract `CardFrame` and `CanvasContext` into a small `components/studylab/canvasShared.tsx` and import from there in both files. (Prefer the extraction if any circular-import warning appears.)
- Set `code: RunnableCodeNode` in the `studyNodeTypes` map (replacing `code: CodeNode`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification (controller follow-up — note in report, do not start dev server in a subagent)**

The implementer notes this is pending. The controller will, in the running app:
- Create/open a LearnSpace, get a `code` card (Python or JS), confirm the editor is editable, **Run** shows real output in the terminal pane, **Stop** kills a `while True:`/`while(true){}` loop within the timeout.
- For an `html` card, confirm the iframe renders the live preview.
- Confirm edited code persists across reload (autosave via `onNodeDataChange`).
- Confirm dragging the card by its frame still works but dragging starts on the textarea select text (nodrag).

- [ ] **Step 6: Commit**

```bash
git add components/studylab/RunnableCodeCard.tsx components/studylab/canvasNodes.tsx
git commit -m "feat(studylab): runnable code card with editor, Run/Stop, and output/terminal"
```

---

## Self-Review

**Spec coverage (Phase 3 — code runner):**
- Pluggable `RunEngine` interface + engines → Tasks 1, 3. ✓
- HTML/CSS/JS live preview (sandboxed iframe) → Task 3 (webEngine) + Task 5 (iframe render). ✓
- JavaScript in a Web Worker, console piped to terminal → Task 3 (jsEngine) + Task 1 (serialize). ✓
- Python via Pyodide, lazy-loaded from CDN → Task 3 (pythonEngine). ✓
- Timeout + worker terminate (kill infinite loops) → Task 3 (both engines). ✓
- Engines load only when first used → Task 3 (worker created on `run`; Pyodide imported in-worker on first run). ✓
- Runnable code card replacing static CodeNode (editor, Run/Stop, output pane) → Task 5. ✓
- Same component will power the freeform scratchpad → the card reads `data.code`/`data.language`, so Phase 4 can drop a blank one; no AI-specific coupling. ✓ (scratchpad block itself is Phase 4.)
- Output escaped; iframe `allow-scripts` only → Task 5. ✓
- Review carry (block-size-aware placement) → Task 2. ✓
- SQL stubbed/out of scope; CodeMirror→textarea — documented deviations. ✓

**Placeholder scan:** Tasks 1–2 (pure) carry complete code + tests. Tasks 3–4 carry complete code. Task 5 is a standard-model UI task with a full skeleton, exact class names, and explicit behavior per element — no "add error handling"-style hand-waving; the one open implementation choice (circular-import resolution) has an explicit decision rule.

**Type consistency:** `RunLanguage`/`RunResult`/`RunEngine` (Task 1) are used unchanged in Tasks 3 & 5. `getEngine`/`normalizeLanguage`/`isRunnable` signatures match across Tasks 3 & 5. `autoPosition(nodes, step, type?)` (Task 2) matches its call sites. `onNodeDataChange(id, patch: Partial<StudyNodeData>)` is identical across Task 4 (context, props, handler) and Task 5 (consumer). `CardFrame` is exported in Task 5 Step 1 before Task 5 Step 2 imports it.

**Open risk to flag at execution:** if the app sets a Content-Security-Policy, it may block `worker-src blob:`, `script-src https://cdn.jsdelivr.net`, or iframe scripts. Not visible from the codebase; the Task 5 manual run will surface it. If blocked, the fix is a CSP allowlist entry (out of this plan's scope; escalate).
