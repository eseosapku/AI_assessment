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
 * `\x00` is allowed where it is plainly a separator — `join('\0')` in a cache
 * key is deliberate and safe.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const DIRS = ['lib', 'app', 'components', 'scripts']
const EXTENSIONS = new Set(['.ts', '.tsx', '.py', '.js', '.mjs'])

/** Backspace, vertical tab, form feed, escape, and bare carriage control. */
const FORBIDDEN = [0x08, 0x0b, 0x0c, 0x1b]

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
