#!/usr/bin/env bash
# Smoke-tests a release archive made by scripts/package-release.sh, the way an
# installer would consume it.
#
# By default the server runs without Twitch credentials and the API must answer
# 503, which also proves none were baked in at build time. With
# --with-credentials, TWITCH_CLIENT_ID/SECRET from the environment are passed to
# the server and the API must answer with release JSON.
#
# It also checks the license notices: Day One's LICENSE at the archive root, and
# a THIRD_PARTY_LICENSES entry for every package bundled into the server, both
# the ones traced into server/node_modules and the ones inlined into its chunks.
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
[[ "$(head -n 1 "$workdir/LICENSE" 2>/dev/null)" == "MIT License" ]] \
  || fail "LICENSE with the MIT text is not at the archive root"
[[ -f "$workdir/THIRD_PARTY_LICENSES" ]] || fail "THIRD_PARTY_LICENSES is not at the archive root"

# Every package Nitro traced into server/node_modules (at any depth) must have
# an entry, headed by a "<name> <version>" line.
# shellcheck disable=SC2016 # the $ in this JavaScript are not shell expansions
traced="$(node -e '
  const fs = require("fs"), path = require("path");
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const pkgDir = path.join(dir, entry);
      if (entry.startsWith("@")) { walk(pkgDir); continue; }
      if (entry === ".nitro") { walk(pkgDir); continue; }
      const manifest = path.join(pkgDir, "package.json");
      if (fs.existsSync(manifest)) {
        const { name, version } = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (name && version) console.log(`${name} ${version}`);
      }
      walk(path.join(pkgDir, "node_modules"));
    }
  };
  walk(process.argv[1]);
' "$workdir/server/node_modules")"
[[ -n "$traced" ]] || fail "found no packages under server/node_modules"
while IFS= read -r package; do
  grep -Fqx "$package" "$workdir/THIRD_PARTY_LICENSES" \
    || fail "THIRD_PARTY_LICENSES has no entry for $package, which is bundled in server/node_modules"
done <<<"$traced"

# Every package Nitro inlined into the server chunks must have an entry too. The
# chunks' sourcemaps name the node_modules files each chunk was built from.
# shellcheck disable=SC2016 # the $ in this JavaScript are not shell expansions
inlined="$(node -e '
  const fs = require("fs"), path = require("path");
  const [chunks, notices] = process.argv.slice(1);
  const names = new Set();
  for (const file of fs.readdirSync(chunks, { recursive: true })) {
    if (!file.endsWith(".map")) continue;
    for (const source of JSON.parse(fs.readFileSync(path.join(chunks, file), "utf8")).sources ?? []) {
      const at = source.lastIndexOf("node_modules/");
      if (at < 0) continue;
      const segments = source.slice(at + "node_modules/".length).split("/");
      if (segments[0].startsWith(".")) continue; // build-generated code, not a package
      names.add(segments.slice(0, segments[0].startsWith("@") ? 2 : 1).join("/"));
    }
  }
  if (names.size === 0) { console.log("(none found in the sourcemaps)"); process.exit(); }
  const lines = fs.readFileSync(notices, "utf8").split("\n");
  const listed = new Set(lines.filter((_, i) => /^={80}$/.test(lines[i - 1] ?? "")).map(l => l.split(" ")[0]));
  for (const name of names) if (!listed.has(name)) console.log(name);
' "$workdir/server/chunks" "$workdir/THIRD_PARTY_LICENSES")"
[[ -z "$inlined" ]] \
  || fail "THIRD_PARTY_LICENSES has no entry for these packages inlined into server/chunks: ${inlined//$'\n'/, }"

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
