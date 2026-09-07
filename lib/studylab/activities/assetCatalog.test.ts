import { describe, it, expect } from 'vitest'
import { assetUrl, assetNames, assetCatalogPromptBlock } from './assetCatalog'

describe('assetUrl', () => {
  it('resolves a known asset to a public path', () => {
    const url = assetUrl('balance-scale')
    expect(url).toMatch(/^\/art\/montessori\/.+\.webp$/)
  })

  it('accepts the asset: prefix the tutor is told to use', () => {
    expect(assetUrl('asset:balance-scale')).toBe(assetUrl('balance-scale'))
  })

  it('returns null for an unknown name', () => {
    expect(assetUrl('no-such-thing')).toBeNull()
    expect(assetUrl('')).toBeNull()
  })

  it('returns null for prototype-chain names instead of resolving or throwing', () => {
    for (const bad of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(assetUrl(bad)).toBeNull()
    }
  })

  it('never emits a path outside the bundled art directory', () => {
    for (const bad of ['../../etc/passwd', '/etc/passwd', 'https://evil.test/x.png', 'a/../../b']) {
      expect(assetUrl(bad)).toBeNull()
    }
  })

  it('lists names and builds a prompt block naming them', () => {
    const names = assetNames()
    expect(names.length).toBeGreaterThan(10)
    const block = assetCatalogPromptBlock()
    expect(block).toContain(names[0])
  })
})
