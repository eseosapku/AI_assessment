import fs from 'node:fs'

const lines = fs.readFileSync(new URL('../reports/inventory-files.tsv', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)

const by = new Map()
for (const line of lines) {
  const parts = line.includes('\t') ? line.split('\t') : line.split('`t')
  const rel = parts.slice(2).join(parts.includes('\t') ? '\t' : '`t')
  const segs = rel.split(/\\|\//)
  const key = `${segs[0] ?? '(none)'} / ${segs[1] ?? '(none)'}`
  by.set(key, (by.get(key) ?? 0) + 1)
}

console.log(`files ${lines.length}`)
for (const [key, n] of [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${String(n).padStart(5)}  ${key}`)
}
