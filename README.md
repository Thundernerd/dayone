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

- **CI** (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request: typecheck, production build, a smoke test of the packaged server archive, a Docker build check, and `actionlint` plus `shellcheck`.
- **Release** (`.github/workflows/release.yml`) runs when you push a version tag. It re-runs CI, publishes the image as `1.2.3`, `1.2`, `1` and `latest`, and creates a GitHub release with generated notes. The release has the server archive `dayone-1.2.3.tar.gz` attached, with its `dayone-1.2.3.tar.gz.sha256` checksum.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Tags with a suffix, such as `v1.1.0-rc.1`, become pre-releases and only get their exact image tag.

Both workflows also smoke-test the archive with Twitch credentials, checking that the packaged server fetches release JSON from IGDB. This needs the repository secrets `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`, which are passed to that step only, never to the build:

```bash
gh secret set TWITCH_CLIENT_ID
gh secret set TWITCH_CLIENT_SECRET
```

Runs without the secrets, such as pull requests from forks or Dependabot, skip that step with a notice. So does the CI run inside the release workflow; the release's own publish job runs the check instead.

### Running the server archive

The archive is the built Nuxt server with its dependencies bundled, so it runs on any architecture with Node 26 and nothing else. Credentials are read at runtime and are never baked into it:

```bash
sha256sum -c dayone-1.2.3.tar.gz.sha256
tar -xzf dayone-1.2.3.tar.gz
cd dayone-1.2.3
PORT=3000 TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... node server/index.mjs
```

To build and check an archive locally, the same way the release does:

```bash
scripts/package-release.sh 1.2.3                           # dist/dayone-1.2.3.tar.gz (+ .sha256)
scripts/smoke-test-release.sh dist/dayone-1.2.3.tar.gz      # API must answer 503 without credentials
scripts/smoke-test-release.sh --with-credentials dist/dayone-1.2.3.tar.gz   # needs TWITCH_* set
```
