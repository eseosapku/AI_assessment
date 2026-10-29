import fs from 'node:fs'
import readline from 'node:readline'
import { classifyQuestion, RESPONSE_TYPES } from '../lib/past-paper/response-type.ts'

const file = new URL('../data/past-paper-corpus/papers.jsonl', import.meta.url)
const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })

const types = Object.fromEntries(RESPONSE_TYPES.map((type) => [type, 0]))
const byGroup = new Map()
const usable = { full: 0, partial: 0, held: 0, none: 0 }
let questions = 0
let parts = 0
let dependencyExclusions = 0
let papers = 0
let unparsed = 0

function groupOf(path) {
  const segs = String(path).split(/\\|\//)
  const system = /^cambridge$/i.test(segs[0]) ? 'cambridge' : /^reb$/i.test(segs[0]) ? 'reb' : segs[0]
  return `${system} | ${segs[1] ?? ''} | ${segs[2] && !segs[2].includes('.') ? segs[2] : ''}`
}

for await (const line of rl) {
  if (!line) continue
  const row = JSON.parse(line)
  papers += 1
  if (!row.questions?.length) {
    unparsed += 1
    continue
  }
  const group = groupOf(row.path)
  if (!byGroup.has(group)) byGroup.set(group, { questions: 0, full: 0, partial: 0, held: 0, none: 0 })
  const cell = byGroup.get(group)
  for (const question of row.questions) {
    const classified = classifyQuestion(question)
    questions += 1
    cell.questions += 1
    usable[classified.usable] += 1
    cell[classified.usable] += 1
    for (const part of classified.parts) {
      parts += 1
      types[part.response_type] += 1
      if (part.excluded_by_dependency) dependencyExclusions += 1
    }
  }
}

const report = []
const say = (s = '') => report.push(s)
say('# Response types')
say()
say('Tagged from the extracted questions. IGCSE was not in the corpus. No row in the curriculum database was written.')
say()
say(`Papers read: ${papers}. Papers with no parsed questions: ${unparsed}.`)
say(`Questions tagged: ${questions}. Parts tagged: ${parts}.`)
say()
say('## Parts')
say()
say('| response type | parts |')
say('| --- | ---: |')
for (const type of RESPONSE_TYPES) say(`| ${type} | ${types[type]} |`)
say()
say('A typed answer is `text`, `numeric`, `algebraic`, `multiple_choice`, `table_fill`, or `graph_read`. `graph_read` is a number read off a graph that is already printed. A plot the student has to draw is held, not served, until the plot marker exists.')
say()
say('## Questions')
say()
say(`- fully usable: ${usable.full}`)
say(`- partly usable: ${usable.partial}`)
say(`- held for plotting only: ${usable.held}`)
say(`- not usable: ${usable.none}`)
say()
say(`Parts kept out because they depend on a part that cannot be served: ${dependencyExclusions}.`)
say()
say('## By system, level, and subject folder')
say()
say('| group | questions | full | partial | held | none |')
say('| --- | ---: | ---: | ---: | ---: | ---: |')
for (const [key, cell] of [...byGroup.entries()].sort((a, b) => b[1].questions - a[1].questions)) {
  say(`| ${key} | ${cell.questions} | ${cell.full} | ${cell.partial} | ${cell.held} | ${cell.none} |`)
}

fs.writeFileSync(new URL('../reports/response_types.md', import.meta.url), report.join('\n'))
console.log(JSON.stringify({ papers, unparsed, questions, parts, usable, dependencyExclusions, types }, null, 2))
