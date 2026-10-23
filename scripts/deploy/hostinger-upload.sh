#!/usr/bin/env bash
# Upload a file to a Hostinger website's public_html via TUS 1.0.0.
# Usage: UP_URL=... UP_AUTH=... UP_REST=... scripts/deploy/hostinger-upload.sh <local-file> <remote-name>
# Credentials come from the environment and are never echoed.
set -euo pipefail
FILE="$1"; NAME="$2"
SIZE=$(stat -c%s "$FILE")
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$UP_URL/$NAME?override=true" \
  -H "X-Auth: $UP_AUTH" -H "X-Auth-Rest: $UP_REST" -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Length: $SIZE" -H "Upload-Offset: 0")
echo "create: $code (size $SIZE)"
[ "$code" = "201" ] || exit 1
offset=0
if [ "$SIZE" -gt 0 ]; then
  hdrs=$(curl -s -D - -o /dev/null -X PATCH "$UP_URL/$NAME?override=true" \
    -H "X-Auth: $UP_AUTH" -H "X-Auth-Rest: $UP_REST" -H "Tus-Resumable: 1.0.0" \
    -H "Content-Type: application/offset+octet-stream" -H "Upload-Offset: 0" \
    --data-binary "@$FILE")
  echo "$hdrs" | head -1
  offset=$(echo "$hdrs" | tr -d '\r' | awk -F': ' 'tolower($1)=="upload-offset"{print $2}')
fi
echo "uploaded offset: ${offset:-?} / $SIZE"
[ "${offset:-0}" = "$SIZE" ]
