<script setup lang="ts">
const props = defineProps<{
  group: ReleaseGroup
}>()

const parts = computed(() => {
  const date = parseIsoDate(props.group.date)
  if (!date) {
    return { day: props.group.date, rest: '' }
  }

  return {
    day: String(date.getUTCDate()).padStart(2, '0'),
    rest: new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      month: 'short',
      timeZone: 'UTC',
    }).format(date),
  }
})
</script>

<template>
  <h2
    class="flex aspect-[3/4] flex-col justify-end bg-red-600 p-3"
    :aria-label="group.label"
  >
    <span class="font-display text-6xl leading-none sm:text-7xl">{{ parts.day }}</span>
    <span class="text-xs font-semibold uppercase tracking-widest">{{ parts.rest }}</span>
    <span class="mt-1 text-[10px] uppercase tracking-widest text-white/70">
      {{ group.games.length }} {{ group.games.length === 1 ? 'game' : 'games' }}
    </span>
  </h2>
</template>
