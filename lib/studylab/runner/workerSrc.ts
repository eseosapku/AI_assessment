/**
 * What the code runners' workers run, written as source text.
 *
 * The JavaScript worker used to be assembled from `serializeArg.toString()`.
 * The production minifier compiles that function to an anonymous one, so the
 * worker received `function(e){...}` as a statement, which is a syntax error:
 * every JavaScript card on the live site failed before running a line. Text
 * is not compiled, so what is written here is what the worker gets, and the
 * tests run this same text.
 */

/** Most output a run keeps, per stream. A print loop filled memory and the page. */
export const OUTPUT_LIMIT = 100_000

/** One console argument as the terminal pane shows it. */
export const SERIALIZE_SRC = `
function serializeArg(value) {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object' || value === null) return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return '[Circular]';
  }
}
`

/** Collects output up to a limit, then says once that the rest was cut. */
export const SINK_SRC = `
function makeSink(limit) {
  var text = '';
  var cut = false;
  return {
    push: function (s) {
      if (cut) return;
      if (text.length + s.length > limit) {
        text += s.slice(0, Math.max(0, limit - text.length));
        text += '\\n... output cut off here, after ' + Math.round(limit / 1000) + ' KB.';
        cut = true;
        return;
      }
      text += s;
    },
    text: function () { return text.replace(/\\n$/, ''); },
  };
}
`

/**
 * Takes the network and storage away from the worker before a student's code
 * runs. A card's code is partly written by the model, and nothing a lesson
 * runs needs to reach out. Removed from the prototype chain too, and pinned,
 * so `delete self.fetch` cannot bring it back.
 */
export const LOCKDOWN_SRC = `
function lockDown(scope) {
  var names = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'Worker',
    'SharedWorker', 'WebTransport', 'BroadcastChannel', 'indexedDB', 'caches'];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    for (var o = scope; o; o = Object.getPrototypeOf(o)) {
      try { delete o[name]; } catch (e) {}
    }
    try { Object.defineProperty(scope, name, { value: undefined, writable: false, configurable: false }); } catch (e) {}
  }
}
`

/**
 * A Python error from the student's own lines down. Pyodide's traceback opens
 * with its own internals ("_pyodide/_base.py ... eval_code_async"), which a
 * student cannot act on and reads as the runner breaking.
 */
export const TRACEBACK_SRC = `
function cleanTraceback(msg) {
  var at = msg.indexOf('  File "<exec>"');
  return at === -1 ? msg : 'Traceback (most recent call last):\\n' + msg.slice(at);
}
`

/** Most steps a run's trace keeps; replay.ts plays back no more than this. */
export const TRACE_LIMIT = 500

/**
 * The line of the learner's code a print came from, read off the stack. Their
 * code runs inside `new Function`, whose body starts two lines down; the
 * innermost frame of it is the line that printed (V8 writes it
 * "..., <anonymous>:L:C)", Firefox "... > Function:L:C"). 0 when it cannot tell.
 */
export const CALLER_LINE_SRC = `
function callerLine() {
  var frames = String((new Error()).stack || '').split('\\n');
  for (var i = 0; i < frames.length; i++) {
    var m = /, <anonymous>:(\\d+):\\d+\\)$/.exec(frames[i]) || /> Function:(\\d+):\\d+$/.exec(frames[i]);
    if (m) return Number(m[1]) - 2;
  }
  return 0;
}
`

export const JS_WORKER_SRC = `
${SERIALIZE_SRC}
${SINK_SRC}
${LOCKDOWN_SRC}
${CALLER_LINE_SRC}
var out = makeSink(${OUTPUT_LIMIT});
var err = makeSink(${OUTPUT_LIMIT});
var trace = [];
var fmt = function (args) { return args.map(serializeArg).join(' ') + '\\n'; };
var print = function (args) {
  var text = fmt([].slice.call(args));
  out.push(text);
  if (trace.length < ${TRACE_LIMIT}) {
    var line = callerLine();
    if (line > 0) trace.push({ line: line, out: text });
  }
};
self.console = {
  log: function () { print(arguments); },
  info: function () { print(arguments); },
  warn: function () { print(arguments); },
  debug: function () { print(arguments); },
  error: function () { err.push(fmt([].slice.call(arguments))); },
};
lockDown(self);
self.onmessage = async function (e) {
  try {
    var fn = new Function('return (async () => {' + e.data + '\\n})()');
    await fn();
    self.postMessage({ type: 'done', stdout: out.text(), stderr: err.text(), trace: trace });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: out.text(), stderr: String((ex && ex.stack) || ex), trace: trace });
  }
};
`

