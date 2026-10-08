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

export const JS_WORKER_SRC = `
${SERIALIZE_SRC}
${SINK_SRC}
${LOCKDOWN_SRC}
var out = makeSink(${OUTPUT_LIMIT});
var err = makeSink(${OUTPUT_LIMIT});
var fmt = function (args) { return args.map(serializeArg).join(' ') + '\\n'; };
self.console = {
  log: function () { out.push(fmt([].slice.call(arguments))); },
  info: function () { out.push(fmt([].slice.call(arguments))); },
  warn: function () { out.push(fmt([].slice.call(arguments))); },
  debug: function () { out.push(fmt([].slice.call(arguments))); },
  error: function () { err.push(fmt([].slice.call(arguments))); },
};
lockDown(self);
self.onmessage = async function (e) {
  try {
    var fn = new Function('return (async () => {' + e.data + '\\n})()');
    await fn();
    self.postMessage({ type: 'done', stdout: out.text(), stderr: err.text() });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: out.text(), stderr: String((ex && ex.stack) || ex) });
  }
};
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
  try {
    var py = await ensurePy();
    py.setStdout({ batched: function (s) { out.push(s + '\\n'); } });
    py.setStderr({ batched: function (s) { err.push(s + '\\n'); } });
    ns = py.toPy({});
    ns.set('__name__', '__main__');
    await py.runPythonAsync(msg.code, { globals: ns });
    self.postMessage({ type: 'done', stdout: out.text(), stderr: err.text() });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: out.text(), stderr: cleanTraceback(String((ex && ex.message) || ex)) });
  } finally {
    if (ns) ns.destroy();
  }
};
`
}
