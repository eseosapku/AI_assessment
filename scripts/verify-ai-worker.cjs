const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync } = require('node:child_process')
const temporaryRoot = path.resolve(os.tmpdir())
const target = fs.mkdtempSync(path.join(temporaryRoot, 'assessment-worker-'))
try {
  fs.cpSync(path.resolve('.ai-worker'), target, { recursive: true })
  const probe = spawnSync(process.execPath, ['-e', 'const w=require("./index.js"); if(!w.submitHandler||!w.statusHandler)throw Error("missing handlers"); w.handler({Records:[]}).then(r=>{if(r.batchItemFailures.length)throw Error("bad worker");console.log("Isolated worker imported all handlers successfully; no HTTP or AI calls.")})'], {
    cwd: target, encoding: 'utf8', env: { ...process.env, NODE_PATH: '', DATABASE_URL: 'postgresql://test:test@127.0.0.1/test' },
  })
  process.stdout.write(probe.stdout || '')
  process.stderr.write(probe.stderr || '')
  if (probe.status !== 0) throw new Error(`Isolated worker failed: ${probe.status}`)
  for (const file of ['data/past-paper-references.json', 'systems/cambridge/style']) {
    if (!fs.existsSync(path.join(target, file))) throw new Error(`Missing deployed resource: ${file}`)
  }
} finally {
  // Delete only the exact fresh directory verified to lie under the OS temp root.
  const resolved = path.resolve(target)
  if (!resolved.startsWith(temporaryRoot + path.sep)) throw new Error('Refusing unsafe temporary cleanup')
  fs.rmSync(resolved, { recursive: true, force: true })
}
