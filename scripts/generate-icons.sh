#!/usr/bin/env bash
# Generate PNG icon files from an SVG source for Chrome Web Store submission.
#
# Prerequisites: rsvg-convert (from librsvg)
#   macOS:  brew install librsvg
#   Ubuntu: sudo apt install librsvg2-bin
#
# Usage:
#   bash scripts/generate-icons.sh [source.svg]
#
# If no source SVG is provided, a placeholder SVG is generated automatically.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$PROJECT_ROOT/public"
SIZES=(16 32 48 128)

SOURCE_SVG="${1:-}"

if [ -z "$SOURCE_SVG" ]; then
  SOURCE_SVG="$PROJECT_ROOT/scripts/_placeholder-icon.svg"
  echo "No source SVG provided. Generating placeholder at $SOURCE_SVG ..."
  cat > "$SOURCE_SVG" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#bg)"/>
  <text x="64" y="88" font-family="system-ui, -apple-system, sans-serif"
        font-size="72" font-weight="700" fill="white" text-anchor="middle">A</text>
</svg>
SVGEOF
fi

if ! command -v rsvg-convert &> /dev/null; then
  echo "Error: rsvg-convert not found."
  echo "Install it with:"
  echo "  macOS:  brew install librsvg"
  echo "  Ubuntu: sudo apt install librsvg2-bin"
  echo ""
  echo "Alternatively, use any tool to export the SVG to PNG at these sizes:"
  for size in "${SIZES[@]}"; do
    echo "  icon-${size}.png  (${size}x${size})"
  done
  exit 1
fi

echo "Generating icons from: $SOURCE_SVG"
for size in "${SIZES[@]}"; do
  OUTPUT="$PUBLIC_DIR/icon-${size}.png"
  rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" -o "$OUTPUT"
  echo "  Created $OUTPUT (${size}x${size})"
done

echo "Done. Icon files written to $PUBLIC_DIR/"
