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

## Docker

Each release publishes a multi-arch image (amd64 and arm64) to GitHub Container Registry. Credentials are read at runtime and are never baked into the image:

```bash
docker run -d -p 3000:3000 \
  -e TWITCH_CLIENT_ID=... \
  -e TWITCH_CLIENT_SECRET=... \
  ghcr.io/thundernerd/dayone:latest
```

The repo is private, so the image is too: run `docker login ghcr.io` with a token that has `read:packages` first.

## CI and releases

- **CI** (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request: typecheck, production build, and a Docker build check.
- **Release** (`.github/workflows/release.yml`) runs when you push a version tag. It re-runs CI, publishes the image as `1.2.3`, `1.2`, `1` and `latest`, and creates a GitHub release with generated notes.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Tags with a suffix, such as `v1.1.0-rc.1`, become pre-releases and only get their exact image tag.
