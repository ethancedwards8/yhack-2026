#!/usr/bin/env bash
set -euo pipefail
IMAGE_NAME=ethancedwards8/hotbills-frontend

# Load .env.local if it exists and no vars are already set
if [[ -f .env ]]; then
  # Export only the NEXT_PUBLIC_ vars we need
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=' .env)
  set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is not set}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is not set}"

IMAGE="${IMAGE_NAME:-yhack-frontend}"
TAG="${IMAGE_TAG:-latest}"

echo "Building $IMAGE:$TAG"

docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t "$IMAGE:$TAG" \
  .

echo "Done: $IMAGE:$TAG"
