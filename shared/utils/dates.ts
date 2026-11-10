export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const MAX_RANGE_DAYS = 366

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) {
    return false
  }

  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  const date = utcDate(year, month, day)
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  )
}

export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

export function parseIsoDate(value: string): Date | null {
  if (!isIsoDate(value)) {
    return null
  }

  const [year = 0, month = 0, day = 0] = value.split('-').map(Number)
  return utcDate(year, month, day)
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

export function rangeDayCount(from: Date, toInclusive: Date): number {
  return Math.round((toInclusive.getTime() - from.getTime()) / 86_400_000) + 1
}

export function defaultDateRange(now = new Date()): { from: string, to: string } {
  return rangeForMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parseMonthKey(value: string): { year: number, month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    return null
  }

  return { year, month }
}

export function rangeForMonth(year: number, month: number): { from: string, to: string } {
  const from = utcDate(year, month, 1)
  const to = utcDate(year, month + 1, 0)
  return {
    from: formatIsoDate(from),
    to: formatIsoDate(to),
  }
}

export function monthKeyFromRange(fromIso: string, toIso: string): string | null {
  const from = parseIsoDate(fromIso)
  if (!from || from.getUTCDate() !== 1) {
    return null
  }

  const expected = rangeForMonth(from.getUTCFullYear(), from.getUTCMonth() + 1)
  if (expected.from !== fromIso || expected.to !== toIso) {
    return null
  }

  return monthKey(from.getUTCFullYear(), from.getUTCMonth() + 1)
}

export function shiftMonth(year: number, month: number, delta: number): { year: number, month: number } {
  const date = utcDate(year, month, 1)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

export function formatIsoFromUnix(unixSeconds: number): string {
  return formatIsoDate(new Date(unixSeconds * 1000))
}

export function formatGroupLabel(isoDate: string): string {
  const parsed = parseIsoDate(isoDate)
  if (!parsed) {
    return isoDate
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}
