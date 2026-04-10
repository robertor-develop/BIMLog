#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARTIFACT_DIR="$(dirname "$SCRIPT_DIR")"
INDEX="$ARTIFACT_DIR/dist/public/index.html"

if [ ! -f "$INDEX" ]; then
  echo "FAIL: $INDEX does not exist. Build first."
  exit 1
fi

BAD_REFS=$(grep -oE 'src="/[^/]+/' "$INDEX" | grep -v 'src="/assets/' || true)
BAD_HREFS=$(grep -oE 'href="/[^/]+/' "$INDEX" | grep -v 'href="/assets/' | grep -v 'href="/favicon' | grep -v 'href="/apple' || true)

if [ -n "$BAD_REFS" ] || [ -n "$BAD_HREFS" ]; then
  echo "FAIL: index.html contains asset references with wrong base path."
  echo "Expected: /assets/..."
  echo "Found:"
  [ -n "$BAD_REFS" ] && echo "  $BAD_REFS"
  [ -n "$BAD_HREFS" ] && echo "  $BAD_HREFS"
  echo ""
  echo "Production serves at /. Rebuild with BASE_PATH=/ or unset BASE_PATH."
  exit 1
fi

JS_COUNT=$(grep -c '/assets/.*\.js' "$INDEX" || true)
CSS_COUNT=$(grep -c '/assets/.*\.css' "$INDEX" || true)

if [ "$JS_COUNT" -lt 1 ]; then
  echo "FAIL: No JS asset references found in index.html."
  exit 1
fi

if [ "$CSS_COUNT" -lt 1 ]; then
  echo "FAIL: No CSS asset references found in index.html."
  exit 1
fi

echo "OK: Build verified. $JS_COUNT JS + $CSS_COUNT CSS assets at /assets/..."
