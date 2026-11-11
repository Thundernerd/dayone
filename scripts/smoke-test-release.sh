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

echo "smoke test passed: $archive"
