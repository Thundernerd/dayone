#!/usr/bin/env bash
# Builds the Nuxt server and packages it as a release archive:
#
#   dist/dayone-<version>.tar.gz         one top-level dayone-<version>/ directory
#                                        holding the contents of .output
#   dist/dayone-<version>.tar.gz.sha256  its checksum, for `sha256sum -c`
#
# The Nitro output bundles its dependencies and has no native code, so the
# archive runs on any platform with Node: `node server/index.mjs`.
#
# Usage: scripts/package-release.sh <version>   (the tag without the v, e.g. 1.2.3)
set -euo pipefail

version="${1:?usage: $0 <version, e.g. 1.2.3>}"
name="dayone-$version"

cd "$(dirname "$0")/.."

# nuxt.config.ts reads the Twitch credentials at build time, and anything set then
# is baked into the output. The server reads them at runtime instead, so build
# without them.
env -u TWITCH_CLIENT_ID -u TWITCH_CLIENT_SECRET npm run build

rm -rf "dist/$name" "dist/$name.tar.gz" "dist/$name.tar.gz.sha256"
mkdir -p "dist/$name"
cp -R .output/. "dist/$name/"

# COPYFILE_DISABLE keeps macOS tar from adding ._* metadata files.
COPYFILE_DISABLE=1 tar -C dist -czf "dist/$name.tar.gz" "$name"
rm -rf "dist/$name"

(cd dist && sha256sum "$name.tar.gz" > "$name.tar.gz.sha256")

echo "dist/$name.tar.gz"
