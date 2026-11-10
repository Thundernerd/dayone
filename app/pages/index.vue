<script setup lang="ts">
const MONTH_MIN = '2020-01'
const MONTH_MAX = monthKey(new Date().getUTCFullYear() + 3, 12)

const {
  from,
  to,
  platforms,
  requireAll,
  junk,
  data,
  error,
  pending,
  groups,
  applyFilters,
} = useReleases()

const route = useRoute()
const fromInput = ref(from.value)
const toInput = ref(to.value)
const monthInput = ref(monthKeyFromRange(from.value, to.value) ?? from.value.slice(0, 7))
const selectedSlugs = ref(platforms.value.map(platform => platform.slug))
const hypesInput = ref(junk.value.hypes)
let hypesTimer: ReturnType<typeof setTimeout> | null = null

if (
  typeof route.query.from !== 'string'
  || typeof route.query.to !== 'string'
  || typeof route.query.platform !== 'string'
  || typeof route.query.junk !== 'string'
) {
  await applyFilters({
    from: from.value,
    to: to.value,
    platforms: selectedSlugs.value,
    requireAll: requireAll.value,
    junk: junk.value,
    replace: true,
  })
}

watch([from, to], ([nextFrom, nextTo]) => {
  fromInput.value = nextFrom
  toInput.value = nextTo
  monthInput.value = monthKeyFromRange(nextFrom, nextTo) ?? nextFrom.slice(0, 7)
})

watch(platforms, (nextPlatforms) => {
  selectedSlugs.value = nextPlatforms.map(platform => platform.slug)
}, { deep: true })

watch(() => junk.value.hypes, (nextHypes) => {
  hypesInput.value = nextHypes
})

onUnmounted(() => {
  if (hypesTimer) {
    clearTimeout(hypesTimer)
  }
})

function currentPlatformSlugs() {
  return selectedSlugs.value.length ? selectedSlugs.value : platforms.value.map(platform => platform.slug)
}

function currentJunk(overrides: Partial<JunkFilters> = {}): JunkFilters {
  return {
    ...junk.value,
    hypes: hypesInput.value,
    ...overrides,
  }
}

function applyCurrent(overrides: {
  from?: string
  to?: string
  platforms?: string[]
  requireAll?: boolean
  junk?: JunkFilters
  replace?: boolean
} = {}) {
  applyFilters({
    from: overrides.from ?? from.value,
    to: overrides.to ?? to.value,
    platforms: overrides.platforms ?? currentPlatformSlugs(),
    requireAll: overrides.requireAll ?? requireAll.value,
    junk: overrides.junk ?? currentJunk(),
    replace: overrides.replace,
  })
}

function applyMonth(year: number, month: number) {
  const range = rangeForMonth(year, month)
  monthInput.value = monthKey(year, month)
  fromInput.value = range.from
  toInput.value = range.to
  applyFilters({
    from: range.from,
    to: range.to,
    platforms: currentPlatformSlugs(),
    requireAll: requireAll.value,
    junk: currentJunk(),
  })
}

function onMonthChange() {
  const parsed = parseMonthKey(monthInput.value)
  if (!parsed) {
    return
  }

  applyMonth(parsed.year, parsed.month)
}

function shiftSelectedMonth(delta: number) {
  const parsed = parseMonthKey(monthInput.value)
    ?? parseMonthKey(from.value.slice(0, 7))
  if (!parsed) {
    return
  }

  const next = shiftMonth(parsed.year, parsed.month, delta)
  applyMonth(next.year, next.month)
}

function togglePlatform(slug: string) {
  const next = selectedSlugs.value.includes(slug)
    ? selectedSlugs.value.filter(value => value !== slug)
    : [...selectedSlugs.value, slug]

  if (!next.length) {
    return
  }

  selectedSlugs.value = PLATFORMS.filter(platform => next.includes(platform.slug)).map(platform => platform.slug)
  applyFilters({
    from: from.value,
    to: to.value,
    platforms: selectedSlugs.value,
    requireAll: requireAll.value,
    junk: currentJunk(),
  })
}

