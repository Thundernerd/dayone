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

const drawerOpen = ref(false)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    drawerOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const rangeLabel = computed(() => isFullMonth.value
  ? selectedMonthLabel.value
  : `${formatShortDate(from.value)} – ${formatShortDate(to.value)}`)

const compactRangeLabel = computed(() => isFullMonth.value
  ? selectedMonthLabel.value
  : `${formatShortDate(from.value, false)} – ${formatShortDate(to.value, false)}`)

function formatShortDate(iso: string, withYear = true) {
  const parsed = parseIsoDate(iso)
  if (!parsed) {
    return iso
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(parsed)
}

function onRangeSubmit() {
  onSubmit()
  drawerOpen.value = false
}

</script>

<template>
  <div class="min-h-screen pb-16">
    <header class="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-black/80 px-3 py-2 backdrop-blur sm:px-5">
      <h1 class="font-display text-2xl tracking-wider sm:text-3xl">
        Day One<span class="text-red-500">.</span>
      </h1>

      <div class="flex min-w-0 items-center gap-1">
        <button
          class="h-9 w-9 shrink-0 rounded-full text-lg hover:bg-white/10 disabled:opacity-30"
          type="button"
          aria-label="Previous month"
          :disabled="pending"
          @click="shiftSelectedMonth(-1)"
        >
          ‹
        </button>
        <span class="truncate text-center font-display text-lg tracking-wider sm:min-w-[10rem] sm:text-xl">
          <span class="sm:hidden">{{ compactRangeLabel }}</span>
          <span class="hidden sm:inline">{{ rangeLabel }}</span>
        </span>
        <button
          class="h-9 w-9 shrink-0 rounded-full text-lg hover:bg-white/10 disabled:opacity-30"
          type="button"
          aria-label="Next month"
          :disabled="pending"
          @click="shiftSelectedMonth(1)"
        >
          ›
        </button>
      </div>

      <button
        class="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition hover:bg-white hover:text-black sm:px-4"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="drawerOpen"
        @click="drawerOpen = true"
      >
        <span class="hidden sm:inline">{{ platformLabel }} · </span>Filters
      </button>
    </header>

    <Transition name="fade">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-40 bg-black/60"
        @click="drawerOpen = false"
      />
    </Transition>
    <Transition name="slide">
      <aside
        v-if="drawerOpen"
        class="fixed inset-y-0 right-0 z-50 flex w-80 max-w-full flex-col gap-7 overflow-y-auto bg-neutral-950 p-6 ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-display text-3xl tracking-wider">
            Filters
          </h2>
          <button
            type="button"
            class="text-2xl text-white/60 hover:text-white"
            aria-label="Close filters"
            @click="drawerOpen = false"
          >
            ×
          </button>
        </div>

        <section>
          <h3 class="mb-2 text-xs uppercase tracking-widest text-white/50">
            Platforms
          </h3>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="option in PLATFORMS"
              :key="option.slug"
              type="button"
              class="py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
              :class="selectedSlugs.includes(option.slug) ? 'bg-red-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'"
              :aria-pressed="selectedSlugs.includes(option.slug)"
              :disabled="pending"
              @click="togglePlatform(option.slug)"
            >
              {{ option.shortName }}
            </button>
          </div>
          <label
            class="mt-3 flex items-center gap-2 text-sm"
            :class="canRequireAll ? 'text-white/70' : 'text-white/30'"
            :title="canRequireAll ? '' : 'Select at least two platforms'"
          >
            <input
              type="checkbox"
              class="accent-red-600"
              :checked="requireAll && canRequireAll"
              :disabled="!canRequireAll || pending"
              @change="toggleRequireAll()"
            >
            Must be on every selected platform
          </label>
        </section>

        <section>
          <h3 class="mb-2 text-xs uppercase tracking-widest text-white/50">
            Dates
          </h3>
          <label class="block text-sm text-white/70">
            Month
            <input
              v-model="monthInput"
              class="mt-1 w-full bg-white/5 px-3 py-2 text-white outline-none ring-red-600 focus:ring-2"
              type="month"
              :min="MONTH_MIN"
              :max="MONTH_MAX"
              :disabled="pending"
              @change="onMonthChange"
            >
          </label>
          <form
            class="mt-4 flex flex-col gap-2"
            @submit.prevent="onRangeSubmit"
          >
            <p class="text-sm text-white/70">
              Or a custom range
            </p>
            <div class="grid grid-cols-2 gap-2">
              <label class="text-xs text-white/50">
                From
                <input
                  v-model="fromInput"
                  class="mt-1 w-full bg-white/5 px-2 py-2 text-sm text-white outline-none ring-red-600 focus:ring-2"
                  type="date"
                  required
                >
              </label>
              <label class="text-xs text-white/50">
                To
                <input
                  v-model="toInput"
                  class="mt-1 w-full bg-white/5 px-2 py-2 text-sm text-white outline-none ring-red-600 focus:ring-2"
                  type="date"
                  required
                >
              </label>
            </div>
            <button
              class="bg-white py-2 text-sm font-semibold uppercase tracking-widest text-black transition hover:bg-red-600 hover:text-white disabled:opacity-50"
              type="submit"
              :disabled="pending"
            >
              Apply range
            </button>
          </form>
        </section>

        <section>
          <h3 class="mb-2 text-xs uppercase tracking-widest text-white/50">
            Junk
          </h3>
          <label
            v-for="key in JUNK_BOOLEAN_KEYS"
            :key="key"
            class="flex items-center gap-2 py-1 text-sm text-white/70"
          >
            <input
              type="checkbox"
              class="accent-red-600"
              :checked="junk[key]"
              :disabled="pending"
              @change="toggleJunkBoolean(key)"
            >
            {{ JUNK_BOOLEAN_LABELS[key] }}
          </label>
          <label class="mt-3 block text-sm text-white/70">
            <span class="flex justify-between">
              Minimum hypes
              <strong class="text-white">{{ hypesLabel(hypesInput) }}</strong>
            </span>
            <input
              type="range"
              class="mt-1 w-full accent-red-600"
              :min="HYPES_MIN"
              :max="HYPES_MAX"
              step="1"
              :value="hypesInput"
              :disabled="pending"
              @input="onHypesInput"
            >
          </label>
        </section>

        <p class="mt-auto text-xs leading-relaxed text-white/40">
          Full releases on {{ platformSentence }}. DLC, expansions, early access and other add-ons are excluded.
        </p>
      </aside>
    </Transition>

    <p
      v-if="pending"
      class="animate-pulse py-32 text-center font-display text-4xl tracking-widest text-white/30"
    >
      Loading
    </p>

    <section
      v-else-if="error"
      class="mx-auto mt-16 max-w-md px-4 text-center"
    >
      <h2 class="font-display text-4xl tracking-wider text-red-500">
        Could not load releases
      </h2>
      <p class="mt-2 text-sm text-white/60">
        {{ errorMessage }}
      </p>
    </section>

    <section
      v-else-if="!groups.length"
      class="mx-auto mt-16 max-w-md px-4 text-center"
    >
      <h2 class="font-display text-4xl tracking-widest text-white/30">
        Nothing here
      </h2>
      <p class="mt-2 text-sm text-white/50">
        No {{ platformSentence }} releases between {{ from }} and {{ to }}{{ requireAll && canRequireAll ? ' on every selected platform' : '' }}.
      </p>
    </section>

    <div
      v-else
      class="grid grid-cols-3 gap-px bg-white/5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8"
    >
      <template
        v-for="group in groups"
        :key="group.date"
      >
        <DateTile :group="group" />
        <GameCard
          v-for="game in group.games"
          :key="game.id"
          :game="game"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
