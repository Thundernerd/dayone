export const HYPES_MIN = 0
export const HYPES_MAX = 50
export const ADULT_THEME_ID = 42

export const JUNK_BOOLEAN_KEYS = ['adult', 'cover', 'company'] as const
export type JunkBooleanKey = typeof JUNK_BOOLEAN_KEYS[number]

export interface JunkFilters {
  adult: boolean
  cover: boolean
  company: boolean
  hypes: number
}

export const DEFAULT_JUNK_FILTERS: JunkFilters = {
  adult: true,
  cover: true,
  company: false,
  hypes: 0,
}

export const JUNK_BOOLEAN_LABELS: Record<JunkBooleanKey, string> = {
  adult: 'Hide adult',
  cover: 'Require cover',
  company: 'Require a company',
}

export function clampHypes(value: number): number {
  if (!Number.isFinite(value)) {
    return HYPES_MIN
  }

  return Math.min(HYPES_MAX, Math.max(HYPES_MIN, Math.round(value)))
}

export function parseHypesParam(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw == null || raw === '') {
    return DEFAULT_JUNK_FILTERS.hypes
  }

  const parsed = Number(raw)
  return clampHypes(parsed)
}

export function parseJunkParam(value: unknown): Pick<JunkFilters, JunkBooleanKey> {
  if (value == null || value === '') {
    return {
      adult: DEFAULT_JUNK_FILTERS.adult,
      cover: DEFAULT_JUNK_FILTERS.cover,
      company: DEFAULT_JUNK_FILTERS.company,
    }
  }

  const raw = Array.isArray(value) ? value.join(',') : String(value)
  if (raw === 'none') {
    return {
      adult: false,
      cover: false,
      company: false,
    }
  }

  const keys = new Set(raw.split(',').map(key => key.trim()).filter(Boolean))
  const unknown = [...keys].some(key => !JUNK_BOOLEAN_KEYS.includes(key as JunkBooleanKey))
  if (unknown) {
    return {
      adult: false,
      cover: false,
      company: false,
    }
  }

  return {
    adult: keys.has('adult'),
    cover: keys.has('cover'),
    company: keys.has('company'),
  }
}

export function isValidJunkParam(value: unknown): boolean {
  if (value == null || value === '') {
    return true
  }

  const raw = Array.isArray(value) ? value.join(',') : String(value)
  if (raw === 'none') {
    return true
  }

  const keys = raw.split(',').map(key => key.trim()).filter(Boolean)
  return keys.length > 0 && keys.every(key => JUNK_BOOLEAN_KEYS.includes(key as JunkBooleanKey))
}

export function parseJunkFilters(junkValue: unknown, hypesValue: unknown): JunkFilters {
  return {
    ...parseJunkParam(junkValue),
    hypes: parseHypesParam(hypesValue),
  }
}

export function serializeJunkParam(filters: Pick<JunkFilters, JunkBooleanKey>): string {
  const keys = JUNK_BOOLEAN_KEYS.filter(key => filters[key])
  return keys.length ? keys.join(',') : 'none'
}

export function serializeHypesParam(hypes: number): string | undefined {
  const clamped = clampHypes(hypes)
  return clamped > 0 ? String(clamped) : undefined
}

export function hypesLabel(hypes: number): string {
  const clamped = clampHypes(hypes)
  return clamped === 0 ? 'No minimum' : `${clamped}+`
}
