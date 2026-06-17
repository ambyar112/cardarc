#!/bin/bash
# Trigger marketplace seed endpoint
# Usage: ./trigger-seed.sh

VERCEL_URL="https://cardarc.vercel.app"
SEED_SECRET="arccc-seed-2026"

echo "🚀 Triggering marketplace seed endpoint..."
echo "URL: ${VERCEL_URL}/api/seed"
echo ""

curl -X POST "${VERCEL_URL}/api/seed" \
  -H "Authorization: Bearer ${SEED_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s | jq .

echo ""
echo "✅ Request completed"