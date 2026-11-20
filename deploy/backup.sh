#!/usr/bin/env bash
# Backup cifrado de la base de datos y de las imágenes subidas.
#
# Variables (ver .env.production.example):
#   BACKUP_DIR          directorio local (por defecto ./backups)
#   BACKUP_KEEP_DAYS    retención local en días (por defecto 14)
#   BACKUP_PASSPHRASE   frase para cifrado simétrico (openssl AES-256)
#   BACKUP_AGE_RECIPIENT  clave pública age (cifrado asimétrico, opcional)
#   BACKUP_RCLONE_REMOTE remoto rclone para copia externa (opcional)
#
# Uso manual:   ./deploy/backup.sh
# Con cron:     0 2 * * * cd /ruta/al/proyecto && ./deploy/backup.sh >> ./backups/backup.log 2>&1
set -euo pipefail

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
REMOTE="${BACKUP_RCLONE_REMOTE:-}"
PASSPHRASE="${BACKUP_PASSPHRASE:-}"
RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"

mkdir -p "$BACKUP_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1) Volcado de la base de datos (consistente, sin bloquear). Usa root porque
#    mysqldump --single-transaction requiere el privilegio PROCESS.
docker compose exec -T db sh -c \
  'exec mysqldump --single-transaction --quick -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  > "$TMP/db.sql"

# 2) Imágenes subidas (volumen de uploads del backend).
docker compose exec -T backend sh -c 'tar czf - -C /app/app/uploads .' \
  > "$TMP/uploads.tar.gz"

# 3) Empaqueta todo.
tar czf "$TMP/backup_${STAMP}.tar.gz" -C "$TMP" db.sql uploads.tar.gz

# 4) Cifra (asimétrico con age si hay receptor; si no, simétrico con openssl).
PLAIN="$TMP/backup_${STAMP}.tar.gz"
if [ -n "$RECIPIENT" ] && command -v age >/dev/null 2>&1; then
  OUT="$BACKUP_DIR/backup_${STAMP}.tar.gz.age"
  age -r "$RECIPIENT" -o "$OUT" "$PLAIN"
else
  : "${PASSPHRASE:?ERROR: definí BACKUP_PASSPHRASE (o BACKUP_AGE_RECIPIENT)}"
  OUT="$BACKUP_DIR/backup_${STAMP}.tar.gz.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass "env:BACKUP_PASSPHRASE" -in "$PLAIN" -out "$OUT"
fi

# 5) Retención local.
find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete

# 6) Copia externa opcional (fuera del VPS).
if [ -n "$REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$OUT" "$REMOTE"
  else
    echo "AVISO: BACKUP_RCLONE_REMOTE definido pero rclone no está instalado" >&2
  fi
fi

echo "Backup completado: $OUT"
