#!/usr/bin/env bash
#
# sync-sdk.sh — vendor the @percy/maestro-app SDK's `percy/` directory
# into flows/percy/ so Maestro's `runFlow:` directives resolve.
#
# @percy/maestro-app is published on npm and pinned in package.json, so this
# just copies its `percy/` directory out of node_modules after `npm install`.
# Run `npm install` first.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/node_modules/@percy/maestro-app/percy"
DEST_DIR="$ROOT_DIR/flows/percy"

if [ ! -d "$SRC_DIR" ]; then
  echo "Error: $SRC_DIR not found. Run 'npm install' first." >&2
  exit 1
fi

echo "Vendoring @percy/maestro-app SDK into $DEST_DIR..."

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -R "$SRC_DIR/." "$DEST_DIR/"

echo "Done."
echo "Vendored files under flows/percy/:"
find "$DEST_DIR" -type f | sed "s|$ROOT_DIR/||"
