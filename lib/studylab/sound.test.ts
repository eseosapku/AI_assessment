import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type Listener = (e: unknown) => void

/** A browser just big enough for the sound module: storage, listeners, Audio. */
function fakeBrowser(opts: { storageThrows?: boolean } = {}) {
  const store = new Map<string, string>()
  const listeners = new Map<string, Listener[]>()
  const played: string[] = []
  const localStorage = opts.storageThrows
    ? {
        getItem: () => { throw new Error('blocked') },
        setItem: () => { throw new Error('blocked') },
      }
    : {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      }
  class FakeAudio {
    src: string
    volume = 1
    currentTime = 0
    preload = ''
    constructor(src: string) { this.src = src }
    play() { played.push(this.src); return Promise.resolve() }
  }
  const window = {
    localStorage,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
    },
  }
  const fire = (type: string) => (listeners.get(type) ?? []).forEach((fn) => fn({}))
  return { window, FakeAudio, store, played, fire }
}

describe('lesson sounds', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function load(opts?: { storageThrows?: boolean }) {
    const b = fakeBrowser(opts)
    vi.stubGlobal('window', b.window)
    vi.stubGlobal('localStorage', b.window.localStorage)
    vi.stubGlobal('Audio', b.FakeAudio)
    const mod = await import('./sound')
    return { ...b, mod }
  }

  it('is on by default and remembers being muted', async () => {
    const { mod, store } = await load()
    expect(mod.isMuted()).toBe(false)
    mod.setMuted(true)
    expect(mod.isMuted()).toBe(true)
    expect(store.get('ss-sound')).toBe('off')
    mod.setMuted(false)
    expect(store.get('ss-sound')).toBe('on')
  })

  it('stays quiet until the learner has touched the page', async () => {
    const { mod, played, fire } = await load()
    mod.playSound('correct')
    expect(played).toEqual([])
    fire('pointerdown')
    mod.playSound('correct')
    expect(played).toEqual(['/sounds/correct.mp3'])
  })

  it('plays nothing while muted, even after a gesture', async () => {
    const { mod, played, fire } = await load()
    fire('keydown')
    mod.setMuted(true)
    mod.playSound('wrong')
    expect(played).toEqual([])
  })

  it('treats blocked storage as unmuted and never throws', async () => {
    const { mod } = await load({ storageThrows: true })
    expect(mod.isMuted()).toBe(false)
    expect(() => mod.setMuted(true)).not.toThrow()
  })

  it('tells subscribers when the mute changes', async () => {
    const { mod } = await load()
    const seen: boolean[] = []
    const off = mod.subscribeMuted((m) => seen.push(m))
    mod.setMuted(true)
    mod.setMuted(false)
    off()
    mod.setMuted(true)
    expect(seen).toEqual([true, false])
  })

  it('maps every sound to a file that exists in public/sounds', async () => {
    const { mod } = await load()
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const src of Object.values(mod.SOUND_FILES)) {
      expect(fs.existsSync(path.join(process.cwd(), 'public', src)), src).toBe(true)
    }
  })
})
