#!/usr/bin/env bash
# Construye y publica backend/frontend para linux/amd64 en el registro de imágenes.
#
# Requiere:
#   - Docker con buildx (multi-arch).
#   - Estar autenticado en el registro (docker login) si es privado.
#
# Uso:
#   BACKEND_IMAGE=... FRONTEND_IMAGE=... NEXT_PUBLIC_API_URL=... ./deploy/build-push.sh
set -euo pipefail

BACKEND_IMAGE="${BACKEND_IMAGE:?Falta BACKEND_IMAGE}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:?Falta FRONTEND_IMAGE}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:?Falta NEXT_PUBLIC_API_URL}"
PLATFORM="${PLATFORM:-linux/amd64}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ">> Backend  -> $BACKEND_IMAGE ($PLATFORM)"
docker buildx build \
  --pull \
  --platform "$PLATFORM" \
  --provenance=false \
  -t "$BACKEND_IMAGE" \
  --push \
  "$ROOT/backend"

echo ">> Frontend -> $FRONTEND_IMAGE ($PLATFORM)"
docker buildx build \
  --pull \
  --platform "$PLATFORM" \
  --provenance=false \
  --build-arg "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" \
  --build-arg "INTERNAL_API_URL=http://backend:8000" \
  -t "$FRONTEND_IMAGE" \
  --push \
  "$ROOT/frontend"

echo "Publicadas: $BACKEND_IMAGE y $FRONTEND_IMAGE"
