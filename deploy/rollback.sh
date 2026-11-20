#!/usr/bin/env bash
# Rollback: vuelve a una versión anterior de las imágenes y recrea los servicios.
#
# Uso:
#   ROLLBACK_BACKEND_IMAGE=... ROLLBACK_FRONTEND_IMAGE=... ./deploy/rollback.sh
#
# Las variables se exportan con prioridad sobre .env.production, así que el
# compose usa las imágenes anteriores sin editar el archivo.
#
# IMPORTANTE (compatibilidad con migraciones):
#   Este rollback revierte el CÓDIGO (imágenes), no el esquema. Las migraciones
#   Alembic son aditivas y forward-only (no se ejecuta `downgrade`). Revertir a
#   una imagen anterior es seguro mientras las migraciones nuevas no hayan
#   renombrado/eliminado columnas que el código anterior sigue usando. Si un
#   rollback exige revertir el esquema, usá `alembic downgrade` y/o restaurá un
#   backup (deploy/restore.sh) antes de recrear los servicios.
set -euo pipefail

BACKEND_IMAGE="${ROLLBACK_BACKEND_IMAGE:?Falta ROLLBACK_BACKEND_IMAGE}"
FRONTEND_IMAGE="${ROLLBACK_FRONTEND_IMAGE:?Falta ROLLBACK_FRONTEND_IMAGE}"
export BACKEND_IMAGE FRONTEND_IMAGE

docker compose --env-file .env.production pull
docker compose --env-file .env.production up -d

echo "Rollback aplicado: $BACKEND_IMAGE / $FRONTEND_IMAGE"
