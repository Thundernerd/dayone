# Day One

Upcoming game releases across PlayStation, Xbox, Nintendo and PC, shown as a wall of covers grouped by launch day. Data comes from [IGDB](https://www.igdb.com/).

## Setup

IGDB is accessed through a Twitch application. Register a confidential app at <https://dev.twitch.tv/console/apps>, then copy `.env.example` to `.env` and fill in the credentials:

```bash
cp .env.example .env
npm install
```

## Development

```bash
npm run dev      # http://localhost:3000
```

## Production

```bash
npm run build
npm run preview  # preview the production build locally
```

See the [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment) for hosting options.
