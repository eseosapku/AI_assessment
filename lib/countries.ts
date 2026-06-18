export type CountryCode = 'RW' | 'NG'

export interface CountryMeta {
  code: CountryCode
  name: string
  flag: string
  defaultCurricula: number[]
}

export const COUNTRIES: Record<CountryCode, CountryMeta> = {
  RW: {
    code: 'RW',
    name: 'Rwanda',
    flag: '🇷🇼',
    defaultCurricula: [0, 1],
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    defaultCurricula: [1, 2],
  },
}

export const COUNTRY_LIST = Object.values(COUNTRIES)

export function normalizeCountry(value: unknown): CountryCode {
  const code = String(value ?? '').trim().toUpperCase()
  if (code === 'NG' || code === 'NIGERIA') return 'NG'
  return 'RW'
}

export function classOptionsForCountry(country: CountryCode): { value: string; label: string }[] {
  if (country === 'NG') {
    return [
      ...['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((c) => ({ value: c, label: `Primary ${c.slice(1)}` })),
      ...['JSS1', 'JSS2', 'JSS3'].map((c) => ({ value: c, label: c.replace('JSS', 'Junior Secondary ') })),
      ...['SS1', 'SS2', 'SS3'].map((c) => ({ value: c, label: c.replace('SS', 'Senior Secondary ') })),
    ]
  }
  return [
    { value: 'Grade1', label: 'Grade 1' },
    ...[6, 7, 8, 9, 10, 11, 12].map((n) => ({ value: `Grade ${n}`, label: `Grade ${n}` })),
  ]
}
