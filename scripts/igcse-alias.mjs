import path from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL(path.resolve('scripts/igcse-alias-hook.mjs')).href, pathToFileURL('./'))
