import fs from 'node:fs'
import path from 'node:path'

const TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

/** A library file to serve: only under <dir>/assets, only an image, only if it exists. */
export function resolveAsset(dir: string, parts: readonly string[]): { file: string; type: string } | null {
  if (!dir) return null
  const root = path.resolve(dir, 'assets')
  const file = path.resolve(dir, ...parts)
  if (!file.startsWith(root + path.sep)) return null
  const type = TYPES[path.extname(file).toLowerCase()]
  if (!type || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null
  return { file, type }
}
