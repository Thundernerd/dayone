<script setup lang="ts">
const props = defineProps<{
  game: ReleaseGame
}>()

const href = computed(() => props.game.slug ? `https://www.igdb.com/games/${props.game.slug}` : undefined)
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noreferrer' : undefined"
    class="group relative block aspect-[3/4] overflow-hidden bg-neutral-900 outline-none"
  >
    <img
      v-if="game.coverUrl"
      :src="game.coverUrl"
      :alt="`${game.name} cover`"
      class="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:opacity-40 group-focus-visible:scale-105 group-focus-visible:opacity-40"
      loading="lazy"
    >
    <span
      v-else
      class="flex h-full items-center justify-center p-3 text-center font-display text-2xl text-white/40"
    >
      {{ game.name }}
    </span>

    <span class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/60 to-transparent p-3 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
      <span class="text-sm font-semibold leading-tight text-white">{{ game.name }}</span>
      <span class="mt-1 flex flex-wrap gap-1">
        <span
          v-for="item in game.platforms"
          :key="item.slug"
          class="bg-white/15 px-1 text-[10px] uppercase tracking-wide text-white"
          :title="`${item.name} · ${item.humanDate}`"
        >
          {{ item.shortName }}<template v-if="item.humanDate !== game.humanDate"> · {{ item.humanDate }}</template>
        </span>
      </span>
      <span
        v-if="game.summary"
        class="mt-1 line-clamp-3 text-[11px] leading-snug text-white/70"
      >
        {{ game.summary }}
      </span>
    </span>
  </component>
</template>
