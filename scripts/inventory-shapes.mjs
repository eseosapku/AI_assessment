import fs from 'node:fs'

const lines = fs.readFileSync(new URL('../reports/inventory-files.tsv', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(Boolean)

const depths = new Map()
const ext = new Map()
const samples = new Map()
for (const line of lines) {
  const rel = (line.includes('\t') ? line.split('\t') : line.split('`t')).slice(2).join('\\')
  const segs = rel.split('\\')
  const key = segs.slice(0, 3).join(' / ')
  depths.set(key, (depths.get(key) ?? 0) + 1)
  const e = (segs.at(-1).match(/\.[^.]+$/) ?? ['(none)'])[0].toLowerCase()
  ext.set(e, (ext.get(e) ?? 0) + 1)
  if (!samples.has(segs[0] + '/' + segs[1])) samples.set(segs[0] + '/' + segs[1], rel)
}
console.log('EXT')
for (const [k, n] of [...ext.entries()].sort((a, b) => b[1] - a[1])) console.log(n, k)
console.log('SAMPLES')
for (const rel of samples.values()) console.log(rel)
console.log('TOP3')
for (const [k, n] of [...depths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(String(n).padStart(5), k)
