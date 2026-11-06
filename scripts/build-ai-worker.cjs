/** Package the actual engine and its traced runtime assets for the SQS Lambda. */
const fs = require('node:fs/promises')
const path = require('node:path')
const { build } = require('esbuild')
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft')
const root = path.resolve(__dirname, '..')
const out = path.join(root, '.ai-worker')
async function main() {
  const route = path.join(root, '.next/server/app/api/generate-assessment/route.js.nft.json')
  const trace = JSON.parse(await fs.readFile(route, 'utf8')) // next build must run first.
  await fs.mkdir(out, { recursive: true })
  const entry = path.join(out, 'index.js')
  await build({ entryPoints: [path.join(root, 'infra/lambda/handlers/entry.ts')], outfile: entry,
    bundle: true, packages: 'external', platform: 'node', format: 'cjs', target: 'node20', minify: true,
    tsconfig: path.join(root, 'tsconfig.json'), logLevel: 'warning' })
  const dependencies = await nodeFileTrace([entry], { base: root, processCwd: root,
    ignore: ['data/**', 'systems/**', 'public/**', 'curriculum/**', '.next/**'],
    analysis: { emitGlobs: false, computeFileReferences: false } })
  const files = new Set([...dependencies.fileList].map((f) => path.resolve(root, f)))
  for (const f of trace.files) files.add(path.resolve(path.dirname(route), f))
  let bytes = 0, copied = 0
  for (const source of files) {
    const relative = path.relative(root, source)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Dependency outside project: ${relative}`)
    if (relative.startsWith('.ai-worker' + path.sep) || /^\.env(?:\.|$)/.test(path.basename(source))) continue
    const stat = await fs.stat(source)
    if (!stat.isFile()) continue
    const destination = path.join(out, relative)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(source, destination)
    bytes += stat.size; copied++
  }
  bytes += (await fs.stat(entry)).size
  if (bytes >= 250 * 1024 * 1024) throw new Error(`Worker exceeds Lambda unzipped package limit: ${bytes} bytes`)
  await fs.writeFile(path.join(out, 'build-info.json'), JSON.stringify({ files: copied + 1, bytes, timeoutSeconds: 900 }, null, 2))
  console.log(`Packaged direct generation worker: ${copied + 1} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB. No .env files included.`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
