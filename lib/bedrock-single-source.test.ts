/**
 * The Bedrock helpers live in ONE place.
 *
 * Every Bedrock fault found on 2026-09-29 had the same root cause: the logic
 * existed in five copies (lib/bedrock.ts and four routes), a fix landed in one,
 * and the others kept the bug.
 *
 *  - The bare model id was tried first everywhere. In eu-west-1 it fails on
 *    every call, so every call was made twice.
 *  - lib/bedrock.ts had fixed "any ValidationException is a model-id error";
 *    three route copies had not.
 *  - lib/bedrock.ts had fixed LaTeX turning into control characters ("\frac"
 *    parsed as a form feed then "rac"); the question generator's copy had not,
 *    and grade-longform's copy had no LaTeX handling at all.
 *
 * So a second definition of any of these outside lib/bedrock.ts fails here,
 * before it can drift.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SHARED = ['parseJsonRobust', 'fixLatexInRawJson', 'isModelIdError']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      out.push(...sourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('the Bedrock helpers have one definition', () => {
  it('defines parseJsonRobust, fixLatexInRawJson and isModelIdError only in lib/bedrock.ts', () => {
    const root = process.cwd()
    const offenders: string[] = []
    for (const file of [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'lib'))]) {
      if (path.relative(root, file).replace(/\\/g, '/') === 'lib/bedrock.ts') continue
      const text = fs.readFileSync(file, 'utf8')
      for (const name of SHARED) {
        if (new RegExp(`function\\s+${name}\\s*\\(`).test(text)) {
          offenders.push(`${path.relative(root, file)} defines ${name}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
