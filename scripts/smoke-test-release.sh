#!/usr/bin/env bash
# Smoke-tests a release archive made by scripts/package-release.sh, the way an
# installer would consume it.
#
# By default the server runs without Twitch credentials and the API must answer
# 503, which also proves none were baked in at build time. With
# --with-credentials, TWITCH_CLIENT_ID/SECRET from the environment are passed to
# the server and the API must answer with release JSON.
#
# Usage: scripts/smoke-test-release.sh [--with-credentials] dist/dayone-<version>.tar.gz
set -euo pipefail

with_credentials=false
if [[ "${1:-}" == --with-credentials ]]; then
  with_credentials=true
  shift
fi
archive="${1:?usage: $0 [--with-credentials] <path to dayone-<version>.tar.gz>}"

fail() {
  echo "smoke test failed: $*" >&2
  exit 1
}

if $with_credentials; then
  [[ -n "${TWITCH_CLIENT_ID:-}" && -n "${TWITCH_CLIENT_SECRET:-}" ]] \
    || fail "--with-credentials needs TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET set"
  server_env=(env)
else
  server_env=(env -u TWITCH_CLIENT_ID -u TWITCH_CLIENT_SECRET)
fi

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
grep -q '^MIT License' "$workdir/LICENSE" 2>/dev/null || fail "LICENSE with the MIT text is not at the archive root"

port="${SMOKE_PORT:-3123}"
base="http://127.0.0.1:$port"
log="$workdir/server.log"

(cd "$workdir" && exec "${server_env[@]}" \
  HOST=127.0.0.1 PORT="$port" node server/index.mjs) >"$log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null; wait "$server_pid" 2>/dev/null; rm -rf "$workdir"' EXIT

# Wait for this server to say it is listening, rather than for the port to answer:
# if something else already holds the port, node exits and we must not test that.
ready=false
for _ in $(seq 1 60); do
  kill -0 "$server_pid" 2>/dev/null || { cat "$log" >&2; fail "server exited during startup"; }
  if grep -q "Listening on" "$log"; then
    ready=true
    break
  fi
  sleep 0.5
done
$ready || { cat "$log" >&2; fail "server did not start listening within 30 seconds"; }

# / redirects to the default date range, so follow it to the page itself.
status="$(curl -sL -o "$workdir/page.html" -w '%{http_code}' "$base/")"
[[ "$status" == 200 ]] || { cat "$log" >&2; fail "GET / returned $status, expected 200"; }
grep -q '<title>Day One</title>' "$workdir/page.html" || fail "GET / did not serve the Day One page"

api="$base/api/releases?from=2026-11-01&to=2026-11-30"
status="$(curl -s -o "$workdir/api.json" -w '%{http_code}' "$api")"
if $with_credentials; then
  [[ "$status" == 200 ]] || { cat "$workdir/api.json" >&2; fail "the API returned $status with credentials, expected 200"; }
  node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(r.games)) process.exit(1)' \
    "$workdir/api.json" || fail "the API did not return release JSON"
else
  [[ "$status" == 503 ]] || fail "the API returned $status without credentials, expected 503 (were credentials baked in at build time?)"
  grep -q 'IGDB is not configured' "$workdir/api.json" || fail "the 503 did not say IGDB is not configured"
fi

echo "smoke test passed: $archive"
