#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:5173}"
TOOL_NAME="${2:-}"
ENDPOINT="${BASE_URL%/}/api/debug/registry"

if [[ -n "$TOOL_NAME" ]]; then
  ENDPOINT+="?name=$(python3 - <<'PY' "$TOOL_NAME"
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
)"
fi

if command -v jq >/dev/null 2>&1; then
  curl --fail --silent --show-error "$ENDPOINT" | jq .
else
  curl --fail --silent --show-error "$ENDPOINT"
  printf '\n'
fi