function onSubmit() {
  applyFilters({
    from: fromInput.value,
    to: toInput.value,
    platforms: currentPlatformSlugs(),
    requireAll: requireAll.value,
    junk: currentJunk(),
  })
}

function toggleRequireAll() {
  if (platforms.value.length < 2) {
    return
  }

  applyFilters({
    from: from.value,
    to: to.value,
    platforms: currentPlatformSlugs(),
    requireAll: !requireAll.value,
    junk: currentJunk(),
  })
}

function toggleJunkBoolean(key: JunkBooleanKey) {
  applyCurrent({
    junk: currentJunk({ [key]: !junk.value[key] }),
  })
}

function onHypesInput(event: Event) {
  const value = clampHypes(Number((event.target as HTMLInputElement).value))
  hypesInput.value = value

  if (hypesTimer) {
    clearTimeout(hypesTimer)
  }

  hypesTimer = setTimeout(() => {
    applyCurrent({
      junk: currentJunk({ hypes: value }),
    })
  }, 200)
}

const selectedMonthLabel = computed(() => {
  const parsed = parseMonthKey(monthInput.value)
  if (!parsed) {
    return 'Choose a month'
  }

  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate(parsed.year, parsed.month, 1))
})

const isFullMonth = computed(() => monthKeyFromRange(from.value, to.value) != null)
const platformLabel = computed(() => formatPlatformShortList(platforms.value))
const platformSentence = computed(() => formatPlatformList(platforms.value, requireAll.value ? 'and' : 'or'))
const canRequireAll = computed(() => platforms.value.length > 1)

const errorMessage = computed(() => {
  if (!error.value) {
    return ''
  }

  return error.value.statusMessage || error.value.message || 'Could not load releases.'
})
</script>

