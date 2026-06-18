import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { NIGERIA_CURRICULUM } from '../lib/nigeria-curriculum.ts'

const dir = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(dir, 'nigeria-curriculum-data.json'), JSON.stringify(NIGERIA_CURRICULUM, null, 0))
console.log('Wrote nigeria-curriculum-data.json')
