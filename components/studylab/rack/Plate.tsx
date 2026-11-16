import type { SectionBand } from '@/lib/studylab/mastery-latest'

/**
 * A flat square plate with the logo's four squares set into it. How many are
 * lit is how solid the section is: all four for solid or gold, two bright and
 * two dim (as in the logo) for shaky, four faint for a gap, four pale for a
 * section not tried yet.
 */
const PALETTE: Record<SectionBand, [string, string, [number, number, number, number]]> = {
  solid: ['#2ACBF2', '#0C86CE', [1, 1, 1, 1]],
  gold: ['#F2C14E', '#A87B12', [1, 1, 1, 1]],
  shaky: ['#F4C77B', '#9A5B0B', [1, 0.42, 0.42, 1]],
  gap: ['#F0A3AB', '#B0303C', [0.34, 0.34, 0.34, 0.34]],
  none: ['#E3E9EE', '#B9C5CE', [0.7, 0.7, 0.7, 0.7]],
}

const iso = (u: number, v: number) => `${(60 + (u - v)).toFixed(1)},${(35 + (u + v) * 0.56).toFixed(1)}`

function Cell({ u, v, o }: { u: number; v: number; o: number }) {
  return (
    <polygon
      points={`${iso(u, v)} ${iso(u + 13, v)} ${iso(u + 13, v + 13)} ${iso(u, v + 13)}`}
      fill="#fff" fillOpacity={o} stroke="#fff" strokeOpacity={o} strokeWidth="2.5" strokeLinejoin="round"
    />
  )
}

export function Plate({ band }: { band: SectionBand }) {
  const [top, side, lit] = PALETTE[band]
  return (
    <svg className="p" viewBox="0 0 120 86" aria-hidden="true" focusable="false">
      <polygon points="60,1 120,36 120,48 60,83 0,48 0,36" fill="#fff" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
      <polygon points="9,36 60,65 111,36 111,48 60,77 9,48" fill={side} stroke={side} strokeWidth="7" strokeLinejoin="round" />
      <polygon points="60,7 111,36 60,65 9,36" fill={top} stroke={top} strokeWidth="7" strokeLinejoin="round" />
      <Cell u={-15} v={-15} o={lit[0]} />
      <Cell u={2} v={-15} o={lit[1]} />
      <Cell u={-15} v={2} o={lit[2]} />
      <Cell u={2} v={2} o={lit[3]} />
    </svg>
  )
}
