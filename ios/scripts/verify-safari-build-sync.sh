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
Usage: verify-safari-build-sync.sh [--source <path>] [--dest <path>]

Verify that the generated WXT Safari bundle matches the committed iOS extension resources.

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
DEST_DIR="$(cd "$(dirname "$DEST_DIR")" && pwd)/$(basename "$DEST_DIR")"

if [[ ! -f "$SOURCE_DIR/manifest.json" ]]; then
  echo "[astra-ios] Missing Safari build output at: $SOURCE_DIR" >&2
  echo "[astra-ios] Run 'pnpm build:safari' first." >&2
  exit 1
fi

if [[ ! -f "$DEST_DIR/manifest.json" ]]; then
  echo "[astra-ios] Missing committed extension resources at: $DEST_DIR" >&2
  echo "[astra-ios] Run 'pnpm ios:sync-extension' or check the iOS resources directory." >&2
  exit 1
fi

if diff -qr --exclude '.DS_Store' --exclude '.gitkeep' "$SOURCE_DIR" "$DEST_DIR" >/dev/null; then
  echo "[astra-ios] Safari build output matches committed extension resources"
  echo "  source: $SOURCE_DIR"
  echo "  dest:   $DEST_DIR"
  exit 0
fi

echo "[astra-ios] Safari build output is out of sync with committed extension resources" >&2
echo "[astra-ios] Run 'pnpm ios:sync-extension' after 'pnpm build:safari' and commit the updated resources." >&2
echo >&2
diff -qr --exclude '.DS_Store' --exclude '.gitkeep' "$SOURCE_DIR" "$DEST_DIR" >&2 || true
exit 1
