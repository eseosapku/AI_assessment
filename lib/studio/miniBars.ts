// Map raw values to pixel/percent heights for a tiny bar chart. A floor keeps
// zero bars visible; an all-zero series collapses to the floor (no divide-by-zero).
export function barHeights(values: number[], maxPx = 100): number[] {
  const max = Math.max(0, ...values)
  const floor = Math.round(maxPx * 0.08)
  if (max === 0) return values.map(() => floor)
  return values.map((v) => Math.max(floor, Math.round((v / max) * maxPx)))
}