<template>
  <div class="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header class="mb-8 flex flex-col gap-6 border-b border-white/10 pb-8">
      <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          {{ platformLabel }}
        </p>
        <h1 class="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Upcoming releases
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-[#9aa3b5] sm:text-base">
          Games with a full release on {{ platformSentence }} in the selected window. DLC, expansions, early access, and other add-ons are excluded.
        </p>
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <p class="text-sm text-[#9aa3b5]">
            Platforms
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in PLATFORMS"
              :key="option.slug"
              class="rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="selectedSlugs.includes(option.slug)
                ? 'border-blue-400/40 bg-blue-500 text-white'
                : 'border-white/10 bg-[#141821] text-[#eef1f6] hover:border-white/20 hover:bg-[#1b2130]'"
              type="button"
              :aria-pressed="selectedSlugs.includes(option.slug)"
              :disabled="pending"
              @click="togglePlatform(option.slug)"
            >
              {{ option.shortName }}
            </button>
          </div>
          <button
            class="mt-1 flex w-fit items-center gap-3 rounded-xl px-1 py-1 text-left text-sm text-[#9aa3b5] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            role="switch"
            :aria-checked="requireAll"
            :disabled="pending || !canRequireAll"
            :title="canRequireAll ? 'Show only games releasing on every selected platform' : 'Select at least two platforms'"
            @click="toggleRequireAll"
          >
            <span
              class="relative h-6 w-11 shrink-0 rounded-full transition"
              :class="requireAll && canRequireAll ? 'bg-blue-500' : 'bg-white/15'"
            >
              <span
                class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition"
                :class="requireAll && canRequireAll ? 'translate-x-5' : 'translate-x-0'"
              />
            </span>
            Only games on every selected platform
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-sm text-[#9aa3b5]">
            Junk filters
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="key in JUNK_BOOLEAN_KEYS"
              :key="key"
              class="rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="junk[key]
                ? 'border-blue-400/40 bg-blue-500 text-white'
                : 'border-white/10 bg-[#141821] text-[#eef1f6] hover:border-white/20 hover:bg-[#1b2130]'"
              type="button"
              :aria-pressed="junk[key]"
              :disabled="pending"
              @click="toggleJunkBoolean(key)"
            >
              {{ JUNK_BOOLEAN_LABELS[key] }}
            </button>
          </div>
          <label class="flex flex-col gap-2 text-sm text-[#9aa3b5]">
            <span class="flex items-center justify-between gap-3">
              Minimum hypes
              <span class="text-white">{{ hypesLabel(hypesInput) }}</span>
            </span>
            <input
              :value="hypesInput"
              class="w-full accent-blue-500"
              type="range"
              :min="HYPES_MIN"
              :max="HYPES_MAX"
              step="1"
              :disabled="pending"
              @input="onHypesInput"
            >
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-sm text-[#9aa3b5]">
            Month
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="rounded-xl border border-white/10 bg-[#141821] px-3 py-2.5 text-white transition hover:border-white/20 hover:bg-[#1b2130] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              aria-label="Previous month"
              :disabled="pending"
              @click="shiftSelectedMonth(-1)"
            >
              ‹
            </button>
            <label class="relative min-w-[10rem] flex-1">
              <span class="sr-only">Select month</span>
              <input
                v-model="monthInput"
                class="w-full rounded-xl border border-white/10 bg-[#141821] px-3 py-2.5 text-white outline-none ring-blue-500 focus:ring-2"
                type="month"
                :min="MONTH_MIN"
                :max="MONTH_MAX"
                :disabled="pending"
                @change="onMonthChange"
              >
            </label>
            <button
              class="rounded-xl border border-white/10 bg-[#141821] px-3 py-2.5 text-white transition hover:border-white/20 hover:bg-[#1b2130] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              aria-label="Next month"
              :disabled="pending"
              @click="shiftSelectedMonth(1)"
            >
              ›
            </button>
            <p
              v-if="isFullMonth"
              class="text-sm text-[#9aa3b5]"
            >
              {{ selectedMonthLabel }}
            </p>
          </div>
        </div>

        <form
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="onSubmit"
        >
          <label class="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-[#9aa3b5]">
            Start date
            <input
              v-model="fromInput"
              class="rounded-xl border border-white/10 bg-[#141821] px-3 py-2.5 text-white outline-none ring-blue-500 focus:ring-2"
              type="date"
              required
            >
          </label>
          <label class="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-[#9aa3b5]">
            End date
            <input
              v-model="toInput"
              class="rounded-xl border border-white/10 bg-[#141821] px-3 py-2.5 text-white outline-none ring-blue-500 focus:ring-2"
              type="date"
              required
            >
          </label>
          <button
            class="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            :disabled="pending"
          >
            {{ pending ? 'Loading…' : 'Show releases' }}
          </button>
        </form>
      </div>
    </header>

    <p
      v-if="pending"
      class="mb-6 text-sm text-[#9aa3b5]"
    >
      Loading {{ platformLabel }} releases…
    </p>

    <section
      v-else-if="error"
      class="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-6 text-sm text-red-100"
    >
      <h2 class="mb-1 font-semibold text-red-50">
        Could not load releases
      </h2>
      <p>{{ errorMessage }}</p>
    </section>

    <section
      v-else-if="!groups.length"
      class="rounded-2xl border border-white/10 bg-[#141821] px-5 py-10 text-center"
    >
      <h2 class="text-lg font-semibold text-white">
        No {{ platformLabel }} releases
      </h2>
      <p class="mt-2 text-sm text-[#9aa3b5]">
        Nothing in IGDB matches a {{ platformSentence }} launch between {{ from }} and {{ to }}{{ requireAll && canRequireAll ? ' on every selected platform' : '' }}.
      </p>
    </section>

    <div
      v-else
      class="flex flex-col gap-10"
    >
      <p class="text-sm text-[#9aa3b5]">
        {{ data?.count }} {{ data?.count === 1 ? 'game' : 'games' }}
        releasing on {{ requireAll && canRequireAll ? 'every selected platform' : platformLabel }}
        from {{ from }} to {{ to }}.
      </p>

      <section
        v-for="group in groups"
        :key="group.date"
        class="flex flex-col gap-4"
      >
        <h2 class="text-lg font-semibold text-white">
          {{ group.label }}
        </h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <GameCard
            v-for="game in group.games"
            :key="game.id"
            :game="game"
          />
        </div>
      </section>
    </div>
  </div>
</template>
