#!/usr/bin/env bash
set -euo pipefail
PROJECT="${1:-arcard}"
REPO_DIR="${2:-/tmp/cardarc-fix}"
VERCEL_TOKEN_FILE="${VERCEL_TOKEN_FILE:-$HOME/.hermes/secrets/vercel_token}"

cd "$REPO_DIR"
git add -A
git commit -m "fix: listing modal + batch mint + w3m dismiss" >/dev/null 2>&1 || true
git push origin master >/dev/null 2>&1 || true

TOKEN="$(cat "$VERCEL_TOKEN_FILE" | tr -d '\n')"
( cd "$REPO_DIR" && vercel pull --yes --token "$TOKEN" >/dev/null 2>&1 )
NODE_OPTIONS="--max_old_space_size=4096" vercel build --yes --token "$TOKEN" --project "$PROJECT" >/dev/null 2>&1 ||
NODE_OPTIONS="--max_old_space_size=8192" vercel build --yes --token "$TOKEN" --project "$PROJECT" >/dev/null 2>&1
vercel deploy --yes --token "$TOKEN" --project "$PROJECT" --prod >/dev/null 2>&1
echo "DEPLOYED"
