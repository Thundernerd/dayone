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

The image is private, even though the repo is public: run `docker login ghcr.io` with a token that has `read:packages` first.

## Proxmox VE container

`deploy/proxmox/ct/dayone.sh` is a [community-scripts.org](https://community-scripts.org) script. It runs on their shared engine ([community-scripts/core](https://github.com/community-scripts/core)), so the Day One container is set up like every other community-scripts container: the same Default/Advanced wizard (container ID, storage, network, VLAN, SSH, password and so on), console auto-login when no root password is set, the community-scripts MOTD, the container notes in the Proxmox UI, and the `update` command. Only Day One's own two files come from this repository: `ct/dayone.sh` and `install/dayone-install.sh`.

Run this in the Proxmox VE node's shell:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Thundernerd/dayone/main/deploy/proxmox/ct/dayone.sh)"
```

The defaults are an unprivileged Debian 13 container with 1 core, 512 MiB RAM and a 4 GiB disk, on x86_64 or arm64. Day One is installed from the server archive of the latest [release](https://github.com/Thundernerd/dayone/releases) and runs on Node 26, so nothing is built in the container. Presets work like in any community script, e.g. `var_ram=1024 var_disk=8 bash -c "$(curl …)"`.

Day One listens on port 3000 of the container's IP. Inside the container:
- `/etc/dayone/dayone.env` holds the Twitch credentials (see [Setup](#setup)). It starts out empty, and until `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are filled in, the page shows "IGDB is not configured" instead of releases. Run `systemctl restart dayone` after changes.
- `/opt/dayone` holds the release files, and the `dayone` service runs them as the `dayone` user.

To update, run `update` in the container. When a newer release exists, it stops Day One, replaces `/opt/dayone`, updates Node 26 and starts Day One again. `/etc/dayone/dayone.env` is kept.

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
