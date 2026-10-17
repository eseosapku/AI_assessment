import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Amplify passes console environment variables to the SERVER only through the grep in amplify.yml,
 * which writes the matching ones into .env.production before the build. A server setting missing
 * from that pattern is silently absent in production -- the figure library's two settings were.
 */
function serverPattern(): RegExp {
  const yml = fs.readFileSync(path.join(process.cwd(), 'amplify.yml'), 'utf8')
  const line = yml.split('\n').find((l) => l.includes('env | grep -E'))
  const m = line?.match(/grep -E '([^']+)'/)
  if (!m) throw new Error('No server env grep in amplify.yml')
  return new RegExp(m[1])
}

describe('the server environment Amplify writes before the build', () => {
  it('carries the figure library settings', () => {
    const re = serverPattern()
    expect(re.test('FIGURE_LIBRARY_SOURCE=postgres')).toBe(true)
    expect(re.test('FIGURE_ASSET_BASE=https://dtj4jtk2hgh9l.cloudfront.net/figure-library')).toBe(true)
  })

  it('still carries the settings it always did', () => {
    const re = serverPattern()
    for (const v of ['DATABASE_URL=x', 'JWT_SECRET=x', 'BEDROCK_REGION=x', 'FLW_SECRET_KEY=x', 'SMTP_HOST=x', 'GOOGLE_CLIENT_ID=x']) {
      expect(re.test(v), v).toBe(true)
    }
  })
})
