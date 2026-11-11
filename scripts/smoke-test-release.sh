#!/usr/bin/env bash
# Smoke-tests a release archive made by scripts/package-release.sh, the way an
# installer would consume it.
#
# Usage: scripts/smoke-test-release.sh dist/dayone-<version>.tar.gz
set -euo pipefail

archive="${1:?usage: $0 <path to dayone-<version>.tar.gz>}"

fail() {
  echo "smoke test failed: $*" >&2
  exit 1
}

[[ -f "$archive" ]] || fail "$archive does not exist"
[[ -f "$archive.sha256" ]] || fail "$archive.sha256 does not exist"

# The checksum file names the archive without a path, so check it from its own directory.
(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256") \
  || fail "checksum does not match"

# Extract into an empty directory outside the repo, dropping the top-level
# dayone-<version>/ directory like the community-scripts prebuild mode does.
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
tar -xzf "$archive" -C "$workdir" --strip-components=1

[[ -f "$workdir/server/index.mjs" ]] || fail "server/index.mjs is not at the archive root"
[[ ! -e "$workdir/node_modules" ]] || fail "the archive should not ship a top-level node_modules"

port="${SMOKE_PORT:-3123}"
base="http://127.0.0.1:$port"
log="$workdir/server.log"

(cd "$workdir" && exec env -u TWITCH_CLIENT_ID -u TWITCH_CLIENT_SECRET \
  HOST=127.0.0.1 PORT="$port" node server/index.mjs) >"$log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; rm -rf "$workdir"' EXIT

for _ in $(seq 1 60); do
  curl -fs -o /dev/null "$base/" && break
  kill -0 "$server_pid" 2>/dev/null || { cat "$log" >&2; fail "server exited during startup"; }
  sleep 0.5
done

# / redirects to the default date range, so follow it to the page itself.
status="$(curl -sL -o "$workdir/page.html" -w '%{http_code}' "$base/")"
[[ "$status" == 200 ]] || { cat "$log" >&2; fail "GET / returned $status, expected 200"; }
grep -q '<title>Day One</title>' "$workdir/page.html" || fail "GET / did not serve the Day One page"

echo "smoke test passed: $archive"
