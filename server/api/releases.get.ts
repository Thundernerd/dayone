export default defineEventHandler(async (event): Promise<ReleasesResponse> => {
  const query = getQuery(event)
  const fromParam = typeof query.from === 'string' ? query.from : ''
  const toParam = typeof query.to === 'string' ? query.to : ''
  const platforms = parsePlatformParam(query.platform)

  if (!platforms) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unknown platform.',
    })
  }

  const fromDate = parseIsoDate(fromParam)
  const toDate = parseIsoDate(toParam)

  if (!fromDate || !toDate) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Query params from and to must be valid YYYY-MM-DD dates.',
    })
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'from must be on or before to.',
    })
  }

  if (rangeDayCount(fromDate, toDate) > MAX_RANGE_DAYS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Date range cannot exceed ${MAX_RANGE_DAYS} days.`,
    })
  }

  const startUnix = toUnixSeconds(fromDate)
  const endUnixExclusive = toUnixSeconds(addUtcDays(toDate, 1))
  const requireAll = parseRequireAll(query.match)

  if (!isValidJunkParam(query.junk)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unknown junk filter.',
    })
  }

  const junk = parseJunkFilters(query.junk, query.hypes)
  let games = await fetchPlatformReleases(
    platforms.map(platform => platform.id),
    startUnix,
    endUnixExclusive,
    junk,
  )

  if (requireAll) {
    games = games.filter(game => hasAllPlatformSlugs(game.platforms, platforms))
  }

  return {
    from: fromParam,
    to: toParam,
    platforms,
    requireAll,
    junk,
    count: games.length,
    games,
  }
})
