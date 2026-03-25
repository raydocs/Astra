#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$IOS_DIR/.." && pwd)"

SOURCE_DIR="${ASTRA_SAFARI_BUILD_DIR:-$REPO_ROOT/.output/safari-mv3}"
DEST_DIR="${ASTRA_SAFARI_RESOURCES_DIR:-$IOS_DIR/AstraShell Extension/Resources}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --dest)
      DEST_DIR="$2"
      shift 2
      ;;
    --help|-h)
      cat <<'EOF'
Usage: sync-safari-build.sh [--source <path>] [--dest <path>]

Sync WXT Safari build output into the iOS Safari Web Extension target resources.

Environment overrides:
  ASTRA_SAFARI_BUILD_DIR
  ASTRA_SAFARI_RESOURCES_DIR
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SOURCE_DIR="$(cd "$(dirname "$SOURCE_DIR")" && pwd)/$(basename "$SOURCE_DIR")"
mkdir -p "$(dirname "$DEST_DIR")"
DEST_DIR="$(cd "$(dirname "$DEST_DIR")" && pwd)/$(basename "$DEST_DIR")"

if [[ ! -f "$SOURCE_DIR/manifest.json" ]]; then
  echo "[astra-ios] Missing Safari build output at: $SOURCE_DIR" >&2
  echo "[astra-ios] Run 'pnpm build:safari' first." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
find "$DEST_DIR" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
cp -R "$SOURCE_DIR"/. "$DEST_DIR"/

if [[ ! -f "$DEST_DIR/manifest.json" ]]; then
  echo "[astra-ios] Sync failed: manifest.json was not copied to $DEST_DIR" >&2
  exit 1
fi

echo "[astra-ios] Synced Safari build"
echo "  source: $SOURCE_DIR"
echo "  dest:   $DEST_DIR"
