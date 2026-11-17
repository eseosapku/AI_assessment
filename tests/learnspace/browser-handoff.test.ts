import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasSeenDemo, markDemoSeen, resetDemoSeen } from '@/lib/studylab/demoGate'
import { setHomeworkImage, setHomeworkText, takeHomeworkImage, takeHomeworkText } from '@/lib/studylab/homeworkHandoff'
import { downscaleDataUrl } from '@/lib/studylab/imageScale'
import { openLearnSpace } from '@/lib/studylab/openSpace'

function memoryStorage() {
  const box = new Map<string, string>()
  return {
    getItem: (key: string) => box.get(key) ?? null,
    setItem: (key: string, value: string) => { box.set(key, value) },
    removeItem: (key: string) => { box.delete(key) },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the demo is offered once', () => {
  it('is never offered while the page is being built on the server', () => {
    expect(hasSeenDemo()).toBe(true)
  })

  it('is offered until it is answered, and a full storage does not keep asking', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', memoryStorage())
    expect(hasSeenDemo()).toBe(false)
    markDemoSeen()
    expect(hasSeenDemo()).toBe(true)
    resetDemoSeen()
    expect(hasSeenDemo()).toBe(false)

    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    expect(hasSeenDemo()).toBe(true)
    expect(() => markDemoSeen()).not.toThrow()
  })
})

describe('homework crosses into the new tab', () => {
  it('a photo and typed text are each taken once', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    setHomeworkImage('space-1', 'data:image/jpeg;base64,abc')
    setHomeworkText('space-1', 'Question 1: find x')
    expect(takeHomeworkImage('space-1')).toBe('data:image/jpeg;base64,abc')
    expect(takeHomeworkImage('space-1')).toBeNull()
    expect(takeHomeworkText('space-1')).toBe('Question 1: find x')
    expect(takeHomeworkText('space-1')).toBeNull()
    expect(takeHomeworkImage('space-2')).toBeNull()
  })

  it('a full storage opens the lesson without the photo', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('full') },
      setItem: () => { throw new Error('full') },
      removeItem: () => { throw new Error('full') },
    })
    expect(() => setHomeworkImage('space-1', 'data:image/jpeg;base64,abc')).not.toThrow()
    expect(takeHomeworkImage('space-1')).toBeNull()
  })
})

describe('opening the lesson', () => {
  it('uses the same tab when there is no window, or a popup blocker', () => {
    const router = { push: vi.fn() }
    openLearnSpace('abc', router)
    expect(router.push).toHaveBeenCalledWith('/studylab/abc')

    vi.stubGlobal('window', { open: () => null })
    const blocked = { push: vi.fn() }
    openLearnSpace('abc', blocked)
    expect(blocked.push).toHaveBeenCalledWith('/studylab/abc')
  })

  it('opens a new tab and clears its opener', () => {
    const tab = { opener: { some: 'parent' } }
    vi.stubGlobal('window', { open: vi.fn(() => tab) })
    const router = { push: vi.fn() }
    openLearnSpace('abc', router)
    expect(router.push).not.toHaveBeenCalled()
    expect(tab.opener).toBeNull()
  })
})

describe('a homework photo', () => {
  it('comes back unchanged when it cannot be drawn', async () => {
    await expect(downscaleDataUrl('data:image/gif;base64,not-really')).resolves.toBe('data:image/gif;base64,not-really')
  })
})
