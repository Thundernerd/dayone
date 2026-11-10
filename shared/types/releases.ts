import type { PlatformOption } from '../utils/platforms'
import type { JunkFilters } from '../utils/junkFilters'

export interface ReleasePlatform {
  slug: string
  shortName: string
  name: string
  releaseDate: number
  humanDate: string
}

export interface ReleaseGame {
  id: number
  name: string
  slug: string | null
  summary: string | null
  coverUrl: string | null
  releaseDate: number
  humanDate: string
  platforms: ReleasePlatform[]
}

export interface ReleaseGroup {
  date: string
  label: string
  games: ReleaseGame[]
}

export interface ReleasesResponse {
  from: string
  to: string
  platforms: PlatformOption[]
  requireAll: boolean
  junk: JunkFilters
  count: number
  games: ReleaseGame[]
}
