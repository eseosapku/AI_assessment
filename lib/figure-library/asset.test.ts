import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveAsset } from './asset'

describe('serving library files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figlib-asset-'))
  fs.mkdirSync(path.join(dir, 'assets', 'wikimedia'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'assets', 'wikimedia', '1.webp'), 'x')
  fs.writeFileSync(path.join(dir, 'assets', 'notes.txt'), 'x')
  fs.writeFileSync(path.join(dir, 'figures.db'), 'secret')

  it('finds a file under the assets folder, with its type', () => {
    expect(resolveAsset(dir, ['assets', 'wikimedia', '1.webp'])).toEqual({ file: path.join(dir, 'assets', 'wikimedia', '1.webp'), type: 'image/webp' })
  })

  it('never reaches outside the assets folder, nor serves other kinds of file', () => {
    expect(resolveAsset(dir, ['assets', '..', 'figures.db'])).toBeNull()
    expect(resolveAsset(dir, ['figures.db'])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'wikimedia', '..', '..', '..', 'etc'])).toBeNull()
    expect(resolveAsset(dir, ['assets', path.join(dir, 'figures.db')])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'wikimedia', 'missing.webp'])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'notes.txt'])).toBeNull()
    expect(resolveAsset(dir, ['assets', 'wikimedia'])).toBeNull()
    expect(resolveAsset('', ['assets', 'wikimedia', '1.webp'])).toBeNull()
  })
})
