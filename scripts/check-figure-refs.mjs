import fs from 'node:fs'
import readline from 'node:readline'
import { classifyResponse } from '../lib/past-paper/response-type.ts'

const FIGURE = /\b(?:from the graph|using (?:the |fig\.? ?\d)|from the diagram|fig\.?\s*\d|from the figure|the graph shows|shown in (?:the |fig))\b/i
const GRAPH_READ = /\b(?:from the graph|read off|determine the gradient|from the curve|using the graph)\b/i

const rl = readline.createInterface({
  input: fs.createReadStream(new URL('../data/past-paper-corpus/papers.jsonl', import.meta.url)),
  crlfDelay: Infinity,
})

let parts = 0
let figureMention = 0
let figureMentionNoRef = 0
let numericWithGraphLanguage = 0
let graphRead = 0
const figureTypes = {}
const numericExamples = []

for await (const line of rl) {
  if (!line) continue
  const row = JSON.parse(line)
  for (const question of row.questions ?? []) {
    const refs = Array.isArray(question.figure_refs) ? question.figure_refs.length : 0
    const chunks = question.parts?.length
      ? question.parts.map((part) => `${question.stem ?? ''}\n${part.text ?? ''}`)
      : [String(question.stem ?? '')]
    for (const text of chunks) {
      parts += 1
      const type = classifyResponse(text)
      if (type === 'graph_read') graphRead += 1
      if (type === 'numeric' && GRAPH_READ.test(text)) {
        numericWithGraphLanguage += 1
        if (numericExamples.length < 6) numericExamples.push(text.replace(/\s+/g, ' ').slice(0, 180))
      }
      if (FIGURE.test(text)) {
        figureMention += 1
        figureTypes[type] = (figureTypes[type] ?? 0) + 1
        if (refs === 0) figureMentionNoRef += 1
      }
    }
  }
}

console.log(JSON.stringify({
  parts, graphRead, numericWithGraphLanguage, figureMention, figureMentionNoRef, figureTypes, numericExamples,
}, null, 2))
