// scripts/figure-library/wikimedia.ts
import { readJson, type Store } from './store'
import { sleep } from './claude'

/** Wikimedia asks every API client to identify itself with a contact. The site, never the account email. */
export const USER_AGENT = 'StudySquareFigureLibrary/0.1 (https://www.studysquare.org)'

/** Photos and drawings together: the combined filter returns exactly their sum, in one request. */
export function searchUrl(term: string): string {
  const q = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${term} filetype:bitmap|drawing`,
    srnamespace: '6',
    srlimit: '1',
    srinfo: 'totalhits',
    srprop: '',
    format: 'json',
    formatversion: '2',
  })
  return `https://commons.wikimedia.org/w/api.php?${q}`
}

export function parseHits(body: unknown): number {
  const hits = (body as { query?: { searchinfo?: { totalhits?: unknown } } } | null)?.query?.searchinfo?.totalhits
  if (typeof hits !== 'number') throw new Error('No total in the Wikimedia reply')
  return hits
}

export type FetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/** Photos plus drawings for one term, in one request. Rate limits are waited out. */
export async function countImages(term: string, fetchFn: FetchFn = fetch as unknown as FetchFn, wait: (ms: number) => Promise<void> = sleep): Promise<number> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchFn(searchUrl(term), { headers: { 'User-Agent': USER_AGENT } })
    if (res.ok) return parseHits(await res.json())
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await wait(2000 * 2 ** attempt); continue }
    throw new Error(`Wikimedia search failed (${res.status}) for "${term}"`)
  }
}

/** Every search term any topic asked for, once, minus those already counted. */
export function termsToProbe(db: Store, redo = false): string[] {
  const all = new Set<string>()
  for (const r of db.prepare('SELECT terms FROM topic_map').all() as { terms: string }[]) {
    for (const t of readJson<string[]>(r.terms, [])) all.add(String(t).trim().toLowerCase())
  }
  const done = redo ? new Set<string>() : new Set((db.prepare('SELECT term FROM supply').all() as { term: string }[]).map((r) => r.term))
  return [...all].filter((t) => t && !done.has(t)).sort()
}

export function saveSupply(db: Store, term: string, hits: number): void {
  db.prepare('INSERT OR REPLACE INTO supply (term, source, hits, probed_at) VALUES (?, ?, ?, ?)')
    .run(term.trim().toLowerCase(), 'wikimedia', hits, new Date().toISOString())
}
