// Deterministic shuffle so an activity looks identical on reload and in export.
export function seededShuffle<T>(arr: T[], seed = 1): T[] {
  const out = [...arr]
  // mulberry32 — small, fast, good enough for presentation shuffling.
  let s = seed >>> 0 || 1
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
