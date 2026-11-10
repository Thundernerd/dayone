export function groupReleasesByDate(games: ReleaseGame[]): ReleaseGroup[] {
  const map = new Map<string, ReleaseGame[]>()

  for (const game of games) {
    const key = formatIsoFromUnix(game.releaseDate)
    const list = map.get(key) ?? []
    list.push(game)
    map.set(key, list)
  }

  return [...map.entries()].map(([date, groupedGames]) => ({
    date,
    label: formatGroupLabel(date),
    games: groupedGames,
  }))
}

export function useReleases() {
  const route = useRoute()
  const defaults = defaultDateRange()

  const from = computed(() => {
    const value = route.query.from
    return typeof value === 'string' && isIsoDate(value) ? value : defaults.from
  })

  const to = computed(() => {
    const value = route.query.to
    return typeof value === 'string' && isIsoDate(value) ? value : defaults.to
  })

  const platforms = computed(() => parsePlatformParam(route.query.platform) ?? parsePlatformParam(null)!)

  const requireAll = computed(() => parseRequireAll(route.query.match))

  const junk = computed(() => parseJunkFilters(route.query.junk, route.query.hypes))

  const platformQuery = computed(() => serializePlatforms(platforms.value))

  const matchQuery = computed(() => requireAll.value ? 'all' : undefined)

  const junkQuery = computed(() => serializeJunkParam(junk.value))

  const hypesQuery = computed(() => serializeHypesParam(junk.value.hypes))

  const { data, error, pending, refresh } = useFetch<ReleasesResponse>('/api/releases', {
    query: {
      from,
      to,
      platform: platformQuery,
      match: matchQuery,
      junk: junkQuery,
      hypes: hypesQuery,
    },
    watch: [from, to, platformQuery, requireAll, junkQuery, hypesQuery],
  })

  const groups = computed(() => groupReleasesByDate(data.value?.games ?? []))

  async function applyFilters(options: {
    from: string
    to: string
    platforms: string[]
    requireAll?: boolean
    junk?: JunkFilters
    replace?: boolean
  }) {
    const matchAll = options.requireAll ?? requireAll.value
    const nextJunk = options.junk ?? junk.value
    await navigateTo(
      {
        path: '/',
        query: {
          from: options.from,
          to: options.to,
          platform: serializePlatforms(
            parsePlatformParam(options.platforms.join(',')) ?? parsePlatformParam(null)!,
          ),
          junk: serializeJunkParam(nextJunk),
          ...(matchAll ? { match: 'all' } : {}),
          ...(serializeHypesParam(nextJunk.hypes) ? { hypes: serializeHypesParam(nextJunk.hypes) } : {}),
        },
      },
      { replace: options.replace ?? false },
    )
  }

  return {
    from,
    to,
    platforms,
    requireAll,
    junk,
    data,
    error,
    pending,
    refresh,
    groups,
    applyFilters,
  }
}
