// scripts/figure-library/wikimedia.test.ts
import { describe, it, expect } from 'vitest'
import { openStore } from './store'
import { USER_AGENT, countImages, parseHits, saveSupply, searchUrl, termsToProbe, type FetchFn } from './wikimedia'

const noWait = async () => {}

describe('counting candidate images on Wikimedia Commons', () => {
  it('searches photos and drawings together and asks only for the total', () => {
    // One request a term: the combined filter returned exactly bitmap + drawing (1,884 + 7 = 1,891 for "oxbow lake").
    const url = new URL(searchUrl('oxbow lake'))
    expect(url.origin + url.pathname).toBe('https://commons.wikimedia.org/w/api.php')
    expect(url.searchParams.get('srsearch')).toBe('oxbow lake filetype:bitmap|drawing')
    expect(url.searchParams.get('srnamespace')).toBe('6')
    expect(url.searchParams.get('srlimit')).toBe('1')
  })

  it('reads the total, and refuses a reply without one', () => {
    expect(parseHits({ query: { searchinfo: { totalhits: 412 } } })).toBe(412)
    expect(() => parseHits({ error: { code: 'x' } })).toThrow(/total/)
  })

  it('makes one request a term, identifies itself, and retries a rate limit', async () => {
    const seen: string[] = []
    let calls = 0
    const fetchFn: FetchFn = async (_url, init) => {
      seen.push(init.headers['User-Agent'])
      calls++
      if (calls === 1) return { ok: false, status: 429, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ query: { searchinfo: { totalhits: 340 } } }) }
    }
    expect(await countImages('oxbow lake', fetchFn, noWait)).toBe(340)
    expect(calls).toBe(2)
    expect(new Set(seen)).toEqual(new Set([USER_AGENT]))
  })

  it('probes each search term once, across all topics, and skips ones already counted', () => {
    const db = openStore(':memory:')
    db.prepare("INSERT INTO topics (key, source, book, subject, band, name) VALUES ('db:1', 'rwanda', 'B', 'geography', 'LS', 'Rivers'), ('db:2', 'rwanda', 'B', 'geography', 'LS', 'Coasts')").run()
    db.prepare(`INSERT INTO topic_map (topic_key, concepts, kinds, terms, visual, model, mapped_at) VALUES
      ('db:1', '[]', '[]', '["oxbow lake","meander"]', 'high', 'm', 'now'),
      ('db:2', '[]', '[]', '["meander","spit"]', 'high', 'm', 'now')`).run()
    saveSupply(db, 'meander', 5000)
    expect(termsToProbe(db)).toEqual(['oxbow lake', 'spit'])
    expect(termsToProbe(db, true)).toEqual(['meander', 'oxbow lake', 'spit'])
  })
})
