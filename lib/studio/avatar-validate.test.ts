import { describe, it, expect } from 'vitest'
import { checkAvatarDataUrl, base64Bytes, AVATAR_MAX_BYTES } from './avatar-validate'

/** A syntactically valid base64 payload of roughly `bytes` decoded length. */
const payload = (bytes: number) => {
  const chars = Math.ceil((bytes * 4) / 3)
  return 'A'.repeat(chars + ((4 - (chars % 4)) % 4))
}

describe('base64Bytes', () => {
  it('measures decoded length without decoding', () => {
    expect(base64Bytes('AAAA')).toBe(3)
    expect(base64Bytes('AAA=')).toBe(2)
    expect(base64Bytes('AA==')).toBe(1)
    expect(base64Bytes('')).toBe(0)
  })
})

describe('checkAvatarDataUrl', () => {
  it('accepts the formats the uploader produces', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkAvatarDataUrl(`data:${mime};base64,${payload(1000)}`).ok).toBe(true)
    }
  })

  it('rejects SVG', () => {
    // An SVG data URL can carry script, and this value is rendered back into an
    // <img src> for other people to load.
    const res = checkAvatarDataUrl(`data:image/svg+xml;base64,${payload(100)}`)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/JPEG, PNG or WebP/)
  })

  it('rejects non-image mime types', () => {
    expect(checkAvatarDataUrl(`data:text/html;base64,${payload(100)}`).ok).toBe(false)
    expect(checkAvatarDataUrl(`data:application/javascript;base64,${payload(100)}`).ok).toBe(false)
  })

  it('rejects anything that is not a base64 data URL', () => {
    for (const bad of [
      'https://example.com/me.png',
      'javascript:alert(1)',
      'data:image/jpeg,notbase64',
      '/art/avatar-default.png',
      '',
    ]) {
      expect(checkAvatarDataUrl(bad).ok).toBe(false)
    }
  })

  it('rejects payloads over the size cap', () => {
    const tooBig = checkAvatarDataUrl(`data:image/jpeg;base64,${payload(AVATAR_MAX_BYTES + 5000)}`)
    expect(tooBig.ok).toBe(false)
    expect(tooBig.reason).toMatch(/too large/)
  })

  it('accepts a payload just under the cap', () => {
    expect(checkAvatarDataUrl(`data:image/jpeg;base64,${payload(AVATAR_MAX_BYTES - 1000)}`).ok).toBe(true)
  })

  it('rejects non-string input rather than throwing', () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      expect(checkAvatarDataUrl(bad).ok).toBe(false)
    }
  })

  it('tolerates surrounding whitespace', () => {
    expect(checkAvatarDataUrl(`  data:image/png;base64,${payload(500)}  `).ok).toBe(true)
  })
})
