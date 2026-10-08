import { describe, expect, it } from 'vitest'
import vm from 'vm'
import { JS_WORKER_SRC, LOCKDOWN_SRC, OUTPUT_LIMIT, SINK_SRC, TRACEBACK_SRC, pythonWorkerSrc } from './workerSrc'

type Sink = { push(s: string): void; text(): string }
const makeSink = new Function(`${SINK_SRC}; return makeSink`)() as (limit: number) => Sink
const lockDown = new Function(`${LOCKDOWN_SRC}; return lockDown`)() as (scope: object) => void

/**
 * Runs the JavaScript worker's text with a stand-in for a worker's global
 * scope: `self` is the global, and it has a network to take away.
 */
async function runJs(code: string): Promise<{ type: string; stdout: string; stderr: string }> {
  const posted: { type: string; stdout: string; stderr: string }[] = []
  const scope: Record<string, any> = {
    postMessage: (m: any) => posted.push(m),
    fetch: () => 'reached',
    XMLHttpRequest: class {},
    importScripts: () => {},
  }
  scope.self = scope
  const ctx = vm.createContext(scope)
  vm.runInContext(JS_WORKER_SRC, ctx)
  await scope.onmessage({ data: code })
  return posted[0]
}

describe('the scripts the runners hand their workers', () => {
  // Built from `serializeArg.toString()`, the minifier made the worker's first
  // line an anonymous function statement and nothing ran on the live site.
  it('parse as written', () => {
    expect(() => new Function(JS_WORKER_SRC)).not.toThrow()
    expect(() => new Function(pythonWorkerSrc('v0.26.4'))).not.toThrow()
  })

  it('run JavaScript and hand back what it printed', async () => {
    const r = await runJs('console.log("sum", 1 + 2); console.error("careful")')
    expect(r).toEqual({ type: 'done', stdout: 'sum 3', stderr: 'careful' })
  })

  it('report an error with what was printed before it', async () => {
    const r = await runJs('console.log("before"); throw new Error("boom")')
    expect(r.type).toBe('error')
    expect(r.stdout).toBe('before')
    expect(r.stderr).toMatch(/boom/)
  })

  it("keep the network from a card's code", async () => {
    const r = await runJs('console.log(typeof fetch, typeof XMLHttpRequest, typeof importScripts)')
    expect(r.stdout).toBe('undefined undefined undefined')
  })
})

describe('output from a run', () => {
  it('is kept whole up to the limit', () => {
    const sink = makeSink(10)
    sink.push('hello\n')
    expect(sink.text()).toBe('hello')
  })

  it('is cut at the limit, with one note saying so', () => {
    // A print loop filled the page's memory for the whole timeout.
    const sink = makeSink(OUTPUT_LIMIT)
    for (let i = 0; i < 50_000; i++) sink.push('line of output\n')
    const text = sink.text()
    expect(text.length).toBeLessThan(OUTPUT_LIMIT + 100)
    expect(text.match(/output cut off/g)).toHaveLength(1)
  })
})

describe('taking the network away', () => {
  it('leaves nothing to call, even after deleting the blank', () => {
    const proto = { fetch: () => 'reached', XMLHttpRequest: class {} }
    const scope: Record<string, unknown> = Object.create(proto)
    lockDown(scope)
    expect(scope.fetch).toBeUndefined()
    // Pinned: a strict-mode delete throws, a sloppy one does nothing.
    expect(() => { delete scope.fetch }).toThrow(TypeError)
    expect(scope.fetch).toBeUndefined()
    expect((proto as Record<string, unknown>).fetch).toBeUndefined()
    expect(scope.XMLHttpRequest).toBeUndefined()
  })
})

describe('a Python error', () => {
  const cleanTraceback = new Function(`${TRACEBACK_SRC}; return cleanTraceback`)() as (m: string) => string

  it("starts at the student's own code, not Pyodide's internals", () => {
    // As Chrome reported it for `print(x)` with no x.
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 1, in <module>',
      "NameError: name 'x' is not defined",
    ].join('\n')
    expect(cleanTraceback(raw)).toBe(
      `Traceback (most recent call last):\n  File "<exec>", line 1, in <module>\nNameError: name 'x' is not defined`,
    )
  })

  it('is left alone when it has no line of theirs in it', () => {
    expect(cleanTraceback('SyntaxError: invalid syntax')).toBe('SyntaxError: invalid syntax')
  })
})
