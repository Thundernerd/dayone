<script setup lang="ts">
defineProps<{
  game: ReleaseGame
}>()
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-white/10 bg-[#141821] shadow-sm transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg hover:shadow-blue-500/5">
    <div class="relative aspect-[3/4] bg-[#0f131c]">
      <img
        v-if="game.coverUrl"
        :src="game.coverUrl"
        :alt="`${game.name} cover`"
        class="h-full w-full object-cover"
        loading="lazy"
      >
      <div
        v-else
        class="flex h-full items-center justify-center px-4 text-center text-sm text-[#9aa3b5]"
      >
        No cover
      </div>
    </div>
    <div class="flex flex-col gap-2 p-4">
      <p class="text-xs font-medium uppercase tracking-wide text-blue-300">
        {{ game.humanDate }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="item in game.platforms"
          :key="item.slug"
          class="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-blue-200"
          :title="`${item.name} · ${item.humanDate}`"
        >
          {{ item.shortName }}
          <span
            v-if="item.humanDate !== game.humanDate"
            class="font-normal normal-case tracking-normal text-blue-200/70"
          >
            {{ item.humanDate }}
          </span>
        </span>
      </div>
      <h3 class="text-base font-semibold leading-snug text-white">
        <a
          v-if="game.slug"
          :href="`https://www.igdb.com/games/${game.slug}`"
          target="_blank"
          rel="noreferrer"
          class="hover:text-blue-300"
        >
          {{ game.name }}
        </a>
        <span v-else>{{ game.name }}</span>
      </h3>
      <p
        v-if="game.summary"
        class="line-clamp-3 text-sm leading-relaxed text-[#9aa3b5]"
      >
        {{ game.summary }}
      </p>
    </div>
  </article>
</template>
