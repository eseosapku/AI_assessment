import { NIGERIA_CURRICULUM, NIGERIA_LEVELS } from './nigeria-curriculum'

export type CountryCode =
  | 'INT'
  | 'NG'
  | 'KE'
  | 'GH'
  | 'UG'
  | 'RW'
  | 'ZA'
  | 'TZ'
  | 'ET'
  | 'CM'
  | 'SN'
  | 'ZM'
  | 'ZW'

export type CountryGroup = 'international' | 'africa'

export interface CountryMeta {
  code: CountryCode
  name: string
  flag: string
  group: CountryGroup
  defaultCurricula: number[]
  /** Short line for signup — curricula available */
  curriculumNote: string
  /** Short line for signup — how they can pay */
  paymentNote: string
}

const CAMBRIDGE_ONLY = [1] as const
const RW_CURRICULA = [0, 1] as const
const NG_CURRICULA = [1, 2, 3, 4] as const

export const COUNTRIES: Record<CountryCode, CountryMeta> = {
  INT: {
    code: 'INT',
    name: 'International / Other',
    flag: '🌍',
    group: 'international',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International debit or credit card (USD)',
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    group: 'africa',
    defaultCurricula: [...NG_CURRICULA],
    curriculumNote: 'NERDC national syllabus, Cambridge, WAEC & JAMB prep',
    paymentNote: 'Card, bank transfer, or USSD (NGN)',
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    flag: '🇰🇪',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'M-Pesa (KES)',
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    flag: '🇬🇭',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'Mobile money (GHS)',
  },
  UG: {
    code: 'UG',
    name: 'Uganda',
    flag: '🇺🇬',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'MTN / Airtel MoMo (UGX)',
  },
  RW: {
    code: 'RW',
    name: 'Rwanda',
    flag: '🇷🇼',
    group: 'africa',
    defaultCurricula: [...RW_CURRICULA],
    curriculumNote: 'Rwanda REB national curriculum & Cambridge',
    paymentNote: 'MTN Mobile Money (RWF)',
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
  TZ: {
    code: 'TZ',
    name: 'Tanzania',
    flag: '🇹🇿',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
  ET: {
    code: 'ET',
    name: 'Ethiopia',
    flag: '🇪🇹',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
  CM: {
    code: 'CM',
    name: 'Cameroon',
    flag: '🇨🇲',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
  SN: {
    code: 'SN',
    name: 'Senegal',
    flag: '🇸🇳',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
  ZM: {
    code: 'ZM',
    name: 'Zambia',
    flag: '🇿🇲',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
  ZW: {
    code: 'ZW',
    name: 'Zimbabwe',
    flag: '🇿🇼',
    group: 'africa',
    defaultCurricula: [...CAMBRIDGE_ONLY],
    curriculumNote: 'Cambridge International (CAIE)',
    paymentNote: 'International card (USD)',
  },
}

export const COUNTRY_GROUP_LABELS: Record<CountryGroup, string> = {
  international: 'International',
  africa: 'Africa',
}

/** Signup/settings dropdown order: general first, then African countries. */
export const COUNTRY_LIST: CountryMeta[] = [
  COUNTRIES.INT,
  COUNTRIES.NG,
  COUNTRIES.KE,
  COUNTRIES.GH,
  COUNTRIES.UG,
  COUNTRIES.RW,
  COUNTRIES.ZA,
  COUNTRIES.TZ,
  COUNTRIES.ET,
  COUNTRIES.CM,
  COUNTRIES.SN,
  COUNTRIES.ZM,
  COUNTRIES.ZW,
]

const CODE_ALIASES: Record<string, CountryCode> = {
  INT: 'INT',
  INTERNATIONAL: 'INT',
  OTHER: 'INT',
  GLOBAL: 'INT',
  NG: 'NG',
  NIGERIA: 'NG',
  KE: 'KE',
  KENYA: 'KE',
  GH: 'GH',
  GHANA: 'GH',
  UG: 'UG',
  UGANDA: 'UG',
  RW: 'RW',
  RWANDA: 'RW',
  ZA: 'ZA',
  'SOUTH AFRICA': 'ZA',
  TZ: 'TZ',
  TANZANIA: 'TZ',
  ET: 'ET',
  ETHIOPIA: 'ET',
  CM: 'CM',
  CAMEROON: 'CM',
  SN: 'SN',
  SENEGAL: 'SN',
  ZM: 'ZM',
  ZAMBIA: 'ZM',
  ZW: 'ZW',
  ZIMBABWE: 'ZW',
}

export function isCountryCode(value: unknown): value is CountryCode {
  const code = String(value ?? '').trim().toUpperCase()
  return code in COUNTRIES
}

export function normalizeCountry(value: unknown): CountryCode {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return 'RW'
  // users.country is VARCHAR(2) in RDS; International is stored as XX
  if (raw === 'XX') return 'INT'
  if (raw in COUNTRIES) return raw as CountryCode
  return CODE_ALIASES[raw] ?? 'INT'
}

/** Persist country on users/classes (VARCHAR(2) — INT stored as XX). */
export function countryToDb(code: CountryCode): string {
  return code === 'INT' ? 'XX' : code
}

export function getCountryMeta(code: CountryCode | null | undefined): CountryMeta {
  return COUNTRIES[normalizeCountry(code)]
}

export function countrySignupHint(code: CountryCode | null | undefined): string {
  const meta = getCountryMeta(code)
  return `${meta.curriculumNote} · ${meta.paymentNote}`
}

export function classOptionsForCountry(country: CountryCode): { value: string; label: string }[] {
  if (country === 'NG') {
    return NIGERIA_LEVELS.map((level) => ({
      value: level,
      label: NIGERIA_CURRICULUM[level].label,
    }))
  }

  if (country === 'RW') {
    return [
      { value: 'Grade1', label: 'Grade 1' },
      ...[6, 7, 8, 9, 10, 11, 12].map((n) => ({ value: `Grade ${n}`, label: `Grade ${n}` })),
    ]
  }

  return [
    { value: 'Year 1', label: 'Year 1 (Primary)' },
    ...[2, 3, 4, 5, 6].map((n) => ({ value: `Year ${n}`, label: `Year ${n} (Primary)` })),
    ...[7, 8, 9].map((n) => ({ value: `Year ${n}`, label: `Year ${n} (Lower Secondary)` })),
    ...[10, 11].map((n) => ({ value: `Year ${n}`, label: `Year ${n} (IGCSE)` })),
    { value: 'Year 12', label: 'Year 12 (AS Level)' },
    { value: 'Year 13', label: 'Year 13 (A Level)' },
  ]
}
