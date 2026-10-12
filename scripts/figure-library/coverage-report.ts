// scripts/figure-library/coverage-report.ts
// Run: npx jiti scripts/figure-library/coverage-report.ts
// Approved library figures per topic against spec section 3: 50 per topic, 6 sources, no source above 25%.
import fs from 'node:fs'
import path from 'node:path'
import { libraryDir, openStore } from './store'
import { coverage } from './coverage'

const db = openStore()
const c = coverage(db)
db.close()
const out = path.join(libraryDir(), 'reports', 'coverage.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(c, null, 2))
console.log(`${c.totals.approved} approved figures (${c.totals.drawn} drawn, ${c.totals.real} real) on ${c.totals.topicsCovered} topics`)
for (const t of c.topics) {
  console.log(`  ${t.key.padEnd(34)} ${String(t.approved).padStart(4)} figures, ${t.sources} sources, largest ${(100 * t.largestShare).toFixed(0)}%  ${t.name.slice(0, 50)}`)
}
console.log(`Written to ${out}`)
