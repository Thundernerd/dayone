// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    twitchClientId: process.env.TWITCH_CLIENT_ID || '',
    twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  },
  app: {
    head: {
      title: 'PS5 Upcoming Releases',
      htmlAttrs: { lang: 'en' },
      meta: [
        {
          name: 'description',
          content: 'PlayStation 5 game releases in a chosen date range.',
        },
      ],
    },
  },
})
