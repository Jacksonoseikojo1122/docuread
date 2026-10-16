#!/usr/bin/env sh
# Run: DOCUREAD_KEY=my-secret-key sh examples/curl.sh
URL="${DOCUREAD_URL:-http://localhost:8787}"
curl -s -X POST "$URL/v1/extract" \
  -H "Authorization: Bearer $DOCUREAD_KEY" \
  -F type=certificate \
  -F file=@eval/fixtures/cert-expired.png
echo
curl -s -H "Authorization: Bearer $DOCUREAD_KEY" "$URL/v1/review?status=pending"
echo
