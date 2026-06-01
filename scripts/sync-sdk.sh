#!/usr/bin/env bash
#
# sync-sdk.sh — vendor the @percy/maestro-app SDK's `percy/` directory
# from a specific GitHub release tag.
#
# Why a shell script instead of `npm install`?
# v1.0.0-Beta.0 is currently a GitHub-tag-only release (not yet published
# to npm). Once `@percy/maestro-app` lands on npm, this script will likely
# collapse to `cp -r node_modules/@percy/maestro-app/percy ./flows/percy`.
# Until then, we clone the SDK repo at the pinned tag and copy `percy/`.

set -euo pipefail

SDK_REPO="https://github.com/percy/percy-maestro-app.git"
SDK_TAG="v1.0.0-Beta.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$ROOT_DIR/flows/percy"
TMP_DIR="$(mktemp -d -t percy-maestro-app-sync.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Syncing @percy/maestro-app SDK at tag $SDK_TAG into $DEST_DIR..."

git clone --depth=1 --branch="$SDK_TAG" "$SDK_REPO" "$TMP_DIR/percy-maestro-app" >/dev/null 2>&1

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -R "$TMP_DIR/percy-maestro-app/percy/." "$DEST_DIR/"

echo "Done."
echo "Vendored files under flows/percy/:"
find "$DEST_DIR" -type f | sed "s|$ROOT_DIR/||"
