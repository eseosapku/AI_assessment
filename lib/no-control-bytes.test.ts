// lib/no-control-bytes.test.ts
/**
 * No source file may contain a stray control character.
 *
 * This exists because the same mistake has now been made five times in one
 * piece of work, and every time it was invisible.
 *
 * Writing a regex through a shell heredoc collapses `\\b` to `\b`, and the
 * language on the far side reads `\b` as a BACKSPACE character rather than a
 * word boundary. The result compiles, type-checks, passes review and reads
 * correctly in an editor — and never matches anything:
 *
 *   isPlaceholderKey   a pattern for "name ... here" became one that began
 *                      with a backspace character — a rule written to catch
 *                      "name here" that had never once fired
 *   paper-tidy         a figure guard that silently failed, so pictures were
 *                      pulled out from under stems pointing at them
 *   extract-coverage   the component pattern lost its trailing word boundary
 *                      the same way, so every Science past paper was skipped
 *                      and four years of sittings vanished without a word
 *
 * A regex that cannot match looks exactly like a rule that is never needed.
 * Nothing else catches that, so this does.
 *
 * A literal NUL is refused too, even where it is deliberate. Joining cache
 * keys on a NUL is perfectly safe at runtime -- but written as a raw byte
 * it makes git treat the whole file as BINARY, and lib/checkpoint-figures.ts
 * sat unreviewable and undiffable for that one character. Write it as a
 * unicode escape instead: same value, and the file stays text.
 *
 * This very comment spelled that escape out, and the editor turned it into
 * a real NUL. The fault is not hypothetical.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const DIRS = ['lib', 'app', 'components', 'scripts']
const EXTENSIONS = new Set(['.ts', '.tsx', '.py', '.js', '.mjs'])

/** Backspace, vertical tab, form feed, escape, and bare carriage control. */
// 0x00 included: a NUL written as a literal byte (a join separator, in
// one case) makes git treat the whole file as binary and stop diffing it,
// which is how lib/checkpoint-figures.ts went unreviewable. The escape
// sequence has the same runtime value and keeps the file text.
const FORBIDDEN = [0x00, 0x08, 0x0b, 0x0c, 0x1b]

function sourceFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) sourceFiles(full, out)
    else if (EXTENSIONS.has(path.extname(e.name))) out.push(full)
  }
  return out
}

describe('no source file carries a stray control character', () => {
  it('scans lib, app, components and scripts', () => {
    const offenders: string[] = []

    for (const file of DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))) {
      const bytes = fs.readFileSync(file)
      for (const code of FORBIDDEN) {
        const at = bytes.indexOf(code)
        if (at === -1) continue
        const line = bytes.subarray(0, at).toString('utf8').split('\n').length
        offenders.push(
          `${path.relative(ROOT, file)}:${line} contains 0x${code.toString(16).padStart(2, '0')} — ` +
          'almost certainly a regex escape that was written through a shell and lost its backslash',
        )
      }
    }

    expect(offenders).toEqual([])
  })
})

describe('a word boundary that is really a backspace', () => {
  it('never builds a regex from a template literal containing a bare escape', () => {
    // `\b` inside a TEMPLATE literal is U+0008, not a word boundary, so
    // new RegExp(`\b${name}\b`) matches nothing — silently, and the file
    // itself is clean, so the byte scan above cannot see it. Found the hard
    // way in passage-question-match: every borrowed-work check passed
    // because none of them could ever fire.
    //
    // String.raw`\b`, '\b' in a normal string, or a literal /.../ are all
    // fine; a backtick string with a bare \b, \d, \w, \s or \t is not.
    const offenders: string[] = []
    const files = DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      // Tests are excluded: this file's own doc comment spells the mistake
      // out, and a guard that fails on its own explanation is no guard.
      .filter((f) => !f.includes('.test.'))

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      // A backtick string handed to RegExp, or concatenated into a pattern,
      // that carries a bare regex escape.
      const re = /new RegExp\(\s*`([^`]*)`/g
      for (const m of src.matchAll(re)) {
        const body = m[1]
        if (new RegExp(String.raw`(?<!\\)\\[bdwsSDWtnr]`).test(body)) {
          offenders.push(`${file}: new RegExp(\`...${body.slice(0, 50)}...\`)`)
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
