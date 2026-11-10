const PAGE_SIZE = 500
const MAX_PAGES = 10
const COVER_BASE = 'https://images.igdb.com/igdb/image/upload/t_cover_big'
const FULL_RELEASE_STATUS_ID = 6
const EXCLUDED_GAME_TYPES = new Set([
  1, // dlc_addon
  2, // expansion
  13, // pack
  14, // update
])

interface TwitchTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface IgdbCover {
  id: number
  image_id: string
}

interface IgdbGame {
  id: number
  name: string
  slug?: string
  summary?: string
  cover?: IgdbCover
  category?: number
  game_type?: number | { id: number }
}

interface IgdbReleaseDate {
  id: number
  date?: number
  human?: string
  category?: number
  status?: number | { id: number }
  platform?: number | { id: number }
  game?: IgdbGame | number
}

interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

function requireCredentials() {
  const config = useRuntimeConfig()
  // Nuxt only overrides runtimeConfig with NUXT_-prefixed vars at runtime, so a prebuilt
  // image (e.g. Docker) would otherwise ignore TWITCH_CLIENT_ID/SECRET set on the container.
  const clientId = String(config.twitchClientId || process.env.TWITCH_CLIENT_ID || '')
  const clientSecret = String(config.twitchClientSecret || process.env.TWITCH_CLIENT_SECRET || '')

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'IGDB is not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.',
    })
  }

  return { clientId, clientSecret }
}

async function fetchAccessToken(forceRefresh = false): Promise<{ token: string, clientId: string }> {
  const { clientId, clientSecret } = requireCredentials()
  const now = Date.now()

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 60_000) {
    return { token: cachedToken.token, clientId }
  }

  const url = new URL('https://id.twitch.tv/oauth2/token')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('grant_type', 'client_credentials')

  try {
    const data = await $fetch<TwitchTokenResponse>(url.toString(), { method: 'POST' })
    cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    }
    return { token: data.access_token, clientId }
  }
  catch {
    cachedToken = null
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to authenticate with Twitch for IGDB access.',
    })
  }
}

async function igdbPost<T>(body: string, retried = false): Promise<T> {
  const { token, clientId } = await fetchAccessToken(retried)

  try {
    return await $fetch<T, string>('https://api.igdb.com/v4/release_dates', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body,
    })
  }
  catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined

    if (!retried && status === 401) {
      cachedToken = null
      return igdbPost<T>(body, true)
    }

    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch release dates from IGDB.',
    })
  }
}

function buildQuery(
  platformIds: number[],
  startUnix: number,
  endUnixExclusive: number,
  offset: number,
  junk: JunkFilters,
): string {
  const platformFilter = platformIds.length === 1
    ? `platform = ${platformIds[0]}`
    : `platform = (${platformIds.join(',')})`

  const clauses = [
    platformFilter,
    `date >= ${startUnix}`,
    `date < ${endUnixExclusive}`,
    'date != null',
    `(status = ${FULL_RELEASE_STATUS_ID} | status = null)`,
  ]

  if (junk.adult) {
    clauses.push(`game.themes != (${ADULT_THEME_ID})`)
  }

  if (junk.cover) {
    clauses.push('game.cover != null')
    clauses.push('game.summary != null')
  }

  if (junk.company) {
    clauses.push('game.involved_companies != null')
  }

  if (junk.hypes > 0) {
    clauses.push(`game.hypes >= ${junk.hypes}`)
  }

  return `
fields date, human, category, status, platform, game.id, game.name, game.slug, game.cover.image_id, game.summary, game.category, game.game_type;
where ${clauses.join(' & ')};
sort date asc;
limit ${PAGE_SIZE};
offset ${offset};
`.trim()
}

function coverUrl(imageId?: string): string | null {
  if (!imageId) {
    return null
  }

  return `${COVER_BASE}/${imageId}.jpg`
}

function gameTypeId(game: IgdbGame): number | null {
  const value = game.game_type ?? game.category
  if (typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && typeof value.id === 'number') {
    return value.id
  }

  return null
}

function statusId(row: IgdbReleaseDate): number | null {
  const value = row.status
  if (typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && typeof value.id === 'number') {
    return value.id
  }

  return null
}

function isFullRelease(row: IgdbReleaseDate): boolean {
  const status = statusId(row)
  return status == null || status === FULL_RELEASE_STATUS_ID
}

function isDlcOrAddon(game: IgdbGame): boolean {
  const type = gameTypeId(game)
  return type != null && EXCLUDED_GAME_TYPES.has(type)
}

function asGame(game: IgdbReleaseDate['game']): IgdbGame | null {
  if (!game || typeof game !== 'object' || typeof game.id !== 'number' || !game.name) {
    return null
  }

  return game
}

function rowPlatformId(row: IgdbReleaseDate): number | null {
  const value = row.platform
  if (typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && typeof value.id === 'number') {
    return value.id
  }

  return null
}

function mergeByGame(rows: IgdbReleaseDate[]): ReleaseGame[] {
  const byGame = new Map<number, {
    game: IgdbGame
    byPlatform: Map<string, ReleasePlatform>
  }>()

  for (const row of rows) {
    const game = asGame(row.game)
    if (!game || row.date == null || !isFullRelease(row) || isDlcOrAddon(game)) {
      continue
    }

    const platform = getPlatformById(rowPlatformId(row))
    if (!platform) {
      continue
    }

    const entry = byGame.get(game.id) ?? { game, byPlatform: new Map() }
    const existing = entry.byPlatform.get(platform.slug)
    if (!existing || row.date < existing.releaseDate) {
      entry.byPlatform.set(platform.slug, {
        slug: platform.slug,
        shortName: platform.shortName,
        name: platform.name,
        releaseDate: row.date,
        humanDate: row.human ?? formatIsoFromUnix(row.date),
      })
    }

    byGame.set(game.id, entry)
  }

  return [...byGame.values()]
    .map(({ game, byPlatform }) => {
      const platforms = [...byPlatform.values()].sort((a, b) => a.releaseDate - b.releaseDate)
      const earliest = platforms[0]!

      return {
        id: game.id,
        name: game.name,
        slug: game.slug ?? null,
        summary: game.summary ?? null,
        coverUrl: coverUrl(game.cover?.image_id),
        releaseDate: earliest.releaseDate,
        humanDate: earliest.humanDate,
        platforms,
      }
    })
    .sort((a, b) => a.releaseDate - b.releaseDate || a.name.localeCompare(b.name))
}

export async function fetchPlatformReleases(
  platformIds: number[],
  startUnix: number,
  endUnixExclusive: number,
  junk: JunkFilters = DEFAULT_JUNK_FILTERS,
): Promise<ReleaseGame[]> {
  const rows: IgdbReleaseDate[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE
    const batch = await igdbPost<IgdbReleaseDate[]>(buildQuery(platformIds, startUnix, endUnixExclusive, offset, junk))
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) {
      break
    }
  }

  return mergeByGame(rows)
}