/**
 * The Python tracer, as Python. Compiled under its own file name, '<lstrace>',
 * so tracing never records its own lines; only frames of the learner's code
 * ('<exec>', as Pyodide names it) are traced. Each line run is a step; what
 * is printed while a line runs is that step's output. At the limit it stops
 * tracing, and _ls_stop always puts the tracer and stdout back.
 */
export const PY_TRACE_SRC = `
import sys as _sys

class _LsOut:
    def __init__(self, inner, trace, state):
        self.inner = inner
        self.trace = trace
        self.state = state
    def write(self, text):
        if self.trace and not self.state['full']:
            self.trace[-1][1] += text
        return self.inner.write(text)
    def flush(self):
        return self.inner.flush()
    def __getattr__(self, name):
        return getattr(self.inner, name)

def _ls_start(limit):
    trace = []
    state = {'full': False}
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != '<exec>':
            return None
        line = frame.f_lineno
        if event == 'return':
            # Back in the line that called it: print(f(x)) prints from there, not from f.
            caller = frame.f_back
            if caller is None or caller.f_code.co_filename != '<exec>':
                return tracer
            line = caller.f_lineno
        elif event != 'line':
            return tracer
        if len(trace) >= limit:
            state['full'] = True
            _sys.settrace(None)
            return None
        trace.append([line, ''])
        return tracer
    out = _LsOut(_sys.stdout, trace, state)
    _sys.stdout = out
    _sys.settrace(tracer)
    return [trace, out]

def _ls_stop(started):
    _sys.settrace(None)
    if _sys.stdout is started[1]:
        _sys.stdout = started[1].inner
    return started[0]
`

/**
 * The Python worker, which is kept between runs.
 *
 * It was made fresh for every run, so every press of Run downloaded and
 * started Python again. Kept, Python loads once; each run gets its own
 * namespace, so one card's variables do not leak into the next.
 */
export function pythonWorkerSrc(version: string): string {
  const base = `https://cdn.jsdelivr.net/pyodide/${version}/full/`
  return `
${SINK_SRC}
${LOCKDOWN_SRC}
${TRACEBACK_SRC}
var TRACE_PY = ${JSON.stringify(PY_TRACE_SRC)};
var tracer = null;
// The tracer's own namespace, compiled once as '<lstrace>' so it is never traced itself.
function ensureTracer(py) {
  if (!tracer) {
    tracer = py.toPy({});
    tracer.set('__src', TRACE_PY);
    py.runPython("exec(compile(__src, '<lstrace>', 'exec'), globals())", { globals: tracer });
  }
  return tracer;
}
var pyReady = null;
function ensurePy() {
  if (!pyReady) {
    importScripts('${base}pyodide.js');
    pyReady = loadPyodide({ indexURL: '${base}' }).then(function (py) { lockDown(self); return py; });
  }
  return pyReady;
}
self.onmessage = async function (e) {
  var msg = e.data;
  if (msg.type === 'load') {
    try {
      await ensurePy();
      self.postMessage({ type: 'ready' });
    } catch (ex) {
      self.postMessage({ type: 'failed', stderr: String((ex && ex.message) || ex) });
    }
    return;
  }
  var out = makeSink(${OUTPUT_LIMIT});
  var err = makeSink(${OUTPUT_LIMIT});
  var ns = null;
  var started = null;
  var trace;
  // The run line by line; a run that cannot be traced still runs, just without one.
  var stopTrace = function () {
    if (!started) return;
    try {
      var steps = tracer.get('_ls_stop')(started);
      trace = steps.toJs().map(function (s) { return { line: s[0], out: s[1] }; });
      steps.destroy();
    } catch (e) { trace = undefined; }
    started.destroy();
    started = null;
  };
  try {
    var py = await ensurePy();
    py.setStdout({ batched: function (s) { out.push(s + '\\n'); } });
    py.setStderr({ batched: function (s) { err.push(s + '\\n'); } });
    ns = py.toPy({});
    ns.set('__name__', '__main__');
    try { started = ensureTracer(py).get('_ls_start')(${TRACE_LIMIT}); } catch (e) { started = null; }
    try {
      await py.runPythonAsync(msg.code, { globals: ns });
    } finally {
      stopTrace();
    }
    self.postMessage({ type: 'done', stdout: out.text(), stderr: err.text(), trace: trace });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: out.text(), stderr: cleanTraceback(String((ex && ex.message) || ex)), trace: trace });
  } finally {
    if (ns) ns.destroy();
  }
};
`
}
