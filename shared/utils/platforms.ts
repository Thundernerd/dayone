export interface PlatformOption {
  slug: string
  id: number
  name: string
  shortName: string
}

export const PLATFORMS: PlatformOption[] = [
  { slug: 'ps5', id: 167, name: 'PlayStation 5', shortName: 'PS5' },
  { slug: 'ps4', id: 48, name: 'PlayStation 4', shortName: 'PS4' },
  { slug: 'xbox-series', id: 169, name: 'Xbox Series X|S', shortName: 'Xbox Series' },
  { slug: 'xbox-one', id: 49, name: 'Xbox One', shortName: 'Xbox One' },
  { slug: 'switch-2', id: 508, name: 'Nintendo Switch 2', shortName: 'Switch 2' },
  { slug: 'switch', id: 130, name: 'Nintendo Switch', shortName: 'Switch' },
  { slug: 'pc', id: 6, name: 'PC', shortName: 'PC' },
]

export const DEFAULT_PLATFORM_SLUG = 'ps5'

const platformsBySlug = new Map(PLATFORMS.map(platform => [platform.slug, platform]))
const platformsById = new Map(PLATFORMS.map(platform => [platform.id, platform]))

export function getPlatformBySlug(slug: string | undefined | null): PlatformOption | null {
  if (!slug) {
    return null
  }

  return platformsBySlug.get(slug) ?? null
}

export function getPlatformById(id: number | undefined | null): PlatformOption | null {
  if (id == null) {
    return null
  }

  return platformsById.get(id) ?? null
}

export function parsePlatformParam(value: unknown): PlatformOption[] | null {
  if (value == null || value === '') {
    return [platformsBySlug.get(DEFAULT_PLATFORM_SLUG)!]
  }

  const raw = Array.isArray(value) ? value : [value]
  const slugs = raw.flatMap(entry => String(entry).split(','))
    .map(slug => slug.trim())
    .filter(Boolean)

  if (!slugs.length) {
    return [platformsBySlug.get(DEFAULT_PLATFORM_SLUG)!]
  }

  const unique = [...new Set(slugs)]
  const platforms = unique.map(slug => platformsBySlug.get(slug))
  if (platforms.some(platform => platform == null)) {
    return null
  }

  return PLATFORMS.filter(platform => unique.includes(platform.slug))
}

export function serializePlatforms(platforms: PlatformOption[]): string {
  return platforms.map(platform => platform.slug).join(',')
}

export function parseRequireAll(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'all' || raw === '1' || raw === 'true'
}

export function hasAllPlatformSlugs(
  gamePlatforms: Array<{ slug: string }>,
  required: Array<{ slug: string }>,
): boolean {
  if (required.length < 2) {
    return true
  }

  return required.every(platform => gamePlatforms.some(item => item.slug === platform.slug))
}

export function formatPlatformList(platforms: PlatformOption[], conjunction: 'or' | 'and' = 'or'): string {
  if (platforms.length === 1) {
    return platforms[0]!.name
  }

  if (platforms.length === 2) {
    return `${platforms[0]!.name} ${conjunction} ${platforms[1]!.name}`
  }

  const names = platforms.map(platform => platform.name)
  return `${names.slice(0, -1).join(', ')}, ${conjunction} ${names.at(-1)}`
}

export function formatPlatformShortList(platforms: PlatformOption[]): string {
  return platforms.map(platform => platform.shortName).join(' + ')
}
