import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(pathToFileURL(path.join(root, `${specifier.slice(2)}.ts`)).href, context)
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier) && context.parentURL) {
    const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`)
    if (fs.existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context)
  }
  return nextResolve(specifier, context)
}
